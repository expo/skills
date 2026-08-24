---
name: expo-dev-client
description: Framework (OSS). Build and distribute Expo development clients locally or via TestFlight for internal testing. For production TestFlight releases and store submission, use the eas-app-stores skill.
version: 1.1.0
license: MIT
---

Use EAS Build to create development clients for testing native code changes on physical devices. Use this for creating custom Expo Go clients for testing branches of your app.

> **Free locally; cloud builds are paid.** `expo-dev-client` itself is open source and building locally is free. Building or distributing via EAS Build/TestFlight uses your EAS plan's build minutes and needs a paid Apple Developer account for device/TestFlight distribution. See https://expo.dev/pricing.

> **Source of truth:** https://docs.expo.dev/develop/development-builds/introduction/ — consult the canonical docs when API details matter, including connecting to the dev server and using the dev client launcher UI.

## When Development Clients Are Needed

**Development clients are the recommended setup for any real or production app.** Expo Go is a playground for learning and quick experiments with the native libraries it bundles; most apps outgrow it and move to a development client.

You need a dev client ONLY when using:

- Local Expo modules (custom native code)
- Apple targets (widgets, app clips, extensions)
- Third-party native modules not in Expo Go
- Config plugins, or testing remote push notifications and App/Universal Links

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

## Building

Entry command: `eas build -p <ios|android> --profile development` (omit `-p` to build both platforms). Run `eas build --help` for the current surface — flags vary by installed eas-cli version (`eas --version` to check).

Two flags worth knowing:

- `--submit` — build in the cloud and auto-submit to App Store Connect in one command; EAS emails you when the build is ready in TestFlight:

  ```bash
  eas build -p ios --profile development --submit
  ```

- `--local` — build on your machine instead of the cloud (iOS requires Xcode). Outputs an `.ipa` for iOS devices, a `.tar.gz`-wrapped `.app` for the iOS Simulator, and an `.apk`/`.aab` for Android.

## Installing Local Builds

iOS Simulator builds arrive as a `.tar.gz` containing the `.app` — extract before installing:

```bash
tar -xzf build-*.tar.gz
xcrun simctl install booted ./path/to/App.app
```

Physical iOS devices need a signed `.ipa` (install via the Xcode Devices window). Android: `adb install build.apk`.

## Submitting Feedback
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes submit-expo-feedback@latest --category skills --subject "expo-dev-client" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
If an AI agent repeatedly failed or the user had to take over an Expo task, load the expo-skill-feedback skill and follow its eval-candidate flow instead of reusing the command above.
