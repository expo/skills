"""Check reviewed Firegoat cases for an Expo skills PR from a trusted runner."""
import json
import os
import re
import subprocess
import time
from pathlib import Path

from authoring import authoring_prompt
from changes import changed_skills
from hosted import list_cases, read_run, start_run, validate_case

MARKER = "<!-- expo-firegoat-skill-evals -->"
CONTEXT = "Firegoat skill evals"
AWAITING_TOKEN_APPROVAL = "Awaiting EXPO_TOKEN approval"
COMMENT_LIMIT = 65_536


def github(path, *, method="GET", body=None, fields=None):
    args = ["gh", "api", "--method", method, path]
    for key, value in (fields or {}).items():
        args.extend(["-f", f"{key}={value}"])
    if body is not None:
        args.extend(["--input", "-"])
    result = subprocess.check_output(args, input=json.dumps(body) if body is not None else None, text=True)
    return json.loads(result) if result.strip() else None


def open_pr(repo, run):
    # Fork workflow runs can have an empty pull_requests array.
    source = run["head_repository"]
    pulls = github(f"repos/{repo}/pulls", fields={
        "head": f"{source['owner']['login']}:{run['head_branch']}", "base": "main", "state": "open",
    })
    return next((pr for pr in pulls if pr["head"]["repo"] and
                 pr["head"]["repo"]["id"] == source["id"] and pr["head"]["sha"] == run["head_sha"]), None)


def opted_out(pr):
    return any(label["name"] == "no-eval" for label in pr["labels"])


def publish(repo, number, body):
    pages = subprocess.check_output(["gh", "api", "--paginate", "--slurp",
                                    f"repos/{repo}/issues/{number}/comments?per_page=100"], text=True)
    existing = next((c for page in json.loads(pages) for c in page
                     if c["user"]["login"] == "github-actions[bot]" and c["body"].startswith(MARKER)), None)
    if existing and not body:
        github(f"repos/{repo}/issues/comments/{existing['id']}", method="DELETE")
    elif existing and body != existing["body"]:
        github(f"repos/{repo}/issues/comments/{existing['id']}", method="PATCH", body={"body": body})
    elif not existing and body:
        github(f"repos/{repo}/issues/{number}/comments", method="POST", body={"body": body})


def verdict(run, required):
    status = run["status"]
    if status == "failed":
        return "Run failed"
    if status != "completed":
        return None
    outcome = run.get("outcome")
    if outcome and outcome != "succeeded":
        return {"goal_not_met": "Goal not met", "no_creds": "Credentials unavailable",
                "scoring_failed": "Grading failed", "excluded": "Excluded"}.get(outcome, "Unscored")
    checks = run.get("checks")
    if not checks or not outcome:
        return None  # The report may arrive after the agent finishes.
    if checks.get("skill-activation") != 1:
        return "Skill use unverified"
    if checks.get("end_goal") == 0 or any(checks.get(key) != 1 for key in required):
        return "Task checks failed"
    return "Passed"


def eval_title_cell(title):
    # A code span renders mentions, links, and HTML as literal text in a GitHub comment.
    title = " ".join(title.split()).replace("|", r"\|") or "Untitled eval"
    longest_run = max((len(run) for run in re.findall(r"`+", title)), default=0)
    fence = "`" * (longest_run + 1)
    return f"{fence} {title} {fence}"


def render(pr, rows, missing, actions_url, *, comment=False):
    sha = pr["head"]["sha"]
    sections = [f"{MARKER}\n### Firegoat skill evals\nPR revision `{sha[:12]}`.\n\n"
                "| Skill | Eval | Result |\n| --- | --- | --- |"]
    for row in rows:
        run = row.get("run")
        result = row["result"]
        if run:
            result = f"[{result}]({run.get('report_url') or run['url']})"
            if row.get("failed_checks"):
                result += " (failed " + ", ".join(f"`{key}`" for key in row["failed_checks"]) + ")"
        elif result == "Invalid eval configuration":
            result = f"[{result}]({actions_url})"
        title = eval_title_cell(row["title"]) if "title" in row else "—"
        sections.append(f"\n| `{row['name']}` | {title} | {result} |")
    for skill in missing:
        prompt = authoring_prompt(skill, pr)
        sections.append(f"\n\n<details><summary>Prepare a reviewed eval for {skill['name']}</summary>\n\n"
                        f"Copy this prompt into your coding agent.\n\n````text\n{prompt}\n````\n\n</details>")
    if any(row["result"] == AWAITING_TOKEN_APPROVAL for row in rows):
        skills_url = f"https://github.com/{pr['head']['repo']['full_name']}/tree/{sha}/plugins"
        footer = (f"A repository writer must [review the skills at `{sha}`]({skills_url}), then "
                  f"[rerun this Firegoat job]({actions_url}) to authorize the waiting evals to use `EXPO_TOKEN`.")
    else:
        footer = f"After saving or correcting an eval, [rerun the CI job]({actions_url})."
    body = "".join(sections) + "\n\n" + footer
    if not comment or len(body) <= COMMENT_LIMIT:
        return body

    link = f"\n\n[See all results and copyable prompts in the run summary.]({actions_url})"
    remaining = COMMENT_LIMIT - len(link)
    included = []
    for section in sections:
        if len(section) <= remaining:
            included.append(section)
            remaining -= len(section)
    return "".join(included) + link


def evaluate(repo, pr, actions_url):
    number, sha = pr["number"], pr["head"]["sha"]
    if opted_out(pr):
        publish(repo, number, "")
        return "success", "Skipped by no-eval label"

    # Fetch from the base repository. Read the PR's Git objects without checking
    # them out or executing its code on this runner.
    subprocess.run(["git", "fetch", "--quiet", "--no-tags", "origin",
                    f"refs/pull/{number}/head", pr["base"]["sha"]], check=True)
    if subprocess.check_output(["git", "rev-parse", "FETCH_HEAD"], text=True).strip() != sha:
        return None  # The newer revision has its own check.
    skills = changed_skills(pr["base"]["sha"], sha)
    if not skills:
        publish(repo, number, "")
        return "success", "No installable skills changed"

    api_key = os.environ.get("FIREGOAT_API_KEY")
    if not api_key:
        raise RuntimeError("Configure the repository's FIREGOAT_API_KEY Actions secret.")
    cases = list_cases(api_key)
    rows, missing, pending = [], [], []
    source = f"{pr['head']['repo']['full_name']}/plugins#{sha}"
    rerun = int(os.environ.get("GITHUB_RUN_ATTEMPT", "1")) > 1
    # Only repository writers can rerun this controller. open_pr binds the rerun to its original head SHA.
    token_authorized = rerun or (
        pr["head"]["repo"]["id"] == pr["base"]["repo"]["id"] and pr["user"]["type"] == "User"
    )

    def current():
        latest = github(f"repos/{repo}/pulls/{number}")
        return latest["state"] == "open" and latest["head"]["sha"] == sha and not opted_out(latest)

    def report(*, final):
        body = render(pr, rows, missing, actions_url)
        if final:
            with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as summary:
                print(body, file=summary)
        if len(body) > COMMENT_LIMIT:
            body = render(pr, rows, missing, actions_url, comment=True)
        publish(repo, number, body)

    for skill in skills:
        name = skill["name"]
        prefix = f"[{name}] "
        matched = [case for case in cases if case["title"].startswith(prefix)]
        if not matched:
            missing.append(skill)
            rows.append({"name": name, "result": "Missing eval"})
        for index, case in enumerate(matched, start=1):
            row = {"name": name, "title": case["title"].removeprefix(prefix), "result": "Invalid eval configuration"}
            rows.append(row)
            try:
                row["required"], row["uses_token"] = validate_case(api_key, case["id"], name)
            except ValueError as exc:
                print(f"{name}, eval {index}: {exc}", flush=True)
                if skill not in missing:
                    missing.append(skill)
                continue
            row["id"] = case["id"]
            row["result"] = "Ready"

    if not current():
        return None
    if missing:
        report(final=True)
        return "failure", "Reviewed eval coverage is missing or invalid"

    for row in rows:
        if row["uses_token"] and not token_authorized:
            row["result"] = AWAITING_TOKEN_APPROVAL
            continue
        if not current():
            return None
        row["run"] = start_run(api_key, row["id"], source, rerun=rerun)
        row["result"] = "Queued"
        pending.append(row)
    report(final=False)
    deadline = time.monotonic() + 40 * 60
    while pending and time.monotonic() < deadline:
        if not current():
            return None
        for row in pending.copy():
            run = read_run(api_key, row["run"]["id"])
            if run.get("retried_as"):
                row["run"] = read_run(api_key, run["retried_as"])
                continue
            row["run"] = run
            result = verdict(run, row["required"])
            row["result"] = result or ("Grading" if run["status"] == "completed" else run["status"].capitalize())
            if result is not None:
                row["failed_checks"] = sorted(
                    key for key, score in run.get("checks", {}).items()
                    if score == 0 and (key == "end_goal" or key in row["required"])
                    and re.fullmatch(r"[a-z0-9][a-z0-9_-]{0,63}", key)
                )
                pending.remove(row)
        if pending:
            time.sleep(45)
    for row in pending:
        row["result"] = "CI wait timed out"

    if not current():
        return None
    report(final=True)
    if any(row["result"] == AWAITING_TOKEN_APPROVAL for row in rows):
        return "failure", "Review this revision and rerun to authorize EXPO_TOKEN"
    if any(row["result"] != "Passed" for row in rows):
        return "failure", "Missing or unsuccessful skill evals"
    return "success", "All skill evals passed"


def main():
    repo = os.environ["GITHUB_REPOSITORY"]
    event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text())
    pr = open_pr(repo, event["workflow_run"])
    if not pr:
        return
    actions_url = f"https://github.com/{repo}/actions/runs/{os.environ['GITHUB_RUN_ID']}"

    def status(state, description):
        # workflow_run itself reports on main. Publish the verdict on the PR SHA.
        github(f"repos/{repo}/statuses/{pr['head']['sha']}", method="POST", body={
            "state": state, "context": CONTEXT, "description": description, "target_url": actions_url,
        })

    status("pending", "Checking Firegoat skill coverage")
    try:
        result = evaluate(repo, pr, actions_url)
    except Exception:
        status("error", "Firegoat CI error; see workflow log")
        raise
    if result:
        state, description = result
        status(state, description)
        if state != "success":
            raise SystemExit(description)


if __name__ == "__main__":
    main()
