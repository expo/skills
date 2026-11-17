# Submitting to Google Play Store

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

Store the key file securely and add it to `.gitignore`.

## Environment Variables

For CI/CD, use environment variables instead of file paths:

```bash
# Base64-encoded service account JSON
EXPO_ANDROID_SERVICE_ACCOUNT_KEY_BASE64=...
```

Or use EAS Secrets:

```bash
eas secret:create --name GOOGLE_SERVICE_ACCOUNT --value "$(cat google-service-account.json)" --type file
```

Then reference in `eas.json`:

```json
{
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "@secret:GOOGLE_SERVICE_ACCOUNT"
      }
    }
  }
}
```

## Release Tracks

Google Play uses tracks for staged rollouts:

| Track | Purpose |
|-------|---------|
| `internal` | Internal testing (up to 100 testers) |
| `alpha` | Closed testing |
| `beta` | Open testing |
| `production` | Public release |

### Track Configuration

```json
{
  "submit": {
    "production": {
      "android": {
        "track": "production",
        "releaseStatus": "completed"
      }
    },
    "internal": {
      "android": {
        "track": "internal",
        "releaseStatus": "completed"
      }
    }
  }
}
```

### Release Status Options

- `completed` - Immediately available on the track
- `draft` - Upload only, release manually in Console
- `halted` - Pause an in-progress rollout
- `inProgress` - Staged rollout (requires `rollout` percentage)

## Staged Rollout

```json
{
  "submit": {
    "production": {
      "android": {
        "track": "production",
        "releaseStatus": "inProgress",
        "rollout": 0.1
      }
    }
  }
}
```

This releases to 10% of users. Increase via Play Console or subsequent submissions.

## Submission Commands

```bash
# Build and submit to internal track
eas build -p android --profile production --auto-submit

# Submit existing build to Play Store
eas submit -p android --latest

# Submit specific build
eas submit -p android --id BUILD_ID
```

## App Signing

### Google Play App Signing (Recommended)

EAS uses Google Play App Signing by default:

1. First upload: EAS creates upload key, Play Store manages signing key
2. Play Store re-signs your app with the signing key
3. Upload key can be reset if compromised

### Checking Signing Status

```bash
eas credentials -p android
```

## Version Codes

Android requires incrementing `versionCode` for each upload:

```json
{
  "build": {
    "production": {
      "autoIncrement": true
    }
  }
}
```

With `appVersionSource: "remote"`, EAS tracks version codes automatically.

### `appVersionSource: "remote"` makes `app.json`'s `versionCode` a no-op

With `cli.appVersionSource: "remote"`, the remote record on EAS servers is the
**single source of truth** for the build's `versionCode`. The
`expo.android.versionCode` field in `app.json` is **ignored** — EAS CLI says so
on every invocation:

```
android.versionCode field in app config is ignored when version source is set to
remote, but this value will still be in the manifest available via
expo-constants. It's recommended to remove this value from app config.
```

So editing `app.json` to bump the version code does nothing to the uploaded
artifact. Two consequences worth internalising:

- **To change the baseline**, write the remote record:
  `eas build:version:set --platform android` (prompts for the new value; it
  accepts any integer in `0 < v <= 2100000000`, not only `current + 1`). The
  command touches only the EAS server — it does not modify `eas.json`.
  Read it back with `eas build:version:get --platform android --json`.
- **Remove `expo.android.versionCode` from `app.json`** rather than leaving a
  stale value there. It does not participate in the build, but `expo-constants`
  still surfaces it in the manifest, so a stale number in app config reads as
  "this is the version code" when it is not.

To confirm what a build actually got, read the build log phase
`CONFIGURE_ANDROID_VERSION` — it prints `Version code: N`. Do not infer the
version code from `app.json`.

## First Submission Checklist

Before your first Play Store submission:

- [ ] Create app in Google Play Console
- [ ] Complete app content declaration (privacy policy, ads, etc.)
- [ ] Set up store listing (title, description, screenshots)
- [ ] Complete content rating questionnaire
- [ ] Set up pricing and distribution
- [ ] Create service account with proper permissions
- [ ] Configure `eas.json` with service account path

## Common Issues

### "App not found"

The app must exist in Play Console before EAS can submit. Create it manually first.

### "Version code already used"

Play permanently retires every `versionCode` you have uploaded, so a repeat
upload of the same code is rejected.

- With `appVersionSource: "remote"`: the fix is to advance the **remote
  record**, not `app.json` — `eas build:version:set --platform android`, or let
  `autoIncrement: true` do it on the next build. Editing `app.json` changes
  nothing (see "Version Codes" above).
- With a local version source: increment `expo.android.versionCode` in
  `app.json`.

If the code was already used on the Play side, you cannot reuse it — jump
**forward** to a higher code. Play requires the version code to increase
monotonically and never to repeat, but it does **not** require consecutive
values, so skipping ahead is valid.

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

For quick internal distribution without Play Store:

```bash
# Build with internal distribution
eas build -p android --profile development

# Share the APK link with testers
```

Or use EAS Update for OTA updates to existing installs.

## Monitoring Submissions

Follow the submission URL returned by `eas submit` for status and logs. Check Play Console for the resulting track and release state.

With EAS CLI 23.2.0, `eas submit:list -p android --json` and `eas submit:view SUBMISSION_ID --json` report EAS submission jobs. `submit:status` currently reads Apple status only; do not treat an EAS job's success as confirmation of Play Console rollout.

## Tips

- Start with `internal` track for testing before production
- Use staged rollouts for production releases
- Keep service account key secure - never commit to git
- Set up Play Console notifications for review status
- Pre-launch reports in Play Console catch issues before review
