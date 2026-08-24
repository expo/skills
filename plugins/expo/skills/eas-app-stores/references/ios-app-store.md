# Submitting to iOS App Store

> Source: https://docs.expo.dev/submit/ios/ — the canonical page. This reference adds only what the docs do not cover: credential-setup judgment and submission troubleshooting.

Release strategy: always TestFlight first — see ./testflight.md. Listing copy and release options (automatic/scheduled/phased) — see ./app-store-metadata.md.

## Prerequisites (in order)

1. Apple Developer Program membership.
2. App record in App Store Connect with a bundle ID matching `app.json` — create it before first submission.
3. Credentials configured (below).

## Credential Setup

```bash
eas credentials -p ios
```

Interactive flow that creates or selects the distribution certificate and provisioning profile and configures an App Store Connect API key. EAS creates and manages certificates and profiles automatically — do not hand-manage them unless forced to.

### App Store Connect API key (use this)

API keys avoid 2FA prompts, which makes them the only sane option for CI. Create one in App Store Connect (Users and Access → Keys) with at least the **App Manager** role — the minimum for submissions — and download the `.p8` file. Then either:

```json
{
  "submit": {
    "production": {
      "ios": {
        "ascApiKeyPath": "./AuthKey_XXXXX.p8",
        "ascApiKeyIssuerId": "xxxxx-xxxx-xxxx-xxxx-xxxxx",
        "ascApiKeyId": "XXXXXXXXXX"
      }
    }
  }
}
```

or env vars: `EXPO_ASC_API_KEY_PATH`, `EXPO_ASC_API_KEY_ISSUER_ID`, `EXPO_ASC_API_KEY_ID`.

### Apple ID (fallback)

`EXPO_APPLE_ID` + `EXPO_APPLE_TEAM_ID`. Accounts with 2FA need an app-specific password — workable interactively, painful in CI. Prefer the API key.

## Submitting

```bash
eas submit -p ios --latest    # submit the most recent finished build
```

Add `--submit` to `eas build` to chain build → submit in one command. Run `eas submit --help` for the current surface — flags and subcommands vary by installed eas-cli version.

`ascAppId` for submit profiles is found in App Store Connect → App Information → Apple ID.

## Version and build numbers

iOS has two identifiers: the user-facing version (`CFBundleShortVersionString`) and the build number (`CFBundleVersion`), which must increase for every upload. With `appVersionSource: "remote"` in `eas.json` and `autoIncrement: true` on the build profile, EAS handles build numbers automatically. See https://docs.expo.dev/build-reference/app-versions/.

## Troubleshooting

### "No suitable application records found"

Create the app in App Store Connect first with matching bundle ID.

### "The bundle version must be higher"

Increment build number. With `autoIncrement: true`, this is automatic.

### "Missing compliance information"

Add export compliance to `app.json`:

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

### "Invalid provisioning profile"

```bash
eas credentials -p ios --sync
```

### Build stuck in "Processing"

App Store Connect processing can take 5-30 minutes. Check status in App Store Connect → TestFlight.

### Purpose strings, ITMS-90683, and universal links

Rejections for missing `infoPlist` purpose strings (ITMS-90683) and universal-links/AASA (`apple-app-site-association`) setup are covered in the sibling `expo-app-clip` skill and its references.
