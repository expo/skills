# Expo brownfield playgrounds

Runnable iOS fixtures for the [expo-brownfield skill](../../../plugins/expo/skills/expo-brownfield/SKILL.md). They exercise the same Expo feature in a native SwiftUI host through either an integrated native build or an isolated XCFramework package. These fixtures belong to this repository; they are not bundled into the installed Expo plugin.

The feature accepts initial props, requests a native context update, returns a selection, cancels, and displays a bundled image. The host keeps its own navigation and shows presentation/completion counters so repeated opening and dismissal are observable.

## Requirements and versions

Use macOS with Node, npm, CocoaPods, and Xcode. Isolated consumers also use [XcodeGen](https://github.com/yonaskolb/XcodeGen) to generate the small host project. Install these tools before setup; the scripts install only the fixture's locked JavaScript dependencies and pods.

| Fixture | Expo / brownfield / React Native | Documented Node / Xcode minimum | iOS minimum |
| --- | --- | --- | --- |
| SDK 57 (current fixture) | 57.0.21 / 57.0.18 / 0.86.3 | 22.13.x / 26.4 | 16.4 |
| SDK 55 (historical regression fixture) | 55.0.31 / 55.0.28 / 0.83.10 | 20.19.x / 26.2 | 15.1 |

These are reproducible snapshots, not instructions to pin every new app to these versions. Check [Expo's compatibility table](https://docs.expo.dev/versions/latest/) when upgrading a snapshot. Both approaches and both SDKs use separate working directories.

Commands below start from this directory:

```sh
cd tests/fixtures/expo-brownfield
```

Metro defaults to **8097**. If that port is occupied, choose another at setup time with `BROWNFIELD_METRO_PORT=8098 node scripts/prepare.mjs ...` and use the generated `npm start` command, which remembers that port. The selected value is stored in the app's Info.plist for both host approaches. Scripts do not stop other Metro servers.

## Integrated SwiftUI app

```sh
node scripts/prepare.mjs 57 integrated
open .build/sdk-57/integrated/producer/ios/BrownfieldFixture.xcworkspace
```

The script copies the shared feature and selected lockfile, runs `npm ci`, generates a disposable native project, installs the handwritten SwiftUI host, and installs pods. Select the **BrownfieldFixture** scheme and your iOS simulator in Xcode.

For Debug, run Metro in another terminal before opening the feature:

```sh
cd .build/sdk-57/integrated/producer
npm start
```

For Release, edit the scheme's Run configuration to **Release**, stop this fixture's Metro, then build and run again. JS and assets are embedded by the native build phase.

To use the historical SDK 55 fixture, replace `57` with `55` in the commands and paths.

**This bootstraps a test host, not an arbitrary native app migration.** After setup, its native project contains handwritten SwiftUI code. Do not run prebuild over it. Real integrated apps must merge the SDK's native changes into their existing host and preserve its entry point, targets, and native source.

## Isolated SwiftUI consumer

Prepare the producer, then build a Debug package:

```sh
node scripts/prepare.mjs 57 isolated
cd .build/sdk-57/isolated/producer
npx expo-brownfield build:ios --debug --artifacts ./artifacts-debug --package BrownfieldFixture
```

Return to the fixture directory and configure the independent native host:

```sh
cd ../../../..
node scripts/configure-host.mjs 57 Debug
open .build/sdk-57/isolated/host/BrownfieldHost.xcodeproj
```

The helper reads the generated `Package.swift` with `swift package dump-package` and selects its actual library products. This handles both SDK 55's separate products and SDK 57's aggregate precompiled-module product. The host imports **MyBrownfield**, the configured Swift module name. It has no CocoaPods or Node dependency of its own.

Select the **BrownfieldHost** scheme and a simulator. Start Metro from the isolated producer with `npm start`, then run the Debug host.

For Release, stop this fixture's Metro and build the Release artifact:

```sh
cd .build/sdk-57/isolated/producer
npx expo-brownfield build:ios --release --artifacts ./artifacts-release --package BrownfieldFixture
cd ../../../..
node scripts/configure-host.mjs 57 Release
open .build/sdk-57/isolated/host/BrownfieldHost.xcodeproj
```

Set the host scheme's Run configuration to **Release** before running. Repeat `configure-host.mjs` when switching back to Debug. It preserves Swift source edits but regenerates the Xcode project/Info.plist. Xcode does not select the matching local binary package automatically. Keep Debug and Release artifact directories separate because packaging can clear the selected output directory.

The artifact CLI builds device and simulator slices. To restrict local validation to arm64 without signing, set `XCODE_XCCONFIG_FILE` to an **absolute** path to `ios/arm64.xcconfig` when invoking the CLI. This optional override does not establish physical-device or signing coverage.

## Play with the app

After setup, edit `Feature.tsx` in your chosen `.build/.../producer/` and use Metro/Fast Refresh in Debug. Edit the integrated host at `producer/ios/BrownfieldFixture/AppDelegate.swift`, or the isolated host under `host/Sources/`. Rebuild native code after Swift or native dependency changes. Rebuild the Release artifact when changing isolated Release JS/assets.

Each SDK/approach has a distinct bundle identifier, so the four apps can coexist on a simulator. The setup script refuses to overwrite an existing playground. To recreate one, save your edits and move aside that specific `.build/sdk-<version>/<approach>/` directory before rerunning setup. This also applies after a partial setup failure.

To share improvements, move the relevant edits back into `app/`, `ios/`, or `sdks/`. Commit source and lockfiles, never `.build/`, pods, node_modules, XCFrameworks, signing material, or DerivedData.

## Acceptance checklist

1. Launch the native app. Open **Open native details** and return; native navigation should work.
2. Open the feature. Confirm **Hello: 123** and the bundled image.
3. Tap **Refresh greeting**. Confirm **Updated hello: 123** (native-to-JS reply).
4. Tap **Done**. The sheet closes; the host shows **item-42**, **Completed: 1**, **Presented: 1**.
5. Reopen. Confirm fresh input **Hello: 456**. Cancel; the completion count stays at 1. Reopen again and swipe down to dismiss; completion still stays at 1.
6. Reopen and complete. Exactly one additional completion should be recorded.
7. Repeat the main flow in Release with the fixture Metro stopped. Check the image and native navigation again.

**Native dismiss API** is a diagnostic button. It should dismiss the isolated generated SwiftUI wrapper. The custom integrated controller has no corresponding handler; use **Done** or **Cancel** there. Initial required data is supplied as props because an eager startup message/reply was missed during the original SDK 55 cold-launch test.

## Validation record

On 2026-09-07, the original SDK 55 isolated and integrated SwiftUI hosts were built and exercised in Debug and Release on an iPhone 17 simulator running iOS 26.1 with Xcode 26.1.1. Props, later messages, results, cancellation, reopening, Release assets without Metro, and original native navigation passed. That Xcode is below Expo's documented SDK 55 minimum; the observed pass does not change supported toolchain requirements.

The checked-in fixture helpers were then exercised from this repository: Both SDKs and both approaches prepared successfully, the SDK 55 integrated Release app was rebuilt, and the isolated host was rebuilt against the earlier SDK 55 Release artifact with identical feature/entry/image source. Debug/Release package switching preserved host Swift edits, and repeated setup refused to overwrite existing playgrounds. Both SDK 55 Release hosts loaded the feature, received the later greeting reply, and returned one completion without Metro.

On 2026-09-09, the SDK 57 fixture was updated to Expo 57.0.21, `expo-brownfield` 57.0.18, and React Native 0.86.3. Both hosts were built with Xcode 26.6 (17F113) and exercised in Debug and Release on an iPhone 17 simulator running iOS 26.5 (23F77). Dependency and TypeScript checks passed. The tested feature, host sources, and npm lockfiles matched the checked-in fixtures.

Both hosts passed the acceptance checklist: initial props and image, later greeting reply, exactly one completion per Done tap, fresh input on reopening, cancellation, swipe dismissal, and native navigation. Both Release apps passed with the fixture Metro stopped. The isolated native dismiss API also closed its sheet without recording a completion; the integrated diagnostic remained a no-op as documented. Debug and Release isolated consumers used their matching generated aggregate Swift Package products. No Expo or React Native package source was patched.

These are iOS simulator fixtures. Android, physical devices, signing, EAS, Updates, deep links, push callbacks, arbitrary host migrations, and memory/leak instrumentation were not validated. Record versions, destination, build configuration, and observed results when using these fixtures for a new SDK.

## Source layout

- `app/`: shared feature, explicit `main` registration, TypeScript config, image probe.
- `sdks/55/` and `sdks/57/`: package manifests and npm lockfiles.
- `ios/integrated/`: retained runtime, SwiftUI host, and embedded controller.
- `ios/isolated/`: independent SwiftUI host consuming Expo's generated wrapper.
- `scripts/`: setup and package-to-host configuration helpers.
- `.build/`: ignored playground copies, dependencies, generated projects, and artifacts.
