# Native Swift iOS apps on EAS

For SwiftUI/UIKit apps, preserve the Xcode project and Swift entry point. EAS can deliver the app without adding Expo, React Native, Metro, an `index.js` or `expo-dev-client`. Keep existing dependencies when the app actually uses them. `expo prebuild --clean` regenerates native directories and is not a setup step for this path.

## Adapt the existing project

Inspect the shared scheme, native targets, signing, dependencies and release configurations. Xcode's bundle ID is authoritative; keep any duplicate app-config identifier consistent. Reuse the existing EAS project and Apple team.

The default worker expects an `ios/` directory and still runs `pod install` for checked-in native projects. See the [iOS build process](https://docs.expo.dev/build-reference/ios-builds/). A Swift-only project can use these tooling files alongside its native sources:

```text
package.json
package-lock.json
app.json
eas.json
ios/Podfile
ios/MyApp.xcodeproj
ios/MyApp/Info.plist
```

Use a private `package.json` with a name, version and matching lockfile. No Node dependencies are needed merely for EAS. Minimal `app.json`:

```json
{
  "expo": {
    "name": "My App",
    "slug": "my-app",
    "ios": { "bundleIdentifier": "com.example.myapp" }
  }
}
```

`eas init` writes `extra.eas.projectId` when linking. The `expo` key here is tooling configuration, not an Expo runtime. For an app with no pods, an empty-target Podfile can adapt the default worker:

```ruby
platform :ios, '17.0'
target 'MyApp' do
end
```

Use the actual target and deployment version. Keep an existing Podfile. If the project must avoid CocoaPods or has another layout, choose a [custom EAS build](https://docs.expo.dev/custom-builds/get-started/) or export an IPA with Xcode for submission. Do not relocate an established project to fit this example. Custom layouts require project-specific build work; this guide verifies the default `ios/` layout only.

## Native build profiles

Use the actual shared scheme and build configuration. A minimal store profile is:

```json
{
  "cli": { "appVersionSource": "remote" },
  "build": {
    "production": {
      "distribution": "store",
      "autoIncrement": true,
      "ios": { "scheme": "MyApp", "buildConfiguration": "Release" }
    }
  },
  "submit": {
    "production": { "ios": { "ascAppId": "1234567890" } }
  }
}
```

`ascAppId` is the numeric App Store Connect app ID. Match it to the native bundle ID and selected Apple team. A TestFlight profile can use the same store/Release settings; a simulator profile uses `ios.simulator: true` and the chosen Debug/Release configuration. `developmentClient: true` is for Expo's development client, not Swift debugging.

For other fields use the [build configuration docs](https://docs.expo.dev/build/eas-json/) and [current build images](https://docs.expo.dev/build-reference/infrastructure/). A pure Swift wrapper with no Expo dependencies or SDK metadata needs no Expo Doctor or JavaScript-bundling skip flags. Preserve actual integrations, build phases and Release debug symbols. Native preparation uses Xcode configuration or an EAS lifecycle hook; Expo prebuild plugins do not run on this path. Preserve existing hook work.

## Diagnose native version or icon failures

SwiftUI testing exposed an archive stuck at build 1 despite an increasing EAS counter, and a default icon rejected for its alpha channel. Use these checks during initial setup, after relevant native configuration changes, or when investigating an upload rejection.

The [native updater](https://github.com/expo/eas-cli/blob/main/packages/eas-cli/src/build/ios/version.ts) writes `CFBundleVersion` to an explicit `INFOPLIST_FILE`. For this pipeline, one tested setup uses:

```text
GENERATE_INFOPLIST_FILE = NO
INFOPLIST_FILE = MyApp/Info.plist
MARKETING_VERSION = 1.0.0
```

In the complete app plist:

```xml
<key>CFBundleShortVersionString</key>
<string>$(MARKETING_VERSION)</string>
<key>CFBundleVersion</key>
<string>1</string>
```

EAS replaces that starting build number for the store build. Before changing plist generation, inspect the generated Release metadata and plist-related build settings. Preserve identity, privacy usage descriptions, scene/launch configuration, supported devices, orientations and extension version synchronization. An existing generated-plist setup is also valid if the build process sets `CURRENT_PROJECT_VERSION` correctly; keep it when verified. For general remote/local versioning use [App version management](https://docs.expo.dev/build-reference/app-versions/).

For a version or identity check on macOS, inspect the resulting app's metadata:

```bash
plutil -p "/path/to/MyApp.xcarchive/Products/Applications/MyApp.app/Info.plist"
```

For an IPA, unzip into a temporary directory and inspect `Payload/MyApp.app/Info.plist`. Confirm the intended `CFBundleIdentifier`, `CFBundleShortVersionString`, `CFBundleVersion`, and device platform `iPhoneOS`; metadata must be resolved strings. `eas build:view BUILD_ID --json` supplies the artifact URL.

When adding or changing a default (Any/light) 1024px PNG, or diagnosing its rejection, check the source selected by that build profile:

```bash
sips -g pixelWidth -g pixelHeight -g hasAlpha "/path/to/AppIcon.appiconset/icon.png"
```

That PNG must have no alpha channel, including an all-opaque RGBA channel. Preserve transparent dark variants and Icon Composer layers; use [Apple's icon guidance](https://developer.apple.com/documentation/xcode/configuring-your-app-icon) for those formats.

Check privacy usage descriptions and encryption declarations against actual app behavior. For checked-in native apps, `ITSAppUsesNonExemptEncryption` belongs in the native plist; changing app.json alone will not update it. Do not copy `false` solely to suppress a prompt.

## Delivery and verification scope

Use the build/submit commands in the main skill, then [testflight.md](testflight.md) for Apple processing and tester access or [ios-app-store.md](ios-app-store.md) for public release. Local diagnostics do not establish Apple's acceptance.

This native setup was exercised with EAS CLI 18.6.0 and Xcode 26.2: a default-pipeline simulator build succeeded without Expo/React/React Native dependencies or skip flags. A signed device build verified the explicit-plist and opaque-icon fixes through Apple acceptance. Recheck worker behavior when changing tooling or project layout; custom hooks, extensions and signing can differ.
