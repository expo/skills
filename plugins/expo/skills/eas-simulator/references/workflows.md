# Build artifacts and run repeatable tests with EAS Workflows

Choose the workflow's outcome first:

| Outcome | Approach |
|---|---|
| Build an Expo app, then explore it interactively | EAS Build / a workflow `type: build` job, then install its build ID in EAS Simulator |
| Build a native Swift app without local Xcode | A custom macOS workflow: checkout → resolve dependencies → `xcodebuild` → upload simulator artifact → install in EAS Simulator |
| Repeat a known regression test in CI | Run the test on the workflow worker's simulator/emulator; retain assertions, logs, and captures as artifacts |

A simulator running **inside a workflow worker** is separate from a hosted **EAS Simulator session**. Do not start an additional hosted session when the test can run on its worker. The interactive hosted path is useful when a human/agent needs to inspect and continue operating the app.

Load the sibling `eas-workflows` skill before authoring YAML: fetch the [current schema](https://api.expo.dev/v2/workflows/schema), [syntax](https://docs.expo.dev/eas/workflows/syntax/), and [job definitions](https://docs.expo.dev/eas/workflows/pre-packaged-jobs/), then validate with EAS CLI. The examples here explain the artifact handoff, not the full workflow language.

## Build the current local checkout

`eas workflow:run <file>` packages and uploads the local project, including eligible uncommitted edits. `--ref <ref>` instead runs the remote Git state at that ref; it will not test your unpushed working-tree edits. Check ignore rules and the upload root so source, shared Xcode schemes, required config, and the workflow itself arrive. Exclude simulator credentials, local build output, and unrelated files from uploads. Use the intended linked EAS project/account.

```bash
npx --yes eas-cli@latest workflow:validate .eas/workflows/simulator-build.yml --non-interactive
npx --yes eas-cli@latest workflow:run .eas/workflows/simulator-build.yml --non-interactive
# Record the run ID. Submission success is not build success.
npx --yes eas-cli@latest workflow:view <run-id> --json
```

Require the validation message `Workflow configuration YAML is valid.`; a successful shell exit alone is insufficient. Use `--wait` on `workflow:run` when you want its completion exit code, or inspect the named run afterward. Use `workflow:logs --help` to select the failing job/step when necessary. Keep a record of what source was uploaded; a local run's Git SHA alone may not identify uncommitted changes.

## Expo: use a simulator build profile

Use the project's existing profile, or the development/preview profiles in [run-your-app.md](./run-your-app.md). For example:

```yaml
name: Build development simulator app
on:
  workflow_dispatch: {}
jobs:
  build_ios:
    type: build
    params:
      platform: ios
      profile: development-simulator
```

On success, read that job's `outputs.build_id` from `workflow:view <run-id> --json`. Use this **build ID**, not the workflow run ID, in `eas sim --build-id <build-id>`. Prepare Metro and add `--open-url` for a development build; a standalone preview does not need Metro.

An existing compatible development binary can avoid rebuilding for JS-only edits. For CI that reuses native builds, consult the current `fingerprint`, `get-build`, and `repack` job documentation: native compatibility and the freshness of embedded JS are separate checks. Do not declare a changed checkout tested solely because a native fingerprint matched.

## Swift / SwiftUI: custom macOS job

A native Xcode app can use EAS as its build machine. Keep its existing project structure; do not convert it to Expo or run Expo prebuild. The CLI still needs EAS project linkage for the workflow and hosted session. Resolve the actual project/workspace, shared scheme, app product, and bundle ID before adapting this example.

For a native-only repository with no EAS metadata, EAS CLI 23.2.0 can read a minimal `package.json` (for example, `{"name":"my-app","version":"1.0.0","private":true}`) and `app.json` without installing Expo. Set `expo.name` and `expo.slug` in `app.json`, then link the intended account/project with `eas init`; the result must contain `expo.extra.eas.projectId`. This metadata identifies the EAS project; Xcode remains the source of the native app's bundle ID and build settings. Preserve existing metadata when it is already configured.

```yaml
name: Build Swift simulator app
on:
  workflow_dispatch: {}
jobs:
  build_swift:
    runs_on: macos-medium
    steps:
      - uses: eas/checkout
      # Add the project's dependency setup here (SwiftPM, CocoaPods, etc.).
      - name: Build simulator app
        run: |
          set -euo pipefail
          xcodebuild -project MyApp.xcodeproj -scheme MyApp \
            -configuration Debug -destination 'generic/platform=iOS Simulator' \
            -derivedDataPath .sim-build CODE_SIGNING_ALLOWED=NO build
      - name: Package simulator app
        run: |
          set -euo pipefail
          APP_PATH='.sim-build/Build/Products/Debug-iphonesimulator/MyApp.app'
          test -d "$APP_PATH"
          /usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' "$APP_PATH/Info.plist"
          mkdir -p simulator-artifact
          tar -czf simulator-artifact/MyApp-simulator.tar.gz \
            -C "$(dirname "$APP_PATH")" "$(basename "$APP_PATH")"
      - uses: eas/upload_artifact
        with:
          type: other
          name: simulator-app
          path: simulator-artifact/MyApp-simulator.tar.gz
```

The important boundaries:

- **Checkout is explicit.** An uploaded source archive is not automatically your custom job's working directory; start with `eas/checkout`.
- **Build for iOS Simulator.** A device build/IPA or a macOS application is a different artifact. Use a compatible Xcode image, simulator architecture, and deployment target. Simulator builds do not need Apple distribution credentials.
- **Select the app product explicitly.** A repository may build widgets, tests, or several apps. Package the intended `.app`, not the first arbitrary match in DerivedData. Use `-workspace` instead of `-project` for projects requiring a workspace.
- **Return a generic artifact.** `type: other` works for custom-job uploads. `application-archive` and `build-artifact` are reserved for build jobs. This custom job produces an artifact, not an EAS Build record.
- **Preserve app behavior.** Do not silently remove failing build phases, dependencies, or permissions to get a green build. Diagnose the first relevant error and disclose any simulator-only configuration changes.

## Install the workflow result

After the custom job finishes, `workflow:view <run-id> --json` exposes the selected job's `artifacts`, including its `downloadUrl` in current EAS CLI. Select `simulator-app` / the expected filename, and confirm the build succeeded. Artifact URLs may expire; re-query the run for a fresh URL when needed.

```bash
npx --yes eas-cli@latest sim --platform ios --type agent-device \
  --application-archive-url '<artifact-download-url>' \
  --name 'Swift onboarding verification' --max-idle-time-minutes 15 \
  --non-interactive
```

For a session already running, use its controller's artifact-install command. Attach to the bundle ID printed by the package step, wait for an app landmark, exercise an interaction, and inspect a capture. A successful workflow proves compilation/packaging; the simulator test proves only the behavior exercised. Swift edits require another build/install, whereas JS edits in an Expo development client can come from Metro.

## Turn an interactive finding into a CI regression test

Keep the same trigger, control, inputs, and expected result that reproduced the issue. Run a deterministic test (for example, Maestro) for a known flow, or an agent-driven review when the task needs exploratory judgment. Use a macOS worker for iOS; Android emulator jobs require a supported nested-virtualization worker. Load the current job/function docs for boot, install, controller preparation, and artifact collection.

A useful run reports the tested source/build, assertion results, and failure evidence. Upload logs/captures even on failure, and make a failed assertion fail the job. See Expo's [Maestro workflow example](https://docs.expo.dev/eas/workflows/examples/e2e-tests/) and the [agent-device integration](https://docs.expo.dev/agents/agent-device/) for maintained templates rather than copying a complete CI framework into this skill.
