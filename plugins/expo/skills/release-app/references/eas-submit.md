# Submit with EAS

Send the finished builds to App Store Connect and Google Play. For deeper credential and submit-profile reference, see the `expo-deployment` skill.

## Prerequisites

```
□ Build completed successfully
□ App created in App Store Connect (iOS) and Google Play Console (Android)
□ All store metadata filled in
□ Screenshots uploaded
□ Privacy policy URL added
```

## Step 1 — credentials

```
iOS (App Store Connect):
  eas credentials   → select iOS → set up an App Store Connect API Key
  (or use manual Apple ID login)

Android (Google Play):
  - Create a service account in Google Cloud Console
  - Download its JSON key
  - Add it under Play Console → API access
  - Reference it in eas.json:
    {
      "submit": {
        "production": {
          "android": {
            "serviceAccountKeyPath": "./google-service-account.json",
            "track": "production"
          }
        }
      }
    }
```

## Step 2 — submit

```bash
eas submit --platform ios --latest
eas submit --platform android --latest
# or both:
eas submit --platform all --latest
```

After submission: iOS goes to App Store review (typically 1–3 days); Android goes to Play review (usually faster).

## First-time submission checklists

```
iOS (App Store Connect)
□ App created; bundle ID matches
□ Metadata complete (name, description, keywords, …)
□ Screenshots for required device sizes
□ Privacy policy URL added
□ Age-rating questionnaire complete
□ Pricing and availability set

Android (Google Play)
□ App created; package name matches
□ Store listing complete
□ Screenshots uploaded
□ Privacy policy URL added
□ Data Safety questionnaire complete
□ Content rating questionnaire complete
□ Target audience / content settings configured
□ 12 testers for 14 days (new personal-account requirement)
```

## Google Play's 12-tester requirement

New **personal** developer accounts must run a closed test with **12 testers for at least 14 days**, and testers must actually use the app (not just install).

```
1. Play Console → Testing → Closed testing → create a track
2. Add tester emails (or a Google Group)
3. Share the opt-in link
4. Wait 14 days with active usage
```

Tip: recruit friends/family or swap testers with other developers (e.g. the Expo Discord).

## Automate future releases with EAS Workflows

Once the first release is live, automate subsequent builds and submissions. Fingerprinting skips a native build when only JS changed and ships an OTA update instead.

Create `.eas/workflows/deploy-to-production.yml`:

```yaml
name: Deploy to production
on:
  push:
    branches: ['main']

jobs:
  fingerprint:
    name: Fingerprint
    type: fingerprint
    environment: production

  get_android_build:
    name: Check for existing Android build
    needs: [fingerprint]
    type: get-build
    params:
      fingerprint_hash: ${{ needs.fingerprint.outputs.android_fingerprint_hash }}
      profile: production

  get_ios_build:
    name: Check for existing iOS build
    needs: [fingerprint]
    type: get-build
    params:
      fingerprint_hash: ${{ needs.fingerprint.outputs.ios_fingerprint_hash }}
      profile: production

  build_android:
    name: Build Android
    needs: [get_android_build]
    if: ${{ !needs.get_android_build.outputs.build_id }}
    type: build
    params: { platform: android, profile: production }

  build_ios:
    name: Build iOS
    needs: [get_ios_build]
    if: ${{ !needs.get_ios_build.outputs.build_id }}
    type: build
    params: { platform: ios, profile: production }

  submit_android_build:
    name: Submit Android Build
    needs: [build_android]
    type: submit
    params: { build_id: ${{ needs.build_android.outputs.build_id }} }

  submit_ios_build:
    name: Submit iOS Build
    needs: [build_ios]
    type: submit
    params: { build_id: ${{ needs.build_ios.outputs.build_id }} }

  publish_android_update:
    name: Publish Android update
    needs: [get_android_build]
    if: ${{ needs.get_android_build.outputs.build_id }}
    type: update
    params: { branch: production, platform: android }

  publish_ios_update:
    name: Publish iOS update
    needs: [get_ios_build]
    if: ${{ needs.get_ios_build.outputs.build_id }}
    type: update
    params: { branch: production, platform: ios }
```

Push to `main` and the workflow triggers: native changes build + submit; JS-only changes ship an OTA update. Docs: https://docs.expo.dev/eas/workflows/examples/deploy-to-production/

> For more workflow examples, the `expo-cicd-workflows` skill covers EAS Workflows YAML in depth.
