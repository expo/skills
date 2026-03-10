---
name: brownfield-isolated
description: Integrate Expo into an existing native iOS or Android app using the isolated approach. Use this skill when you want to build React Native code as standalone native libraries (AAR for Android, XCFramework for iOS) that native developers can consume without installing Node.js or React Native tooling.
---

# Brownfield Integration: Isolated Approach

In the isolated approach, your React Native code is developed and maintained separately from your native project. You package it as a native library (AAR for Android, XCFramework for iOS) and integrate it into your native app like any other dependency.

This is ideal when you want to minimize the impact of React Native on your existing native build process, or when you have separate teams for native and React Native development.

## Prerequisites

- **Node.js (LTS)**: The runtime to execute JavaScript code and Expo CLI
- **Yarn**: A package manager for managing JavaScript dependencies

## Set Up an Expo Project

### 1. Create a new Expo project

```sh
npx create-expo-app@latest my-project --template default@sdk-55
```

The project can exist in a separate repository or monorepo — it doesn't need to live inside your native app.

### 2. Install expo-brownfield

```sh
npx expo install expo-brownfield
```

### 3. Configure app.json (optional)

The plugin adds itself automatically with defaults derived from your app config. To customize:

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

## Build Native Libraries

### Android

```sh
npx expo-brownfield build:android
```

Builds an AAR and publishes it to your local Maven repository (`~/.m2`) by default. The artifact name is determined by your config plugin settings (e.g., `com.username.myproject:brownfield:1.0.0`).

### iOS

```sh
npx expo-brownfield build:ios
```

Outputs to the `./artifacts` directory:
- `{TargetName}.xcframework` — Your Expo project as a native library
- `hermesvm.xcframework` — The Hermes JavaScript engine

### Debugging Native Targets

To generate native projects with brownfield library targets for debugging:

```sh
npx expo prebuild
```

This generates native projects in `android/` and `ios/` containing `ReactNativeHostManager`, `BrownfieldActivity`, `ReactNativeFragment`, and related classes.

## Integrate into Your Native App

### Android

#### Add the Maven dependency

**app/build.gradle.kts:**
```kotlin
dependencies {
  implementation("com.username.myproject:brownfield:1.0.0")
}
```

For local Maven, add `mavenLocal()` to your repository config:

**settings.gradle.kts:**
```kotlin
dependencyResolutionManagement {
  repositories {
    google()
    mavenCentral()
    mavenLocal()
  }
}
```

#### Show a React Native screen

**ExpoActivity.kt:**
```kotlin
import android.os.Bundle
import com.example.brownfield.BrownfieldActivity
import com.example.brownfield.showReactNativeFragment

class ExpoActivity : BrownfieldActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    showReactNativeFragment()
  }
}
```

Register in **AndroidManifest.xml**:
```xml
<activity
  android:name=".ExpoActivity"
  android:theme="@style/Theme.AppCompat.Light.NoActionBar"
  android:configChanges="keyboard|keyboardHidden|orientation|screenLayout|screenSize|smallestScreenSize|uiMode"
/>
```

Launch it:
```kotlin
startActivity(Intent(this, ExpoActivity::class.java))
```

`BrownfieldActivity` extends `AppCompatActivity` and handles forwarding configuration changes. `showReactNativeFragment()` sets up native back button handling automatically.

### iOS

#### Add XCFrameworks to your project

Drag both `{TargetName}.xcframework` and `hermesvm.xcframework` into your Xcode project navigator. In the dialog:
- Check **Copy items if needed**
- Add them to your app target

In your target's **General** tab under **Frameworks, Libraries, and Embedded Content**, set both to **Embed & Sign**.

#### Initialize React Native

Call `ReactNativeHostManager.shared.initialize()` early in your app lifecycle:

**AppDelegate.swift:**
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

#### Present a React Native view

**UIKit:**
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

Pass props and launch options optionally:
```swift
let rnViewController = ReactNativeViewController(
  moduleName: "main",
  initialProps: ["userId": "123"],
  launchOptions: [:]
)
```

**SwiftUI:**
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

## Test Your Integration

### Development (debug builds)

Start the Metro bundler in your Expo project:
```sh
npx expo start
```

Build and run the native app. When you navigate to the React Native screen, it loads from the Metro dev server with hot reloading.

### Production (release builds)

The JavaScript bundle is embedded in the artifact (AAR or XCFramework), so Metro is not needed. Build in Release configuration and verify the React Native screen loads correctly.

## Configuration Options Reference

### iOS Options

| Option | Description |
|--------|-------------|
| `targetName` | Name of the XCFramework target |
| `bundleIdentifier` | Bundle identifier for the framework |

### Android Options

| Option | Description |
|--------|-------------|
| `libraryName` | Name of the AAR library |
| `group` | Maven group ID |
| `package` | Android package name |
| `version` | Library version string |

## Troubleshooting

### Metro Connection Issues

Ensure your development machine and device/emulator are on the same network. For Android emulators, the Metro server should be accessible automatically.

### Build Failures

Run `npx expo prebuild --clean` to regenerate native projects from scratch.

### Missing Dependencies

Ensure all Expo modules are properly installed with `npx expo install` before building.
