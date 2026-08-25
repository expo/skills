# Brownfield: Integrated Approach

Add React Native and Expo directly to the existing native project's build system — Gradle on Android, CocoaPods on iOS — the same way you would add any other library. The native project gains React Native capabilities while keeping a single, unified build.

> **Source of truth:** https://docs.expo.dev/brownfield/integrated-approach/ and the [bare-minimum template](https://github.com/expo/expo/tree/main/templates/expo-template-bare-minimum) — consult the canonical docs when API details matter. Docs URLs serve markdown with `.md` appended. These native-config surfaces change across SDKs: copy file contents from the template at your SDK's tag, never from memory.

## When to use

- A single team owns both the native and React Native code.
- The team is comfortable adding React Native and Expo to the native build (Gradle plugin, CocoaPods pods).
- You want hot reload, JS source maps, and a single Metro instance to "just work" inside the existing build.
- You prefer one repository and one build pipeline over shipping a prebuilt artifact.

If the native team must not need Node, Yarn, or React Native tooling, use [./brownfield-isolated.md](./brownfield-isolated.md) instead.

## Prerequisites

- **Expo SDK 54 or later** — the `ExpoReactHostFactory`, `ExpoReactNativeFactory`, and `ApplicationLifecycleDispatcher` entry points used below require SDK 54+. Earlier SDKs do not support this setup.
- **Node.js (LTS)** — runs JavaScript and the Expo CLI.
- **Yarn** — manages JavaScript dependencies.
- **CocoaPods** (iOS) — `sudo gem install cocoapods`.

---

## 1) Create an Expo project

Create the Expo project inside (or alongside) the existing native project. **Pin to SDK 55 or later — earlier SDKs do not support brownfield integration:**

```sh
npx create-expo-app@latest my-project --template default@sdk-55
```

The new project ships a TypeScript example app. The JS entry point registers a root component under the name `"main"` — this name must match the `moduleName` referenced from the native side later.

## 2) Place native projects under the Expo project

A standard React Native project keeps native code under `android/` and `ios/`. Move the existing native projects in:

```sh
mkdir my-project/android
mv /path/to/your/android-project my-project/android/
# repeat for ios/
```

### Monorepo alternative

If the native projects cannot be moved, set up a monorepo with the Expo project as a workspace: create a root `package.json` with `"private": true` and `"workspaces": ["my-project"]`, then run `yarn install` at the root. This installs `node_modules` at the workspace root so Gradle and CocoaPods scripts can resolve React Native and Expo dependencies.

> **Monorepo callout:** with a monorepo, the Expo project is not at `../../` from the native projects. You must set `projectRoot` explicitly in Gradle and pass the project root to CocoaPods so autolinking can find the Expo project.

---

## 3) Configure Android

Each file below: copy the current content from the template, then merge into your existing file. What each change does:

### `settings.gradle`

Copy from [template `settings.gradle`](https://github.com/expo/expo/blob/main/templates/expo-template-bare-minimum/android/settings.gradle). Adds a `pluginManagement` block that resolves the React Native Gradle plugin and the Expo autolinking settings plugin out of `node_modules` via `node --print require.resolve(...)`, applies `com.facebook.react.settings` + `expo-autolinking-settings`, and wires `expoAutolinking` (modules, version catalog, RN Gradle plugin) into the settings evaluation.

> **Monorepo:** add an explicit project root before `expoAutolinking.useExpoModules()` so autolinking finds your Expo project's `node_modules`.

### Top-level `build.gradle`

Copy from [template `build.gradle`](https://github.com/expo/expo/blob/main/templates/expo-template-bare-minimum/android/build.gradle). Adds buildscript classpaths (`com.facebook.react:react-native-gradle-plugin`, Kotlin), the JitPack repository, and applies `expo-root-project` + `com.facebook.react.rootproject` at the root.

### `app/build.gradle`

Copy from [template `app/build.gradle`](https://github.com/expo/expo/blob/main/templates/expo-template-bare-minimum/android/app/build.gradle). The minimum that must change in your existing module: apply the `com.facebook.react` plugin, and add the `react { ... }` block that resolves `entryFile` (via `expo/scripts/resolveAppEntry`), `reactNativeDir`, `codegenDir`, and `cliFile` (`@expo/cli`) through Node, sets `bundleCommand = "export:embed"` so release bundling goes through Expo CLI, and calls `autolinkLibrariesWithApp()`.

> **Monorepo:** set `root = file("../../")` (or wherever your Expo project lives) inside the `react { ... }` block.

### `gradle.properties`

```properties
reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64
newArchEnabled=true
hermesEnabled=true
```

`newArchEnabled` and `hermesEnabled` must match across all sub-modules in your build.

### `AndroidManifest.xml`

Add the `INTERNET` permission to `app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

In the debug-variant manifest at `app/src/debug/AndroidManifest.xml`, set `android:usesCleartextTraffic="true"` on `<application>` — Android 9+ blocks HTTP by default, and debug builds load the JS bundle from the local Metro server over HTTP.

### `MainApplication.kt`

Copy from [template `MainApplication.kt`](https://github.com/expo/expo/blob/main/templates/expo-template-bare-minimum/android/app/src/main/java/com/helloworld/MainApplication.kt) into your `Application` class. It provides the `reactHost` via `ExpoReactHostFactory.getDefaultReactHost(...)` with the autolinked `PackageList`, calls `loadReactNative(this)` in `onCreate`, and forwards `onCreate` / `onConfigurationChanged` to `ApplicationLifecycleDispatcher` so Expo modules receive lifecycle events.

### `ReactActivity`

Create an `Activity` that hosts a React Native screen. The `moduleName` returned by `getMainComponentName()` must match the name registered via `AppRegistry.registerComponent(...)` in your JS entry point (`"main"` for the default template).

```kotlin
package com.example.myapp

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MyReactActivity : ReactActivity() {

  override fun getMainComponentName(): String = "main"

  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
      this,
      BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
      object : DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled) {}
    )
  }
}
```

Register the activity in `AndroidManifest.xml` with a non-ActionBar theme:

```xml
<activity
  android:name=".MyReactActivity"
  android:theme="@style/Theme.AppCompat.Light.NoActionBar"
  android:configChanges="keyboard|keyboardHidden|orientation|screenLayout|screenSize|smallestScreenSize|uiMode"
/>
```

Launch it from existing native code:

```kotlin
startActivity(Intent(this, MyReactActivity::class.java))
```

---

## 4) Configure iOS

The integrated approach drives iOS through CocoaPods + Expo modules autolinking, exactly like a fresh Expo project. The key difference is that you are integrating into your existing Xcode project rather than starting from the template.

### `ios/Podfile`

Copy from the [template `Podfile`](https://github.com/expo/expo/blob/main/templates/expo-template-bare-minimum/ios/Podfile) and change the target name to your existing Xcode target. What it does: requires Expo's `scripts/autolinking` and RN's `react_native_pods` helpers out of `node_modules`, calls `use_expo_modules!`, feeds `use_native_modules!` the Expo autolinking `config_command`, and calls `use_react_native!` + `react_native_post_install`. The `:app_path` argument tells `use_react_native!` where the JS app lives — set it to the absolute path of your Expo project root if you are in a monorepo.

Create `ios/Podfile.properties.json` alongside it ([template defaults](https://github.com/expo/expo/blob/main/templates/expo-template-bare-minimum/ios/Podfile.properties.json) are fine: Hermes engine, network inspector on).

Install pods:

```sh
cd ios && pod install
```

Open the generated `.xcworkspace` (not the `.xcodeproj`) from now on.

### Xcode project changes

Three Xcode-side adjustments are required before the app can build and run a React Native screen. Skip any one and either CocoaPods scripts fail under sandboxing, the JS bundle never lands in the IPA (release crashes looking for `main.jsbundle`), or the status bar fights React Native at runtime.

#### 1. Disable user script sandboxing

In Xcode, select your project → app target → **Build Settings**, search for `ENABLE_USER_SCRIPT_SANDBOXING`, and set it to **No**. CocoaPods' Hermes scripts need to switch between debug and release engine binaries at build time, which sandboxing blocks.

#### 2. Add a Run Script phase to embed the JS bundle

On the app target's **Build Phases** tab, add a new **Run Script** phase **before** `[CP] Embed Pods Frameworks`. Copy the script body from the "Bundle React Native code and images" phase in the [template `project.pbxproj`](https://github.com/expo/expo/blob/main/templates/expo-template-bare-minimum/ios/HelloWorld.xcodeproj/project.pbxproj). What it does: sources `.xcode.env` / `.xcode.env.local`, sets `PROJECT_ROOT`, exports `SKIP_BUNDLING=1` in Debug (Metro serves the bundle then), resolves `ENTRY_FILE` via `expo/scripts/resolveAppEntry` and `CLI_PATH` to `@expo/cli`, sets `BUNDLE_COMMAND="export:embed"`, and invokes React Native's `react-native-xcode.sh`.

> **Monorepo:** override `PROJECT_ROOT` to point at the Expo project (e.g. `export PROJECT_ROOT="$PROJECT_DIR"/../../my-project`). Without this, bundling looks for `node_modules` in the wrong directory.

This script writes `main.jsbundle` into the app's resources directory in release configurations. Without it, the `bundleURL()` fallback in `ReactNativeDelegate` resolves to `nil` and the React Native screen fails to load whenever Metro is not running.

#### 3. Update `Info.plist`

Set `UIViewControllerBasedStatusBarAppearance` to `NO` so React Native can manage the status bar:

```xml
<key>UIViewControllerBasedStatusBarAppearance</key>
<false/>
```

### `AppDelegate.swift`

Copy from the [template `AppDelegate.swift`](https://github.com/expo/expo/blob/main/templates/expo-template-bare-minimum/ios/HelloWorld/AppDelegate.swift). It subclasses `ExpoAppDelegate`, creates an `ExpoReactNativeFactory` with an `ExpoReactNativeFactoryDelegate` (plus `RCTAppDependencyProvider`), and calls `factory.startReactNative(withModuleName: "main", in: window, launchOptions:)` to take over the root window. The delegate's `bundleURL()` selects the Metro dev server (`.expo/.virtual-metro-entry` via `RCTBundleURLProvider`) in `DEBUG` and the embedded `main.jsbundle` in release.

The module name `"main"` must match what the JS side registers with `AppRegistry.registerComponent("main", () => App)`.

### Embedding RN inside an existing screen (not the root window)

If you do not want React Native to take over the whole window, instantiate the factory the same way but mount the produced root view inside an existing `UIViewController`:

```swift
import UIKit
import React
import Expo

class ReactNativeScreenViewController: UIViewController {
  private var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  private var reactNativeFactory: RCTReactNativeFactory?

  override func viewDidLoad() {
    super.viewDidLoad()

    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()
    self.reactNativeDelegate = delegate
    self.reactNativeFactory = factory

    let rootView = factory.rootViewFactory.view(
      withModuleName: "main",
      initialProperties: nil,
      launchOptions: nil
    )
    rootView.frame = view.bounds
    rootView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    view.addSubview(rootView)
  }
}
```

Present it like any other view controller:

```swift
navigationController?.pushViewController(ReactNativeScreenViewController(), animated: true)
```

> **Monorepo iOS:** `pod install` is run from `ios/`, but Node module resolution starts from the Expo project root. Pass `EXPO_PROJECT_ROOT=/absolute/path/to/expo-project` to the `pod install` invocation if autolinking cannot find the Expo project automatically.

---

## 5) Test the integration

Start Metro from the Expo project (or `yarn start` from the monorepo root):

```sh
yarn start
```

Build and run the native app normally (Android Studio / Xcode). Navigate to your React Native-powered Activity or screen - it loads JS from the Metro dev server with hot reloading.

### Development vs. production

- **Development** — Metro serves the JS bundle with hot reloading over HTTP. Debug builds use the Metro URL via `RCTBundleURLProvider` (iOS) or the dev server detection in `ReactActivity` (Android).
- **Production** — Metro is not used. Run `expo export:embed` (invoked automatically by the React Native Gradle plugin and the iOS build phase) to embed the bundle into the APK/IPA.

For Metro connection issues, build failures, missing modules, or arch mismatches, see [./troubleshooting.md](./troubleshooting.md).

---

## Related references

- [./brownfield-isolated.md](./brownfield-isolated.md) — Alternative: ship RN as a prebuilt AAR/XCFramework.
- [./comparison.md](./comparison.md) — Decide between isolated and integrated.
- [./troubleshooting.md](./troubleshooting.md) — Common Metro, build, and integration issues.
