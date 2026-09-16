# Store release workflows

Use `eas-workflows` whenever authoring or changing EAS workflow YAML, including
when adapting this example. Fetch its current schema and selected job contracts,
then validate the finished file. This reference adds the store-specific connection
between build artifacts and submissions; it is not a separate YAML authority.

## Build and submit the same artifacts

Confirm the existing build and submit profiles, signing, store identifiers, and
release destination first. An EAS submit job transfers the build to the store;
Apple processing, tester availability, review, and public release remain separate.

This manual-trigger example submits the exact outputs of separate iOS and Android
build jobs. Replace profile names with the project's selected profiles. A workflow
run starts remote operations; authoring this file alone does not authorize a run.

```yaml
name: Store submission
on:
  workflow_dispatch: {}

jobs:
  build_ios:
    type: build
    params:
      platform: ios
      profile: production

  build_android:
    type: build
    params:
      platform: android
      profile: production

  submit_ios:
    type: submit
    needs: [build_ios]
    params:
      build_id: ${{ needs.build_ios.outputs.build_id }}
      profile: production

  submit_android:
    type: submit
    needs: [build_android]
    params:
      build_id: ${{ needs.build_android.outputs.build_id }}
      profile: production
```

A build job targets one platform; use separate jobs for iOS and Android. Submit
jobs receive `build_id` rather than a platform selector. Avoid `--latest`-style
selection when the workflow already knows the artifact it should submit.

For tag/push/PR triggers, conditions, custom steps, and named job outputs, use the
[current syntax](https://docs.expo.dev/eas/workflows/syntax/) and
[job contracts](https://docs.expo.dev/eas/workflows/pre-packaged-jobs/).
EAS custom jobs use their documented steps/output mechanisms; GitHub Actions
constructs such as `$GITHUB_OUTPUT` are not interchangeable. For PR OTA previews,
use `eas-update` to establish the compatible runtime, channel/branch, and EAS
environment before wiring the update job. Keep credentials in the supported
credential store or CI secret integration, outside committed YAML.
