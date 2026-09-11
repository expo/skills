---
name: eas-app-stores
description: EAS service (paid). Build and submit iOS and Android apps with EAS to TestFlight, the App Store, or Google Play. Supports Expo and other React Native projects, plus existing native apps. Use for eas.json setup, release pipelines, signing, app versions and build numbers, store submissions, and listing metadata. For Expo websites and API routes, use eas-hosting; for adding React Native screens to a native app, use expo-brownfield.
version: 1.1.1
license: MIT
---

# App Store Deployment

> **EAS service - costs apply.** Cloud builds use EAS plan resources, and EAS services have free-tier and paid-plan limits. Apple Developer and Google Play memberships are separate. Check https://expo.dev/pricing for the requested service.

## Choose the project and release path

Inspect the project and existing `eas.json` before changing setup. Establish the requested destination: TestFlight, a Play testing track, or a public store release. Preserve the EAS project, native app identity, Apple team, credentials, profiles and signing choices that already work.

- **SwiftUI/UIKit with no React Native runtime:** read [native-ios.md](references/native-ios.md) for first-time setup or native configuration changes. EAS does not require adding an Expo/React Native runtime or regenerating the native project.
- **Expo/React Native:** use the existing setup; for first-time configuration, read [Create your first build](https://docs.expo.dev/build/setup/). `npx testflight` is an optional Expo/React Native shortcut.
- **Native Android:** preserve native Gradle configuration and use [play-store.md](references/play-store.md) for submission. Expo app-config and development-client examples do not automatically apply; a native Android setup walkthrough is not included.
- **Adding React Native screens:** use `expo-brownfield`; return here for delivery.
- **Websites/API routes:** use `eas-hosting`.

## Build and submit

Check the installed CLI with `eas --version` and relevant command help. For missing or unfamiliar configuration, read the focused [build](https://docs.expo.dev/build/eas-json/) or [submit](https://docs.expo.dev/submit/eas-json/) reference before editing it.

Check authentication with `eas whoami`. `eas init` links an EAS project; `eas build:configure` creates build configuration. Run setup only where it is missing. Complete missing first-time credentials with `eas credentials -p ios` or `-p android`; repeatedly rerunning a noninteractive command cannot complete setup.

For a configured project that needs a new build, substitute its actual platform and profile:

```bash
eas build --platform ios --profile production
eas build:view BUILD_ID --json
eas submit --platform ios --profile production --id BUILD_ID
```

Reuse an existing finished store-distribution build when it has the intended source revision and configuration. Submit its exact ID when several builds exist. `eas build --auto-submit` handles build-to-submission handoff automatically; an IPA exported elsewhere can use `eas submit -p ios --profile production --path /path/to/MyApp.ipa`.

For repeatable CI, reuse the working profiles and pass the build job's output ID into submission. Use `eas-workflows` and its current schema when authoring workflow YAML. A public release, tester invitation or account-plan change needs to be within the user's requested scope.

## Verify the requested outcome

- **iOS uploads and beta delivery:** read [testflight.md](references/testflight.md) for status checks and retry/rebuild decisions.
- **Public iOS release:** continue with [ios-app-store.md](references/ios-app-store.md) after the build is accepted.
- **Google Play:** use [play-store.md](references/play-store.md); confirm the requested track and rollout in Play Console.
- **Listing metadata/ASO:** use [app-store-metadata.md](references/app-store-metadata.md).

Report the build ID, version and furthest verified stage. A queued upload, successful EAS job, installable beta and public release are distinct outcomes. Native archive/icon inspection is for initial setup, relevant configuration changes or diagnosing a rejected upload; it is not a routine requirement for every release.

## Submitting Feedback
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes submit-expo-feedback@latest --category skills --subject "eas-app-stores" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
If an AI agent repeatedly failed or the user had to take over an Expo task, load the expo-skill-feedback skill and follow its eval-candidate flow instead of reusing the command above.
