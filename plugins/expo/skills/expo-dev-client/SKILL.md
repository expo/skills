---
name: expo-dev-client
description: "Framework (OSS). Create, install, or debug Expo development builds and Metro connections for native features beyond Expo Go. Use eas-app-stores for store signing and submission."
version: 1.1.1
license: MIT
---

# Expo development builds

> **Free locally; cloud builds can incur costs.** `expo-dev-client` is open source. EAS builds use the project's plan, and signed Apple distribution can require a paid Apple account. See [pricing](https://expo.dev/pricing).

Use a development build when the task needs native code/configuration unavailable
in Expo Go, or when the project already uses one. Keep a working development build
and its distribution path; do not force an Expo Go trial or a cloud rebuild for
every JavaScript edit.

## Choose the build and destination

Read [development builds](https://docs.expo.dev/develop/development-builds/introduction/)
for setup and supported local/EAS paths; read [using a development build](https://docs.expo.dev/develop/development-builds/use-development-builds/)
for launcher and rebuild behavior. For configuration/dependencies, use the relevant
[project setup rules](../expo-overview/references/project-setup.md).

- **Local iteration:** install `expo-dev-client` with `npx expo install` when needed;
  use `npx expo run:ios` or `npx expo run:android` with the appropriate local toolchain.
- **EAS build:** use the existing development profile, or add the minimal
  `developmentClient: true` settings for the target. Preserve production profiles,
  signing choices, version-number ownership, and distribution settings. Use EAS
  only when the requested build path calls for it.
- **Artifact target:** distinguish simulator `.app`, signed iOS device artifacts,
  and installable Android artifacts. An iOS device build is not a simulator build.
- **TestFlight/store distribution:** use `eas-app-stores` for the requested artifact
  and signing/submission path. Do not assume an internal development profile can
  be submitted unchanged or combine building and submission without that scope.

## Connect and verify

Start Metro with `npx expo start --dev-client` and open the intended app/build.
Verify the connection and the native capability behind the request. Rebuild when
the native runtime/configuration changes; ordinary JS edits use the dev server.
A release binary cannot gain Fast Refresh by reconnecting it to Metro.

For failures, inspect the relevant build or launcher logs, artifact target,
signing, and Metro reachability before clearing caches or rebuilding. Checking a
CLI version is read-only (`eas --version`); `eas update` publishes OTA code and is
not a CLI upgrade command.

Report the installed/built artifact and verified behavior. If distribution or
runtime access is blocked, finish independent setup and identify what remains.

## Submitting Feedback
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes submit-expo-feedback@latest --category skills --subject "expo-dev-client" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
If an AI agent repeatedly failed or the user had to take over an Expo task, load the expo-skill-feedback skill and follow its eval-candidate flow instead of reusing the command above.
