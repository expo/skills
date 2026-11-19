# Submitting to iOS App Store

For native SwiftUI/UIKit apps without a React Native runtime, configure the Xcode/EAS path in [native-ios.md](native-ios.md) first. The signing, App Store Connect, and review stages below apply to both native Swift and Expo/React Native apps.

## Contents

- [Prerequisites](#prerequisites)
- [Credential Setup](#credential-setup)
- [Submission Commands](#submission-commands)
- [App Store Connect Configuration](#app-store-connect-configuration)
- [TestFlight vs App Store](#testflight-vs-app-store)
- [Complete the Public Release](#complete-the-public-release)
- [App Review Process](#app-review-process)
- [Version and Build Numbers](#version-and-build-numbers)
- [Release Options](#release-options)
- [Certificates and Provisioning](#certificates-and-provisioning)
- [App Store Metadata](#app-store-metadata)
- [Troubleshooting](#troubleshooting)
- [CI/CD Integration](#cicd-integration)
- [Tips](#tips)

## Prerequisites

1. **Apple Developer Account** - Enroll at [developer.apple.com](https://developer.apple.com)
2. **App Store Connect App** - Create your app record before first submission
3. **Apple Credentials** - Configure via EAS or environment variables

## Credential Setup

### Using EAS Credentials

When working managed credentials are absent, the account owner completes `npx --yes eas-cli@latest credentials -p ios` privately for the selected team/profile. Its interactive menus can provision certificates/profiles and configure an API key; they are not read-only status queries. Do not drive those menus, collect account passwords/MFA codes, or download private credentials during a routine build or submission.

### App Store Connect API Key (Recommended)

An authorized App Store Connect API key supports CI/CD uploads without an interactive Apple ID sign-in. This is Apple's supported authentication flow, not permission to disable account security or obtain another user's key.

Reuse a working managed key. If initial setup is missing, have the account owner complete `npx --yes eas-cli@latest credentials -p ios` privately for the selected team/profile; do not automate Apple password/MFA entry or download private keys. For an existing protected local team API key, configure the submit profile explicitly:

Configure in `eas.json`:

```json
{
  "submit": {
    "production": {
      "ios": {
        "ascApiKeyPath": "../private-credentials/AuthKey_XXXXX.p8",
        "ascApiKeyIssuerId": "xxxxx-xxxx-xxxx-xxxx-xxxxx",
        "ascApiKeyId": "XXXXXXXXXX"
      }
    }
  }
}
```

The relative key path above denotes protected local storage outside the uploaded project; replace it with the existing protected location. Hosted workflow jobs cannot read a sibling file on your machine; use EAS-managed credentials or a protected file provisioned for that job. Do not create or copy a key into the uploaded project to satisfy the example. Keep private key material outside version control and the EAS Build upload archive. If an existing key is inside the project, check both `.gitignore` and any overriding `.easignore`. Reuse valid managed credentials. Use the installed CLI's credential flow and current documentation when setting up a different key type.

### Apple ID Authentication (Alternative)

For manual submissions, you can use Apple ID:

```bash
# Configure these names through a protected local or CI secret store:
# EXPO_APPLE_ID
# EXPO_APPLE_TEAM_ID
# EXPO_APPLE_APP_SPECIFIC_PASSWORD
```

The app-specific password is for the upload flow. Interactive Apple Developer signing setup has a separate authentication flow.

## Submission Commands

```bash
# Build the store artifact; verify it before uploading
npx --yes eas-cli@latest build -p ios --profile production

# Submit the verified build
npx --yes eas-cli@latest submit -p ios --profile production --id BUILD_ID

# Expo / React Native TestFlight shortcut
npx testflight@1.0.4
```

The shortcut and `build --auto-submit` combine remote actions. Use them only for a requested combined workflow with the selected account, app, and submit profile already verified. For an existing artifact or a build-only request, use the separate steps.

## App Store Connect Configuration

### First-Time Setup

Before submitting, complete in App Store Connect:

1. **App Information**
   - Primary language
   - Bundle ID (must match the archive; Xcode is authoritative for checked-in native projects)
   - SKU (unique identifier)

2. **Pricing and Availability**
   - Price tier
   - Available countries

3. **App Privacy**
   - Privacy policy URL
   - Data collection declarations

4. **App Review Information**
   - Contact information
   - Demo account (if login required)
   - Notes for reviewers

### EAS Configuration

```json
{
  "cli": {
    "version": ">= 16.0.1",
    "appVersionSource": "remote"
  },
  "build": {
    "production": {
      "ios": {
        "resourceClass": "m-medium",
        "autoIncrement": true
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your@email.com",
        "ascAppId": "1234567890",
        "appleTeamId": "XXXXXXXXXX"
      }
    }
  }
}
```

Find `ascAppId` in App Store Connect → App Information → Apple ID.

## TestFlight vs App Store

### TestFlight (Beta Testing)

- Builds appear after Apple processing; compliance and group assignment may still need attention
- Internal testers (up to 100) - verify the build is available to the intended group
- External testers (up to 10,000) - requires beta review
- Builds expire after 90 days

### App Store (Production)

- Requires passing App Review
- Submit for review from App Store Connect
- Choose release timing (immediate, scheduled, manual)

## Complete the Public Release

EAS Submit uploads the binary to App Store Connect. Public distribution continues through the app version's App Review and release flow, as described in the [EAS Submit guide](https://docs.expo.dev/submit/ios/).

1. Open the correct app and iOS version in App Store Connect. In its Build section, select the exact processed version/build you verified. Reuse an eligible TestFlight build when its code, icon, and configuration are ready for production; build again when those must change. Confirm the build is selectable for the App Store version. See [Apple's build-selection guide](https://developer.apple.com/help/app-store-connect/manage-builds/choose-a-build-to-submit/).
2. Complete the required listing and review information: screenshots, description, support/privacy URLs, age rating, privacy declarations, export compliance, reviewer contact/login, and pricing/availability as applicable. Resolve the version's outstanding requirements before submission.
3. Choose the requested release timing: manual release, automatic release after approval, or automatic release no earlier than a chosen date. Approval is still required for the date-based option.
4. Click **Add for Review**, inspect the draft submission, then **Submit for Review**. Adding to a draft alone does not send it to Apple. Handle review messages and verify the resulting status. See [Apple's submission steps](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app/).
5. After approval, follow the selected release timing. For manual release, the version waits in **Pending Developer Release** until **Release This Version** is completed. Verify availability in the intended storefronts before reporting it live. See [Apple's release options](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/select-an-app-store-version-release-option/).

Perform these publication steps only within the requested release scope. Preparing documentation or uploading a TestFlight beta does not itself request a public launch. Report the exact version/build and distinguish uploaded, submitted for review, approved, and publicly available.

## App Review Process

### What Reviewers Check

1. **Functionality** - App works as described
2. **UI/UX** - Follows Human Interface Guidelines
3. **Content** - Appropriate and accurate
4. **Privacy** - Data handling matches declarations
5. **Legal** - Complies with local laws

### Common Rejection Reasons

| Issue | Solution |
|-------|----------|
| Crashes/bugs | Test thoroughly before submission |
| Incomplete metadata | Fill all required fields |
| Placeholder content | Remove "lorem ipsum" and test data |
| Missing login credentials | Provide demo account |
| Privacy policy missing | Add URL in App Store Connect |
| Guideline 4.2 (minimum functionality) | Ensure app provides value |

### Expedited Review

Request expedited review for:
- Critical bug fixes
- Time-sensitive events
- Security issues

Go to App Store Connect → your app → App Review → Request Expedited Review.

## Version and Build Numbers

iOS uses two version identifiers:

- **Version** (`CFBundleShortVersionString`): User-facing, e.g., "1.2.3"
- **Build Number** (`CFBundleVersion`): Internal, must increment for each upload

For Expo projects whose native files are generated from app config, configure in `app.json`:

```json
{
  "expo": {
    "version": "1.2.3",
    "ios": {
      "buildNumber": "1"
    }
  }
}
```

With `autoIncrement: true` and remote versioning, EAS increments its counter and writes native version metadata during the build. When setting up or changing native Swift versioning, or diagnosing a duplicate build number, verify the archive's `CFBundleVersion` as described in [native-ios.md](native-ios.md). A changing remote counter does not prove Xcode used it.

## Release Options

These JSON examples are fragments of `store.config.json` for EAS Metadata. They configure release timing; uploading with EAS Submit still requires selecting the processed build and completing App Review before a public release.

### Automatic Release

Release immediately when approved:

```json
{
  "apple": {
    "release": {
      "automaticRelease": true
    }
  }
}
```

### Scheduled Release

```json
{
  "apple": {
    "release": {
      "automaticRelease": "2025-03-01T10:00:00Z"
    }
  }
}
```

### Phased Release

Gradual rollout over 7 days:

```json
{
  "apple": {
    "release": {
      "phasedRelease": true
    }
  }
}
```

Rollout: Day 1 (1%) → Day 2 (2%) → Day 3 (5%) → Day 4 (10%) → Day 5 (20%) → Day 6 (50%) → Day 7 (100%)

## Certificates and Provisioning

### Distribution Certificate

- Required for App Store submissions
- Limited to 3 per Apple Developer account
- Valid for 1 year
- EAS manages automatically

### Provisioning Profile

- Links app, certificate, and entitlements
- App Store profiles don't include device UDIDs
- EAS creates and manages automatically

### Check Current Credentials

Ask the account owner to inspect the selected team's credentials through the EAS dashboard or `npx --yes eas-cli@latest credentials -p ios` privately. Request only the non-secret status needed for the release. Do not treat the interactive credential manager as a read-only query or select create/download/revoke actions.

## App Store Metadata

Use EAS Metadata to manage App Store listing from code:

```bash
# Pull existing metadata
npx --yes eas-cli@latest metadata:pull

# Push changes
npx --yes eas-cli@latest metadata:push
```

See ./app-store-metadata.md for detailed configuration.

## Troubleshooting

### "No suitable application records found"

Create the app in App Store Connect first with matching bundle ID.

### "The bundle version must be higher"

Compare the number inside the rejected archive with EAS's remote counter. For native Swift, check the plist/build-setting ownership described in [native-ios.md](native-ios.md), then rebuild and submit the corrected artifact.

### "Missing compliance information"

Review the app's actual encryption use and complete Apple's export-compliance requirements. For an Expo app generated from app config, an exempt app can declare:

```json
{
  "expo": {
    "ios": {
      "config": {
        "usesNonExemptEncryption": false
      }
    }
  }
}
```

For a checked-in Swift app, the equivalent declaration belongs in its native Info.plist as `ITSAppUsesNonExemptEncryption`. Use the value appropriate to the app; changing app.json alone does not update its native plist.

### "Invalid provisioning profile"

Check the selected team, bundle ID, entitlements, and profile expiry against the build configuration. Have the account owner resolve an invalid profile through the official credential flow privately. A failed build does not authorize revoking or replacing valid signing credentials.

### Build stuck in "Processing"

App Store Connect processing can take 5-30 minutes. Check status in App Store Connect → TestFlight.

## CI/CD Integration

For automated submissions in CI/CD:

Approve the exact tagged source and submit profile before the build job receives signing access. Use protected release tags; enabling unattended releases requires an explicit automation request and a corresponding trusted-source policy.

```yaml
# .eas/workflows/release.yml
name: Upload production iOS build

on:
  push:
    tags: ['v*']

jobs:
  approve_release:
    type: require-approval

  build:
    type: build
    needs: [approve_release]
    params:
      platform: ios
      profile: production

  submit:
    type: submit
    needs: [build]
    params:
      build_id: ${{ needs.build.outputs.build_id }}
      profile: production
```

## Tips

- Submit to TestFlight early and often for feedback
- Use beta app review for external testers to catch issues before App Store review
- Respond to reviewer questions promptly in App Store Connect
- Keep demo account credentials up to date
- Monitor App Store Connect notifications for review updates
- Use phased release for major updates to catch issues early
