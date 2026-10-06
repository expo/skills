# Running your app on the remote sim — tested sequences

A plain session boots blank; `--build-id` installs the chosen build during startup. You install a **simulator-targeted** build onto the session, then open it. Pick a mode from `SKILL.md`. (Sequences validated against eas-cli 20.3.x + agent-device 0.17.x in mid-2026. These commands are experimental — check the relevant subcommand's `--help` before using non-default flags.)

In all modes, EAS CLI manages the session and the bundled runner drives the selected controller. Replace `dev.example.app` with the app's iOS `bundleIdentifier` (from `app.json` → `ios.bundleIdentifier`), and run from the project directory.

> These sequences are **iOS**. For **Android**: build via `npx --yes eas-cli@latest build --platform android` (or local Gradle), `install` the `.apk` instead of an `.app`, and skip `pod install`. Current simulator session types include a web preview, though Android support is still in development and may lack iOS parity.

## Starting a session (shared by all modes)

Run this preparation before any CLI command that reads or writes the session file. Resolve an existing session's ownership before choosing a start command:

```bash
set +x
umask 077
if [ -L .env.eas-simulator ] || { [ -e .env.eas-simulator ] && [ ! -f .env.eas-simulator ]; }; then
  printf '%s\n' 'Unsafe simulator config path; resolve it before starting.' >&2
  exit 1
fi
if [ -f .env.eas-simulator ]; then
  if [ ! -O .env.eas-simulator ]; then
    printf '%s\n' 'Simulator config belongs to another user; resolve ownership first.' >&2
    exit 1
  fi
  chmod 600 ./.env.eas-simulator || exit 1
fi
SESSION_OUTPUT=$(mktemp "${TMPDIR:-/tmp}/eas-sim-output.XXXXXX")
SESSION_ERROR=$(mktemp "${TMPDIR:-/tmp}/eas-sim-error.XXXXXX")
CONTROL_OUTPUT=$(mktemp "${TMPDIR:-/tmp}/eas-sim-control.XXXXXX")
CONTROL_ERROR=$(mktemp "${TMPDIR:-/tmp}/eas-sim-control-error.XXXXXX")
SIM_CONTROLLER=agent-device  # Change to the selected interface before its start/readiness check.
SESSION_CREATED_THIS_RUN=0  # Existing-session capture must preserve that session.
# Set SIM_STATUS to this skill's scripts/session-status.cjs absolute path.
# Set SIM_RUN to this skill's scripts/run-controller.cjs absolute path.
# Set and export AGENT_DEVICE_BIN to the reviewed installed agent-device executable's absolute path.
sim_control() {
  : > "$CONTROL_OUTPUT"
  : > "$CONTROL_ERROR"
  npx --yes eas-cli@latest simulator:get --id "$SESSION_ID" --json --non-interactive \
    > "$SESSION_OUTPUT" 2> "$SESSION_ERROR" || {
      printf '%s\n' 'Session query failed; inspect private diagnostics before retrying.' >&2
      return 1
    }
  if node "$SIM_RUN" "$SESSION_ID" "$SIM_CONTROLLER" "$@" < "$SESSION_OUTPUT" \
    > "$CONTROL_OUTPUT" 2> "$CONTROL_ERROR"; then
    printf '%s\n' 'Controller completed; inspect the private result for the requested task.'
  else
    local result=$?
    printf '%s\n' 'Controller failed; inspect private diagnostics before retrying.' >&2
    return "$result"
  fi
}
```

Each controller action replaces `CONTROL_OUTPUT` and `CONTROL_ERROR`. Read only the fields needed for the next action: help text, current UI selectors, or the requested capture's local path. Keep raw logs, network payloads, entered text, and credential-bearing errors private; share redacted diagnostic excerpts. Save any needed result before the next action. Screenshot/video files still go to the chosen local paths. Remove these two run-owned temporary files with `SESSION_OUTPUT` and `SESSION_ERROR` at cleanup.

If the dotenv names a session, inspect that session privately with `simulator:get --json`. Reuse it when it belongs to this run; stop it only when it is in scope and no longer needed. Preserve a concurrent run's ID/config and resolve ownership before another start. Replacing the file does not stop the remote session.

Choose **one** start command: this default, the device-specific alternative, Mode B's `--build-id`, or Mode C Method 1. The build-ID alternatives replace this default; they do not need an earlier session:

```bash

# Start (the default --out-config-type dotenv writes .env.eas-simulator). It boots the sim + agent-device daemon.
# --json changes stdout but does not suppress the completed dotenv write; use --out-config-type env for no file.
# --name is required practice: it labels the session in simulator:list/get and on expo.dev.
# Describe what the run is for, in the user's terms — see "Always name the session" in SKILL.md.
npx --yes eas-cli@latest simulator:start --platform ios --type agent-device --non-interactive \
  --name "Checkout flow screenshots" --json > "$SESSION_OUTPUT" 2> "$SESSION_ERROR" || exit 1
chmod 600 ./.env.eas-simulator
```

Immediately after each `start`, record the returned ID without exposing the other fields:

```bash
SESSION_ID=$(node -e '
  const fs = require("node:fs");
  try {
    const j = JSON.parse(fs.readFileSync(0, "utf8"));
    if (typeof j.id !== "string" || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(j.id)) throw new Error();
    process.stdout.write(j.id);
  } catch { console.error("Session creation is unverified; inspect its private output."); process.exitCode = 1; }
' < "$SESSION_OUTPUT") || exit 1
SESSION_CREATED_THIS_RUN=1
```

Then verify the session file is still an owned regular file with mode `0600` before CLI reads. Use the recorded `SESSION_ID` for polling, controller operations, and stopping. `sim_control` verifies a fresh response for that ID and uses its connection configuration rather than a shared dotenv's controller destination. Preserve a concurrent run's dotenv; resolve ownership before writing or resetting it.

Confirm readiness before driving. The helper defaults to `agent-device`; set `SIM_CONTROLLER` to `appium`, `argent`, or `web-preview-only` for that chosen session type. Keep CLI errors private too; inspect a failed check locally rather than hiding it and continuing to a controller:

```bash
# Poll up to ~16 min. The helper verifies the requested ID and a populated controller config.
READY=0
for i in $(seq 1 64); do
  npx --yes eas-cli@latest simulator:get --id "$SESSION_ID" --json --non-interactive \
    > "$SESSION_OUTPUT" 2> "$SESSION_ERROR" || break
  S=$(node "$SIM_STATUS" "$SESSION_ID" "${SIM_CONTROLLER:-agent-device}" < "$SESSION_OUTPUT") || break
  echo "$S" | grep -q '"ready":true' && { READY=1; break; }
  echo "$S" | grep -qE '"status":"(STOPPED|ERRORED)"' && break
  sleep 15
done
if [ "$READY" != 1 ]; then
  printf '%s\n' 'Session readiness is unverified; stop before driving and clean up this run.' >&2
  if [ "${SESSION_CREATED_THIS_RUN:-0}" = 1 ]; then
    npx --yes eas-cli@latest simulator:stop --id "$SESSION_ID" \
      >> "$SESSION_ERROR" 2>&1 || {
        printf '%s\n' 'Cleanup failed; report this session ID for manual stop.' >&2
      }
  fi
  # Preserve an existing session; inspect private diagnostics before deleting this run's files.
  exit 1
fi
```

Keep raw start/get results private. Extract a `webPreviewUrl` only for a requested live preview, per the main skill's sharing rules. The runner forwards only OS/network settings and the selected controller's connection configuration; it does not inherit EAS account tokens, unrelated service tokens, project dotenv variables, or `NODE_OPTIONS`. It is an environment filter, not a filesystem sandbox: review controller packages, client code, and package-manager configuration before execution. Follow the main skill's cleanup rules: reset the dotenv only if it still names the session you stopped.

## Targeting a device — iPad, or several at once

**Boot a specific device at session start** with `npx --yes eas-cli@latest simulator:start --device "<name|UDID>"` (eas-cli ≥ 22.4.0) — this is how you run on an iPad instead of the default iPhone:

```bash
npx --yes eas-cli@latest simulator:start --platform ios --device "iPad Pro 13-inch (M5)" \
  --non-interactive --name "iPad run" --json > "$SESSION_OUTPUT" 2> "$SESSION_ERROR" || exit 1
# then install / launch / screenshot as usual — the iPad renders larger (e.g. 1032x1376).
```

The value must be a device the **remote runner** offers (NOT your local Xcode set), by name **or** UDID. List them from a live session:

```bash
sim_control devices --json
```

Available iOS devices today: iPhone 17 / 17 Pro / 17 Pro Max / 17e / Air, and iPad (A16), iPad Air 11"/13" (M4), iPad mini (A17 Pro), iPad Pro 11"/13" (M5).

**Switch devices mid-session:** a session exposes ~16 sims but boots only one at start. Pass the **controller's** global `--device "<name>"` on `open` (and other verbs) to boot + target another; it stays booted alongside the first, so pass `--device` on each verb to say which it hits.

```bash
sim_control open <bundleId> "<devClientURL>" \
  --platform ios --device "iPad Pro 13-inch (M5)" --relaunch
```

- ⚠️ The **controller** `--device` resolves by **NAME only** — a udid returns `DEVICE_NOT_FOUND`. (The start-time CLI `--device` above takes either.)
- `devices` reports each device's name, kind, and booted state, but **not** its iOS version.

---

## Mode A — Local release build (embedded JS, no Metro)

A Release build bundles the JS into the binary, so it renders without Metro. Good for a quick "run my current code on a cloud device" when a Mac toolchain is available.

Generate missing native directories for a CNG project; inspect and preserve hand-maintained native projects instead of regenerating them. Do not use clean prebuild to obtain a screenshot.

```bash
# 1. Generate native project + build a Release simulator .app
./node_modules/.bin/expo prebuild --platform ios          # set ios.bundleIdentifier in app.json first to avoid prompts
# pod install can fail on Ruby 4 + CocoaPods with a Unicode/ASCII-8BIT error — fix with a UTF-8 locale:
( cd ios && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install )
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 xcodebuild \
  -workspace ios/<App>.xcworkspace -scheme <App> \
  -configuration Release -sdk iphonesimulator -derivedDataPath ios/build build
# → ios/build/Build/Products/Release-iphonesimulator/<App>.app

# 2. Start a session (see "Starting a session" above), then install + open + drive
APP=ios/build/Build/Products/Release-iphonesimulator/<App>.app
sim_control install dev.example.app "$APP" --platform ios
sim_control open dev.example.app --platform ios
sim_control screenshot ./shot.png

# 3. Stop
npx --yes eas-cli@latest simulator:stop --id "$SESSION_ID" > "$SESSION_OUTPUT" 2> "$SESSION_ERROR"
rm -f -- "$SESSION_OUTPUT" "$SESSION_ERROR" "$CONTROL_OUTPUT" "$CONTROL_ERROR"
```

The `install` here **uploads** the (~90MB) `.app` to the remote daemon over the tunnel, which installs it on the sim with `simctl`.

---

## Mode B — EAS simulator build (embedded JS, no Metro)

Use for static UI verification without a suitable local build, a requested EAS artifact, or an identified existing build. For **live** iteration use Mode C. Simulator builds are unsigned and need no store-signing credentials; they still use EAS authentication and upload the selected project source.

⚠️ **Check for an existing build first.** Before triggering a new build, check if a compatible, source-matched one already exists — it saves ~15-20 min:

```bash
# First run the private-file preparation above, without starting a session.
# SIM_PROFILE is a reviewed profile with ios.simulator: true and embedded JS.
npx --yes eas-cli@latest build:list --platform ios --profile "$SIM_PROFILE" --status finished --json \
  > "$SESSION_OUTPUT" 2> "$SESSION_ERROR" || exit 1
# Show only valid build IDs and source revisions, never artifact URLs or account details.
node -e '
  const fs = require("node:fs");
  try {
    const builds = JSON.parse(fs.readFileSync(0, "utf8"));
    const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
    if (!Array.isArray(builds)) throw new Error();
    const output = builds.map(b => {
      if (typeof b.id !== "string" || !uuid.test(b.id) || typeof b.app?.id !== "string" || !uuid.test(b.app.id) || b.status !== "FINISHED" ||
          b.platform !== "IOS" || typeof b.gitCommitHash !== "string" ||
          !/^[0-9a-f]{40}$/i.test(b.gitCommitHash)) throw new Error();
      return { id: b.id, projectId: b.app.id, gitCommitHash: b.gitCommitHash };
    });
    console.log(JSON.stringify(output));
  } catch { console.error("Build discovery is incomplete; keep the raw result private."); process.exitCode = 1; }
' < "$SESSION_OUTPUT"
```

Verify the selected ID belongs to this project, is an unsigned simulator build with embedded JS, and reflects the requested source. Check the source revision and later working-tree edits; the native fingerprint establishes compatibility, not embedded-JS freshness. If those checks succeed, skip to step 3 with that build ID. An explicitly requested older build may be used as such without claiming it reflects current edits.

**Order matters:** build FIRST, `start` LAST. A build can take ~15-20 min; an idle session can time out. Wait for a verified finished build ID before starting the simulator.

```bash
# 1. Find or create a simulator build profile in eas.json.
#    Read eas.json if it exists and look for a build profile with ios.simulator: true.
#    If one exists, note its name and skip to step 2.
#    If not, add one named "sim" — use node, python3, jq, or a direct JSON edit, whichever
#    is available. Preserve all other profiles. Minimum: { "ios": { "simulator": true } }

# 2. Build, retaining raw job output privately. Verify its finished build ID as above.
npx --yes eas-cli@latest build --platform ios --profile "$SIM_PROFILE" --non-interactive --json \
  > "$SESSION_OUTPUT" 2> "$SESSION_ERROR" || exit 1

# 3. Start AND install the identified build; no artifact URL needs to enter shell arguments.
npx --yes eas-cli@latest simulator:start --platform ios --type agent-device --build-id "$BUILD_ID" \
  --non-interactive --name "Checkout flow screenshots" --json \
  > "$SESSION_OUTPUT" 2> "$SESSION_ERROR" || exit 1
# Record SESSION_ID, verify the dotenv, and run the readiness loop above before controller actions.
sim_control open dev.example.app --platform ios
sim_control screenshot ./shot.png

# 4. Stop
npx --yes eas-cli@latest simulator:stop --id "$SESSION_ID" > "$SESSION_OUTPUT" 2> "$SESSION_ERROR"
rm -f -- "$SESSION_OUTPUT" "$SESSION_ERROR" "$CONTROL_OUTPUT" "$CONTROL_ERROR"
```

Tell the user which build/source revision you used. Remove the private output/error files after diagnosis and completion; preserve them only while this run needs them, outside uploads and version control.

---

## Mode C — Dev build + tunnel (live edits via Fast Refresh)

The agentic edit-and-see loop: a **dev (Debug) build** loads JS from your **Metro** over a tunnel, so edits appear on the remote sim via Fast Refresh. Two ways to connect the dev client to Metro:

- **Method 1 (recommended, eas-cli ≥ 22.4.0):** launch at session start — `simulator:start` installs the build, applies launch-args, and opens the Metro URL in one command, and the "Open in?" dialog is auto-handled. Needs a **remote** build source (`--build-id`, `--application-archive-url`, or `--expo-go`); a local `.app` can't be passed here.
- **Method 2 (fallback):** drive the connect with the controller — for a **local `.app`** build, or eas-cli < 22.4.0.

⚠️ **Don't install a release build as a "quick interim" and screenshot it** — it shows stale, build-time code. Use a dev build + Metro; screenshot only after the dev client is connected.

### Get a dev-client build (either method needs one)

- **Local (Mac):** Use the project's existing `expo-dev-client` dependency; if missing, report it as a prerequisite. Generate a missing CNG project with `./node_modules/.bin/expo prebuild --platform ios` (set `ios.bundleIdentifier` first), or update the existing native host selectively. Do not clean or overwrite hand-maintained native directories; inspect and preserve native changes before any CNG regeneration. Then `( cd ios && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install )` and `xcodebuild -workspace ios/<App>.xcworkspace -scheme <App> -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build-debug build` → `ios/build-debug/Build/Products/Debug-iphonesimulator/<App>.app`. A local `.app` → **Method 2 only**.
- **EAS (no Mac, or to use Method 1):** ensure a profile with `developmentClient: true` + `ios.simulator: true`. Capture build output privately as in Mode B and select the verified finished **build ID** for Method 1. A compatible dev client may be reused because Metro supplies the current JavaScript.

### Method 1 — launch at session start (recommended)

⚠️ **Metro FIRST, then `simulator:start`** — the runner opens `--open-url` during startup, with no retry.

```bash
# 1. Start Metro with a tunnel on your own free port (tunnel-backend details at the end of this mode).
EXPO_UNSTABLE_TUNNEL_V2=1 ./node_modules/.bin/expo start --tunnel --port <your-free-port>   # background it durably
#    Capture the manifest host. Headless runs won't print it — read only this run's tunnel metadata when using ngrok
#    or the manifest (curl -s -H "expo-platform: ios" localhost:<port>/ → launchAsset.url).

# 2. Start the session AND install+launch+open the app in one command (--launch-arg = one token per flag):
#    Dev client: --build-id <id>, --open-url <scheme>://expo-development-client/?url=https://<manifest-host>
#                (scheme = app.json `scheme`, NOT the slug; URL-encode the inner url if it has a path/query)
#    Expo Go:    --expo-go instead of --build-id, and --open-url exp://<manifest-host>  (no port; https opens Safari)
npx --yes eas-cli@latest simulator:start --platform ios --build-id <BUILD_ID> \
  --launch-arg "-EXDevMenuIsOnboardingFinished" --launch-arg "1" \
  --launch-arg "-EXDevMenuShowsAtLaunch" --launch-arg "0" \
  --launch-arg "-EXDevMenuShowFloatingActionButton" --launch-arg "0" \
  --open-url "<scheme>://expo-development-client/?url=https://<manifest-host>" \
  --non-interactive --name "Coin flip live edits" --json > "$SESSION_OUTPUT" 2> "$SESSION_ERROR" || exit 1
#    The app installs, launches with the launch-args (onboarding/dev-menu/gear suppressed), and opens the URL.
#    EAS configures the selected app's development deep-link association inside this disposable simulator.
#    This affects that test session only; it does not authorize device permissions or actions in other apps.
#    `start` prints NOTHING about the install/launch — confirm from Metro's `iOS Bundled …` line.

# Record SESSION_ID, verify the dotenv and readiness as above.
# 3. To screenshot/drive, ATTACH the controller once — the CLI launch makes NO agent-device session, so a bare
#    `screenshot` fails `SESSION_NOT_FOUND`. `open --foreground` attaches without relaunching:
sim_control open <bundleId> --foreground --platform ios
sim_control screenshot ./live.png
#    The runner checks a fresh IN_PROGRESS response for SESSION_ID and injects the selected remote
#    connection settings. Missing/wrong controller configuration stops the operation instead of
#    allowing a silent local-simulator fallback. Confirm the requested app/source before capture.

# 4. Fast Refresh: edit a source file → it hits the remote sim with no reload. Screenshot again to confirm.
# 5. Stop the recorded session with stdout/stderr captured privately, then remove this run's output files.
# Then stop only the Metro process you started for this run.
```

### Method 2 — drive the connect with the controller (fallback)

For a **local `.app`** (can't be passed to `--build-id`) or **eas-cli < 22.4.0**. Start a plain session (see "Starting a session"), install the build, then deep-link the dev client:

```bash
# Install the verified local .app. For an EAS dev build, use Method 1 with its build ID.
sim_control install <bundleId> "$DEVAPP" --platform ios

# connect: `open <bundleId> <devClientURL>` deep-links into the bundle, skipping the launcher UI. Assemble
# <devClientURL> from the app's SCHEME (app.json `scheme`, NOT the slug): <scheme>://expo-development-client/?url=https://<manifest-host>
sim_control open <bundleId> "<devClientURL>" --platform ios --relaunch \
  --launch-args "-EXDevMenuIsOnboardingFinished" --launch-args "1" \
  --launch-args "-EXDevMenuShowsAtLaunch" --launch-args "0" \
  --launch-args "-EXDevMenuShowFloatingActionButton" --launch-args "0"
# Inspect any system dialog before responding. Accept only a verified "Open in '<expected app>'?"
# prompt for this requested development link. Do not run a blanket alert-accept command against an
# unknown dialog, approve account changes, or grant unrelated camera/location/contact permissions.
# then screenshot; if it shows the launcher not the app, the deep link didn't take → manual fallback:
#   press 'label="Enter URL manually"' → snapshot -i → fill @<field> "<manifest URL>" → press 'label="Connect"'
#   → press 'label="Reload"'; press 'label="Go back"' if expo-router shows "Unmatched Route".
```

### Dev-menu launch flags (both methods)

The launch-args are iOS UserDefaults (`-Key Value`), verified in expo/expo `packages/expo-dev-menu`. By default the onboarding popup, auto-opened dev menu, and floating gear all show and clutter screenshots; these suppress them:
- `-EXDevMenuIsOnboardingFinished 1` — skip the first-run onboarding popup (dev client **and** Expo Go)
- `-EXDevMenuShowsAtLaunch 0` — don't auto-open the dev menu at launch (dev client)
- `-EXDevMenuShowFloatingActionButton 0` — hide the floating gear (defaults visible on both)

Method 1 passes each as two flags: `--launch-arg "<key>" --launch-arg "<value>"`. Method 2 passes them as `--launch-args`.

### Metro tunnel backends (both methods)

#### Tunnel scope and approvals

Mode C exposes this project's Metro server through a temporary public endpoint so the EAS device can fetch its development manifest, JavaScript bundle, and assets. A signed Expo tunnel URL authenticates tunnel creation to an account; it does not establish authenticated access to the public endpoint. URL randomness is not access control.

Before starting the tunnel, explain which project/port/provider will be exposed and follow the host's normal network approval flow. Review what that Metro server serves, including source maps, development middleware, and any API routes; keep private files and server-only credentials outside served content. A simulator request alone does not authorize exposing a different local service. Keep the endpoint within the intended development session and stop only this run's Metro process when finished.

Respect a denied tunnel or dev-client connection. Report the blocked action and reason; do not retry with altered tools, providers, permissions, or approval wording. Resume only if the host receives the required authorization. If a static build satisfies the requested task, use Mode A/B; otherwise explain that live edits remain blocked.

Source: Expo CLI's [AsyncWsTunnel.ts](https://github.com/expo/expo/blob/main/packages/%40expo/cli/src/start/server/AsyncWsTunnel.ts) resolves the Expo account, requests a signed URL, and sets the local target port. Verify the installed CLI's actual backend below: the environment flag alone does not prove it selected Expo's service.

#### Backend selection

Start Metro on your OWN free port — each run gets its own tunnel URL, so never fight for or kill :8081 (#133's rule). BOTH backends accept ANY `--port`:
- **ws-tunnel v2 (account-signed):** `EXPO_UNSTABLE_TUNNEL_V2=1` — signed URL for your EAS account, `on.expo.app` host, and the supported path for robot/EXPO_TOKEN/cloud agents. Needs login / an EAS-linked project. An authentication, access, or approval failure is a stopping condition; a CLI suggestion to change providers does not authorize doing so.
- **ngrok (plain `--tunnel`, no flag):** `<host>.exp.direct` host; blocked for robot/EXPO_TOKEN users.

The ONLY 8081 lock is the LEGACY ws-tunnel path — hit WITHOUT the v2 account URL (an older CLI where the flag no-ops, or `EXPO_FORCE_WEBCONTAINER_ENV=1`). Do NOT set `EXPO_FORCE_WEBCONTAINER_ENV` to "fix" a port — it forces that legacy path and locks you to 8081. On an older CLI (e.g. expo 56) the v2 flag no-ops and you get ngrok on your chosen port (verified: expo 56.0.3 → ngrok on :8083).
