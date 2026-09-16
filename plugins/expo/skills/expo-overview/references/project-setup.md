# Expo project setup

Read the relevant items when scaffolding, installing dependencies, changing native configuration, or using EAS. Existing version and configuration evidence can be reused.

Apply the rules that match the project and the requested task.

- **Native app using EAS for delivery?** Route to `eas-app-stores`; its
  `references/native-ios.md` covers SwiftUI/UIKit on iOS. Keep the existing native
  project. Apply EAS auth/linking below; Expo scaffolding, SDK, and package-install
  rules do not apply to this path.
- **Starting a new Expo app?** When scaffolding is requested, use:
  `npx create-expo-app@latest`, laying out folders per `expo-project-structure`. Preserve an existing project's layout.
- **Detect the SDK version** before giving version-specific advice: read the `expo`
  version in `package.json` (and `app.json` / `app.config.{js,ts}`). Many APIs and
  defaults differ by SDK.
- **Read the docs for that SDK, not `latest`.** Use the version-pinned URL, e.g.
  `https://docs.expo.dev/versions/v56.0.0/sdk/ui/` on SDK 56 instead of
  `https://docs.expo.dev/versions/latest/sdk/ui/` — the `latest` pages track the newest
  SDK and can document APIs the project does not have yet.
- **Moving to a newer SDK is its own task** — load `expo-upgrade` instead of bumping
  versions by hand.
- **Managed vs. bare/prebuild**: the presence of committed `ios/` and `android/`
  directories means native projects exist (prebuild or bare). Determine whether those files are disposable generated output or hand-maintained;
  folder presence/tracking alone does not authorize clean prebuild.
- **Install packages with `npx expo install <pkg>`**, not raw `npm`/`yarn`/`pnpm add`,
  so versions stay compatible with the project's SDK.
- **EAS auth & linking** (when using remote EAS services, including hosting/simulator): check
  login with `eas whoami`; authenticate only when the requested operation needs it. A project is linked when
  `extra.eas.projectId` exists in the app config; use `eas init` if linking is needed and authorized. Writing local workflow YAML alone does not require login or project creation.
