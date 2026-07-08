#!/usr/bin/env python3
"""Non-interactive CI entrypoint for the Expo eval harnesses.

This is the deterministic replacement for the orchestrating agent. Where the
interactive `expo-skill-eval` / `expo-plugin-eval` skills rely on a human
answering `AskUserQuestion` prompts and Claude hand-writing Python orchestrators,
this script hard-codes the pipeline so it runs unattended on a PR. It reuses the
already-debugged harness scripts (make-fixture / check-static / snapshot-routes /
discover_routes / generate_viewer) verbatim via subprocess.

Two modes:

  detect   Map the PR's changed files to a tier and skill list.
             python3 scripts/eval-ci.py detect --base origin/main
           Prints `tier=<static|runtime|none>` and `skills=<csv>` (one per line)
           so a workflow step can turn them into job outputs.

  run      Run the pipeline for a tier.
             python3 scripts/eval-ci.py run --tier static  --skills eas-hosting
             python3 scripts/eval-ci.py run --tier runtime --platform ios \
                     --prd .claude/skills/expo-plugin-eval/references/hot-chocolate-prd.txt
           Writes <out>/eval-report.md and <out>/eval-summary.json, and prints a
           compact markdown summary to stdout for the PR comment.

The only model call is the executor (`claude -p`) that builds the app inside the
fixture. `ANTHROPIC_API_KEY` must be set for that to authenticate. Grading is
objective (static gate + per-route capture + skill/MCP usage parsed from the
executor's stream-json log) — no LLM grader runs in CI.
"""

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path

# --- Repo layout -----------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent
PLUGIN_DIR = REPO_ROOT / "plugins" / "expo"
SKILLS_DIR = PLUGIN_DIR / "skills"
SKILL_EVAL_SCRIPTS = REPO_ROOT / ".claude" / "skills" / "expo-skill-eval" / "scripts"
PLUGIN_EVAL_SCRIPTS = REPO_ROOT / ".claude" / "skills" / "expo-plugin-eval" / "scripts"

# Shared scripts live in expo-skill-eval/scripts (symlinked into plugin-eval).
MAKE_FIXTURE = SKILL_EVAL_SCRIPTS / "make-fixture.sh"
CHECK_STATIC = SKILL_EVAL_SCRIPTS / "check-static.sh"
LATEST_SDK = SKILL_EVAL_SCRIPTS / "latest-sdk.sh"
DISCOVER_ROUTES = PLUGIN_EVAL_SCRIPTS / "discover_routes.py"
GENERATE_VIEWER = PLUGIN_EVAL_SCRIPTS / "generate_viewer.py"

SNAPSHOT_ROUTES = {
    "ios": PLUGIN_EVAL_SCRIPTS / "snapshot-routes-ios.sh",
    "android": PLUGIN_EVAL_SCRIPTS / "snapshot-routes-android.sh",
}
SNAPSHOT_PORT = {"ios": "8081", "android": "8082"}

# Skills whose output is a renderable app — a change to any of these runs the
# whole-plugin runtime tier (build + screenshot the hot_chocolate app). Every
# other skill with a SKILL.md runs the cheap static tier. Names are the
# directory names under plugins/expo/skills/.
RUNTIME_SKILLS = {
    "expo-app-clip",
    "expo-data-fetching",
    "expo-dev-client",
    "expo-dom",
    "expo-examples",
    "expo-module",
    "expo-native-ui",
    "expo-router",
    "expo-tailwind-setup",
    "expo-ui",
    "expo-web-to-native",
}

# Per-executor timeouts (seconds). Runtime builds a full multi-screen app.
EXECUTOR_TIMEOUT = {"static": 900, "runtime": 1200}


# --- Small helpers ---------------------------------------------------------


def run(cmd, **kwargs):
    """Run a command, returning CompletedProcess. Never raises on non-zero."""
    kwargs.setdefault("cwd", str(REPO_ROOT))
    kwargs.setdefault("text", True)
    return subprocess.run(cmd, **kwargs)


def clean_env():
    """Env for `claude -p`: strip CLAUDECODE so it doesn't hang when nested."""
    return {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}


def latest_sdk():
    try:
        r = run(["bash", str(LATEST_SDK)], capture_output=True, timeout=120)
        major = r.stdout.strip()
        return major if major.isdigit() else None
    except Exception:
        return None


# --- detect ----------------------------------------------------------------


def changed_files(base):
    """Files changed relative to `base` (three-dot: since the merge base)."""
    for args in ([f"{base}...HEAD"], [base], ["HEAD~1"]):
        r = run(["git", "diff", "--name-only", *args], capture_output=True)
        if r.returncode == 0:
            return [ln.strip() for ln in r.stdout.splitlines() if ln.strip()]
    return []


def changed_skills(files):
    """Skill directory names touched by the changed files, in stable order."""
    seen = []
    for f in files:
        m = re.match(r"plugins/expo/skills/([^/]+)/", f)
        if not m:
            continue
        name = m.group(1)
        # Only skills with a SKILL.md are evaluable (skips stray dirs like the
        # scripts-only expo-cicd-workflows folder).
        if name not in seen and (SKILLS_DIR / name / "SKILL.md").is_file():
            seen.append(name)
    return seen


def decide_tier(skills):
    if any(s in RUNTIME_SKILLS for s in skills):
        return "runtime"
    if skills:
        return "static"
    return "none"


def cmd_detect(args):
    files = changed_files(args.base)
    skills = changed_skills(files)
    tier = decide_tier(skills)
    print(f"tier={tier}")
    print(f"skills={','.join(skills)}")
    return 0


# --- Executor (the one model call) -----------------------------------------


def run_executor(prompt, app_path, log_path, tier, plugin_dir=None):
    """Run one `claude -p` executor that edits the fixture in place.

    Returns (elapsed_seconds, tokens_dict). The stream-json output is written to
    log_path for usage parsing.
    """
    cmd = [
        "claude",
        "-p",
        prompt,
        "--dangerously-skip-permissions",
        "--output-format=stream-json",
        "--verbose",
        "--include-partial-messages",
    ]
    if plugin_dir:
        cmd += ["--plugin-dir", str(plugin_dir)]

    start = time.time()
    with open(log_path, "w") as log:
        try:
            subprocess.run(
                cmd,
                cwd=app_path,
                env=clean_env(),
                stdout=log,
                stderr=subprocess.STDOUT,
                text=True,
                timeout=EXECUTOR_TIMEOUT[tier],
            )
        except subprocess.TimeoutExpired:
            log.write("\n[eval-ci] executor timed out\n")
    elapsed = round(time.time() - start, 1)
    return elapsed, parse_tokens(log_path)


def _stream_events(log_path):
    """Yield parsed JSON events from a stream-json log, skipping junk lines."""
    try:
        with open(log_path) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    yield json.loads(line)
                except json.JSONDecodeError:
                    continue
    except FileNotFoundError:
        return


def parse_tokens(log_path):
    """Read final token usage from the stream-json log.

    The `claude` CLI emits a terminal `result` event carrying the run's
    cumulative `usage`; prefer it and fall back to the last `assistant`
    message's usage if the run was cut off before the result event.
    """
    result_usage = None
    last_assistant = None
    for ev in _stream_events(log_path):
        t = ev.get("type")
        if t == "result" and isinstance(ev.get("usage"), dict):
            result_usage = ev["usage"]
        elif t == "assistant":
            u = ev.get("message", {}).get("usage")
            if isinstance(u, dict):
                last_assistant = u
    u = result_usage or last_assistant or {}
    return {
        "input_tokens": u.get("input_tokens", 0) or 0,
        "output_tokens": u.get("output_tokens", 0) or 0,
        "cache_read_input_tokens": u.get("cache_read_input_tokens", 0) or 0,
        "cache_creation_input_tokens": u.get("cache_creation_input_tokens", 0) or 0,
    }


def parse_usage(log_path):
    """Parse skill and MCP-tool usage from the executor's stream-json log.

    Tool uses appear as blocks inside `type=="assistant"` envelope events (NOT
    as top-level tool_use lines). A skill counts as used when the `Skill` tool is
    invoked OR a plugins/expo/skills/<name>/... file is Read.
    """
    skills = []
    mcp_tools = []
    mcp_available = None
    skill_path_re = re.compile(r"plugins/expo/skills/([^/]+)/")

    for ev in _stream_events(log_path):
        etype = ev.get("type")
        # The init/system event lists MCP servers as {name, status}. A fresh
        # `pending` is indeterminate (the remote Expo MCP may still be
        # authenticating), so only decide on an explicit connected/error state;
        # a real mcp__ tool call below is the strongest signal and wins.
        if etype == "system":
            for s in ev.get("mcp_servers") or []:
                name = (s.get("name") or "").lower()
                status = (s.get("status") or "").lower()
                if "expo" not in name:
                    continue
                if status in ("connected", "ok", "ready", "running"):
                    mcp_available = True
                elif status in ("error", "failed", "unavailable"):
                    mcp_available = False
        if etype != "assistant":
            continue
        for block in ev.get("message", {}).get("content", []) or []:
            if block.get("type") != "tool_use":
                continue
            name = block.get("name", "")
            inp = block.get("input", {}) or {}
            if name == "Skill":
                sk = inp.get("skill") or inp.get("name") or ""
                sk = sk.split(":")[-1]  # expo:expo-ui -> expo-ui
                if sk and sk not in skills:
                    skills.append(sk)
            elif name == "Read":
                m = skill_path_re.search(str(inp.get("file_path", "")))
                if m and m.group(1) not in skills:
                    skills.append(m.group(1))
            elif name.startswith("mcp__"):
                if name not in mcp_tools:
                    mcp_tools.append(name)
                mcp_available = True
    return {"skills": skills, "mcp_tools": mcp_tools, "mcp_available": mcp_available}


# --- Static gate -----------------------------------------------------------


def run_static(app_path, platforms_csv):
    """Run check-static.sh. Pass = `[PASS] export` present in the output."""
    r = run(
        ["bash", str(CHECK_STATIC), str(app_path), platforms_csv],
        capture_output=True,
    )
    output = (r.stdout or "") + (r.stderr or "")
    return "[PASS] export" in output, output


# --- Prompts ---------------------------------------------------------------


def static_prompt(skill_name, app_path):
    skill_md = SKILLS_DIR / skill_name / "SKILL.md"
    return (
        f"You are exercising the Expo skill `{skill_name}` inside an existing, "
        f"blank Expo app to verify its guidance produces working code.\n\n"
        f"1. Read the skill instructions at `{skill_md}` with your Read tool and "
        f"follow them.\n"
        f"2. Build a minimal but complete, working example in this app that "
        f"demonstrates the skill's primary capability. Keep it small but real — "
        f"it must typecheck and bundle.\n\n"
        f"Make all changes inside `{app_path}`. The project already exists with "
        f"dependencies installed; use absolute paths. Before writing files, "
        f"inspect the layout (`ls`, read package.json/app.json) to find the "
        f"routes dir (recent SDK templates use `src/app/`, older ones `app/`). "
        f"Do NOT start the dev server, boot simulators, or take screenshots — "
        f"the harness does that."
    )


def runtime_prompt(prd_text, app_path):
    return (
        "Build a complete, working Expo app that satisfies the following product "
        "requirements. Use the plugin's skills where they help.\n\n"
        "=== PRODUCT REQUIREMENTS ===\n"
        f"{prd_text}\n"
        "=== END REQUIREMENTS ===\n\n"
        f"Make all changes inside `{app_path}`. The project already exists with "
        "dependencies installed; use absolute paths. Before writing files, "
        "inspect the layout (`ls`, read package.json/app.json) to find the routes "
        "dir (recent SDK templates use `src/app/`, older ones `app/`).\n\n"
        "When done, write `" + str(app_path) + "/routes.json`: a JSON array of "
        'every navigable screen as {"path": "/deep/link", "label": "Human name"}. '
        "Use real sample values for dynamic segments (e.g. /flavour/1, not "
        "/flavour/[id]). List / first. This drives per-screen screenshots.\n\n"
        "Do NOT start the dev server, boot simulators, or take screenshots — the "
        "harness does that."
    )


# --- Route resolution ------------------------------------------------------


def resolve_routes(app_path, config_dir, prd_routes=None):
    """Executor routes.json > discover_routes.py > prd hint > ['/']. / first."""
    routes = None
    manifest = Path(app_path) / "routes.json"
    if manifest.is_file():
        try:
            routes = json.loads(manifest.read_text())
        except Exception:
            routes = None
    if not routes:
        r = run(
            ["python3", str(DISCOVER_ROUTES), str(app_path)], capture_output=True
        )
        if r.returncode == 0 and r.stdout.strip():
            try:
                routes = json.loads(r.stdout)
            except Exception:
                routes = None
    if not routes:
        routes = prd_routes or [{"path": "/", "label": "Home"}]

    # Normalize, ensure "/" first, de-dup by path.
    norm, seen = [], set()
    for rt in routes:
        p = rt.get("path", "/") if isinstance(rt, dict) else str(rt)
        if p in seen:
            continue
        seen.add(p)
        norm.append({"path": p, "label": (rt.get("label") if isinstance(rt, dict) else p) or p})
    norm.sort(key=lambda r: (r["path"] != "/", r["path"]))

    # The viewer reads the resolved list from the config dir.
    (Path(config_dir) / "routes.json").write_text(json.dumps(norm, indent=2))
    return norm


def count_captured(out_dir, routes):
    captured = 0
    for rt in routes:
        slug = rt["path"].lstrip("/").replace("/", "-").rstrip("-") or "index"
        png = Path(out_dir) / f"{slug}.png"
        if png.is_file() and png.stat().st_size > 1000:
            captured += 1
    return captured


def metro_had_errors(out_dir):
    log = Path(out_dir) / "metro.log"
    if not log.is_file():
        return None
    text = log.read_text(errors="ignore").lower()
    return any(m in text for m in ("unable to resolve", "failed to compile", "bundling failed"))


# --- run: static tier ------------------------------------------------------


def cmd_run_static(args, workspace):
    skills = [s for s in (args.skills or "").split(",") if s]
    if not skills:
        print("no static skills to evaluate", file=sys.stderr)
        return {"tier": "static", "cases": [], "passed": True}

    sdk = args.sdk or latest_sdk()
    cases = []
    for i, skill in enumerate(skills):
        app = workspace / f"eval-{i}" / "app"
        app.parent.mkdir(parents=True, exist_ok=True)
        log = workspace / f"eval-{i}" / "executor.log"

        mk = run(
            ["bash", str(MAKE_FIXTURE), str(app), *( [sdk] if sdk else [] )],
            capture_output=True,
        )
        if mk.returncode != 0:
            cases.append({"skill": skill, "static_passed": False,
                          "error": "fixture creation failed", "log": mk.stderr[-500:]})
            continue

        elapsed, tokens = run_executor(
            static_prompt(skill, app), str(app), log, "static"
        )
        passed, static_out = run_static(app, "ios,android")
        usage = parse_usage(log)
        cases.append({
            "skill": skill,
            "static_passed": passed,
            "executor_seconds": elapsed,
            "tokens": tokens,
            "skills_used": usage["skills"],
            "static_tail": static_out.strip().splitlines()[-8:],
        })

    return {"tier": "static", "sdk": sdk, "cases": cases,
            "passed": all(c["static_passed"] for c in cases)}


# --- run: runtime tier -----------------------------------------------------


def cmd_run_runtime(args, workspace):
    platform = args.platform
    if platform not in SNAPSHOT_ROUTES:
        print(f"--platform must be ios or android, got {platform!r}", file=sys.stderr)
        return {"tier": "runtime", "platform": platform, "cases": [], "passed": False}

    prd_path = Path(args.prd).resolve()
    if not prd_path.is_file():
        print(f"PRD not found: {prd_path}", file=sys.stderr)
        return {"tier": "runtime", "platform": platform, "cases": [], "passed": False}
    prd_text = prd_path.read_text()

    sdk = args.sdk or latest_sdk()
    app = workspace / "eval-0" / "app"
    config_dir = workspace / "eval-0"
    config_dir.mkdir(parents=True, exist_ok=True)
    log = config_dir / "executor.log"
    out_dir = config_dir / "outputs" / platform

    mk = run(
        ["bash", str(MAKE_FIXTURE), str(app), *( [sdk] if sdk else [] )],
        capture_output=True,
    )
    if mk.returncode != 0:
        return {"tier": "runtime", "platform": platform, "sdk": sdk, "passed": False,
                "cases": [{"name": "hot-chocolate", "static_passed": False,
                           "error": "fixture creation failed"}]}

    elapsed, tokens = run_executor(
        runtime_prompt(prd_text, app), str(app), log, "runtime", plugin_dir=PLUGIN_DIR
    )
    usage = parse_usage(log)
    passed, static_out = run_static(app, platform)

    routes, captured, routes_total = [], 0, 0
    if passed:
        routes = resolve_routes(app, config_dir)
        routes_total = len(routes)
        route_csv = ",".join(r["path"] for r in routes)
        env = {**os.environ, "EXPO_SKILL_EVAL_RUNNER": "expo-go"}
        run(
            ["bash", str(SNAPSHOT_ROUTES[platform]), str(app), str(out_dir),
             SNAPSHOT_PORT[platform], route_csv],
            env=env,
        )
        captured = count_captured(out_dir, routes)

    case = {
        "name": "hot-chocolate",
        "static_passed": passed,
        "routes_total": routes_total,
        "routes_captured": captured,
        "metro_errors": metro_had_errors(out_dir),
        "executor_seconds": elapsed,
        "tokens": tokens,
        "skills_used": usage["skills"],
        "mcp_tools": usage["mcp_tools"],
        "mcp_available": usage["mcp_available"],
        "static_tail": static_out.strip().splitlines()[-8:],
    }
    # Pass = it built (static) and at least the root screen was captured.
    ok = passed and captured >= 1
    return {"tier": "runtime", "platform": platform, "sdk": sdk,
            "cases": [case], "passed": ok}


# --- Reporting -------------------------------------------------------------


def render_report(summary):
    tier = summary["tier"]
    lines = []
    if tier == "static":
        head = "✅ pass" if summary["passed"] else "❌ fail"
        lines.append(f"**Expo skill eval — static gate** · {head}")
        lines.append("")
        lines.append("| Skill | tsc + lint + export | Skills read | Exec (s) |")
        lines.append("|---|---|---|---|")
        for c in summary["cases"]:
            status = "✅" if c.get("static_passed") else "❌"
            used = ", ".join(c.get("skills_used") or []) or "—"
            lines.append(f"| `{c['skill']}` | {status} | {used} | {c.get('executor_seconds','—')} |")
    else:
        plat = summary.get("platform", "?")
        head = "✅ pass" if summary["passed"] else "❌ fail"
        lines.append(f"**Expo plugin eval — runtime ({plat})** · {head}")
        lines.append("")
        for c in summary["cases"]:
            static = "✅" if c.get("static_passed") else "❌"
            lines.append(f"- **{c['name']}** — static gate {static}, "
                         f"routes captured {c.get('routes_captured', 0)}/{c.get('routes_total', 0)}"
                         f"{' ⚠️ metro errors' if c.get('metro_errors') else ''}")
            skills = ", ".join(c.get("skills_used") or []) or "none"
            mcp = c.get("mcp_tools") or []
            avail = c.get("mcp_available")
            mcp_str = (", ".join(mcp) if mcp else "none") + (
                "" if avail is None else f" (MCP {'reachable' if avail else 'unreachable'})")
            lines.append(f"  - skills used: {skills}")
            lines.append(f"  - MCP tools: {mcp_str}")
            lines.append(f"  - executor: {c.get('executor_seconds','—')}s")
    out_tokens = sum((c.get("tokens") or {}).get("output_tokens", 0) for c in summary["cases"])
    lines.append("")
    lines.append(
        f"<sub>SDK {summary.get('sdk') or 'latest'} · {out_tokens:,} output tokens · "
        f"non-interactive CI eval · advisory, does not block merge</sub>")
    return "\n".join(lines)


def cmd_run(args):
    tier = args.tier
    prefix = "expo-plugin-eval-ci" if tier == "runtime" else "expo-skill-eval-ci"
    out_root = Path(args.out).resolve() if args.out else Path(
        tempfile.mkdtemp(prefix=f"{prefix}-"))
    workspace = out_root / "iteration-1"
    workspace.mkdir(parents=True, exist_ok=True)

    if tier == "static":
        summary = cmd_run_static(args, workspace)
    elif tier == "runtime":
        summary = cmd_run_runtime(args, workspace)
    else:
        print(f"unknown tier {tier!r}", file=sys.stderr)
        return 2

    summary["workspace"] = str(out_root)
    (out_root / "eval-summary.json").write_text(json.dumps(summary, indent=2))
    report = render_report(summary)
    (out_root / "eval-report.md").write_text(report)

    # Best-effort viewer for the runtime tier (nice as an artifact).
    if tier == "runtime":
        run(["python3", str(GENERATE_VIEWER), str(out_root)], capture_output=True)

    print(report)
    print(f"\n[eval-ci] summary: {out_root}/eval-summary.json", file=sys.stderr)
    return 0


# --- CLI -------------------------------------------------------------------


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    sub = ap.add_subparsers(dest="mode", required=True)

    d = sub.add_parser("detect", help="map changed files to a tier + skills")
    d.add_argument("--base", default="origin/main", help="base ref to diff against")

    r = sub.add_parser("run", help="run the eval pipeline for a tier")
    r.add_argument("--tier", required=True, choices=["static", "runtime"])
    r.add_argument("--skills", default="", help="csv of skills (static tier)")
    r.add_argument("--platform", default="ios", help="ios|android (runtime tier)")
    r.add_argument("--prd", default=str(
        REPO_ROOT / ".claude/skills/expo-plugin-eval/references/hot-chocolate-prd.txt"))
    r.add_argument("--sdk", default="", help="Expo SDK major (default: latest)")
    r.add_argument("--out", default="", help="output dir (default: a temp dir)")

    args = ap.parse_args()
    if args.mode == "detect":
        return cmd_detect(args)
    return cmd_run(args)


if __name__ == "__main__":
    sys.exit(main())
