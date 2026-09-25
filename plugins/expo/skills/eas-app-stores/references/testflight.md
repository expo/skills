# iOS upload and TestFlight delivery

Use the configured store-distribution profile and exact build ID from the main skill. First-time native Swift setup belongs in [native-ios.md](native-ios.md). Existing Expo/React Native apps can also use `npx testflight`.

## Inspect status

These commands were verified with EAS CLI 23.2.0; the tested 18.6.0 installation lacks them. Check installed help, or use `npx eas-cli@23.2.0` without changing the global installation:

```bash
eas submit:list --platform ios --json
eas submit:view SUBMISSION_ID --json
eas submit:status --platform ios --profile production --json --non-interactive
```

Use the project's actual submit profile. `submit:view` describes the EAS job; `submit:status` reads App Store Connect. The latter needs an ASC API key from the profile, environment or existing EAS credentials. A missing key is an authentication/setup failure, not proof the build failed or does not exist. Use [EAS Submit's API key setup](https://docs.expo.dev/submit/ios/#automate-with-eas-workflows) when needed. Prefer the supported CLI over private GraphQL or internal Node imports.

| Evidence | What to check next |
| --- | --- |
| EAS build finished | Intended build ID, revision and store-distribution profile |
| Submission queued | Returned submission URL and worker logs |
| Apple processing succeeded | Compliance and availability to the intended tester group |
| Build assigned and testers can install | Verify the beta app on a device |
| App Review approved | Requested release timing and actual storefront availability |

`--no-wait` returning successfully establishes only that work was queued. If the EAS summary omits an error, follow its worker-log URLs. A beta processing state alone does not prove a tester has access. Use [Apple's tester instructions](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers/) for groups and invitations, and its [TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/) for current limits/review rules. Keep distribution within the requested scope.

## Choose the recovery action

| Failure | Action |
| --- | --- |
| Missing credentials | Complete setup with `eas credentials -p ios`; noninteractive retries cannot do this |
| Missing/expired agreement | The Account Holder resolves it for the selected Apple team |
| App record missing | Check Apple team, native bundle ID and numeric `ascAppId` together |
| Duplicate build number | Inspect the archive's `CFBundleVersion`; use the [native checks](native-ios.md#diagnose-native-version-or-icon-failures) for Swift or [EAS versioning docs](https://docs.expo.dev/build-reference/app-versions/) for Expo/React Native, then rebuild |
| Rejected icon | Fix the icon selected by that profile and rebuild. Default PNGs must have no alpha channel; preserve transparent dark variants and Icon Composer layers per [Apple's icon guidance](https://developer.apple.com/documentation/xcode/configuring-your-app-icon) |
| Upload accepted but unavailable to testers | Check processing, compliance and intended group assignment |
| Optional release notes rejected by plan | Omit the optional parameter and use App Store Connect for notes; do not rebuild or change plans |

For account or submission failures, reuse the valid artifact once the cause is fixed. `eas submit:retry SUBMISSION_ID --json --non-interactive` is available in the verified CLI; check retry eligibility in `submit:view` first. Retrying an unchanged archive cannot repair its version or icon. Submit a corrected build by exact ID after an artifact failure.

Report the build/version and furthest verified stage. Continue to [public release](ios-app-store.md#complete-the-public-release) only when requested.
