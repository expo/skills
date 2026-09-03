# Verify a migrated screen against the running web app

Disclosed reference for [`expo-web-to-native`](../SKILL.md), steps 3–4. Verification means **running both apps and comparing the same screen** - the native port beside the web original. A clean compile or a green `expo export` proves nothing - a screen can build and still render blank or mis-render. This parity check is the gate the strangle loop runs each iteration.

Two agents drive it, and this skill is **opinionated**: it requires both and installs them rather than falling back to manual screenshots.

- **Web side — `agent-browser`** (vercel-labs, a Rust browser CLI): `open <url>`, `snapshot --json` (accessibility tree with refs), `screenshot <path>`, `read` (rendered DOM/text).
- **Native side — `argent`** (`@swmansion/argent`): drives the simulator — `describe` (a11y tree), `debugger-component-tree` (RN tree), `gesture-tap`/`keyboard`, `flow` to record a check and replay it each pass. Invoke as `argent run <tool> --udid <udid>` (get the udid from `argent run list-devices`).

## Setup — install if missing (don't skip, don't fall back to manual)

Check both are on PATH; if either is absent, ask the user, then install before proceeding:

```bash
which agent-browser || (npm i -g agent-browser && agent-browser install)   # web agent (+ its Chrome)
which argent        || npm i -g @swmansion/argent                          # device agent
```

## The workflow

**A. Capture the web original** with agent-browser — the source of truth for parity. Run the web app (its `pnpm dev` server, or the **deployed URL** if local setup needs DB/auth env), then:

```bash
agent-browser open "<web-url>/<route>?<params>"
agent-browser snapshot --json      # structure to diff
agent-browser screenshot web.png   # visual reference
```

**Tip:** capture web baselines for every screen once, up front, then diff against them instead of re-opening the web app each iteration.

**B. Capture the native screen** - `expo-agent-cli` runs and reads the app, `argent` captures pixels and accessibility (iOS shown; Android note below):
1. Run the app: `npx @expo/agent-cli dev --detach --wait-ready --ios` starts the dev server and opens the app on the booted simulator - in Expo Go while it can run the project (on **SDK 56+ both `@expo/ui` and DOM components run in Expo Go**, no `react-native-webview` to install), otherwise in the development build the plan makes (`--yes` to consent). After a change that does not show up: `npx @expo/agent-cli runtime:reload`.
2. Open the route: `npx @expo/agent-cli navigate "/<route>?<params>"`. On a fresh simulator the first deep link raises an iOS "Open in …?" dialog - accept it once (see `expo-agent-cli`, traps).
3. Read the structure: `npx @expo/agent-cli runtime:tree --all` (elements, text, testIDs of the focused screen) and `runtime:errors --duration 4s` for what it threw; `smoke --route "/<route>"` is the pass/fail gate.
4. Capture pixels and a11y: `xcrun simctl io booted screenshot native.png`, or `argent run screenshot --udid <udid>` / `argent run describe --udid <udid>`.

> **Android:** `npx @expo/agent-cli dev --detach --android` and `navigate --android` work the same way, but Expo Go on Android ships no debugger, so `runtime:*` and `smoke` need a development build there (`dev --dev-client --android --yes`). Pixels via `adb exec-out screencap -p > native.png`, motion via `adb shell screenrecord`.

**C. Compare** the two for the same route — layout, content, behavior. Diff the structures (agent-browser `snapshot` against argent `describe` / `debugger-component-tree`), not just pixels. Pass only on parity: same data, and params passed into a DOM webview must produce the same result.

**Feel needs motion, not a still.** For a nativized screen with transitions, gestures, or haptics, a screenshot can't catch a janky push or wrong easing — capture a short recording (iOS `xcrun simctl io booted recordVideo feel.mov`; Android `adb shell screenrecord`; or an argent flow) and confirm it moves like a native app (see `native-patterns.md` → Feel).

## What "pass" looks like
- **DOM-shelled screen (step 3):** the web UI renders inside the native header/shell; params from the native route drive it the same as on web.
- **Nativized screen (step 4):** native primitives only, no webview; matches the web original screen.
