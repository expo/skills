# Build with EAS

Produce the production builds you'll submit to the stores. For full `eas.json` and build-profile reference, see the `expo-deployment` skill; this file is the first-timer walkthrough.

## Prerequisites

```
□ EAS CLI available:   npm install -g eas-cli   (or use npx eas-cli@latest)
□ Logged in:           eas login
□ Project configured:  eas build:configure
```

## Step 1 — production profile in `eas.json`

```json
{
  "build": {
    "production": {
      "ios": { "distribution": "store" },
      "android": { "buildType": "app-bundle" }
    }
  }
}
```

## Step 2 — confirm `app.json`

- `ios.bundleIdentifier` — e.g. `com.yourcompany.yourapp`
- `android.package` — e.g. `com.yourcompany.yourapp`
- `version` — e.g. `"1.0.0"`
- `ios.buildNumber` — e.g. `"1"`
- `android.versionCode` — e.g. `1`

## Step 3 — build

```bash
# iOS
eas build --platform ios --profile production

# Android
eas build --platform android --profile production

# Both
eas build --platform all --profile production
```

Builds typically take ~15–30 minutes.

## Version-number strategy

```
version (e.g. "1.0.0")
  Shown to users. Semantic MAJOR.MINOR.PATCH. Increase with each store release.

iOS buildNumber (e.g. "1")
  Internal id. Must increase with EVERY build submitted to App Store Connect,
  even if the version string is unchanged.

Android versionCode (e.g. 1)
  Internal id, integer only. Must increase with EVERY Play submission.
```

Forgetting to bump these is the most common cause of a rejected upload. Let EAS manage it automatically:

```json
{
  "cli": { "version": ">= 16.0.0", "appVersionSource": "remote" },
  "build": { "production": { "autoIncrement": true } }
}
```
