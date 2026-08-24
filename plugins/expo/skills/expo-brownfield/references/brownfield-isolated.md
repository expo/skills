# Brownfield: Isolated Approach

Build the React Native + Expo code as a prebuilt native library, **AAR** on Android and **XCFramework** on iOS, and consume it from the existing native app like any other dependency.

> **Source of truth:** https://docs.expo.dev/brownfield/isolated-approach/ (setup and consumption walkthrough) and https://docs.expo.dev/versions/latest/sdk/brownfield/ (plugin options, CLI flags, publishing reference) — consult the canonical docs when exact code or option details matter. Docs URLs serve markdown with `.md` appended.

## When to use

- Native and React Native are owned by different teams or release on different cadences.
- The native team must not be required to install Node.js, Yarn, or React Native tooling.
- React Native code lives in a separate repo or monorepo from the native app.
- You want the smallest possible footprint on the existing native build pipeline.

If a single team owns both layers, is comfortable with React Native tooling and needs deep integration, see [./brownfield-integrated.md](./brownfield-integrated.md).

## What you produce

| Platform | Artifact                                                                                                                                                                                                                | Default location                                              |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Android  | `{group}:{libraryName}:{version}` AAR                                                                                                                                                                                   | Local Maven (`~/.m2`) by default; remote Maven also supported |
| iOS      | Set of `.xcframework`s — see [the iOS section below](#ios) for how `ios.buildReactNativeFromSource` (default `false` on SDK 56+) controls whether you get 5 frameworks or 2 — or a single Swift Package via `--package` | `./artifacts`                                                 |

The JavaScript bundle is **embedded inside the artifact** in release builds, so the native app does not need Metro at runtime in production.

## Prerequisites

- **Expo SDK 55 or later** — brownfield support, `expo-brownfield`, and the required runtime classes are only available on SDK 55+. Earlier SDKs will not work.
- **Node.js (LTS)** — runs JavaScript and the Expo CLI.
- **Yarn** — manages JavaScript dependencies.

Node and Yarn are only needed in the environment that _builds_ the artifact. The consuming native app does not need them.

---

## 1) Set up the Expo project

### Create a new Expo project

```sh
npx create-expo-app@latest my-project --template default@sdk-55
```

**Pin to SDK 55 or later — earlier SDKs do not support brownfield.** The project can live in a separate repo or alongside the native app in a monorepo; it does not need to be inside the native project.

### Install expo-brownfield

```sh
cd my-project
npx expo install expo-brownfield
```

The plugin self-registers in `app.json` with defaults derived from your app config.

### Check what the host app already ships

Before picking Expo modules, audit the host app's dependencies. The artifact's libraries meet the host's at build time, and version clashes surface as duplicate-class errors or forced upgrades.

- **Jetpack Compose** — `@expo/ui` re-declares recent Compose and Material3 versions, and is pulled transitively by `expo-router`. A host pinned to older Compose gets force-upgraded. Exclude it with `expo.autolinking.android.exclude` if the RN screens don't need it.
- **OkHttp, Kotlin stdlib, Material Components** — arrive as ordinary Maven dependencies of the artifact; Gradle resolves the highest version, which can bump the host's copies.

When a shared library must stay at the host's version, exclude the Expo module that brings it, or (with fused publishing, below) mark the group as host-provided.

### Configure the plugin (optional)

The defaults are usually fine. To override auto-generated names, expand the `expo-brownfield` entry in `app.json` plugins: iOS takes `targetName` (XCFramework target name) and `bundleIdentifier`; Android takes `libraryName` (AAR name), `group` (Maven group ID), `package`, `version`, and `publishing` (Maven targets — see [Publishing the Android AAR](#publishing-the-android-aar)). Full option schema: see the SDK reference linked in the banner.

### Speed up iOS builds with prebuilt Expo modules

Enable `expo-build-properties`'s `ios.usePrecompiledModules` so `pod install` downloads each Expo module as a prebuilt `.xcframework` instead of compiling it from source. `build:ios` detects those xcframeworks under `ios/Pods/` and bundles them into the Swift Package output alongside the brownfield framework, React, Hermes, and `ReactNativeDependencies`.

```json
{
  "expo": {
    "plugins": [
      ["expo-build-properties", { "ios": { "usePrecompiledModules": true } }],
      "expo-brownfield"
    ]
  }
}
```

When precompiled modules are detected, `build:ios` is pinned to a single flavor (`--debug` or `--release`) per package — Swift Package Manager has no per-configuration overload for `.binaryTarget(path:)`. Build once per flavor and distribute the two packages side by side.

---

## 2) Build the native libraries

### Android

```sh
npx expo-brownfield build:android
```

Produces an AAR and publishes it to the local Maven repository at `~/.m2`. The Maven coordinates come from the plugin config — e.g. `com.example:mybrownfield:1.0.0`.

#### Publishing the Android AAR

The plugin's `publishing` option (an array under the Android plugin config) controls where the AAR goes. Unset, it defaults to local Maven. Four `type` values: `localMaven`, `localDirectory` (with `path`), `remotePublic` (with `url`), `remotePrivate` (with `url`, `username`, `password`). For private repos, URL and credentials accept inline strings or `{ "variable": "ENV_VAR_NAME" }` to read from the environment at publish time. Exact JSON shape: SDK reference in the banner.

By default, `build:android` runs every declared publication. To pick specific publications or repositories from the command line:

```sh
npx expo-brownfield build:android --task publishReleasePublicationToCompanyRepository
npx expo-brownfield tasks:android   # list available publish tasks and repositories
```

#### Fused publishing (single fat AAR)

> **Version note:** requires minimum SDK 56. Earlier versions only support the per-module publishing above.

The default publish flow emits one Maven coordinate per autolinked Expo module. For remote distribution, `--fused` collapses everything into one fat AAR per build variant:

```sh
npx expo-brownfield build:android --fused --repo MavenLocal
```

This publishes two coordinates — `{group}:{libraryName}-fused-release` and `{group}:{libraryName}-fused-debug`, which the host wires per build type:

```kotlin
dependencies {
  releaseImplementation("com.example:mybrownfield-fused-release:1.0.0")
  debugImplementation("com.example:mybrownfield-fused-debug:1.0.0")
}
```

The debug AAR contains debug-compiled modules (dev menu, Metro reload); the release AAR embeds the JS bundle. Published metadata pins the matching React Native variant, so a debug host consuming only the release AAR still resolves release RN correctly.

Not everything is fused: the React Native runtime, Kotlin stdlib, host-common libraries (Material, Guava, OkHttp, Fresco), `androidx.*`, and detected KMP umbrella modules stay external and are declared as ordinary POM dependencies. Gradle properties tune the behavior for unusual dependency graphs:

| Property                              | Effect                                                                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `brownfield.fused.skip`               | Gradle project names to leave out of the AAR (pair with `strip-packages`).                                                           |
| `brownfield.fused.strip-packages`     | Package prefixes to remove from `ExpoModulesPackageList` — avoids `NoClassDefFoundError` for skipped modules.                        |
| `brownfield.fused.androidx-fuse`      | Extra `androidx.*` groups to fuse instead of keeping external.                                                                       |
| `brownfield.fused.exclude-transitive` | Extra groups to keep external (still declared in the POM).                                                                           |
| `brownfield.fused.host-provided`      | Groups the host already ships (e.g. Glide, Compose): excluded from the AAR **and** from the POM, so the host's version is untouched. |

### iOS

```sh
npx expo-brownfield build:ios
```

Outputs to `./artifacts`. The set depends on the `ios.buildReactNativeFromSource` flag (set via `expo-build-properties` in `app.json`):

- **`buildReactNativeFromSource: false`** (default on SDK 56+) — React Native is consumed as a prebuilt binary, so `build:ios` emits five xcframeworks side-by-side: `{TargetName}.xcframework`, `React.xcframework`, `ReactNativeDependencies.xcframework`, `ExpoModulesJSI.xcframework`, and `hermesvm.xcframework`.
- **`buildReactNativeFromSource: true`** (default on SDK 55, opt-in on SDK 56+) — React Native is compiled from source and statically linked into the brownfield framework, leaving two xcframeworks: `{TargetName}.xcframework` and `hermesvm.xcframework`.

**Every xcframework in the produced set must be embedded in the consuming app** (Embed & Sign). The Swift Package output below (`--package`) wires this for you automatically.

> **iOS deployment target:** the brownfield artifact inherits the Expo project's iOS deployment target (16.4 on SDK 56+). The consuming app's deployment target must be set to 16.4 or higher; otherwise Xcode will refuse to link the embedded frameworks. If the host app is on an older floor (e.g. iOS 14.0), bump its `IPHONEOS_DEPLOYMENT_TARGET` before adding the artifact.

#### Ship as a Swift Package (recommended)

Pass `--package [name]` to bundle the output as a self-contained Swift Package (a `Package.swift` plus every xcframework) instead of separate `.xcframework` directories. The host iOS app then consumes it via **Add Package Dependencies → Add Local** in Xcode and links every bundled framework automatically — no manual drag-and-drop, no per-framework "Embed & Sign" toggles.

```sh
npx expo-brownfield build:ios --release --package MyAppPackage
```

The flag accepts an optional name; if omitted, the package is named `{TargetName}Artifacts` under `./artifacts`.

When `usePrecompiledModules` is enabled, the package directory is suffixed with the build flavor (e.g. `MyAppPackage-release/`) and includes every prebuilt Expo module xcframework. Run `build:ios --debug --package …` and `build:ios --release --package …` separately, and point your host app at the matching package for each build configuration.

### Generate native projects for debugging

To inspect or debug the generated native code, run prebuild:

```sh
npx expo prebuild
```

This creates `android/` and `ios/` directories containing the brownfield wrappers:

**Android (Kotlin):** `ReactNativeHostManager`, `BrownfieldActivity`, `ReactNativeFragment`, `ReactNativeViewFactory`, `BrownfieldMessaging`.

**iOS (Swift):** `ReactNativeHostManager`, `ReactNativeViewController`, `ReactNativeView` (SwiftUI), `BrownfieldMessaging`, `ReactNativeDelegate`.

---

## 3) Consume from the native app

Exact consumption snippets mirror the walkthrough linked in the banner; what follows is the contract plus the failure modes.

### Android

#### Add the Maven dependency

Declare `implementation("com.example:mybrownfield:1.0.0")` in the host's `app/build.gradle.kts`, and register the repository it was published to.

> **Note:** when consuming from local Maven, `mavenLocal()` must be added under `dependencyResolutionManagement { repositories { ... } }` in `settings.gradle.kts`, not the deprecated top-level `allprojects { repositories { ... } }` block. Remote repositories go in the same `dependencyResolutionManagement` block, with credentials in Gradle's standard `maven { url = uri(...); credentials { ... } }` form.

#### Host app requirements

- **`minSdk` 24 or higher** — React Native's floor. Hosts below it fail at manifest merge with `uses-sdk:minSdkVersion XX cannot be smaller than version 24`.
- **Permissions merge in from the Expo modules** (e.g. storage permissions from media modules). Hosts that enforce a permission allowlist can strip unwanted entries in their manifest with `tools:node="remove"` or reconcile attribute conflicts with `tools:replace`.
- **Native libraries ship for every ABI enabled at publish time.** Left unfiltered, this can multiply the host APK size. Constrain ABIs when publishing (`reactNativeArchitectures=arm64-v8a` in the Expo project's `gradle.properties`) or filter in the host with `ndk.abiFilters` / APK splits.

#### Show a React Native screen

Create an activity extending `BrownfieldActivity` (from your library package) and call `showReactNativeFragment()` in `onCreate`. `BrownfieldActivity` extends `AppCompatActivity` and forwards configuration changes; `showReactNativeFragment()` registers the React Native root fragment and wires native back-button handling automatically. Register the activity in `AndroidManifest.xml` with a non-ActionBar theme (`Theme.AppCompat.Light.NoActionBar`) and the standard RN `configChanges` list, then launch it with a normal `startActivity(Intent(...))`.

### iOS

#### Add the artifacts to the Xcode project

If you built a **Swift Package** (`build:ios --package …`):

- In Xcode, **File → Add Package Dependencies… → Add Local…**, then select the generated package directory (e.g. `artifacts/MyAppPackage/`).
- Add the package's product to your app target. Xcode links every bundled XCFramework through the aggregate library product — no manual "Embed & Sign" step.
- If you produced both debug and release packages (because `usePrecompiledModules` is enabled), point the host app at the matching package per build configuration.

If you built **standalone XCFrameworks** (default output):

- Drag **every** `.xcframework` produced under `./artifacts` into the Xcode project navigator.
- In the import dialog, check **Copy items if needed** and add them to your app target.
- Under the app target's **General** tab → **Frameworks, Libraries, and Embedded Content**, set **every** framework to **Embed & Sign**. Forgetting one (commonly `hermesvm.xcframework`) is a leading cause of runtime "Library not loaded" crashes — see [./troubleshooting.md](./troubleshooting.md#ios-xcframework-signing-isolated-approach).

#### Initialize and present React Native

Call `ReactNativeHostManager.shared.initialize()` in `AppDelegate`'s `didFinishLaunchingWithOptions` — it must run **before any React Native view is created** (import your library module, e.g. `import MyAppBrownfield`). Then present a screen with:

- **UIKit** — push or present `ReactNativeViewController(moduleName: "main")`; the initializer also accepts `initialProps: [String: Any]` and `launchOptions`.
- **SwiftUI** — render `ReactNativeView(moduleName: "main")`, e.g. inside a `fullScreenCover`.

> **Note:** `moduleName` must match the name registered via `AppRegistry.registerComponent(...)` in the Expo project's JS entry point. The default Expo template registers `"main"`.

---

## Development vs. production

### Development (debug builds)

Start Metro in the Expo project:

```sh
npx expo start
```

Build and run the native app in debug. React Native screens load JS from the Metro dev server over HTTP with full hot reloading. The device or emulator must be able to reach the dev machine — see [./troubleshooting.md](./troubleshooting.md) if Metro connections fail.

### Production (release builds)

The JS bundle is embedded inside the AAR/XCFramework. Metro is not used. Build the native app in Release configuration and confirm the React Native screen loads.

---

## Related references

- [./brownfield-integrated.md](./brownfield-integrated.md) — Alternative: add RN directly to the native build.
- [./comparison.md](./comparison.md) — Decide between isolated and integrated.
- [./troubleshooting.md](./troubleshooting.md) — Common Metro, build, and integration issues.
