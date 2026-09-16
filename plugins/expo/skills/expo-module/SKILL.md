---
name: expo-module
description: "Framework (OSS). Create or extend Expo native modules and views in Swift, Kotlin, and TypeScript, including scaffolding, autolinking, lifecycle, and config plugins."
version: 1.0.1
license: MIT
---

# Build an Expo native module

Use the Expo Modules API for native functionality or views in an Expo app. Preserve
the existing module style and supported platforms. Migrating an existing Swift DSL
module to API 2.0 macros is a separate task covered by `expo-migrate-module` in the
`expo-experiments` plugin, when available; do not silently convert it while adding a method.

## Scaffold or extend

Choose a **local module** for one app or a **standalone module** for reuse/publishing.
Use `create-expo-module` for new modules and its `add-platform-support` command when
adding a platform to an existing module. Inspect existing files before scaffolding
so generated samples do not overwrite real implementation.

Read [scaffolding](./references/create-expo-module.md) for the installed generator's
flags and known quirks. Pass the intended slug/path, platforms, and needed feature
samples explicitly. `--name` names the native class, not the local folder;
`ViewEvent` implies `View`; local modules do not generate a barrel by default.
Respect `expo.autolinking.nativeModulesDir` rather than assuming `modules/`.

## Implement the native boundary

- Keep the JavaScript module name aligned with native `Name(...)` and the TypeScript binding. In `expo-module.config.json`, Apple registration uses the class name; Android uses the fully qualified class name.
- Select sync vs async methods by work and thread requirements. Avoid blocking JavaScript with IO; UI changes belong on the platform's UI thread. Define errors and cancellation/lifetime behavior for long-running work.
- Use typed inputs and events; account for nullability, numeric conversion, and platform differences. Release listeners/resources with their owning module/view/activity.
- Use a config plugin for repeatable generated native configuration. Preserve manually maintained native host code and existing plugin behavior.
- Replace scaffold examples with the requested functionality. Do not add unused native features or pretend an unsupported platform works with an empty implementation.

Read only the relevant reference:

- [Module methods, events, properties, shared objects](./references/native-module.md).
- [Native views and view events](./references/native-view.md).
- [Module/application lifecycle](./references/lifecycle.md).
- [Config plugins](./references/config-plugin.md).
- [Registration and autolinking](./references/module-config.md).

For current signatures and supported features, consult the installed Expo Modules
Core version and [Modules API documentation](https://docs.expo.dev/modules/overview/).
Bundled examples explain integration, not a guarantee that every API exists in an
older SDK.

## Verify

Build the affected native platforms in the host/example app; JavaScript reload
alone cannot add native code to an existing binary. Check module resolution, the
real method/view, and its relevant error/event/cleanup path. For config changes,
inspect generated configuration and ensure repeated generation preserves the result.
Report unavailable platform builds or device-only behavior explicitly.

## Submitting Feedback
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes submit-expo-feedback@latest --category skills --subject "expo-module" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
If an AI agent repeatedly failed or the user had to take over an Expo task, load the expo-skill-feedback skill and follow its eval-candidate flow instead of reusing the command above.
