# Verify a migrated screen against the running web app

Disclosed reference for [`web-to-native`](../SKILL.md), steps 3–4. Verification means **running both apps and comparing the same screen** — the native port beside the web original. A clean compile or a green `expo export` proves nothing (a DOM screen with no `react-native-webview` exports fine and renders blank; a native rewrite can build and mis-render). This parity check is the gate the strangle loop runs each iteration.

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

**B. Capture the native screen** with argent (`simctl` is the zero-dep fallback):
1. DOM screens need `npx expo install react-native-webview` — `expo export` won't warn, but the webview renders blank without it.
2. Boot + run: `xcrun simctl boot <udid>`; `open -a Simulator`; `npx expo start --ios` (Expo Go). **Expo Go only ships its bundled modules** — `@expo/ui`, `expo-glass-effect` (liquid glass), and custom native modules aren't in it, so it errors or silently omits them and the parity check lies; use a **dev build** (`npx expo run:ios`) for those. Inverse trap: a CI-mode Metro + cached Expo Go bundle can show a *stale* build — terminate Expo Go and add `--clear` if a change doesn't appear.
3. Open the route: `argent run launch-app` + `gesture-tap`, or deep-link `xcrun simctl openurl booted "exp://<lan-ip>:8081/--/<route>?<params>"`.
4. Capture: `argent run describe --udid <udid>` (structure), or `xcrun simctl io booted screenshot native.png` (simplest, zero-dep).

**C. Compare** the two for the same route — layout, content, behavior. Diff the structures (agent-browser `snapshot` against argent `describe` / `debugger-component-tree`), not just pixels. Pass only on parity: same data, and params passed into a DOM webview must produce the same result.

## What "pass" looks like
- **DOM-shelled screen (step 3):** the web UI renders inside the native header/shell; params from the native route drive it the same as on web.
- **Nativized screen (step 4):** native primitives only, no webview; matches the web original screen.
