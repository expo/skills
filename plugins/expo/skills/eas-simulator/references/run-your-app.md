# Get the right app onto the remote device

These examples use the EAS CLI 23.2.0 command surface and POSIX shell syntax. Run from the intended EAS-linked project directory; use current `--help` if a flag differs. Replace example IDs, schemes, paths, ports, and URLs with values discovered from the app and CLI output. On Windows, use a compatible shell or translate shell syntax for PowerShell.

## Expo Go or a development build: prepare Metro

Use Expo Go when it can represent the app and the feature under test. It needs no custom app build. Use the project's development client when native dependencies, configuration, or the test require it; see the sibling `expo-dev-client` skill.

Run Metro in a persistent terminal/process on a free port owned by this task:

```bash
# Expo Go
npx expo start --go --tunnel --port 8082
# Development client (alternative)
npx expo start --dev-client --tunnel --port 8082
```

The remote device cannot reach your laptop's `localhost` or private LAN address. Keep Metro and its tunnel alive throughout testing; do not use `expo start --ios`, which opens a simulator on the Metro host.

For a supported Expo CLI in a headless/robot-account environment, the account-signed tunnel is another option:

```bash
EXPO_UNSTABLE_TUNNEL_V2=1 npx expo start --go --tunnel --port 8082
```

This experimental flag depends on the installed Expo CLI and account/project linkage. Plain ngrok tunneling rejects robot users. Follow the actual error when the signed tunnel cannot be created; setting the flag on an older CLI does not guarantee it is active. Do not set `EXPO_FORCE_WEBCONTAINER_ENV` to work around a port error: it changes tunnel behavior and can select a legacy path restricted to 8081.

Use the deep link printed by Metro. On CLIs supporting the [open endpoint](https://docs.expo.dev/more/expo-cli/#open-endpoint), get it without launching anything locally:

```bash
curl --fail --silent --show-error \
  'http://localhost:8082/_expo/open?platform=ios&runtime=expo'
# Development client: runtime=custom. Android: platform=android.
# Read the response's `url`; with --tunnel it should use the public tunnel host.
```

If that endpoint is unavailable, use Metro's printed URL. Expo Go uses an `exp://` or `exps://` deep link; a development client uses its configured scheme with an encoded Metro URL, such as `myapp://expo-development-client/?url=<encoded-url>`. Do not guess the scheme from the project slug or replace the app deep link with a browser URL.

## Install and launch at session startup

After the access/ownership checks in `SKILL.md`, start **one** of these sessions:

```bash
# Expo Go: SDK inferred from the project; --sdk-version can select it explicitly.
npx --yes eas-cli@latest sim --platform ios --type agent-device \
  --expo-go --open-url '<deep-link-from-Metro>' \
  --name 'Search flow verification' --tag skill-check \
  --max-idle-time-minutes 15 --non-interactive
```

```bash
# Existing EAS build: must target the chosen simulator/emulator platform.
npx --yes eas-cli@latest sim --platform ios --type agent-device \
  --build-id <build-id> --open-url '<development-client-deep-link>' \
  --name 'Development build search flow' --max-idle-time-minutes 15 \
  --non-interactive
```

```bash
# A standalone app from a workflow or other artifact source; no Metro required.
npx --yes eas-cli@latest sim --platform ios --type agent-device \
  --application-archive-url '<download-url>' \
  --name 'Swift onboarding verification' --max-idle-time-minutes 15 \
  --non-interactive
```

`--expo-go`, `--build-id`, and `--application-archive-url` are alternative sources. Omit `--open-url` for standalone builds. Launch options require an application source. Local paths do not belong in `--application-archive-url`; install those after boot instead.

To select a device, add `--device '<remote-device-name>'`. Current start help accepts an iOS device name/UDID or an Android AVD hardware profile ID. Choose from the remote runner's available devices; local Xcode's inventory does not describe the cloud runner.

Record the ID as soon as the CLI reports session creation. Startup waits for connection data. If it is slow, inspect `sim:get --id <session-id> --json` and `sim:events --id <session-id> --follow` instead of creating another session. Confirm status `IN_PROGRESS` and the expected controller's `remoteConfig`; then verify the app separately.

### Connection output and controller attachment

By default, the CLI writes `.env.eas-simulator`. In **23.2.0, even `--json` writes this file after readiness**; it only skips the early ID-only write. Use **`--out-config-type env --json`** when you need machine-readable connection data without that shared file. Store output privately: `remoteConfig` contains credentials. See [controllers.md](./controllers.md) for explicit connection handling.

In the single-session dotenv flow, first confirm the file's ID matches the recorded session and the connection variables exist without printing their values:

```bash
npx --yes eas-cli@latest sim:exec node -e '
  for (const key of ["EAS_SIMULATOR_SESSION_ID", "AGENT_DEVICE_DAEMON_BASE_URL", "AGENT_DEVICE_DAEMON_AUTH_TOKEN"])
    if (!process.env[key]) throw new Error("Missing remote session variable: " + key);
  console.log("Session:", process.env.EAS_SIMULATOR_SESSION_ID);
'
```

Then attach to the installed app. EAS's startup launch does not create the agent-device interaction session:

```bash
# Use the discovered bundle/package ID; Expo Go's installed name is "Expo Go".
npx --yes eas-cli@latest sim:exec npx --yes agent-device@latest \
  open '<app-id-or-Expo-Go>' --foreground --platform ios
npx --yes eas-cli@latest sim:exec npx --yes agent-device@latest \
  wait text 'Expected app landmark' 30000
```

Handle any visible launcher, onboarding, or system dialog before claiming the app loaded. If `--open-url` did not connect, inspect Metro and app state, then open the known app deep link through the controller. For a development-client launcher, entering Metro's manifest URL manually is a fallback; fill the actual input node, then use its Connect action.

Optional iOS dev-menu settings can reduce overlays **after** identifying the app state. EAS accepts one token per `--launch-arg`; agent-device's equivalent on `open` is repeatable `--launch-args`:

```bash
--launch-arg '-EXDevMenuIsOnboardingFinished' --launch-arg '1' \
--launch-arg '-EXDevMenuShowsAtLaunch' --launch-arg '0' \
--launch-arg '-EXDevMenuShowFloatingActionButton' --launch-arg '0'
```

These are Expo runtime settings, not universal native-app launch arguments. Do not suppress a dev-menu/onboarding surface when that is what the test needs to exercise.

## When a build is necessary

### Expo / React Native

Inspect existing build profiles before adding one. For EAS Build, these example profiles distinguish live development from a standalone preview; merge only the needed profile into `eas.json`:

```json
{
  "build": {
    "development-simulator": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": true },
      "android": { "buildType": "apk" }
    },
    "preview-simulator": {
      "distribution": "internal",
      "ios": { "simulator": true },
      "android": { "buildType": "apk" }
    }
  }
}
```

```bash
npx --yes eas-cli@latest build --platform ios \
  --profile development-simulator --non-interactive
```

A development-client profile also needs `expo-dev-client` installed and configured. iOS simulator builds do not require Apple distribution credentials. Android needs an installable `.apk`, not a store `.aab`.

For a local Mac build, use the project's existing native build procedure. If the app uses Expo's generated native projects, prebuild only when needed; do not run `prebuild --clean` over maintained native changes. A workspace-based example:

```bash
xcodebuild -workspace ios/MyApp.xcworkspace -scheme MyApp \
  -configuration Debug -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath .sim-build build
```

Discover the actual product path and bundle ID from build settings / the built `Info.plist`. Use Release and a bundled JS build for standalone verification. Reuse development binaries only when native dependencies/configuration are compatible. A JS-only edit should not trigger a native build; a native patch must actually be compiled into the artifact being tested.

### Native Swift / SwiftUI

Build the app's shared Xcode scheme for `generic/platform=iOS Simulator`, locally or with the [macOS workflow](./workflows.md). Use `-project MyApp.xcodeproj` for a project or `-workspace MyApp.xcworkspace` when required. A device `.ipa` or macOS `.app` cannot run in the iOS Simulator. Confirm simulator architecture and minimum OS compatibility when moving artifacts between machines.

## Install a local artifact after boot

Start a session without an application source, then use the controller's upload path:

```bash
npx --yes eas-cli@latest sim:exec npx --yes agent-device@latest \
  install com.example.myapp './path/to/MyApp.app' --platform ios
npx --yes eas-cli@latest sim:exec npx --yes agent-device@latest \
  open com.example.myapp --foreground --platform ios
```

For Android, use the actual package ID, `.apk` path, and `--platform android`. For a remote artifact on an already-running session, `install-from-source '<download-url>' --platform ios` lets the daemon fetch it. Installation does not prove launch or app readiness; open the intended app and verify its landmark. After native edits, rebuild and reinstall; for JS edits in Expo Go/development builds, verify Fast Refresh instead.

Finish with `sim:stop --id <session-id> --json` and stop the Metro process owned by this task, unless the session is explicitly being handed off for continued use.
