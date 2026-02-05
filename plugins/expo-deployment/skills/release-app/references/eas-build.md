# Build with EAS

Walk through the build process:

```
🔨 Building with EAS

Let's build your app for the stores!

PREREQUISITES:
□ EAS CLI installed: npm install -g eas-cli
□ Logged in: eas login
□ Project configured: eas build:configure

STEP 1: Configure eas.json
Your eas.json should have production profiles:

{
  "build": {
    "production": {
      "ios": {
        "distribution": "store"
      },
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}

STEP 2: Configure app.json
Ensure you have:
- bundleIdentifier (iOS): com.yourcompany.yourapp
- package (Android): com.yourcompany.yourapp
- version: "1.0.0"
- ios.buildNumber: "1"
- android.versionCode: 1

STEP 3: Build for iOS
eas build --platform ios --profile production

STEP 4: Build for Android
eas build --platform android --profile production

Or build both:
eas build --platform all --profile production

⏱️ Builds typically take 15-30 minutes.
```

## Version Number Strategy

```
📊 Version Numbers Explained

version (e.g., "1.0.0")
- Shown to users in the store
- Semantic versioning: MAJOR.MINOR.PATCH
- Must increase with each store submission

iOS buildNumber (e.g., "1")
- Internal build identifier
- Must increase with EVERY build submitted to App Store Connect
- Even if same version, buildNumber must go up

Android versionCode (e.g., 1)
- Internal build identifier
- Must increase with EVERY build submitted to Google Play
- Integer only (1, 2, 3...)

⚠️ Common mistake: Forgetting to increment these causes rejected builds!

Tip: Use EAS to auto-manage:
{
  "cli": {
    "version": ">= 5.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "production": {
      "autoIncrement": true
    }
  }
}
```
