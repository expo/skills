# Public iOS App Store release

For native Swift setup read [native-ios.md](native-ios.md). For uploading and checking Apple processing, use the main skill and [testflight.md](testflight.md). EAS Submit uploads the binary; public App Review and release are additional stages.

## Complete the Public Release

1. Confirm the requested app, Apple team, version and release scope. Reuse an eligible TestFlight build with the intended code, icon and configuration; build again when those need to change. Match the native bundle ID to the App Store Connect app record.
2. Select the exact processed build for the store version. Finish the listing, privacy declarations, review information and export compliance based on the app's actual behavior. Supply a working demo account when review needs login.
3. Set the requested manual, automatic or scheduled release timing before submitting the version for App Review. Confirm both the saved release option and actual review submission.
4. Follow the review result and release at the requested time. Distinguish a saved draft, submitted review, approval and storefront availability when reporting progress.

For manual release, approval leaves the version in **Pending Developer Release**. Release it at the requested time, then verify storefront availability. Report the pending state if the user has not requested that final action yet.

Load the relevant official instructions when executing these steps:

| Task | Current reference |
| --- | --- |
| Credentials, upload and EAS setup | [Submit to the Apple App Store](https://docs.expo.dev/submit/ios/) |
| Submit profile fields | [EAS Submit configuration](https://docs.expo.dev/submit/eas-json/) |
| Select an existing processed build | [Apple: choose a build](https://developer.apple.com/help/app-store-connect/manage-builds/choose-a-build-to-submit/) |
| Submit for review | [Apple: submit an app](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app/) |
| Release timing and phased release | [Apple: release options](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/select-an-app-store-version-release-option/) |
| General version management | [EAS app versions](https://docs.expo.dev/build-reference/app-versions/) |
| Listing configuration and schema | [EAS Metadata](https://docs.expo.dev/eas/metadata/) |

Use `eas credentials -p ios` to inspect or complete signing setup; preserve working credentials and keep private keys out of version control. Use the current credential docs for a new key type or authentication method. For native apps, Xcode/plist configuration owns bundle identity, versions and encryption declarations; Expo app-config changes alone do not update checked-in native files.

For version, icon, credentials or processing failures, use the [recovery table](testflight.md#choose-the-recovery-action). Fix binary defects with a new build; resolve account, listing or submission problems using the valid existing build where possible.

For listing copy and ASO, use [app-store-metadata.md](app-store-metadata.md). `store.config.json` belongs to EAS Metadata; release configuration there does not itself submit the version for App Review. Use `eas-workflows` and its current job schema for automation, passing the build job's output ID into the submission job.

Report the selected version/build and whether it is uploaded, submitted for review, approved or publicly available. A TestFlight-only request does not authorize a public release.
