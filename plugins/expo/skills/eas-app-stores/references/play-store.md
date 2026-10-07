# Submitting to Google Play Store

## Prerequisites

1. **Google Play Console Account** - Register at [play.google.com/console](https://play.google.com/console)
2. **App Created in Console** - Create your app listing before first submission
3. **Service Account** - For automated submissions via EAS

Once these are complete, the default `npx --yes eas-cli@latest submit` works for a first-time submission and creates the app's first release on the internal testing track. Store listing, content rating, and pricing are only required before promoting a release to production.

## Service Account Setup

First check whether the selected project already has working EAS-managed submission credentials. Reuse them; a build or submission request does not require a new service account or key.

### 1. Account-owner setup when credentials are missing

Have the account owner complete Google's service-account/key setup privately in Google Cloud Console and Play Console, following the [EAS Google service-account guide](https://github.com/expo/fyi/blob/main/creating-google-service-account.md). Record only the selected project/app and the credential reference needed by EAS. Do not create or download a long-lived key, inspect its contents, or change IAM roles as an incidental step in building or submitting an app.

The owner grants access only to the selected app and requested track. Production-release permission belongs only to a production-distribution setup; missing testing permissions do not justify broader project roles. A missing credential blocks submission until the owner supplies it through the official EAS credential flow.

### 2. Configure EAS

Add the service account key path to `eas.json`:

```json
{
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "../private-credentials/google-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

Prefer existing EAS-managed credentials. The example path denotes protected local storage outside the upload directory; replace it with the existing protected file location rather than copying a key into the project. Hosted workflow jobs need managed credentials or a protected file provisioned for that job; they cannot read a sibling file on your machine. If an existing key is inside the project, exclude its exact path in `.gitignore` and in a custom `.easignore`; the latter overrides `.gitignore`. Verify the upload archive excludes the key and private environment files before building. Never print the file contents. Preserve an existing valid upload key and Play App Signing setup.

## Environment Variables

For managed credentials, use the official `npx --yes eas-cli@latest credentials -p android` flow to configure the Google service-account key for the selected project. The user supplies the key through that credential flow, not chat.

For a CI-managed key, use the CI provider's encrypted file-secret mechanism to materialize a private file and point `serviceAccountKeyPath` at it. Keep it outside version control and shared artifacts, restrict file access, and remove the temporary file after the job. Do not pass the JSON contents as a command argument or print them. Base64 encoding does not protect a secret.

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
# Build a store-distribution binary; this does not select a submission track
npx --yes eas-cli@latest build -p android --profile production

# After checking the build, use the shown profile whose track is internal
npx --yes eas-cli@latest submit -p android --profile production --id BUILD_ID
```

Use the project's actual build and submit profile names and inspect the submit profile's resolved `android.track`. In the example above, the `production` submit profile targets the internal track. The profile name alone does not determine the audience.

## App Signing

### Google Play App Signing (Recommended)

EAS uses Google Play App Signing by default:

1. First upload: EAS creates upload key, Play Store manages signing key
2. Play Store re-signs your app with the signing key
3. Upload key can be reset if compromised

### Checking Signing Status

Have the account owner inspect the selected app's signing status in Play Console/EAS or `npx --yes eas-cli@latest credentials -p android` privately. The credential manager can change or download keys; do not drive those actions or print its raw output as a status check. Preserve valid upload/signing keys and report only the relevant non-secret status.

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

## Production Release Checklist

Before a production release (internal testing has the smaller prerequisites listed above):

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

Increment `versionCode` in `app.json` or use `autoIncrement: true` in `eas.json`.

### "Service account lacks permission"

Check access to the selected app and requested track, and report the missing permission to the account owner. Adjust permissions only within an explicitly requested account-setup task; the error itself does not authorize a role change. Do not grant production-release access to solve a testing-track permission error.

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
npx --yes eas-cli@latest build -p android --profile development

# Share the APK link with testers
```

Or use EAS Update for OTA updates to existing installs.

## Monitoring Submissions

Follow the submission URL returned by `npx --yes eas-cli@latest submit` for status and logs. Check Play Console for the resulting track and release state.

With EAS CLI 23.2.0, `npx --yes eas-cli@latest submit:list -p android --json --non-interactive` and `npx --yes eas-cli@latest submit:view SUBMISSION_ID --json` report EAS submission jobs. Capture their output privately and use the bundled status helper as shown in [Monitoring](../SKILL.md#monitoring); raw responses can contain account names and private log URLs. `submit:status` currently reads Apple status only; do not treat an EAS job's success as confirmation of Play Console rollout.

## Tips

- Start with `internal` track for testing before production
- Use staged rollouts for production releases
- Keep service account key secure - never commit to git
- Set up Play Console notifications for review status
- Pre-launch reports in Play Console catch issues before review
