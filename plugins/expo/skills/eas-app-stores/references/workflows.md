# EAS Workflows

Automate builds, submissions, and PR-preview updates with EAS Workflows. The examples below are store-release-oriented starting points.

When you need to write, edit, or validate a workflow YAML file beyond these examples, use the `eas-workflows` skill. For website and API-route deploy workflows (`type: deploy`), see the `eas-hosting` skill.

## PR Previews with EAS Update

Publish preview updates only from a reviewed commit. EAS does not trigger these workflows for forks, but same-repository PR code and dependency scripts can still access a job's environment. Use preview-only variables and require approval of the exact revision before the credentialed job. A label or previous revision's approval does not establish trust in newly pushed code:

```yaml
name: PR Preview

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review_source:
    type: require-approval

  publish:
    type: update
    needs: [review_source]
    environment: preview
    params:
      branch: "pr-${{ github.event.pull_request.number }}"
      message: "PR #${{ github.event.pull_request.number }}"
      upload_sentry_sourcemaps: false
```

## Production Release

Build and upload to the configured store tracks for both platforms. App Store review/public release is a separate step, and an Android profile's `track` determines its audience regardless of its name. Review the tagged source and destination profiles before approving; protect who can create release tags. Submit each platform's explicit build output, rather than resolving a latest build:

```yaml
name: Release

on:
  push:
    tags: ['v*']

jobs:
  approve_release:
    type: require-approval

  build_ios:
    type: build
    needs: [approve_release]
    params:
      platform: ios
      profile: production

  build_android:
    type: build
    needs: [approve_release]
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

## Build on Push

Trigger builds from protected, reviewed branches. Build jobs execute project/dependency scripts and may use signing credentials; do not treat an arbitrary pushed ref as trusted:

```yaml
name: Build

on:
  push:
    branches:
      - main
      - release/*

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
```

## Conditional Jobs

Run a platform's release build only when its preceding check reports relevant changes. This example skips documentation-only changes; app configuration, dependencies, native code, and workflow changes still build. On a shallow checkout or unavailable parent revision, build rather than assume there are no changes:

```yaml
name: Conditional Release

on:
  push:
    branches: [main]

jobs:
  check_changes:
    outputs:
      has_changes: ${{ steps.diff.outputs.has_changes }}
    steps:
      - uses: eas/checkout
      - id: diff
        run: |
          set -euo pipefail
          has_changes=true
          if git rev-parse --verify HEAD~1 >/dev/null 2>&1; then
            changed_files=$(git diff --name-only HEAD~1 HEAD)
            if ! printf '%s\n' "$changed_files" | grep -vE '^(docs/|README\.md$)' >/dev/null; then
              has_changes=false
            fi
          fi
          set-output has_changes "$has_changes"

  build:
    type: build
    needs: [check_changes]
    if: ${{ needs.check_changes.outputs.has_changes == 'true' }}
    params:
      platform: ios
      profile: production
```

## Tips

- Use `workflow_dispatch` for manual production releases
- Combine PR previews with GitHub status checks
- Use tags for versioned releases
- Keep sensitive values in EAS Secrets, not workflow files
- Default to approval gates for new credentialed release pipelines. Remove a gate only when the user requests unattended automation and the repository's protected-ref and credential policy supplies the intended authorization.
- Update jobs can upload source maps to Sentry automatically. Enable that separate transfer only for a requested, verified Sentry integration; the preview example disables it.
