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

# CI-only device provisioning (EAS workers ship no Expo Go / no AVD). Committed
# next to this entrypoint; the interactive skill doesn't need them.
CI_SCRIPTS = Path(__file__).resolve().parent
PROVISION = {
    "ios": CI_SCRIPTS / "ci-provision-ios.sh",
    "android": CI_SCRIPTS / "ci-provision-android.sh",
}

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


def log(msg):
    """Progress line to stderr (surfaces in CI logs; flushed immediately)."""
    print(f"[eval-ci] {msg}", file=sys.stderr, flush=True)


def latest_sdk():
    try:
        r = run(["bash", str(LATEST_SDK)], capture_output=True, timeout=120)
        major = r.stdout.strip()
        return major if major.isdigit() else None
    except Exception:
        return None


# --- detect ----------------------------------------------------------------


def git_ref_exists(ref):
    return run(
        ["git", "rev-parse", "--verify", "--quiet", ref], capture_output=True
    ).returncode == 0


def best_effort_fetch():
    """Try to make the base branch available to diff against.

    On a real GitHub-triggered PR, `origin` is the connected repo and `main` is
    fetchable. On a manual `eas workflow:run` from a local checkout, `origin` may
    be an unreachable local path — so every fetch here is best-effort and its
    failure is ignored (never fail the step over it).
    """
    run(["git", "fetch", "--no-tags", "--quiet", "origin",
         "+refs/heads/main:refs/remotes/origin/main"], capture_output=True)
    run(["git", "fetch", "--no-tags", "--quiet", "--deepen", "50"],
        capture_output=True)


def resolve_base(base):
    """First existing ref among the requested base and common fallbacks."""
    for c in (base, "origin/main", "origin/HEAD", "main", "HEAD~1"):
        if c and git_ref_exists(c):
            return c
    return None


def changed_files(base):
    """Files changed relative to a resolved base ref.

    Returns [] (which routes to tier `none`, a safe no-op) when no base ref can
    be resolved — e.g. a shallow checkout with no history and no reachable
    remote.
    """
    ref = resolve_base(base)
    if not ref:
        return []
    # three-dot (since merge base) first, then two-dot, then last commit.
    for args in ([f"{ref}...HEAD"], [ref], ["HEAD~1"]):
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
    # Manual-test override: set EVAL_FORCE_TIER (and EVAL_FORCE_SKILLS for the
    # static tier) to exercise a tier from `eas workflow:run` without needing an
    # actual skill change on the branch.
    forced = os.environ.get("EVAL_FORCE_TIER")
    if forced:
        skills = os.environ.get("EVAL_FORCE_SKILLS", "")
        print(f"[eval-ci] forced tier={forced!r} skills={skills!r}", file=sys.stderr)
        print(f"tier={forced}")
        print(f"skills={skills}")
        return 0

    base = os.environ.get("EVAL_BASE_REF") or args.base
    best_effort_fetch()
    resolved = resolve_base(base)
    files = changed_files(base)
    skills = changed_skills(files)
    tier = decide_tier(skills)
    # Diagnostics on stderr so they don't pollute the tier=/skills= stdout the
    # workflow parses.
    print(f"[eval-ci] base={base!r} resolved={resolved!r} "
          f"changed_files={len(files)} skills={skills}", file=sys.stderr)
    print(f"tier={tier}")
    print(f"skills={','.join(skills)}")
    return 0


# --- Executor (the one model call) -----------------------------------------


def run_executor(prompt, app_path, log_path, tier, plugin_dir=None):
    """Run one `claude -p` executor that edits the fixture in place.

    The executor is the long pole (minutes of a silent app build), so we poll it
    and emit a heartbeat to stderr — otherwise the CI step looks hung. The
    stream-json output goes to log_path for usage parsing.

    Returns (elapsed_seconds, tokens_dict).
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

    timeout = EXECUTOR_TIMEOUT[tier]
    log(f"executor: launching claude -p (timeout {timeout}s"
        f"{', --plugin-dir' if plugin_dir else ''})")
    start = time.time()
    with open(log_path, "w") as logf:
        proc = subprocess.Popen(
            cmd, cwd=app_path, env=clean_env(),
            stdout=logf, stderr=subprocess.STDOUT, text=True,
        )
        next_beat = 60
        while True:
            try:
                proc.wait(timeout=15)
                break
            except subprocess.TimeoutExpired:
                elapsed = time.time() - start
                if elapsed >= timeout:
                    proc.kill()
                    log(f"executor: TIMEOUT after {int(elapsed)}s — killed")
                    break
                if elapsed >= next_beat:
                    log(f"executor: still working ({int(elapsed)}s elapsed)")
                    next_beat += 60
    elapsed = round(time.time() - start, 1)
    toks = parse_tokens(log_path)
    log(f"executor: finished in {elapsed}s "
        f"(output tokens: {toks.get('output_tokens', 0)})")
    return elapsed, toks


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


# Common native modules Expo Go can't load (need a dev build). Not exhaustive —
# Expo Go bundles a fixed module set; these are the usual ones an app-building
# prompt reaches for. When present, skip Expo Go and go straight to a dev build.
EXPO_GO_INCOMPATIBLE = (
    "react-native-maps", "react-native-vision-camera", "react-native-ble-plx",
    "@react-native-firebase/", "react-native-google-mobile-ads",
    "@stripe/stripe-react-native", "react-native-mmkv", "@shopify/react-native-skia",
)


def needs_dev_build(app):
    """Native deps in the app that Expo Go can't run (→ dev build). [] if none."""
    try:
        deps = json.loads((Path(app) / "package.json").read_text()).get("dependencies", {})
    except Exception:
        return []
    return [d for d in deps if any(d == x or d.startswith(x) for x in EXPO_GO_INCOMPATIBLE)]


def count_captured(out_dir, routes):
    captured = 0
    for rt in routes:
        slug = rt["path"].lstrip("/").replace("/", "-").rstrip("-") or "index"
        png = Path(out_dir) / f"{slug}.png"
        if png.is_file() and png.stat().st_size > 1000:
            captured += 1
    return captured


def metro_had_errors(out_dir):
    mlog = Path(out_dir) / "metro.log"
    if not mlog.is_file():
        return None
    text = mlog.read_text(errors="ignore").lower()
    return any(m in text for m in ("unable to resolve", "failed to compile", "bundling failed"))


# --- run: static tier ------------------------------------------------------


def cmd_run_static(args, workspace):
    skills = [s for s in (args.skills or "").split(",") if s]
    if not skills:
        print("no static skills to evaluate", file=sys.stderr)
        return {"tier": "static", "cases": [], "passed": True}

    log("detecting Expo SDK...") if not args.sdk else None
    sdk = args.sdk or latest_sdk()
    log(f"static tier: {len(skills)} skill(s), SDK {sdk or 'latest'}")
    cases = []
    for i, skill in enumerate(skills):
        tag = f"[{i + 1}/{len(skills)}] {skill}"
        app = workspace / f"eval-{i}" / "app"
        app.parent.mkdir(parents=True, exist_ok=True)
        exec_log = workspace / f"eval-{i}" / "executor.log"

        log(f"{tag}: creating fixture")
        mk = run(
            ["bash", str(MAKE_FIXTURE), str(app), *( [sdk] if sdk else [] )],
            capture_output=True,
        )
        if mk.returncode != 0:
            err = ((mk.stdout or "") + (mk.stderr or "")).strip()
            log(f"{tag}: make-fixture FAILED\n{err[-2000:]}")
            cases.append({"skill": skill, "static_passed": False,
                          "error": "fixture creation failed", "log": err[-1000:]})
            continue

        elapsed, tokens = run_executor(
            static_prompt(skill, app), str(app), exec_log, "static"
        )
        log(f"{tag}: running static gate (tsc + lint + export)")
        passed, static_out = run_static(app, "ios,android")
        log(f"{tag}: static gate {'PASS' if passed else 'FAIL'}")
        usage = parse_usage(exec_log)
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

    log("detecting Expo SDK...") if not args.sdk else None
    sdk = args.sdk or latest_sdk()
    log(f"runtime tier ({platform}): SDK {sdk or 'latest'}")
    app = workspace / "eval-0" / "app"
    config_dir = workspace / "eval-0"
    config_dir.mkdir(parents=True, exist_ok=True)
    exec_log = config_dir / "executor.log"
    out_dir = config_dir / "outputs" / platform

    log("creating fixture")
    mk = run(
        ["bash", str(MAKE_FIXTURE), str(app), *( [sdk] if sdk else [] )],
        capture_output=True,
    )
    if mk.returncode != 0:
        err = ((mk.stdout or "") + (mk.stderr or "")).strip()
        log(f"make-fixture FAILED\n{err[-2000:]}")
        return {"tier": "runtime", "platform": platform, "sdk": sdk, "passed": False,
                "cases": [{"name": "hot-chocolate", "static_passed": False,
                           "error": "fixture creation failed", "log": err[-1000:]}]}

    elapsed, tokens = run_executor(
        runtime_prompt(prd_text, app), str(app), exec_log, "runtime", plugin_dir=PLUGIN_DIR
    )
    usage = parse_usage(exec_log)
    log(f"skills used: {usage['skills'] or 'none'} | MCP tools: {usage['mcp_tools'] or 'none'}")
    log(f"running static gate ({platform})")
    passed, static_out = run_static(app, platform)
    log(f"static gate {'PASS' if passed else 'FAIL'}")

    routes, captured, routes_total, runner_used = [], 0, 0, None
    if passed:
        routes = resolve_routes(app, config_dir)
        routes_total = len(routes)
        route_csv = ",".join(r["path"] for r in routes)

        base_env = {**os.environ}
        # A headless x86_64 Linux worker needs software GPU; leave the local
        # macOS default (host) alone (swiftshader hangs on Apple Silicon).
        if platform == "android" and sys.platform.startswith("linux"):
            base_env["EXPO_SKILL_EVAL_GPU"] = "swiftshader_indirect"

        # Provision the device with Expo Go (CI machines ship none). Best-effort:
        # a dev build doesn't need Expo Go, so don't abort if this fails.
        provision = PROVISION.get(platform)
        if provision and provision.is_file():
            log(f"provisioning {platform} device + Expo Go (sdk {sdk or 'latest'})")
            run(["bash", str(provision), str(sdk or "")], env=base_env)

        # Expo Go by default; fall back to a dev build if nothing was captured.
        # If the app declares native modules Expo Go can't load, skip straight to
        # a dev build (Expo Go would just render an error screen).
        runners = ["expo-go", "dev-build"]
        incompatible = needs_dev_build(app)
        if incompatible:
            log(f"native modules not in Expo Go ({', '.join(incompatible)}) — using dev build")
            runners = ["dev-build"]
        for runner in runners:
            log(f"capturing {routes_total} route(s) on {platform} via {runner}")
            run(
                ["bash", str(SNAPSHOT_ROUTES[platform]), str(app), str(out_dir),
                 SNAPSHOT_PORT[platform], route_csv],
                env={**base_env, "EXPO_SKILL_EVAL_RUNNER": runner},
            )
            captured = count_captured(out_dir, routes)
            if captured > 0:
                runner_used = runner
                break
            log(f"{runner}: captured 0/{routes_total}" + (
                " — falling back to dev build" if runner == "expo-go"
                else " — no screenshots"))
        log(f"captured {captured}/{routes_total} route screenshot(s)"
            + (f" via {runner_used}" if runner_used else ""))
    else:
        log("skipping snapshots (static gate failed)")

    case = {
        "name": "hot-chocolate",
        "static_passed": passed,
        "routes_total": routes_total,
        "routes_captured": captured,
        "runner": runner_used,
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
            runner = f" ({c['runner']})" if c.get("runner") else ""
            lines.append(f"- **{c['name']}** — static gate {static}, "
                         f"routes captured {c.get('routes_captured', 0)}/{c.get('routes_total', 0)}{runner}"
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
    # make-fixture commits the pristine fixture; CI workers usually have no git
    # identity configured, which makes `git commit` fatal. Provide one via env
    # (env overrides missing user.name/email config) so it works on any runner.
    os.environ.setdefault("GIT_AUTHOR_NAME", "expo eval-ci")
    os.environ.setdefault("GIT_AUTHOR_EMAIL", "eval-ci@expo.dev")
    os.environ.setdefault("GIT_COMMITTER_NAME", "expo eval-ci")
    os.environ.setdefault("GIT_COMMITTER_EMAIL", "eval-ci@expo.dev")
    if args.mode == "detect":
        return cmd_detect(args)
    return cmd_run(args)


if __name__ == "__main__":
    sys.exit(main())
