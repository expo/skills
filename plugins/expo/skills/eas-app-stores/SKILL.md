---
name: eas-app-stores
description: EAS service (paid). Deploy Expo apps to the app stores with EAS - build and submit to the iOS App Store, Google Play Store, and TestFlight, configure eas.json build and submit profiles, manage app versions and build numbers, and publish App Store metadata and ASO. Use whenever the user wants to deploy, release, or ship an app to production or the app stores, is preparing a production build, running eas build or eas submit, shipping to TestFlight, bumping version or build numbers, or setting up store listing metadata. For deploying an Expo website or API routes, use the eas-hosting skill.
version: 1.0.0
license: MIT
---

# App Store Deployment

> **EAS service - costs apply.** This skill uses Expo Application Services (EAS), a paid product with free-tier limits. `eas build` and `eas submit` consume your plan's build minutes, and store submission requires paid Apple Developer and Google Play accounts. Review https://expo.dev/pricing before running cloud commands.

Build and release Expo apps to the iOS App Store, Google Play Store, and TestFlight with EAS.

> **Source of truth:** https://docs.expo.dev/deploy/submit-to-app-stores/ — consult the canonical docs when API details matter.

## Decision rules

- iOS release → always TestFlight first, never straight to App Store — ./references/testflight.md
- iOS credentials, submission errors, App Review rejections → ./references/ios-app-store.md
- Android release → the default `eas submit` works first-time onto the internal track; a store listing only blocks production — ./references/play-store.md
- Store listing copy, release options (automatic/scheduled/phased), ASO → EAS Metadata, Apple App Store only — ./references/app-store-metadata.md
- CI/CD YAML for automated store releases (build → submit → update pipelines, PR previews) → use the sibling `eas-workflows` skill; it works from the live workflow schema
- Deploying an Expo website or API routes (`npx expo export -p web`, `eas deploy`) → use the `eas-hosting` skill

## Quick Start

```bash
npm install -g eas-cli
eas login
npx eas-cli@latest init    # creates eas.json with build profiles
```

## Build and Submit

```bash
eas build -p ios --profile production --submit   # build, then auto-submit to the store
eas submit -p ios --latest                       # submit an existing build
npx testflight                                   # iOS TestFlight shortcut
```

Swap `-p android` for the Play Store. Entry commands are `eas build` and `eas submit`; run `eas build --help` / `eas submit --help` for the current surface — subcommands vary by installed eas-cli version, so never guess at `build:*` / `submit:*` subcommands.

## eas.json

Standard configuration for production deployments:

```json
{
  "cli": {
    "version": ">= 16.0.1",
    "appVersionSource": "remote"
  },
  "build": {
    "production": {
      "autoIncrement": true,
      "ios": {
        "resourceClass": "m-medium"
      }
    },
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "your@email.com",
        "ascAppId": "1234567890"
      },
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
      }
    }
  }
}
```

- `appVersionSource: "remote"` + `autoIncrement: true`: EAS owns iOS build numbers and Android version codes, which both stores require to increase on every upload. Check or set with `eas build:version:get` / `eas build:version:set`.
- `submit` profiles hold store credentials: `ascAppId` (App Store Connect → App Information → Apple ID) for iOS; `serviceAccountKeyPath` + `track` for Android.

## Gotchas

- `eas submit` requires the app to already exist in the store console (iOS: App Store Connect record with matching bundle ID; Android: Play Console app plus a linked service account).
- After upload, App Store Connect processes builds for 5-30 minutes before they appear in TestFlight — not an error.
- New iOS apps must submit a binary before `eas metadata:push` will work.

## Submitting Feedback
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes submit-expo-feedback@latest --category skills --subject "eas-app-stores" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
If an AI agent repeatedly failed or the user had to take over an Expo task, load the expo-skill-feedback skill and follow its eval-candidate flow instead of reusing the command above.
