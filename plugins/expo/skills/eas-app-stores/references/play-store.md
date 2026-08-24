# Submitting to Google Play Store

> Source: https://docs.expo.dev/submit/android/ — the canonical page. This reference adds only what the docs do not cover: first-submission ordering, service-account permission judgment, and submission troubleshooting.

## Prerequisites

1. **Google Play Console Account** - Register at [play.google.com/console](https://play.google.com/console)
2. **App Created in Console** - Create your app listing before first submission
3. **Service Account** - For automated submissions via EAS

Once these are complete, the default `eas submit` works for a first-time submission and creates the app's first release on the internal testing track. Store listing, content rating, and pricing are only required before promoting a release to production.

## Service Account Setup

### 1. Create Service Account

1. Go to Google Cloud Console → IAM & Admin → Service Accounts
2. Create a new service account
3. Grant the "Service Account User" role
4. Create and download a JSON key

### 2. Link to Play Console

1. Go to Play Console → Setup → API access
2. Click "Link" next to your Google Cloud project
3. Under "Service accounts", click "Manage Play Console permissions"
4. Grant "Release to production" permission (or appropriate track permissions)

### 3. Configure EAS

Add the service account key path to `eas.json`:

```json
{
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

Store the key file securely and add it to `.gitignore` — never commit it.

For CI/CD, avoid the file path: set `EXPO_ANDROID_SERVICE_ACCOUNT_KEY_BASE64` (base64-encoded key JSON), or store the key as an EAS file secret and reference it as `serviceAccountKeyPath: "@secret:NAME"`. The secrets subcommand has moved between `eas secret` and `eas env` across eas-cli versions — run `eas --help` to find the current one.

## Release Tracks

| Track | Purpose |
|-------|---------|
| `internal` | Internal testing (up to 100 testers) |
| `alpha` | Closed testing |
| `beta` | Open testing |
| `production` | Public release |

Set `track` per submit profile. `releaseStatus` controls what happens on upload:

- `completed` - Immediately available on the track
- `draft` - Upload only, release manually in Console
- `halted` - Pause an in-progress rollout
- `inProgress` - Staged rollout; requires a `rollout` fraction, e.g. `"rollout": 0.1` for 10%. Increase via Play Console or subsequent submissions.

## Submitting

```bash
eas build -p android --profile production --submit   # build, then auto-submit
eas submit -p android --latest                       # submit an existing build
```

Run `eas submit --help` for the current surface — flags and subcommands vary by installed eas-cli version.

## App Signing

EAS uses Google Play App Signing by default: on first upload EAS creates an upload key, the Play Store holds the signing key and re-signs your app, and the upload key can be reset if compromised. Check status with `eas credentials -p android`.

## Version Codes

Android requires incrementing `versionCode` for each upload. With `appVersionSource: "remote"` in `eas.json` and `autoIncrement: true` on the build profile, EAS tracks version codes automatically.

## First Submission Checklist

Before the first `eas submit` (lands on internal track):

- [ ] Create app in Google Play Console
- [ ] Create service account with proper permissions
- [ ] Configure `eas.json` with service account path

Only before promoting to production:

- [ ] Complete app content declaration (privacy policy, ads, etc.)
- [ ] Set up store listing (title, description, screenshots)
- [ ] Complete content rating questionnaire
- [ ] Set up pricing and distribution

## Common Issues

### "App not found"

The app must exist in Play Console before EAS can submit. Create it manually first.

### "Version code already used"

Increment `versionCode` in `app.json` or use `autoIncrement: true` in `eas.json`.

### "Service account lacks permission"

Ensure the service account has "Release to production" permission in Play Console → API access.

### "APK not acceptable"

Play Store requires AAB (Android App Bundle) for new apps:

```json
{
  "build": {
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```

## Internal Testing Distribution

For quick internal distribution without the Play Store, build with `distribution: "internal"` (the default `development` profile) and share the APK link with testers, or use EAS Update for OTA updates to existing installs.

## Tips

- Start with the `internal` track; use staged rollouts (`releaseStatus: "inProgress"`) for production releases
- Pre-launch reports in Play Console catch issues before review
