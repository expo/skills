# Config Plugins Reference

Config plugins customize native Android and iOS projects generated with `npx expo prebuild`. They are synchronous functions that accept an `ExpoConfig` and return a modified version.

## Plugin Structure

```
my-module/
  plugin/
    tsconfig.json
    src/
      index.ts
  app.plugin.js         # Entry: module.exports = require('./plugin/build');
```

## Writing a Plugin

Plugin functions follow the `with` prefix naming convention.

Use native configuration for public values such as a client identifier. `Info.plist`, Android manifest metadata, and bundled JavaScript are extractable from the app; they are not secret storage. Keep service credentials on the backend and use platform-protected storage for user session credentials.

```typescript
import {
  ConfigPlugin,
  withInfoPlist,
  withAndroidManifest,
  AndroidConfig,
} from "expo/config-plugins";

const withMyConfig: ConfigPlugin<{ publicClientId: string }> = (config, { publicClientId }) => {
  // iOS: modify Info.plist
  config = withInfoPlist(config, (config) => {
    config.modResults["MY_PUBLIC_CLIENT_ID"] = publicClientId;
    return config;
  });

  // Android: modify AndroidManifest.xml
  config = withAndroidManifest(config, (config) => {
    const mainApp =
      AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      mainApp,
      "MY_PUBLIC_CLIENT_ID",
      publicClientId
    );
    return config;
  });

  return config;
};

export default withMyConfig;
```

## Using in app.json

```json
{
  "expo": {
    "plugins": [["my-module", { "publicClientId": "public-client-id" }]]
  }
}
```

## Reading Config Values in Native Code

**Swift:**

```swift
Function("getPublicClientId") {
  return Bundle.main.object(forInfoDictionaryKey: "MY_PUBLIC_CLIENT_ID") as? String
}
```

**Kotlin:**

```kotlin
Function("getPublicClientId") {
  val appInfo = appContext?.reactContext?.packageManager?.getApplicationInfo(
    appContext?.reactContext?.packageName.toString(),
    PackageManager.GET_META_DATA
  )
  return@Function appInfo?.metaData?.getString("MY_PUBLIC_CLIENT_ID")
}
```

## Key Rules

- Plugins must be synchronous; return values must be serializable (except `mods`)
- `Mods` are async functions invoked during the prebuild "syncing" phase
- Use `npm run build plugin` to compile TypeScript plugins
- Test in a disposable generated app and inspect the native diff. `npx expo prebuild --clean` deletes native directories; use it only for recoverable CNG output after preserving tracked and untracked changes. Apply changes selectively in a manually maintained native host instead.
