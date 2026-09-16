---
name: expo-upgrade
description: "Framework (OSS). Upgrade an Expo SDK or resolve SDK dependency incompatibilities, including release-specific migrations and generated versus maintained native projects."
version: 1.0.1
license: MIT
---

# Upgrade an Expo SDK

Establish the current SDK, the requested target, package manager, and native project
ownership. Follow the [upgrade guide](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)
and the target SDK's [release notes](https://expo.dev/changelog). Use stable releases
unless a preview is requested or needed for the agreed task; `latest` is not a
substitute for an explicit target.

## Apply the upgrade

1. Inspect dependency versions, config plugins, patches, and install exclusions that affect the target SDK. Identify CNG-generated native folders versus manually maintained native projects; folder presence alone does not distinguish them.
2. Install the selected `expo` version using the existing package manager, then align compatible dependencies with `npx expo install --fix` and run `npx expo-doctor`. Preserve required peers, including `expo-constants` when required by Expo Router.
3. Apply the release notes' relevant source and config migrations. Resolve breaking changes in the APIs the app actually uses; do not combine the upgrade with unrelated styling, storage, or architecture migrations.
4. Update native projects by their ownership model. Regenerate disposable CNG output when needed; apply native upgrade changes and pods to manually maintained projects. Do not run `prebuild --clean` over hand-maintained native work.
5. Run the project's affected checks and build/run the target platforms. Rebuild a development client after native changes; Expo Go success alone does not verify autolinking in a custom build.

Incremental SDK upgrades usually make breakages easier to isolate. Check current
release notes for exceptions and known-bad versions before selecting intermediate
releases. A previously documented Hermes V1 memory regression affected SDK 55 with
V1 enabled, SDK 56, and SDK 57 before `expo@57.0.9` when importing Worklets/Reanimated.
Treat that range as a specific compatibility warning, not a permanent instruction
to jump every project to SDK 57. Verify the current fix/release guidance when this
case applies. Do not propose experimental Worklets Bundle Mode or a Hermes-version
override as a routine production workaround.

## Conditional migrations

Load only the references relevant to installed APIs and the target release:

- [React 19](./references/react-19.md): compatibility and optional syntax changes; existing `useContext`, providers, and `forwardRef` are not automatically broken.
- [New Architecture](./references/new-architecture.md): native dependency readiness and release-specific constraints.
- [React Compiler](./references/react-compiler.md): when compiler adoption is part of the task; it is not a prerequisite for every SDK upgrade.
- [Native tabs](./references/native-tabs.md): Router's changing component API.
- [expo-av audio](./references/expo-av-to-audio.md) or [video](./references/expo-av-to-video.md): when replacing those removed/deprecated APIs.
- [React Navigation imports](./references/react-navigation-to-expo-router.md): SDK 56+ Router entry-point migration.

A maintained community package is not deprecated just because Expo offers another
option. Do not replace AsyncStorage, vector icons, or LinearGradient solely to
follow a preference table. Check each package's support for the selected SDK.

Remove patches, exclusions, or Babel/Metro options only after establishing that
the target no longer needs them and the project has no custom behavior relying on
them. Clear only relevant caches when diagnosing a stale-cache failure; avoid
blanket dependency deletion and global Watchman resets as routine upgrade steps.
Update versioned documentation pointers only where they describe the upgraded app,
not historical fixtures or compatibility examples.

## Completion

Report the source/target versions, meaningful migrations, validation performed,
and remaining native/device checks. Keep upgrading and fixing failures within the
requested scope; an installed package and passing doctor check alone do not prove
the application works.

## Submitting Feedback
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes submit-expo-feedback@latest --category skills --subject "expo-upgrade" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
If an AI agent repeatedly failed or the user had to take over an Expo task, load the expo-skill-feedback skill and follow its eval-candidate flow instead of reusing the command above.
