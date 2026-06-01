---
name: upgrading-expo
description: Guidelines for upgrading Expo SDK versions and fixing dependency issues
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

## Review CHANGELOG Breaking Changes

Before touching the codebase, fetch the official changelog and surface every breaking change between the user's current SDK and the target SDK.

1. Detect versions:
   - Current SDK: `expo` version in `package.json`
   - Target SDK: the version being upgraded to (latest, `@next`, or user-specified)

2. Fetch the raw CHANGELOG:

   `https://raw.githubusercontent.com/expo/expo/main/CHANGELOG.md`

3. The file is organized as:

   ```
   ## Unpublished
   ### 🛠 Breaking changes
   - Entry ([#12345](pr-link) by [@author](user-link))
   ## 55.0.0 — YYYY-MM-DD
   ### 🛠 Breaking changes
   - ...
   ```

   Extract the `### 🛠 Breaking changes` block from every `## <version>.0.0` heading where `current < version ≤ target`. If target is a beta/preview, also include the `## Unpublished` section.

4. Filter to what's relevant for this project:
   - Cross-reference the user's `package.json` — drop entries for packages they don't depend on (e.g., skip `expo-dev-menu` if not installed).
   - Drop entries that are clearly internal-only (changes to test fixtures, CI, or `expo-modules-core` internals not exposed to app developers).
   - For topics covered by existing reference files in this skill (e.g., `expo-av` → see `./references/expo-av-to-audio.md` and `./references/expo-av-to-video.md`), point the user to the reference instead of restating the migration.

5. Present the result as a bulleted list grouped by package, preserving the original PR links so the user can dig deeper:

   ```
   ### expo-router (SDK 55)
   - Removed `useNavigationContainerRef` ([#12345](...))

   ### react-native (SDK 54 → 55)
   - Minimum iOS version bumped to 15.1 ([#23456](...))
   ```

6. Ask the user to confirm before proceeding to install. Pause if any entry requires non-trivial code changes.

## Beta/Preview Releases

Beta versions use `.preview` suffix (e.g., `55.0.0-preview.2`), published under `@next` tag.

Check if latest is beta: https://exp.host/--/api/v2/versions (look for `-preview` in `expoVersion`)

```bash
npx expo install expo@next --fix  # install beta
```

## Step-by-Step Upgrade Process

1. Review breaking changes (see "Review CHANGELOG Breaking Changes" above)

2. Upgrade Expo and dependencies

```bash
npx expo install expo@latest
npx expo install --fix
```

3. Run diagnostics: `npx expo-doctor`

4. Clear caches and reinstall

```bash
npx expo export -p ios --clear
rm -rf node_modules .expo
watchman watch-del-all
```

## Breaking Changes Checklist

- Check for removed APIs in release notes
- Update import paths for moved modules
- Review native module changes requiring prebuild
- Test all camera, audio, and video features
- Verify navigation still works correctly

## Prebuild for Native Changes

**First check if `ios/` and `android/` directories exist in the project.** If neither directory exists, the project uses Continuous Native Generation (CNG) and native projects are regenerated at build time — skip this section and "Clear caches for bare workflow" entirely.

If upgrading requires native changes:

```bash
npx expo prebuild --clean
```

This regenerates the `ios` and `android` directories. Ensure the project is not a bare workflow app before running this command.

## Clear caches for bare workflow

These steps only apply when `ios/` and/or `android/` directories exist in the project:

- Clear the cocoapods cache for iOS: `cd ios && pod install --repo-update`
- Clear derived data for Xcode: `npx expo run:ios --no-build-cache`
- Clear the Gradle cache for Android: `cd android && ./gradlew clean`

## Housekeeping

- Review release notes for the target SDK version at https://expo.dev/changelog
- If using Expo SDK 54 or later, ensure react-native-worklets is installed — this is required for react-native-reanimated to work.
- Enable React Compiler in SDK 54+ by adding `"experiments": { "reactCompiler": true }` to app.json — it's stable and recommended
- Delete sdkVersion from `app.json` to let Expo manage it automatically
- Remove implicit packages from `package.json`: `@babel/core`, `babel-preset-expo`, `expo-constants`.
- If the babel.config.js only contains 'babel-preset-expo', delete the file
- If the metro.config.js only contains expo defaults, delete the file

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

Check if there are any outdated patches in the `patches/` directory. Remove them if they are no longer needed.

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

Since SDK 55, users can opt-in to use Hermes engine v1 for improved runtime performance. This requires setting `useHermesV1: true` in the `expo-build-properties` config plugin, and may require a specific version of the `hermes-compiler` npm package. Hermes v1 will become a default in some future SDK release.

## New Architecture

The new architecture is enabled by default, the app.json field `"newArchEnabled": true` is no longer needed as it's the default. Expo Go only supports the new architecture as of SDK +53.
