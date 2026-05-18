# Brownfield: Isolated Approach

Build the React Native + Expo code as a prebuilt native library, **AAR** on Android and **XCFramework** on iOS, and consume it from the existing native app like any other dependency.

## When to use

- Native and React Native are owned by different teams or release on different cadences.
- The native team must not be required to install Node.js, Yarn, or React Native tooling.
- React Native code lives in a separate repo or monorepo from the native app.
- You want the smallest possible footprint on the existing native build pipeline.

If a single team owns both layers, is comfortable with React Native tooling and needs deep integration, see [./brownfield-integrated.md](./brownfield-integrated.md).

## What you produce

| Platform | Artifact                                            | Default location      |
| -------- | --------------------------------------------------- | --------------------- |
| Android  | `{group}:{libraryName}:{version}` AAR               | Local Maven (`~/.m2`) |
| iOS      | `{TargetName}.xcframework` + `hermesvm.xcframework` | `./artifacts`         |

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

### Configure the plugin (optional)

To override the auto-generated names, expand the plugin entry in `app.json`:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-brownfield",
        {
          "ios": {
            "targetName": "MyBrownfield",
            "bundleIdentifier": "com.example.mybrownfield"
          },
          "android": {
            "libraryName": "mybrownfield",
            "group": "com.example",
            "package": "com.example.mybrownfield",
            "version": "1.0.0"
          }
        }
      ]
    ]
  }
}
```

**iOS options** — `targetName` (XCFramework target name), `bundleIdentifier` (framework bundle ID).

**Android options** — `libraryName` (AAR name), `group` (Maven group ID), `package` (Android package), `version` (library version).

---

## 2) Build the native libraries

### Android

```sh
npx expo-brownfield build:android
```

Produces an AAR and publishes it to the local Maven repository at `~/.m2`. The Maven coordinates come from the plugin config — e.g. `com.example:mybrownfield:1.0.0`.

### iOS

```sh
npx expo-brownfield build:ios
```

Outputs to `./artifacts`:

- `{TargetName}.xcframework` — the Expo project compiled as a native framework.
- `hermesvm.xcframework` — the Hermes JavaScript engine. **Both must be embedded in the consuming app.**

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

### Android

#### Add the Maven dependency

In `app/build.gradle.kts`:

```kotlin
dependencies {
  implementation("com.example:mybrownfield:1.0.0")
}
```

If consuming from the local Maven repo, register `mavenLocal()` in `settings.gradle.kts`:

```kotlin
dependencyResolutionManagement {
  repositories {
    google()
    mavenCentral()
    mavenLocal()
  }
}
```

> **Note:** `mavenLocal()` must be added under `dependencyResolutionManagement`, not the deprecated top-level `allprojects { repositories { ... } }` block.

#### Show a React Native screen

Extend `BrownfieldActivity` and call `showReactNativeFragment()`:

```kotlin
import android.os.Bundle
import com.example.mybrownfield.BrownfieldActivity
import com.example.mybrownfield.showReactNativeFragment

class ExpoActivity : BrownfieldActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    showReactNativeFragment()
  }
}
```

`BrownfieldActivity` extends `AppCompatActivity` and forwards configuration changes. `showReactNativeFragment()` registers the React Native root fragment and wires native back-button handling automatically.

Register the activity in `AndroidManifest.xml`:

```xml
<activity
  android:name=".ExpoActivity"
  android:theme="@style/Theme.AppCompat.Light.NoActionBar"
  android:configChanges="keyboard|keyboardHidden|orientation|screenLayout|screenSize|smallestScreenSize|uiMode"
/>
```

Launch it from native code:

```kotlin
startActivity(Intent(this, ExpoActivity::class.java))
```

### iOS

#### Add the XCFrameworks to the Xcode project

Drag **both** `{TargetName}.xcframework` and `hermesvm.xcframework` into the Xcode project navigator. In the import dialog:

- Check **Copy items if needed**.
- Add them to your app target.

Under the app target's **General** tab → **Frameworks, Libraries, and Embedded Content**, set both frameworks to **Embed & Sign**.

#### Initialize React Native at app launch

Call `ReactNativeHostManager.shared.initialize()` from `AppDelegate` **before any React Native view is created**. Initialization is asynchronous-friendly but must precede the first `ReactNativeViewController`/`ReactNativeView` instantiation.

```swift
import UIKit
import MyAppBrownfield // Replace with your target name

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    ReactNativeHostManager.shared.initialize()
    return true
  }
}
```

#### Present a React Native view (UIKit)

```swift
import UIKit
import MyAppBrownfield

class ViewController: UIViewController {
  @IBAction func openReactNative(_ sender: Any) {
    let rnViewController = ReactNativeViewController(moduleName: "main")
    navigationController?.pushViewController(rnViewController, animated: true)
  }
}
```

Pass props and launch options if needed:

```swift
let rnViewController = ReactNativeViewController(
  moduleName: "main",
  initialProps: ["userId": "123"],
  launchOptions: [:]
)
```

> **Note:** `moduleName` must match the name registered via `AppRegistry.registerComponent(...)` in the Expo project's JS entry point. The default Expo template registers `"main"`.

#### Present a React Native view (SwiftUI)

```swift
import SwiftUI
import MyAppBrownfield

struct ContentView: View {
  @State private var showReactNative = false

  var body: some View {
    Button("Open React Native") {
      showReactNative = true
    }
    .fullScreenCover(isPresented: $showReactNative) {
      ReactNativeView(moduleName: "main")
    }
  }
}
```

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
