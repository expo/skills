# Running your app on the remote sim — tested sequences

The remote sim boots blank. You install a **simulator-targeted** build onto the session, then open it. Pick a mode from `SKILL.md`. (Sequences validated against eas-cli 20.3.x + agent-device 0.17.x in mid-2026; the commands are experimental — if one fails, re-check `<cmd> --help`.)

In all modes, the session is started the same way and driven through `npx --yes eas-cli@latest simulator:exec`. Replace `dev.example.app` with the app's iOS `bundleIdentifier` (from `app.json` → `ios.bundleIdentifier`), and run from the project directory.

> These sequences are **iOS**. For **Android**: build via `npx --yes eas-cli@latest build --platform android` (or local Gradle), `install` the `.apk` instead of an `.app`, skip `pod install`, and note there's **no `webPreviewUrl`** (Android is agent-driven / screenshot-only).

## Starting a session (shared by all modes)

```bash
# Reset the dotenv first so the new session id isn't masked by an "Overwriting previous session" warning.
printf '# managed by eas-cli\n' > .env.eas-simulator

# Start (no --json, so it writes .env.eas-simulator). It boots the sim + agent-device daemon.
# --name is required practice: it labels the session in simulator:list/get and on expo.dev.
# Describe what the run is for, in the user's terms — see "Always name the session" in SKILL.md.
npx --yes eas-cli@latest simulator:start --platform ios --type agent-device --non-interactive \
  --name "Checkout flow screenshots"
```

`start`'s own poll is unreliable, so confirm liveness with a bounded loop (boot is ~90s–15min). `get`/`exec`/`stop` default to the session in `.env.eas-simulator`, so you can omit `--id`:

```bash
# Poll up to ~16 min; IN_PROGRESS + remoteConfig = live; a terminal status = failed boot (stop + restart).
for i in $(seq 1 64); do
  S=$(npx --yes eas-cli@latest simulator:get --json --non-interactive 2>/dev/null)
  echo "$S" | grep -q '"status": *"IN_PROGRESS"' && echo "$S" | grep -q remoteConfig && { echo "live"; break; }
  echo "$S" | grep -qE '"status": *"(STOPPED|ERRORED)"' && { echo "boot failed — stop + restart"; break; }
  sleep 15
done
```

If you need the id explicitly, it's `EAS_SIMULATOR_SESSION_ID` in `.env.eas-simulator`. `start` also prints a `webPreviewUrl` (iOS-only browser preview — surface it per the SKILL.md "watch it live" rules) and a job-run URL. Once live, the session env is in `.env.eas-simulator`, so `simulator:exec` works.

---

## Mode A — Local release build (embedded JS, no Metro)

A Release build bundles the JS into the binary, so it renders without Metro. Good for a quick "run my current code on a cloud device" when a Mac toolchain is available.

```bash
# 1. Generate native project + build a Release simulator .app
npx expo prebuild --platform ios          # set ios.bundleIdentifier in app.json first to avoid prompts
# pod install can fail on Ruby 4 + CocoaPods with a Unicode/ASCII-8BIT error — fix with a UTF-8 locale:
( cd ios && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install )
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 xcodebuild \
  -workspace ios/<App>.xcworkspace -scheme <App> \
  -configuration Release -sdk iphonesimulator -derivedDataPath ios/build build
# → ios/build/Build/Products/Release-iphonesimulator/<App>.app

# 2. Start a session (see "Starting a session" above), then install + open + drive
APP=ios/build/Build/Products/Release-iphonesimulator/<App>.app
npx --yes eas-cli@latest simulator:exec npx agent-device@latest install dev.example.app "$APP" --platform ios
npx --yes eas-cli@latest simulator:exec npx agent-device@latest open dev.example.app --platform ios
npx --yes eas-cli@latest simulator:exec npx agent-device@latest screenshot ./shot.png

# 3. Stop
npx --yes eas-cli@latest simulator:stop          # omit --id → stops the dotenv session
```

The `install` here **uploads** the (~90MB) `.app` to the remote daemon over the tunnel, which installs it on the sim with `simctl`.

---

## Mode B — EAS build (the VM downloads it; no credentials)

**Explicit-only** (see the SKILL.md mode picker): a *static* EAS artifact for CI/sharing, or when the user names an existing EAS build. For no-Mac **live** iteration use Mode C with an EAS dev-client build (see Mode C below), not this. **Simulator builds are unsigned, so EAS asks for no credentials.**

⚠️ **Check for an existing build first.** Before triggering a new build, check if a fingerprint-matched one already exists — it saves ~15-20 min:

```bash
npx --yes eas-cli@latest build:list --platform ios --profile <your-sim-profile> --status finished --json | \
  head -20   # <your-sim-profile> = the profile you find/create in step 1; look for one whose fingerprint matches current source
```

If one matches, skip straight to step 3 with its artifact URL.

⚠️ **Order matters:** build FIRST, `start` the session LAST. The build takes ~15-20 min and a session left idle that long times out (`ERR_NGROK_3200`) — don't `start` until you have the artifact URL.

```bash
# 1. Find or create a simulator build profile in eas.json.
#    Read eas.json if it exists and look for a build profile with ios.simulator: true.
#    If one exists, note its name and skip to step 2.
#    If not, add one named "sim" — use node, python3, jq, or a direct JSON edit, whichever
#    is available. Preserve all other profiles. Minimum: { "ios": { "simulator": true } }

# 2. Build (no credentials prompt for a simulator build). Prints an artifact URL when done (~15-20 min).
npx --yes eas-cli@latest build --platform ios --profile sim --non-interactive
# → https://expo.dev/artifacts/eas/<hash>.tar.gz

# 3. Start a session, then install-from-source so the VM downloads the artifact (no local upload)
ART="https://expo.dev/artifacts/eas/<hash>.tar.gz"
npx --yes eas-cli@latest simulator:exec npx agent-device@latest install-from-source "$ART" --platform ios
npx --yes eas-cli@latest simulator:exec npx agent-device@latest open dev.example.app --platform ios
npx --yes eas-cli@latest simulator:exec npx agent-device@latest screenshot ./shot.png

# 4. Stop
npx --yes eas-cli@latest simulator:stop          # omit --id → stops the dotenv session
```

**Build freshness:** reuse only a build whose **fingerprint matches current source** (`npx --yes eas-cli@latest build:list --platform ios --json`, or `get-build` by fingerprint per Callstack's public `eas-agent-device` workflow); otherwise **rebuild** or use Mode C. Tell the user which build you used. (Why this matters → SKILL.md "Reusing an existing build" caveat.)

---

## Mode C — Local dev build + tunnel (live edits via Fast Refresh)

This is the agentic edit-and-see loop: a **dev (Debug) build** loads JS from your local **Metro** over **tunnel v2**, so code edits appear on the remote sim via Fast Refresh. It has the most steps — each is necessary.

⚠️ **Don't install a release build as a "quick interim" and screenshot it** — that interim shows stale, build-time code (the "outdated screenshot" trap). Go straight to the dev build + Metro; screenshot only after the dev client is connected to Metro.

**No local Mac toolchain?** (the common cloud/Linux case) Build the dev client on **EAS** instead of step 1 below. ⚠️ Same order-matters rule as Mode B: build first, start the session after you have the artifact URL.

```bash
# ── Non-Mac path: replace step 1 with these ──────────────────────────────────

# Find or create a dev-client simulator build profile in eas.json.
#    Read eas.json if it exists and look for a build profile with developmentClient: true + ios.simulator: true.
#    If one exists, note its name and skip to the build step.
#    If not, add one named "dev-sim" — use node, python3, jq, or a direct JSON edit, whichever
#    is available. Preserve all other profiles. Minimum: { "developmentClient": true, "ios": { "simulator": true } }

# Build (~15-20 min). Prints an artifact URL when done.
npx --yes eas-cli@latest build --platform ios --profile dev-sim --non-interactive
# → https://expo.dev/artifacts/eas/<hash>.tar.gz

# Start a session AFTER the build finishes (don't start early — idle sessions time out).
# Then in step 3 below, use install-from-source (VM downloads the artifact) instead of local install:
ART="https://expo.dev/artifacts/eas/<hash>.tar.gz"
npx --yes eas-cli@latest simulator:exec npx agent-device@latest install-from-source "$ART" --platform ios
# Continue from step 3a (open the dev client, enter Metro URL) onward — identical to the Mac path.
```

```bash
# 1. Add expo-dev-client and build a Debug (dev-client) simulator .app
npx expo install expo-dev-client
npx expo prebuild --platform ios --clean   # set ios.bundleIdentifier first (as in Mode A) to avoid prompts
( cd ios && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install )
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 xcodebuild \
  -workspace ios/<App>.xcworkspace -scheme <App> \
  -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build-debug build
DEVAPP=ios/build-debug/Build/Products/Debug-iphonesimulator/<App>.app

# 2. Start Metro with a tunnel so the remote sim can reach it. The BACKEND constrains the port:
#    • ws-tunnel ("tunnel v2", durable-object) — the ONLY tunnel that works for robot/EXPO_TOKEN/cloud
#      agents (plain ngrok is blocked for them). HARD-LOCKED to port 8081: `--port 8082` fails with
#      "WS-tunnel only supports tunneling over port 8081". The flag that forces it varies by CLI version —
#      EXPO_UNSTABLE_TUNNEL_V2=1 (newer) or EXPO_FORCE_WEBCONTAINER_ENV=1 (some SDK 56 CLIs); if one is
#      ignored try the other, and confirm from the Metro log which tunnel actually started.
#    • ngrok (plain `--tunnel`, no flag) — allows ANY `--port`, but is blocked for robot/EXPO_TOKEN users.
#    Pick: robot/cloud agent → ws-tunnel on 8081. Normal dev machine → either.
#    If 8081 is held by ANOTHER project's Metro you didn't start, do NOT kill it — stop it only if it's
#    yours, else (non-robot) fall back to ngrok on a free port. Reuse a Metro only if YOU started it this
#    session. A bare `&` won't survive across agent shell calls — background it durably.
EXPO_UNSTABLE_TUNNEL_V2=1 npx expo start --tunnel --port 8081        # ws-tunnel (try EXPO_FORCE_WEBCONTAINER_ENV=1 if ignored)
#    fallback, non-robot only:  npx expo start --tunnel --port <free-port>   # ngrok, any port
#    → capture the https manifest URL from stdout (ws-tunnel: https://<host>.on.expo.app; ngrok: https://<host>.exp.direct).
#      Headless `-p` runs may not print it — read the Metro log, or ngrok's API: curl -s 127.0.0.1:4040/api/tunnels.

# 3. Start a session, install the dev build, then connect it — one `open` call.
#    FAST path: `open <bundleId> <devClientURL>` deep-links straight into the bundle and skips the
#    launcher UI. ASSEMBLE <devClientURL> from the app's URL SCHEME — app.json `scheme` (e.g. "coinflip"),
#    NOT the slug; verify via `npx expo config --json` (.scheme) or Info.plist CFBundleURLSchemes:
#      <scheme>://expo-development-client/?url=https://<manifest-host>
#      e.g. coinflip://expo-development-client/?url=https://abc123.on.expo.app
#    (Only an app with NO custom scheme uses the auto form exp+<slug>://.) Using the slug when a custom
#    scheme exists opens the launcher instead of the app, leaving onboarding to tap away. The url MUST be
#    https. The --launch-args pre-dismiss onboarding + the dev menu — nothing to tap away after.
npx --yes eas-cli@latest simulator:exec npx agent-device@latest install dev.example.app "$DEVAPP" --platform ios

#    a) open straight into the connected dev client — onboarding, dev menu, and floating gear all suppressed:
npx --yes eas-cli@latest simulator:exec npx agent-device@latest open dev.example.app "<devClientURL>" --platform ios --relaunch \
  --launch-args "-EXDevMenuIsOnboardingFinished" --launch-args "1" \
  --launch-args "-EXDevMenuShowsAtLaunch" --launch-args "0" \
  --launch-args "-EXDevMenuShowFloatingActionButton" --launch-args "0"

#    b) a deep-link open can raise the system "Open in '<app>'?" dialog — accept it (waits up to 2.5s, no-op if absent):
npx --yes eas-cli@latest simulator:exec npx agent-device@latest alert accept 2500 --platform ios

#    c) the first bundle build+transfer over the tunnel is ~40-60s; wait, then screenshot to confirm the APP is up.
#       If it shows the launcher instead, the deep link didn't take — use the manual fallback below.

#    FALLBACK (only if the open lands on the launcher, not the app): enter the URL by hand. The labels
#    ("Enter URL manually"/"Connect"/"Reload"/"Go back") are expo-dev-client/expo-router UI, stable across
#    Expo apps but they can shift across versions — if one doesn't match, `snapshot -i` and press the current ref.
#      open dev.example.app --platform ios
#      press 'label="Enter URL manually"'  →  snapshot -i  →  fill @<field> "<manifest URL>"  →  press 'label="Connect"'
#      then press 'label="Reload"' (bundle), and press 'label="Go back"' if expo-router shows "Unmatched Route".

#    ── Dev-menu launch flags (the --launch-args above; iOS UserDefaults `-Key Value`, verified in
#       expo/expo packages/expo-dev-menu). By default the onboarding popup, auto-opened dev menu, and
#       floating gear all show and clutter screenshots — these three suppress them:
#         -EXDevMenuIsOnboardingFinished 1        skip the first-run onboarding popup (dev client AND Expo Go)
#         -EXDevMenuShowsAtLaunch 0               don't auto-open the dev menu at launch (dev client)
#         -EXDevMenuShowFloatingActionButton 0    hide the floating gear (defaults visible on both targets)
#       Expo Go takes the same flags — launch the installed Expo Go shell instead of a build:
#         open host.exp.Exponent "<exp:// or exp+... URL>" --platform ios --relaunch \
#           --launch-args "-EXDevMenuIsOnboardingFinished" --launch-args "1" \
#           --launch-args "-EXDevMenuShowFloatingActionButton" --launch-args "0"

# 4. Edit a source file locally → Fast Refresh pushes it to the remote sim with NO reload. Screenshot to confirm.
npx --yes eas-cli@latest simulator:exec npx agent-device@latest screenshot ./live.png

# 5. Stop the session AND Metro
npx --yes eas-cli@latest simulator:stop          # omit --id → stops the dotenv session
# kill the `expo start --tunnel` process
```

Notes:
- `open <bundleId> <devClientURL>` is the connect step: the deep link points the dev client at the remote Metro directly, so you skip the launcher (whose auto-discovery only scans the LAN). Manual "Enter URL manually" entry is the fallback for when the deep link doesn't land.
- If BOTH the direct open and the manual fallback fail, don't switch mechanisms or reconnect in a loop — reset to baseline and redo Mode C once (SKILL.md principle 1).
