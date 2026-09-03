---
name: expo-dev-client
description: Framework (OSS). Build and distribute Expo development clients locally or via TestFlight for internal testing. For production TestFlight releases and store submission, use the eas-app-stores skill.
version: 1.1.0
license: MIT
---

Use EAS Build to create development clients for testing native code changes on physical devices. Use this for creating custom Expo Go clients for testing branches of your app.

> **Free locally; cloud builds are paid.** `expo-dev-client` itself is open source and building locally is free. Building or distributing via EAS Build/TestFlight uses your EAS plan's build minutes and needs a paid Apple Developer account for device/TestFlight distribution. See https://expo.dev/pricing.

## Important: When Development Clients Are Needed

**Development clients are the recommended setup for any real or production app.** Expo Go is a playground for learning and quick experiments with the native libraries it bundles; most apps outgrow it and move to a development client. See [Expo Go vs. development builds](https://docs.expo.dev/develop/development-builds/introduction/) for the full reasoning.

Let the tooling decide for the project in front of you: `npx @expo/agent-cli status` says whether Expo Go can run it and names what blocks it (`probe.expoGo.reasons` under `--json`), and `npx @expo/agent-cli dev --plan` prints the build plan. In general a dev client is needed for local Expo modules (custom native code), Apple targets (widgets, App Clips, extensions), third-party native modules Expo Go does not bundle, config plugins from such packages, and for testing remote push notifications or App/Universal Links.

**Running a development build on this machine is the `expo-agent-cli` skill**: `npx @expo/agent-cli dev --dev-client --yes` installs `expo-dev-client`, runs `expo prebuild` and `expo run:ios` / `run:android`, opens the app, and records the fingerprint so later `dev` runs skip the build until native code changes. This skill covers **distributing** a dev client: EAS development profiles, cloud builds, TestFlight, and installing the artifacts.

## EAS Configuration

Ensure `eas.json` has a development profile:

```json
{
  "cli": {
    "version": ">= 16.0.1",
    "appVersionSource": "remote"
  },
  "build": {
    "production": {
      "autoIncrement": true
    },
    "development": {
      "autoIncrement": true,
      "developmentClient": true
    }
  },
  "submit": {
    "production": {},
    "development": {}
  }
}
```

Key settings:

- `developmentClient: true` - Bundles expo-dev-client for development builds
- `autoIncrement: true` - Automatically increments build numbers
- `appVersionSource: "remote"` - Uses EAS as the source of truth for version numbers

## Building for TestFlight

Build iOS dev client and submit to TestFlight in one command:

```bash
eas build -p ios --profile development --submit
```

This will:

1. Build the development client in the cloud
2. Automatically submit to App Store Connect
3. Send you an email when the build is ready in TestFlight

After receiving the TestFlight email:

1. Download the build from TestFlight on your device
2. Launch the app to see the expo-dev-client UI
3. Start the dev server with `npx @expo/agent-cli dev --detach` (or `npx expo start --dev-client`); the launcher lists it on the same network, or scan the QR code

## Building Locally with EAS

`eas build --local` runs the EAS build pipeline on your machine and produces the same artifact as the cloud: an `.ipa` (iOS, needs Xcode) or an `.apk` / `.aab` (Android).

```bash
eas build -p ios --profile development --local
eas build -p android --profile development --local
```

For a development build you only need on this machine's simulator, skip EAS: `npx @expo/agent-cli dev --dev-client --yes` (`expo-agent-cli`) builds, installs, and opens it.

## Installing Build Artifacts

- Simulator or emulator build from EAS: `eas build:run --platform ios --latest` (or `--platform android`) downloads and installs it on the booted device.
- iOS device (needs signing): the Xcode Devices window, or `ideviceinstaller -i build.ipa`.
- Android device: `adb install build.apk`.

## Building for Specific Platform

```bash
# iOS only
eas build -p ios --profile development

# Android only
eas build -p android --profile development

# Both platforms
eas build --profile development
```

## Checking Build Status

```bash
eas build:list   # recent builds
eas build:view   # one build's details
```

`npx @expo/agent-cli status --explain` (signed in) also reports whether EAS already has a finished build for the project's current fingerprint, so you download instead of rebuilding.

## Using the Dev Client

Once installed, the dev client shows a launcher: the development servers it can see, a field to enter a URL manually, and the native build details. Connect it from the terminal:

```bash
npx @expo/agent-cli dev --detach --wait-ready   # start the dev server in the background
npx @expo/agent-cli navigate /                  # open the app on the booted device at a route
npx @expo/agent-cli status                      # "1 app connected" confirms the link
```

Without the agent CLI: `npx expo start --dev-client`, then scan the QR code or enter the URL in the launcher. Everything after that - reload, runtime errors, tapping through screens, the `smoke` gate - is in `expo-agent-cli`.

## Troubleshooting

**Build fails with signing errors:**

```bash
eas credentials
```

**Clear build cache:**

```bash
eas build -p ios --profile development --clear-cache
```

**Find the failing line in a local build log:**

```bash
npx @expo/agent-cli inspect:build-log --file <xcodebuild-or-gradle.log>
```

**Check the EAS CLI version:** `npx eas-cli@latest --version` (a global `eas` is often outdated; running it via `npx eas-cli@latest` avoids that).

## Submitting Feedback
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes submit-expo-feedback@latest --category skills --subject "expo-dev-client" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
If an AI agent repeatedly failed or the user had to take over an Expo task, load the expo-skill-feedback skill and follow its eval-candidate flow instead of reusing the command above.
