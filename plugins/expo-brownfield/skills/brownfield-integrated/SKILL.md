---
name: brownfield-integrated
description: Integrate Expo into an existing native iOS or Android app using the integrated approach. Use this skill when you want to add React Native and Expo directly into your existing native project's build system (Gradle for Android, CocoaPods for iOS), similar to how you would integrate any other library.
---

# Brownfield Integration: Integrated Approach

In the integrated approach, React Native and Expo are added directly to your existing native project — the same way you would integrate any other third-party library. Your native project gains React Native capabilities while retaining full control over the build process.

This approach suits teams comfortable with native tooling and React Native build setup, and who want to share a single native project for both native and React Native code.

For a lower-friction alternative where native developers don't need React Native tooling, see the **brownfield-isolated** skill.

## Prerequisites

- **Node.js (LTS)**: The runtime to execute JavaScript code and Expo CLI
- **Yarn**: A package manager for managing JavaScript dependencies
- **CocoaPods** (iOS): Ruby gem for iOS dependency management — `sudo gem install cocoapods`

## Step 1: Create an Expo Project

Create an Expo project inside (or alongside) your existing native project:

```sh
npx create-expo-app@latest my-project --template default@sdk-55
```

The new project includes an example TypeScript application to help you get started.

## Step 2: Set Up Project Structure

A standard React Native project places native code in `android/` and `ios/` directories. Move your existing native projects there:

```sh
mkdir my-project/android
mv /path/to/your/android-project my-project/android/
```

**If you can't move your native projects**, set up a monorepo instead. Create a `package.json` at your project root:

```json
{
  "version": "1.0.0",
  "private": true,
  "workspaces": ["my-project"]
}
```

Then run `yarn install`. This ensures `node_modules` are installed at the root so native scripts can interact with React Native code. Note: a monorepo requires configuring a custom project root in Gradle and CocoaPods (covered below).

## Step 3: Configure Android

Modify the following files to integrate React Native into your Android build.

### settings.gradle

Add the React Native Gradle Plugin and Expo autolinking settings. Use the [bare minimum template](https://github.com/expo/expo/blob/main/templates/expo-template-bare-minimum/android/settings.gradle) as reference:

```groovy
pluginManagement {
  def reactNativeGradlePlugin = new File(
    providers.exec {
      workingDir(rootDir)
      commandLine("node", "--print", "require.resolve('@react-native/gradle-plugin/package.json', { paths: [require.resolve('react-native/package.json')] })")
    }.standardOutput.asText.get().trim()
  ).getParentFile().absolutePath
  includeBuild(reactNativeGradlePlugin)

  def expoPluginsPath = new File(
    providers.exec {
      workingDir(rootDir)
      commandLine("node", "--print", "require.resolve('expo-modules-autolinking/package.json', { paths: [require.resolve('expo/package.json')] })")
    }.standardOutput.asText.get().trim(),
    "../android/expo-gradle-plugin"
  ).absolutePath
  includeBuild(expoPluginsPath)
}

plugins {
  id("com.facebook.react.settings")
  id("expo-autolinking-settings")
}

extensions.configure(com.facebook.react.ReactSettingsExtension) { ex ->
  ex.autolinkLibrariesFromCommand(expoAutolinking.rnConfigCommand)
}
expoAutolinking.useExpoModules()
expoAutolinking.useExpoVersionCatalog()
includeBuild(expoAutolinking.reactNativeGradlePlugin)
```

> If using a monorepo, explicitly set your project root in `settings.gradle` for autolinking to find the Expo project.

### Top-level build.gradle

Add the React Native Gradle Plugin to make it available. Reference the [bare minimum template](https://github.com/expo/expo/blob/main/templates/expo-template-bare-minimum/android/build.gradle).

### app/build.gradle

Apply the React Native Gradle Plugin and configure project-specific settings. Reference the [bare minimum template](https://github.com/expo/expo/blob/main/templates/expo-template-bare-minimum/android/app/build.gradle).

> If using a monorepo, set `projectRoot` to point to the root of your Expo project.

### gradle.properties

```properties
reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64
newArchEnabled=true
hermesEnabled=true
```

Reference: [bare minimum template](https://github.com/expo/expo/blob/main/templates/expo-template-bare-minimum/android/gradle.properties)

### AndroidManifest.xml

Add the `INTERNET` permission to your main `AndroidManifest.xml`. In your **debug** `AndroidManifest.xml`, enable cleartext traffic so the app can communicate with the local Metro bundler via HTTP.

Reference files:
- [Main AndroidManifest.xml](https://github.com/expo/expo/blob/main/templates/expo-template-bare-minimum/android/app/src/main/AndroidManifest.xml)
- [Debug AndroidManifest.xml](https://github.com/expo/expo/blob/main/templates/expo-template-bare-minimum/android/app/src/debug/AndroidManifest.xml)

### Application class

Update your `Application` class to initialize React Native. Reference the [MainApplication template](https://github.com/expo/expo/blob/main/templates/expo-template-bare-minimum/android/app/src/main/java/com/helloworld/MainApplication.kt).

### ReactActivity

Create an `Activity` extending `ReactActivity` to host React Native screens:

**MyReactActivity.kt:**
```kotlin
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

## Step 4: Test the Integration

Start the Metro bundler in the React Native directory:

```sh
yarn start
```

Metro builds your TypeScript application code into a bundle and serves it via HTTP to your simulator or device, enabling hot reloading during development.

Build and run your app normally. Navigate to your React-powered Activity — it will load JavaScript from the Metro dev server.

## Development vs. Production

- **Development**: Metro serves the JS bundle with hot reloading via HTTP
- **Production**: The JS bundle is embedded in the APK/IPA — Metro is not required
