---
name: expo-plugin-eval
description: Evaluate the whole Expo plugin (all skills + the Expo MCP) end-to-end by having it build a complete multi-screen app from a prompt or a target screenshot, then deep-linking to every Expo Router route and screenshotting each on iOS/Android/web via Expo Go or a dev build. Reports which skills and MCP tools the plugin actually used. Use when the user wants to eval the Expo plugin as a whole, benchmark the plugin's app-building quality, test that the plugin produces a working multi-screen app, or compare apps built with vs without the plugin.
version: 1.0.0
license: MIT
allowed-tools: "Read(~/.cache/expo-skill-eval/**), Read(/tmp/expo-plugin-eval-*/**), Read(/private/tmp/expo-plugin-eval-*/**), Write(/tmp/expo-plugin-eval-*/**), Write(/private/tmp/expo-plugin-eval-*/**), Edit(/tmp/expo-plugin-eval-*/**), Edit(/private/tmp/expo-plugin-eval-*/**), Bash(python3 /tmp/expo-plugin-eval-*), Bash(python3 /private/tmp/expo-plugin-eval-*), Bash(python3 *expo-plugin-eval/scripts/*), Bash(tee /tmp/expo-plugin-eval-*), Bash(tee /private/tmp/expo-plugin-eval-*), Bash(bash *expo-plugin-eval/scripts/*)"
---

# Expo Plugin Eval

Evaluates the **whole `expo` plugin** — all skills auto-triggering by description **plus the Expo MCP server** — by giving it a full-app prompt (or a target screenshot to reproduce), letting it build a complete app, then **deep-linking to every Expo Router route and screenshotting each one** on the chosen platforms. It also **reports which skills and MCP tools the plugin used** while building. This is the plugin-level companion to `expo-skill-eval` (which evaluates one skill at a time); it reuses that skill's debugged fixture/static/clean scripts via symlinks.

Requirements: macOS with Xcode (iOS simulators), Android SDK with at least one AVD, and `bun`. No other device tooling is assumed.

Workspace root: `/private/tmp/expo-plugin-eval-<run-name>/iteration-N/` (e.g. `/private/tmp/expo-plugin-eval-recipe-app/iteration-1/`).

## Before starting — clarify scope

**Confirm all of the following up front, before any pipeline work — don't skip any** (only skip a given item if the request already states that choice). Batch them into `AskUserQuestion` calls of ≤4 questions each, in this order:

1. **Prompts** — which app(s) to build. Built-in example apps (from `references/example-apps.md`) are **pre-selected**; drop any, add a custom typed prompt, or **build from an uploaded screenshot** (a target UI to reproduce). See **Prompts** below.
2. **Baseline** — **A/B vs a no-plugin baseline (recommended default)** or plugin-only. See **Configs** below.
3. **Skill loading** — **force-invoke a preset (recommended; Dev/UI)** or routing-style (interactive simulation). Recommend by intent — see **Force-invoking skills** below.
4. **Expo SDK** — latest (default, auto-detected) or a pinned version.
5. **Runner** — Expo Go (default) or development build.
6. **Platforms** — iOS / Android / web (always offer all three).
7. **Permission flag** for `claude -p` — skip-permissions (default) or accept-edits.
8. **Viewer delivery** — local only (default) or publish a shareable Artifact.

Items 4–6 (SDK, runner, platforms) fit naturally in one `AskUserQuestion` call. **You no longer ask the user to disable the published `expo` plugin** — the fixture handles it (see the next paragraph); it's documentation + a post-run check, not a question.

**Loading the plugin under test — and the published-`expo` collision (handled by the fixture).** Executors load the **local, in-repo** plugin via `--plugin-dir <abs>/plugins/expo` so every skill can auto-trigger from its description, and the plugin's `.mcp.json` brings in the Expo MCP. A `claude -p` subprocess **inherits the user's global plugin/MCP config**, so if the *published* `expo` plugin is installed it would collide with `--plugin-dir plugins/expo` (the model may trigger the published `expo:expo-ui` instead of your local edits, and usage detection only sees the tool-call name — you'd silently score the published copy), and it would contaminate the no-plugin baseline.

**This is now handled automatically:** `make-fixture.sh` writes `.claude/settings.local.json` into every fixture with `{"enabledPlugins": {"expo@claude-plugins-official": false}}`. The executor runs with the fixture as its cwd, so that **project-level** setting disables the published plugin for the subprocess — and it has to be project-level: **project settings override the user's `~/.claude/settings.json`, so disabling there alone does *not* take effect** (the exact trap seen in practice). The locally `--plugin-dir`'d copy is unaffected (it's loaded by the CLI flag, not the marketplace `enabledPlugins` registry). Two caveats: (1) the default id is `expo@claude-plugins-official` — if your environment installed the published plugin under a different `<name>@<marketplace>`, set `EXPO_SKILL_EVAL_PUBLISHED_PLUGIN_ID` so `make-fixture.sh` disables the right one; (2) it's still worth a glance at the usage panel — if a `without_plugin` baseline shows `expo:*` skills used, the published copy leaked in (wrong id), so fix the id and re-run. `expo-plugin-eval` itself is a standalone project skill (not part of the `expo` plugin), so none of this disables the harness.

**Prompts — built-in, custom, or a target screenshot.** The prompt is what the plugin builds; it's separate from the per-route grading. Confirm with `AskUserQuestion` (skip if the request already names one), as a **multi-select**:

- **Built-in example apps** — multi-screen apps from `references/example-apps.md` (recipe app, fitness tracker, notes, weather, social profile). They're designed to exercise navigation (so route capture has work to do) and a spread of skills. **Pre-select all** so the default run covers the standard cases; let the user deselect.
- **Custom typed prompt** — don't spend an option slot on this; `AskUserQuestion`'s auto "Type something"/Other entry covers it. Anything typed becomes a custom case.
- **Build from an uploaded screenshot** — **always reserve a slot for this** (it must never be the option dropped when the 4-slot cap fills — collapse the built-ins into one pre-selected "All example apps" option if needed). The user gives the path to a **target screenshot**; the executor opens it with its Read tool and builds a matching app; the case records the path as `reference_image` and grading compares the result to the target (step 6).

Each selected prompt (built-in, typed, or image) becomes one eval case. When the prompt is a screenshot, the run captures the generated app and the grader scores it against the target.

**Phrase prompts at user-intent level — over-specified prompts suppress skill triggering.** Plugin skills auto-trigger when the model recognizes it needs domain guidance; a prompt that already dictates the implementation ("use Expo Router file-based routing", "each screen its own route", "use a data-fetching approach with loading and error states") hands the model everything and it builds the app directly **without ever invoking a skill** — so `with_plugin` collapses toward the baseline and the eval measures nothing. Write each prompt the way a real user would: say **what the app does and which screens it has**, not **how to build it**. The built-in prompts in `references/example-apps.md` are phrased this way deliberately. If a skill-specific behavior is the point (NativeWind styling, live data fetching), name that *domain* naturally ("style it with Tailwind", "use real weather data") — that's a real user signal, not implementation dictation. Note the asymmetry: the **eval prompt** (what we measure) stays natural, while the **executor scaffolding** (emit `routes.json`, don't start servers — see step 2) is separate harness instruction that doesn't affect triggering. **Zero skill usage with the plugin loaded is a finding, not a harness bug** — it means the plugin added no lift for that prompt (either the prompt was too prescriptive, or the skills' descriptions don't recall on that phrasing). The A/B delta and the usage panel surface it; investigate trigger recall in the affected skill's `SKILL.md` description, and cross-check with `expo-skill-eval`'s trigger eval, which exercises recall directly with short natural queries.

**Configs — A/B (recommended default) or plugin-only.** Default to **A/B**: two configs, `with_plugin` and `without_plugin` (a plain `claude -p` with no `--plugin-dir`/MCP). The viewer then shows the plugin's *lift* per config — the most informative result, and the only way to tell whether loading the plugin actually changed the output (a `with_plugin` run that triggered no skills should look ~identical to its baseline; the delta makes that obvious). Offer **plugin-only** (`with_plugin` alone, graded on its own merits) as the cheaper option when build time / token cost matters — A/B doubles fixture count and build time. Pass the config set to `make-workspace.sh` (`"with_plugin without_plugin"` for A/B, or `"with_plugin"`).

**Force-invoking skills — presets.** This question picks what an eval run *measures*, so recommend by intent rather than a fixed default:

- **Recommend a force preset (Dev/UI) by default** when the goal is to evaluate or improve the skills' output — the common case for this tool. Forcing guarantees the skills actually run, so the build exercises their *content*; without it a natural run often triggers **nothing** and `with_plugin` collapses to the baseline (uninformative). Recall — "does the skill fire on a realistic prompt?" — is measured more directly and cheaply by `expo-skill-eval`'s trigger eval, so it's usually not worth spending a whole-app build on here.
- **Recommend routing-style** when the question is "does `expo-overview`'s dispatch chain pick the right leaf skill?" — the closest simulation of what interactive Claude Code does. A single generic directive tells the executor to find and invoke the right skill itself; the model chooses which one, replicating the interactive routing layer. Skills that fire are model-chosen (not pre-specified), so a routing-style run is more informative than force-invoke for testing dispatch quality.

Ask with `AskUserQuestion` (single-select preset; the auto "Other" entry takes a custom comma-separated list); skip if the request already says. Presets:

- **[Force] Dev / UI skills (recommended default).** Instructs the executor to invoke each named skill via the `Skill` tool before writing code — the skills *will* run, guaranteed. The set: `building-native-ui`, `expo-dev-client`, `expo-examples`, `expo-tailwind-setup`, `expo-ui`, `native-data-fetching`, `use-dom`. Excludes ops/release skills (`expo-cicd-workflows`, `expo-deployment`, `eas-update-insights`), native-packaging skills (`expo-module`, `add-app-clip`, `expo-brownfield`), `expo-api-routes`, `upgrading-expo`, and `expo-observe` — forcing those into an app build just adds noise.
- **[Force] This case's `expected_skills`.** Force exactly the skills the eval case already lists — the most targeted option; each app forces only what it's "supposed" to use.
- **[Auto] Interactive simulation.** Gives the executor a single hint: *"Before writing any code, call the Skill tool with the most relevant plugin skill for this task (start with `expo:expo-overview` if unsure) and follow its guidance before building anything."* The model decides which skill to invoke — replicating the interactive Claude Code routing layer. Skills that fire are model-chosen, not pre-specified. Set `routing_style: true` on the eval case.
- **[Neutral] No directive.** No instruction about skills is added to the executor prompt. Claude may or may not invoke a skill depending on natural recall. Use this when the question is whether the plugin provides any lift at all without guidance — expect `with_plugin` to collapse toward the baseline unless a skill's description fires on the prompt.
- **Custom.** A comma-separated skill list typed into "Other" (treated as force-invoke).

How it works (see step 2): when a force set is chosen, the `with_plugin` executor prompt is prefixed with a directive to **use the `Skill` tool to invoke each named skill** (`expo:<name>`) and follow its guidance before building. Only `with_plugin` is forced — the `without_plugin` baseline has no plugin loaded, so it stays natural. Write the set to each case's `force_skills`, and the usage parser marks `skill_usage.json` `"forced": true`. **Forcing changes what an A/B delta means** — it becomes the *content* lift of those skills (recall is bypassed), not "does the plugin naturally help"; the viewer labels a forced config so the two aren't confused. Don't force *all 16* skills: half the plugin is orthogonal to an app build and only adds conflicting context. To exercise the whole plugin instead, run one case per skill (that's `expo-skill-eval`'s job), not one mega-build.

**Expo SDK — once, up front.** Detect the latest with `bash /abs/path/expo-plugin-eval/scripts/latest-sdk.sh` (prints the major, e.g. `56`; it uses `bun` internally and is covered by the bash-scripts rule — don't run the registry query inline). Default to that latest SDK (it stays compatible with the Expo Go that `expo start` installs; pinning an SDK *older* than the device's Expo Go makes `expo start` try to prompt and every snapshot fails in non-interactive mode). Write the chosen version into each case's `runtime.sdk` and pass it to `make-fixture.sh`.

**Runner — Expo Go (default) or a development build.** Expo Go runs anything Expo Go bundles (incl. `@expo/ui` on SDK 56+); it's fast and is the **fully-supported multi-route path**. A development build (`expo run:ios/android`) is for output needing custom native code; it's much slower, multi-GB per fixture, and route deep-linking is **best-effort** (see **Deep-link mechanics**). Prefer fewer cases + a single platform for dev-build runs and keep a few GB free. Pass the choice via `EXPO_SKILL_EVAL_RUNNER` (`expo-go` default, or `dev-build`) and reflect it in each case's `runtime.mode`.

**Platforms — always ask.** Offer iOS / Android / web (multi-select); default iOS + Android, but always offer web (NativeWind/Tailwind, `use-dom`, API routes, plain RN, and `@expo/ui`'s *universal* components all render on web; only platform-specific `@expo/ui/swift-ui` / `jetpack-compose` trees render blank, which is itself a signal). Web runs via `snapshot-routes-web.sh` (`expo start --web` + Playwright) **regardless of runner** (`expo run` is native-only). Write the set into each case's `runtime.platforms`.

**Permission flag for `claude -p` — once, before starting.** Either `--dangerously-skip-permissions` (recommended; each executor runs unattended in a throwaway fixture) or `--permission-mode acceptEdits` (Bash/installs auto-denied with no TTY, so some evals may be partial). A bare `claude -p` with neither can't write files. Apply the same answer to every subprocess this run.

**Viewer delivery — once, up front.** Local only (default; `generate_viewer.py` writes `viewer.html` and opens it) or also **publish a shareable Artifact** at the end (outward-facing — only if the user opts in). See **Viewer**.

## Eval case schema

You generate the run's eval cases — one per chosen prompt — and write them to `<workspace>/iteration-N/evals.json` (the viewer reads them). Each case:

```json
{
  "id": 1,
  "prompt": "Build a recipe app where I can browse a feed of recipes, tap one to see its details with ingredients and steps, keep favorites, and open settings to turn on dark mode.",
  "reference_image": "/abs/path/to/target.png",
  "expectations": ["Uses Expo Router file-based routing", "TypeScript compiles with no errors"],
  "runtime": { "mode": "expo-go", "platforms": ["ios", "android"], "sdk": "56" },
  "routes": [
    {"path": "/", "label": "Home feed"},
    {"path": "/recipe/1", "label": "Recipe detail"},
    {"path": "/settings", "label": "Settings"}
  ],
  "visual_expectations": [
    "Home shows a scrollable list of recipe cards",
    "Settings shows a labeled dark-mode toggle"
  ],
  "expected_skills": ["building-native-ui", "expo-ui"],
  "force_skills": ["building-native-ui", "expo-ui"],
  "routing_style": false
}
```

- `runtime.mode`: `"expo-go"` (default), `"dev-build"`, or `"static-only"` (stop after the static gate — no device; useful for a quick CI-style check that the plugin produces a building app).
- `runtime.platforms`: subset of `ios`, `android`, `web`.
- `runtime.sdk`: SDK major chosen up front (omit to use the latest template).
- `routes` (optional **hint**): expected navigable routes with a deep-link path; sample params filled in for dynamic routes (e.g. `/recipe/1`). **Not authoritative** — at capture time the executor's emitted `routes.json` wins, then `discover_routes.py`, then this hint. Always include `/` first.
- `reference_image` (optional — **image prompt**): absolute path to a target screenshot the app must reproduce. The executor opens it and builds a match; the grader scores fidelity (step 6).
- `expected_skills` (optional): skills you'd expect the plugin to use — reported as coverage, not a pass/fail gate.
- `force_skills` (optional): skills the `with_plugin` executor is **instructed to invoke** (`expo:<name>`) before building — set from the **Skill loading** preset chosen up front. Omit (or `[]`) for natural triggering. Only applies to `with_plugin`. See step 2.
- `routing_style` (optional, default `false`): when `true`, the executor receives the generic routing directive instead of a named-skill force list. Mutually exclusive with a non-empty `force_skills`. The usage parser records `routing_style: true` in `skill_usage.json` (and leaves `forced: false`) so the viewer labels the run as routing-style, not forced.

Pull `prompt`/`routes`/`visual_expectations`/`expected_skills` for built-in cases straight from `references/example-apps.md`.

## Pipeline per eval case

**Orchestration model — on the main thread you run `python3 <orchestrator>` and almost nothing else.** Every phase is driven by a small Python orchestrator you `Write` into the workspace and run with `python3 /private/tmp/expo-plugin-eval-<run>/<phase>.py` (covered by the `python3` rule). The orchestrators are the **only** place the `scripts/*.sh` files are invoked — always via `subprocess.run(["bash", "<scripts>/<name>.sh", …])`, which runs as a child of `python3` and needs no rule of its own — and the only place parallelism, logging, and directory creation live. On the main thread you only: **Write** orchestrators, **run** them with `python3`, **inspect** outputs with `Read`/`Glob`/`Grep`, and **spawn the grader subagent**. Never chain/background/pipe shell constructs (each `|`/`&&`/`&`/`wait`/`echo` segment has no rule and prompts; the one allowed pipe is `… 2>&1 | tee <ws>/…log`). **Run each orchestrator in the foreground** (it parallelizes within a phase). **Expect one permission prompt at the very start** — the first `Write` into the workspace; choose **"allow all edits in this directory for the session"** and every later write goes through silently (`allowed-tools` suppresses `Bash`/`Read` but not `Write`/`Edit`). `<scripts>` is this skill's `scripts/` dir; its `make-fixture.sh`/`clean-fixture.sh`/`latest-sdk.sh`/`make-workspace.sh`/`check-static.sh` are symlinks (to `eval-shared/` and `expo-skill-eval/`) and run identically.

### 0. Workspace setup

```bash
bash /abs/path/expo-plugin-eval/scripts/make-workspace.sh /private/tmp/expo-plugin-eval-<run> iteration-N <num-evals> "with_plugin"
```

Use `"with_plugin without_plugin"` for A/B. This creates `trigger-evals/scratch` (unused here, harmless) and `iteration-N/eval-<i>/<config>/outputs` per eval. Per-platform/route output dirs (`outputs/<platform>/`) are created later by the snapshot scripts' `mkdir`. Never use ad-hoc `mkdir`.

### 1. Fixtures

Each executor run gets a fresh Expo app from `scripts/make-fixture.sh <app-path> <sdk>`:

```bash
scripts/make-fixture.sh <workspace>/iteration-N/eval-X/<config>/app <sdk>
```

It clones an APFS copy-on-write cache under `~/.cache/expo-skill-eval/fixtures/` (shared with `expo-skill-eval` — fixtures aren't rebuilt across the two skills), runs the template's `reset-project` (blank app, so every screen is the plugin's), pins iOS/Android ids **and an app `scheme`** (for dev-build deep links), pre-installs `expo-dev-client`, and resets git so `git diff` shows exactly what the executor changed. **Build all fixtures sequentially in a plain Python loop first** (concurrent creation races the shared bun cache — `EEXIST`), then fan out executors. Only the first fixture per SDK+variant pays the install cost; the rest are ~1s clones.

### 2. Generate (executor subprocesses)

Write `run_executors.py`. **First** create every run's fixture sequentially (step 1). **Then** run the executors in parallel via a `ThreadPoolExecutor`, each a `claude -p` subprocess (not the `Agent` tool — that prompts for in-fixture edits). Each:

- Strip `CLAUDECODE` from the env (`{k:v for k,v in os.environ.items() if k!="CLAUDECODE"}`) — otherwise `claude -p` hangs when nested in a running session.
- The permission flag chosen up front (`--dangerously-skip-permissions` or `--permission-mode acceptEdits`).
- `--output-format=stream-json --verbose --include-partial-messages` and capture the stream to a log next to the fixture (for usage + token parsing).
- **`with_plugin` only:** `--plugin-dir <abs>/plugins/expo`. This loads all skills (auto-triggering) **and** the plugin's `.mcp.json` (the Expo MCP). If the usage parser later shows the MCP never connected, add `--mcp-config <abs>/plugins/expo/.mcp.json` as a fallback. `<abs>` must be the absolute path to the in-repo `plugins/expo` (the dir with `.claude-plugin/plugin.json`) — the subprocess runs from the fixture cwd, so a relative path won't resolve.
- **`without_plugin`:** no `--plugin-dir`/`--mcp-config` — the no-plugin baseline.
- Timeout 1200s (a full multi-screen app build regularly takes 5–10 min; add another 3–5 min when forced skills are in play since each skill invocation consumes context before any code is written — 900s is too tight for the Dev/UI preset of 7 skills).

Executor prompt must include:
- The eval prompt, and for **image cases** the target path + "Open the reference screenshot at `<path>` with your Read tool and build an app whose UI matches it as closely as you can — layout, components, spacing, and colors." If the user uploaded the screenshot inline (no file path), describe the UI in detail in the prompt instead — tab structure, screen layouts, components, and visual style — and omit `reference_image` from the eval case. Pass the same description to the grader.
- **Relay any user hint about a specific library or UI style into the `with_plugin` executor prompt.** When the user says something like "try to use `@expo/ui`" or "style it with Tailwind", that signal belongs in the `with_plugin` executor prompt verbatim — not just in your own skill-preset selection. Keep it at domain-intent level ("use `@expo/ui` components where they fit naturally") rather than a hard dictate, but make sure it reaches the executor. The `without_plugin` baseline should not receive library-specific hints (it has no plugin to guide correct usage).
- **Force-invoke directive (`with_plugin` only, when the case has a non-empty `force_skills`):** prefix the prompt with "Before writing any code, use the Skill tool to invoke each of these plugin skills and follow their guidance while building: `expo:<name>`, `expo:<name>`, … Invoke every one." Build the list from `force_skills` (skip entirely for natural-triggering runs and for the `without_plugin` baseline, which has no plugin to invoke from).
- **Routing-style directive (`with_plugin` only, when the case has `routing_style: true`):** instead of naming specific skills, prefix the prompt with "Before writing any code, call the Skill tool with the most relevant plugin skill for this task (start with `expo:expo-overview` if unsure) and follow its guidance before building anything." The model decides which skill to invoke — replicating what interactive Claude Code's routing layer does. Do NOT set `forced: true` in `skill_usage.json` for routing-style runs; set `routing_style: true` so the viewer labels them correctly.
- **Note:** force-invoking a skill guarantees it is *read*, not that its components are *used* — the executor may read the `expo-ui` skill and still fall back to standard RN components. When the goal is to test a specific skill's component output (e.g. `@expo/ui` adoption), pair the force-invoke directive with an explicit domain hint in the prompt (e.g. "use `@expo/ui` components where they fit") so the executor is nudged toward the skill's guidance, not just exposed to it.
- "Make your changes inside `<app-path>`. The project already exists with dependencies installed. Use absolute paths."
- "Before writing files, inspect the layout — `ls`, read `package.json`/`app.json` — to find the routes dir. Recent SDK templates put Expo Router routes in `src/app/`; older ones in `app/`."
- **"When done, write `<app-path>/routes.json`: a JSON array of every navigable screen as `{\"path\": \"/deep/link\", \"label\": \"Human name\"}`. Use real sample values for dynamic segments (e.g. `/recipe/1`, not `/recipe/[id]`). List `/` first. This drives per-screen screenshots."**
- "Do NOT start the dev server, boot simulators, or take screenshots — the harness does that."
- Where to save a short build summary.

After each executor, immediately parse its stream log and write:
- `skill_usage.json` — `{skills:[…], mcp_tools:[…], mcp_available:bool, forced:bool, forced_skills:[…]}`. See **Skill/MCP usage parsing**. Set `forced:true` and `forced_skills` to the case's `force_skills` when the run used the force-invoke directive — so the viewer/grader read the skills as *forced*, not as natural recall.
- `timing.json` — tokens (from `message_start`/`message_delta` events) + elapsed seconds.

### 3. Static gate

Write `run_static.py`. For each eval/config app, `subprocess.run(["bash","<scripts>/check-static.sh", app, "<platforms-csv>"])` across a `ThreadPoolExecutor`, writing `eval-<i>/<config>/static.json` (`{"exit_code":…, "output":…}`). `check-static.sh` runs `tsc --noEmit`, diff-aware `eslint`, and `expo export` for the platforms — a failing export short-circuits the device stage with a clean FAIL; record it and have the snapshot orchestrator skip that app. **Lint and TypeScript errors alone do not block the device stage** — `check-static.sh` returns non-zero for any of the three checks, so do not use `exit_code != 0` as the skip signal. Instead check whether `"[PASS] export"` is present in `static.json["output"]`; skip only if it is absent.

**Auto-install missing native deps before giving up on the export.** When the export fails with "Unable to resolve module X", the executor correctly decided to use a package that isn't pre-installed in the SDK template (e.g. `react-native-maps`, `react-native-worklets`). `check-static.sh` handles this automatically: it detects "Unable to resolve module" lines, runs `bunx expo install <pkg>` for each, and retries the export once. The `run_static.py` orchestrator needs no special handling — just call `check-static.sh` as usual and read `[PASS] export` from the output.
### 4. Routes + screenshots (serial across apps)

Write `run_snapshots.py`. Simulators/emulators are shared, so this runs **serially** (no thread pool). For each app that passed the static gate:

1. **Resolve routes:** prefer `<app>/routes.json` (executor-emitted); else `python3 <scripts>/discover_routes.py <app>` (static Expo Router enumeration); else the eval case's `routes`; else `[{"path":"/"}]`. Ensure `/` is first. Build a comma-separated `route-csv` of the `path`s. **Immediately write the resolved list to `eval-<i>/<config>/routes.json`** (the config directory, not the app directory) — the viewer's `routes_for()` reads from that path; if the file is absent it falls back to the eval-case hint routes, whose slugs may not match the actual screenshot filenames, producing "no shot" entries for every captured route.
2. **Per platform**, call the route-capture script (booted via `subprocess.run(["bash", …], env={**os.environ, "EXPO_SKILL_EVAL_RUNNER": runner})`):

   ```
   bash <scripts>/snapshot-routes-<platform>.sh <app> <eval-X>/<config>/outputs/<platform> <port> "<route-csv>"
   ```

   Port `8081` for iOS/web, `8082` for Android. Each script **boots Metro once**, deep-links to each route in turn, settles, and screenshots into `outputs/<platform>/<slug>.png` (slug: `/`→`index`, `/recipe/1`→`recipe-1`), writing one shared `outputs/<platform>/metro.log`. It frees its port on startup and tears Metro down on exit — never run `lsof`/`kill` yourself.
3. **Reclaim disk:** after all platforms for an app are captured (and before the next fixture), `subprocess.run(["bash","<scripts>/clean-fixture.sh", app])`. Essential for dev-build (multi-GB per fixture); harmless for Expo Go. It keeps the app source + git so the grader's `git diff` works.

Then generate the viewer:

```bash
python3 /abs/path/expo-plugin-eval/scripts/generate_viewer.py /private/tmp/expo-plugin-eval-<run>
```

It writes `viewer.html` one level above `iteration-N/` and opens it (`webbrowser.open`).

### 5. Grade

Spawn a grader subagent in the foreground per config. Its prompt must include:
- The eval prompt, `expectations`, `visual_expectations`, `routes`, `expected_skills`.
- The instructions in `agents/plugin-grader.md`.
- The inputs: every `outputs/<platform>/<slug>.png`, the `outputs/<platform>/metro.log`s, `routes.json`, `static.json`, and `skill_usage.json`.
- **Image cases:** also the `reference_image`, `references/design-rubric.md`, and the fixture's `git diff`.

The grader writes `grading.json` next to the config's outputs (shape in `agents/plugin-grader.md`): an `expectations` array (case expectations + each visual_expectation, mapped to the right route, PASS/FAIL with cited evidence naming the screenshot file), and — **only for image cases or when a quality grade is requested** — `reference_match` + `quality` blocks. Usage is context, not a gate.

## Deep-link mechanics (how each route is captured)

The snapshot scripts boot Metro once and navigate by deep link:
- **Expo Go iOS:** `xcrun simctl openurl booted "exp://127.0.0.1:<port>/--/<route>"` (the standard Expo deep-link form; `exp://` openurl raises no dialog).
- **Expo Go Android:** `adb shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:<port>/--/<route>"`.
- **Web:** Playwright screenshots `http://localhost:<port>/<route>` directly.
- **dev build:** the app's `<scheme>://<route>` (scheme set by `make-fixture.sh`). **Best-effort:** the iOS Simulator can raise an "Open in <app>?" dialog on the first custom-scheme `openurl` (the script launches root via `simctl launch` to avoid it, but sub-routes use `openurl`, so the first sub-route may capture the dialog — re-run if so). **Expo Go is the fully-supported multi-route path; use it unless the app needs native code.**

The first (cold) route pays the bundle wait; later routes settle for `EXPO_SKILL_EVAL_NAV_SETTLE` (default 5s) — bump it if a navigation transition isn't done when the screenshot fires. **A deep link that doesn't navigate captures the wrong screen** — the grader treats a route showing the home feed instead of its own content as a FAIL, so design prompts so each screen has a real, stable route.

## Skill/MCP usage parsing

From each executor's `--output-format=stream-json` log, build `skill_usage.json`:
- **skills**: collect `tool_use` blocks for the `Skill` tool and `Read` tool calls whose path ends in a `plugins/expo/skills/<name>/SKILL.md` or a `references/` file under it (the model often reads a skill before/instead of the `Skill` invocation). Record the de-duplicated skill names.
- **mcp_tools**: collect `tool_use` blocks whose name starts with `mcp__` (the Expo MCP surfaces as `mcp__expo__*`). Record the de-duplicated tool names.
- **Event structure:** `--output-format=stream-json` does NOT emit top-level `{"type":"tool_use",…}` lines. Tool uses appear as blocks inside `type=="assistant"` envelope events: `event["message"]["content"]` is a list; iterate it and look for `{"type":"tool_use","name":"Skill",…}` items. Checking `etype == "tool_use"` at the top level never matches and produces an empty skill list. The correct pattern: `for ev in log: if ev["type"]=="assistant": for block in ev["message"]["content"]: if block["type"]=="tool_use": …`.
- **mcp_available**: true if any `mcp__*` tool was called, or if the stream's init/`system` event lists the `expo` MCP server as connected; false if the server appears with an error or never connects. If indeterminate, set it to `null`. This matters because the Expo MCP is a **remote HTTP server** (`https://mcp.expo.dev/mcp`) that may require OAuth — a non-interactive `claude -p` may not authenticate it, so a build can legitimately run skills-only. The viewer surfaces this so a result isn't misread.
- **forced / forced_skills**: when the run used the **force-invoke directive** (the case had a non-empty `force_skills`), set `forced:true` and `forced_skills` to that list. The skills then appearing in `skills` reflect *instructed* invocation, not natural recall — the viewer labels the panel "forced" so a forced run isn't read as a recall win. Only `with_plugin` is ever forced.
- **routing_style**: when the run used the **routing-style directive** (the case had `routing_style: true`), set `routing_style: true` and leave `forced: false`. The skills appearing in `skills` are model-chosen, not pre-specified — the viewer labels the panel "routing-style (model-chosen)". Mutually exclusive with `forced: true`.

**Baseline-contamination check (replaces the old manual "disable the published plugin" step).** After parsing, if any `without_plugin` config shows `expo:*` skills used, the fixture's `enabledPlugins` disable didn't match your environment's published-plugin id — the published copy leaked into the baseline. **Stop and tell the user** to set `EXPO_SKILL_EVAL_PUBLISHED_PLUGIN_ID` to the right `<name>@<marketplace>` and re-run; don't report a contaminated A/B delta. This is the only residual guard now that the disable is automatic.

## Practical notes

- **Temp locations & permissions.** All workspaces go under `/private/tmp/expo-plugin-eval-<run>/`. The `allowed-tools` frontmatter mirrors `expo-skill-eval`'s proven rules (path-scoped, no broad interpreters): `Bash(python3 …/expo-plugin-eval-*)` runs your orchestrators, `Bash(python3 *expo-plugin-eval/scripts/*)` runs the checked-in `discover_routes.py`/`generate_viewer.py`, `Bash(bash *expo-plugin-eval/scripts/*)` runs a single standalone script (e.g. re-running one flaky snapshot), and the scoped `tee` rule covers `python3 … 2>&1 | tee <ws>/…log`. The same caveats apply: a Bash rule is a gitignore-style glob **over the command string** (so it matches the symlinked-script path fine), `**` is matched literally (never use it), compound commands are checked per segment, and **`Write`/`Edit` rules don't suppress the prompt** — approve the workspace dir once at the start. After editing this frontmatter, **fully restart Claude Code** (not `/reload-skills`) so the rules reload.
- **Inspect outputs with tools, not shell.** Find files with **Glob** (`/private/tmp/expo-plugin-eval-<run>/iteration-N/**/index.png`), view them with **Read** (renders PNGs — use it to confirm each route's screenshot), search with **Grep**. Never `find`/`ls`/`cat` (they prompt; `find -exec` is deliberately disallowed).
- **Skills that can't run in Expo Go** (expo-module, App Clips, brownfield native code) won't appear in a renderable app — if the plugin reaches for them for a given prompt, expect a `static-only` outcome or a dev build. Prefer prompts whose screens render in Expo Go.
- **Timing data** isn't recoverable later — capture tokens + duration into `timing.json` right after each executor.
- **First-launch dialogs:** Expo Go occasionally shows a one-time prompt on a fresh simulator; if a screenshot captures it, re-run that platform's snapshot script.

## Viewer

After screenshots, always generate and open the HTML viewer:

```bash
python3 /abs/path/expo-plugin-eval/scripts/generate_viewer.py /private/tmp/expo-plugin-eval-<run>
```

It writes a self-contained `viewer.html` (screenshots embedded as base64) and opens it. It renders, per iteration tab: a summary bar (per-config %, A/B delta, eval count); per eval case the prompt and (image cases) the target screenshot; and per config a **skill/MCP usage panel** (skills used with expected-coverage marks, MCP tools, MCP-reachable badge) above a **per-route screenshot gallery** (one row per route, a screenshot per platform — click to zoom), then the PASS/FAIL expectations, and (image cases) `reference_match` + the design-quality rubric.

### Publishing the viewer (only if opted in up front)

When the user chose "Publish a shareable Artifact", additionally run with `--artifact`:

```bash
python3 /abs/path/expo-plugin-eval/scripts/generate_viewer.py /private/tmp/expo-plugin-eval-<run> --artifact
```

It writes `viewer_artifact.html` (page-content only — no `<!DOCTYPE>/<html>/<head>/<body>`, no browser open). Pass that file to the `Artifact` tool (`favicon: "📊"`). It's already self-contained (base64 images, inline CSS/JS), satisfying the Artifact CSP.

## References

- `references/example-apps.md` — built-in multi-screen example app prompts (the defaults).
- `references/design-rubric.md` — design-quality rubric for image-prompt / quality grading.
- `agents/plugin-grader.md` — multi-route, usage-aware grader instructions for the grader subagent.
