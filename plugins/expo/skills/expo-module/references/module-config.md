# expo-module.config.json and Autolinking

Autolinking only discovers modules that have an `expo-module.config.json`. A minimal example is in SKILL.md.

> **Source of truth:** https://docs.expo.dev/modules/module-config/ — consult the canonical docs for the full field schema. Autolinking internals: https://docs.expo.dev/modules/autolinking/.

## Non-obvious behaviors

- File placement: **standalone module** → package root, next to `package.json`; **local module** → module root inside the app's local-modules directory (`expo.autolinking.nativeModulesDir`, default `modules/`).
- `apple.modules` takes bare Swift class names; `android.modules` takes fully-qualified names (package + class).
- `platforms` accepts granular Apple values (`ios`, `macos`, `tvos`), but prefer `apple` when one Swift module serves multiple Apple targets. `web` and `devtools` are also valid.
- Resolution order when a module could come from several places:
  1. Explicit dependencies in `react-native.config.js`
  2. Custom `searchPaths` directories
  3. Local `nativeModulesDir` (default `./modules/`)
  4. Recursive npm dependency resolution
