"""Discover reviewed Firegoat cases, request their runs, and read the results."""

import hashlib
import http.client
import json
import re
import time
from urllib.parse import urlencode
from uuid import UUID


CI_TAG = "expo-skills-ci"
PAGE_SIZE = 100
RUNNER = {"harness": "claude-code", "model": "claude-sonnet-4-6"}
SOURCE_TEMPLATE = "{{skill_owner}}/{{skill_repo}}/plugins#{{skill_sha}}"
SOURCE_PATTERN = re.compile(
    r"(?P<skill_owner>[A-Za-z0-9][A-Za-z0-9_-]*)/(?P<skill_repo>[A-Za-z0-9_.-]+)"
    r"/plugins#(?P<skill_sha>[a-f0-9]{40})"
)


class FiregoatError(RuntimeError):
    def __init__(self, message, status=None):
        super().__init__(message)
        self.status = status


def _request(api_key, method, path, payload=None):
    headers = {"Authorization": f"Bearer {api_key}", "Accept": "application/json"}
    body = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(payload).encode()
    for attempt in range(3):
        # A fixed HTTPS origin also prevents redirects from forwarding the bearer token.
        connection = http.client.HTTPSConnection("firegoat.ai", timeout=30)
        try:
            connection.request(method, "/evals/api/v1" + path, body=body, headers=headers)
            response = connection.getresponse()
            data = response.read()
            if 200 <= response.status < 300:
                return json.loads(data)
            error = FiregoatError(f"Firegoat {method} {path} returned HTTP {response.status}", response.status)
            if response.status != 429 and response.status < 500:
                raise error
        except (OSError, http.client.HTTPException) as exc:
            error = FiregoatError(f"Firegoat {method} {path} failed: {exc}")
        finally:
            connection.close()
        if method != "GET" or attempt == 2:
            raise error
        time.sleep(2 ** attempt)


def _uuid(value):
    if not isinstance(value, str) or str(UUID(value)) != value:
        raise ValueError("Expected a Firegoat resource UUID")
    return value


def _summary(run):
    run_id = _uuid(run["runId"])
    url = run["runUrl"]
    if not re.fullmatch(r"https://firegoat\.ai/evals/[A-Za-z0-9.-]+/runs/" + re.escape(run_id), url):
        raise ValueError("Firegoat returned an invalid dashboard URL")
    if run["status"] not in ("pending", "running", "completed", "failed"):
        raise ValueError("Firegoat returned an unrecognized run status")
    return {"id": run_id, "url": url, "status": run["status"]}


def read_run(api_key, run_id):
    run = _request(api_key, "GET", f"/runs/{_uuid(run_id)}")
    result = _summary(run)
    report = run.get("report") or {}
    slug = run.get("reportSlug") or report.get("slug")
    report_url = None
    if slug:
        if not re.fullmatch(r"[A-Za-z0-9_-][A-Za-z0-9_.-]*", slug):
            raise ValueError("Firegoat returned an invalid report slug")
        report_url = result["url"].rsplit("/runs/", 1)[0] + "/reports/" + slug
        if result["status"] == "completed" and not report.get("reward"):
            try:
                report = _request(api_key, "GET", f"/reports/{slug}")
            except FiregoatError as exc:
                if exc.status != 404:
                    raise
    checks = (report.get("reward") or {}).get("checklist") or {}
    if not isinstance(checks, dict) or any(
        type(value) is not int or value not in (0, 1) for value in checks.values()
    ):
        raise ValueError("Firegoat returned a malformed verifier checklist")
    retry = run.get("retriedAs")
    return {
        **result,
        "outcome": report.get("outcome") or run.get("outcome"),
        "report_url": report_url,
        "checks": checks,
        "retried_as": _uuid(retry) if retry else None,
        "failure_reason": run.get("failureReason") or run.get("skipReason") or report.get("nullNotice"),
    }


def _pages(api_key, path, **params):
    offset = 0
    while True:
        query = urlencode({**params, "limit": PAGE_SIZE, "offset": offset})
        page = _request(api_key, "GET", f"{path}?{query}")
        yield from page
        if len(page) < PAGE_SIZE:
            return
        offset += len(page)


def list_cases(api_key):
    return [
        case for case in _pages(api_key, "/prompts", tags=CI_TAG, status="active")
        if case["status"] == "active" and isinstance(case.get("tags"), list) and CI_TAG in case["tags"]
    ]


def skill_tag(skill):
    if len(skill) <= 24 and skill != CI_TAG:
        return skill
    return skill[:11] + "-" + hashlib.sha256(skill.encode()).hexdigest()[:12]


def setup_command(skill):
    """Install the PR's published skills for all agents and verify the target."""
    if len(skill) > 64 or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", skill):
        raise ValueError("Expected a skill directory name")
    return "\n".join([
        "set -eu",
        "cd /app",
        f"npx --yes skills@1.9.0 add '{SOURCE_TEMPLATE}' --all --copy",
        f"test -s '.agents/skills/{skill}/SKILL.md'",
        f"test -s '.claude/skills/{skill}/SKILL.md'",
    ])


def _case_uses_expo_token(case):
    mode = case.get("envMode")
    env = case.get("env")
    credentials = case.get("envCredentials")
    if mode == "none" and env == [] and credentials == []:
        return False
    if mode == "set" and env == ["EXPO_TOKEN"] and isinstance(credentials, list) and len(credentials) == 1:
        ref = credentials[0]
        if isinstance(ref, dict) and ref.get("key") == "EXPO_TOKEN" and ref.get("credentialName") == "EXPO_TOKEN":
            _uuid(ref.get("credentialId"))
            return True
    raise ValueError("Use an empty environment or bind only EXPO_TOKEN to the saved EXPO_TOKEN credential")


def validate_case(api_key, case_id, skills):
    case = _request(api_key, "GET", f"/prompts/{_uuid(case_id)}")
    tags = case.get("tags")
    if case.get("status") != "active" or not isinstance(tags, list) or CI_TAG not in tags:
        raise ValueError(f"Expected an active Firegoat prompt tagged {CI_TAG}")
    for field in ("text", "endGoal"):
        if not isinstance(case.get(field), str) or not case[field].strip():
            raise ValueError(f"The Firegoat case needs a nonempty {field}")
    setup = (case.get("setupCommand") or "").replace("\r\n", "\n")
    for skill in skills:
        if skill_tag(skill) not in tags:
            raise ValueError(f"Expected the Firegoat prompt to have the {skill_tag(skill)} tag")
        if f"\n{setup_command(skill)}\n" not in f"\n{setup}\n":
            raise ValueError(f"The case setup must include the reviewed PR installation block for {skill}")
    # Firegoat reports an empty list for variables used only in setupCommand.
    variables = set(re.findall(r"\{\{\s*([a-zA-Z_][\w.-]*)\s*\}\}", case["text"] + "\n" + setup))
    expected = set(SOURCE_PATTERN.groupindex)
    declared = case.get("templateVars")
    declares_source = isinstance(declared, list) and len(declared) == len(expected) and all(key in declared for key in expected)
    if variables != expected or (declared != [] and not declares_source):
        raise ValueError("The case must use exactly these Firegoat variables: skill_owner, skill_repo, skill_sha")
    checks = case.get("checks") or {}
    criteria = {key for key, value in checks.items() if value is not None}
    if any(not isinstance(checks[key], str) or not checks[key].strip() for key in criteria):
        raise ValueError("Each enabled Firegoat check needs a nonempty criterion")
    if "skill-activation" not in criteria or not any(key.startswith("task-") and len(key) > 5 for key in criteria):
        raise ValueError("The case needs a skill-activation check and at least one task- outcome check")
    if (
        case.get("loginHintsStatus") != "none" or case.get("loginHints")
        or case.get("inheritedLoginHints") is not None
        or "loginHintsCredential" not in case or case["loginHintsCredential"] is not None
    ):
        raise ValueError("Disable Firegoat persona instructions and remove their credential from the case")
    if case.get("hasSecrets") or case.get("loginHintsHasSecrets"):
        raise ValueError("Firegoat detected a secret in the case")
    return criteria, _case_uses_expo_token(case)


def start_run(api_key, case_id, source, *, rerun=False):
    """Call after validate_case. Only an explicit rerun starts another run for the same source."""
    case_id = _uuid(case_id)
    match = SOURCE_PATTERN.fullmatch(source)
    if not match or match["skill_repo"] in (".", ".."):
        raise ValueError("Expected a GitHub owner/repo/plugins#full-commit-sha")
    # The setup runner accepts individual path components but rejects slash and hash in argument values.
    args = match.groupdict()
    for run in _pages(api_key, "/runs", promptId=case_id):
        if run.get("harness") != RUNNER["harness"] or run.get("model") != RUNNER["model"]:
            continue
        if run.get("templateArgs") == args and (not rerun or run["status"] in ("pending", "running")):
            return _summary(run)
    request = {"templateArgs": args, "harnessModel": RUNNER}
    # The API enqueues a pending run. Its POST response carries the run ID and
    # dashboard link, with no status field. Never replay an ambiguous POST.
    created = _request(api_key, "POST", f"/prompts/{case_id}/run", request)
    return _summary({**created, "status": "pending"})
