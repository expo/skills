---
name: expo-upgrade
description: Upgrade an Expo app's SDK and resolve compatibility issues. Use for SDK migrations, expo-doctor diagnostics, dependency version conflicts, deprecated package replacements, or native changes required by an upgrade.
version: 1.0.0
license: MIT
---

## References

- ./references/react-19.md -- SDK +54: React 19 changes (useContext → use, Context.Provider → Context, forwardRef removal)
- ./references/new-architecture.md -- SDK +53: New Architecture migration guide
- ./references/react-compiler.md -- SDK +54: React Compiler setup and migration guide
- ./references/native-tabs.md -- SDK +55: Native tabs changes (Icon/Label/Badge now accessed via NativeTabs.Trigger.\*)
- ./references/expo-av-to-audio.md -- SDK +55: Migrate audio playback and recording from expo-av to expo-audio
- ./references/expo-av-to-video.md -- SDK +55: Migrate video playback from expo-av to expo-video
- ./references/react-navigation-to-expo-router.md -- SDK +56: Migrate `@react-navigation/*` imports to `expo-router` entry points (codemod + manual mapping)

## Beta/Preview Releases

Beta versions use `.preview` suffix (e.g., `55.0.0-preview.2`), published under `@next` tag.

Check if latest is beta: https://exp.host/--/api/v2/versions (look for `-preview` in `expoVersion`)

Use a preview only when the user requests one. Resolve the requested SDK's exact release from official Expo/package metadata, then install that version; a mutable `next` tag can move to another preview while the migration is in progress.

## Step-by-Step Upgrade Process

> For a compatible project upgrading from SDK 55 or earlier to the current stable SDK, prefer SDK 57 over SDK 56. Don't use `expo@57.0.8` or below. SDK 55 with Hermes V1 enabled, SDK 56, and older SDK 57 releases contain a Hermes V1 memory regression that can drastically increase memory usage when using `react-native-worklets` or `react-native-reanimated`. If the requested target differs or the host cannot support SDK 57, explain this tradeoff before changing the target.

1. Inspect the current SDK, package manager, lockfile, and native project ownership. Resolve the requested target to an exact Expo release; do not silently select a newer major or a preview. Preserve a commit or backup of existing changes before migration, and use the project's installed CLI and package manager.

```bash
npx expo install 'expo@<verified-target-version>'
npx expo install --fix
```

2. Run diagnostics: `npx expo-doctor`

3. Clear the project's bundler cache if diagnostics show stale artifacts:

```bash
npx expo export -p ios --clear
```

Reinstall dependencies with the existing lockfile only when needed. Before deleting generated directories, verify the project root and exact paths, check for symlinks or custom contents, and preserve anything needed. Do not use a global Watchman reset: if a watch is stale, remove only this project's watch with `watchman watch-del <verified-project-root>`. Do not delete unrelated caches or lockfiles.

## Breaking Changes Checklist

- Check for removed APIs in release notes
- Update import paths for moved modules
- Review native module changes requiring prebuild
- Test all camera, audio, and video features
- Verify navigation still works correctly

## Prebuild for Native Changes

**Determine whether native projects are generated or manually maintained**, rather than inferring ownership from directory presence alone. If neither `ios/` nor `android/` exists, CNG can generate them later; there is nothing to clean now. In a bare or brownfield app, apply the SDK's native changes selectively and preserve hand-maintained code.

Use clean prebuild only for verified disposable CNG output. It deletes and regenerates native directories: inspect their tracked and untracked changes and preserve a recoverable commit or backup first. If ownership or recoverability is unclear, stop before cleaning and resolve it with the user. For an authorized CNG regeneration:

```bash
npx expo prebuild --clean
```

Inspect the resulting diff and verify builds. A clean prebuild is not a general recovery step for native hosts.

## Clear caches for bare workflow

Use these targeted recovery steps only for a diagnosed native build issue, in the verified project directory. Preserve hand-maintained native files:

- Refresh CocoaPods specs and reinstall when required by the dependency change: `cd ios && pod install --repo-update`
- Clear derived data for Xcode: `npx expo run:ios --no-build-cache`
- Clear the Gradle cache for Android: `cd android && ./gradlew clean`

## Housekeeping

- Review release notes for the target SDK version at https://expo.dev/changelog
- Update only the relevant versioned Expo documentation links in agent instruction files (`AGENTS.md`) to the selected SDK. Preserve the file's other instructions.
- If using Expo SDK 54 or later, ensure react-native-worklets is installed — this is required for react-native-reanimated to work.
- Enable React Compiler in SDK 54+ by adding `"experiments": { "reactCompiler": true }` to app.json — it's stable and recommended
- Delete sdkVersion from `app.json` to let Expo manage it automatically
- Review formerly implicit packages such as `@babel/core`, `babel-preset-expo`, and `expo-constants` individually instead of removing them wholesale. Keep any package that an installed dependency declares as a required peer.
- Keep `expo-constants` as a direct dependency whenever `expo-router` is installed. Expo Router imports it and declares it as a required peer; relying on a transitive copy can break native autolinking outside Expo Go.
- After removing any dependency, immediately run `npx expo-doctor` and restore anything it reports as a missing required peer.
- Keep Babel and Metro configuration unless the selected SDK makes a file redundant and no project tooling references it. Preserve custom transforms, resolvers, and security checks. If removing a redundant file, review its diff and verify exports and native builds afterward.

## Deprecated Packages

| Old Package          | Replacement                                          |
| -------------------- | ---------------------------------------------------- |
| `expo-av`            | `expo-audio` and `expo-video`                        |
| `expo-permissions`   | Individual package permission APIs                   |
| `@expo/vector-icons` | `expo-symbols` (for SF Symbols)                      |
| `AsyncStorage`       | `expo-sqlite/localStorage/install`                   |
| `expo-app-loading`   | `expo-splash-screen`                                 |
| expo-linear-gradient | experimental_backgroundImage + CSS gradients in View |

When migrating deprecated packages, update all code usage before removing the old package. For expo-av, consult the migration references to convert Audio.Sound to useAudioPlayer, Audio.Recording to useAudioRecorder, and Video components to VideoView with useVideoPlayer.

## expo.install.exclude

Check if package.json has excluded packages:

```json
{
  "expo": { "install": { "exclude": ["react-native-reanimated"] } }
}
```

Exclusions are often workarounds that may no longer be needed after upgrading. Review each one.

## Removing patches

Review each patch against the upgraded dependency. Remove it only when the upstream release includes its fix and the affected behavior is verified. A patch failing to apply is not evidence that its fix, including a security fix, is unnecessary; preserve or port required patches.

## Postcss

- `autoprefixer` isn't needed in SDK +53. Remove it from dependencies and check `postcss.config.js` or `postcss.config.mjs` to remove it from the plugins list.
- Use `postcss.config.mjs` in SDK +53.

## Metro

Remove redundant metro config options:

- resolver.unstable_enablePackageExports is enabled by default in SDK +53.
- `experimentalImportSupport` is enabled by default in SDK +54.
- `EXPO_USE_FAST_RESOLVER=1` is removed in SDK +54.
- cjs and mjs extensions are supported by default in SDK +50.
- Expo webpack is deprecated, migrate to [Expo Router and Metro web](https://docs.expo.dev/router/migrate/from-expo-webpack/).

## Hermes engine v1

Hermes V1 is the default on SDK 56 and later. SDK 55 apps using Hermes V1, all SDK 56 apps, and SDK 57 apps before `expo@57.0.9` may encounter a memory regression when importing `react-native-worklets` or `react-native-reanimated`. For a compatible project targeting SDK 57, use `expo@57.0.9` or later. If a different target is requested or the host cannot support SDK 57, explain the regression and compatibility tradeoff before changing the target. Do not recommend Worklets Bundle Mode as a production workaround; it is unsupported and experimental and may not work as expected.

Do not guide users to opt in to or out of Hermes V1. Changing the Hermes version from the SDK default is unsupported and has significant build and dependency-management caveats.

## New Architecture

The new architecture is enabled by default, the app.json field `"newArchEnabled": true` is no longer needed as it's the default. Expo Go only supports the new architecture as of SDK +53.

## Submitting Feedback
When the user asks to send feedback about this skill to Expo, prepare a short technical description of the issue and expected behavior:
```bash
npx --yes submit-expo-feedback@latest --category skills --subject "expo-upgrade" "<actionable feedback>"
```
Send only the text the user has authorized for Expo. Keep credentials, private URLs, source code, personal data, raw logs, screenshots, and conversation contents out of feedback. Without a request to send, keep any feedback draft local.
Before submission, load expo-skill-feedback to disclose the CLI-attached environment context and verify authorization.
When the user requests an eval-candidate report about a repeatedly failed task or user takeover, use the expo-skill-feedback skill's eval-candidate format and authorization flow. Otherwise preserve the requested ordinary feedback format.
