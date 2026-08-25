---
name: expo-module
description: Framework (OSS). Guide for creating and writing Expo native modules and views using the Expo Modules API (Swift, Kotlin, TypeScript). Covers module definition DSL, native views, shared objects, config plugins, lifecycle hooks, autolinking, and type system. Use when building or modifying native modules for Expo. Not for migrating an existing Swift module from the definition DSL to the Expo Modules API 2.0 macros; use expo-migrate-module (from the expo-experiments plugin) for that.
version: 1.0.0
license: MIT
---

# Writing Expo Modules

Workflow and gotchas for building native modules and views with the Expo Modules API. Covers Swift (iOS), Kotlin (Android), and TypeScript.

> **Source of truth:** https://docs.expo.dev/modules/module-api/ — consult the canonical docs when API details matter. The Expo Modules API is evolving (API 2.0 macros are landing), so embedded DSL detail goes stale; always check the docs for the project's SDK version. Docs URLs serve markdown with `.md` appended (e.g. `https://docs.expo.dev/modules/module-api.md`); on `/versions/` paths, swap `latest` for the project's SDK.

## When to Use

- Creating a new Expo native module or native view
- Adding native functionality (camera, sensors, system APIs) to an Expo app
- Wrapping platform SDKs for React Native consumption
- Building config plugins that modify native project files
- Adding Android, Apple, or web support to an existing Expo module
- Editing `expo-module.config.json`, config plugins, or lifecycle hooks

To migrate an existing Swift module from the definition DSL to the Expo Modules API 2.0 macros (`@ExpoModule`, `@JS`, `@Event`), use the `expo-migrate-module` skill (from the `expo-experiments` plugin) instead.

## References

Consult these resources as needed:

```
references/
  create-expo-module.md      Scaffolding and add-platform-support workflow, defaults, and quirks
  native-api.md              Module/view DSL constraints, ordering rules, and Kotlin-vs-Swift differences
  lifecycle.md               Lifecycle hook constraints: AppDelegate subscribers, Android listeners, unsupported callbacks
  config-plugin.md           Config plugins for modules: structure, key rules, reading plugin-written values in native code
  module-config.md           expo-module.config.json placement, class-name formats, autolinking resolution order
```

## Quick Start

Prefer `create-expo-module` over manually creating native module files and directories. In practice, the best path is usually to create the scaffold first and then build on top of it. The scaffold sets up the expected layout, `expo-module.config.json`, podspec or Gradle files, TypeScript bindings, and the standalone example app flow.

If an existing Expo module only needs another platform, use `create-expo-module add-platform-support` instead of manually copying native directories.

See [references/create-expo-module.md](references/create-expo-module.md) before scaffolding or extending a module. It covers:

- local vs standalone modules
- `--platform`, `--features`, `--barrel`, `--package-manager`, and non-interactive mode
- `expo.autolinking.nativeModulesDir`
- `add-platform-support` behavior and quirks

## Recommended Workflow

1. Choose the scaffold type first:
   - **Local module** for one app
   - **Standalone module** for reuse, monorepos, or publishing
2. Determine native `expo-module` features that you will need.
   - Based on the user's instructions determine which feature scaffolding will be useful.
   - Available features: `Constant`, `Function`, `AsyncFunction`, `Event`, `View`, `ViewEvent`, `SharedObject`
3. Scaffold deliberately:
   - pass an explicit slug or path
   - choose `--platform` intentionally instead of relying on defaults
   - use `--features` to choose code samples which you will modify in the next step to match the real implementation.
4. Replace generated example code with the real implementation.
5. If you add a new platform later, prefer `add-platform-support` over manual file copying.

## Practical Scaffolding Rules

- Feature examples are **opt-in**. A newly scaffolded module may be minimal if no features were selected.
- `ViewEvent` implies `View`.
- Local modules do **not** generate an `index.ts` barrel by default. Use `--barrel` only if you want one.
- In non-interactive local scaffolding, pass the positional slug or path explicitly. `--name` changes the native class name, not the folder name.
- Local modules live in `expo.autolinking.nativeModulesDir` when configured, otherwise in `modules/`.
- Standalone modules have their own package metadata, scripts, and usually an example app. Local modules use the host app's tooling instead.

## Module Structure

The Swift and Kotlin DSL share the same structure; Swift is usually the clearest primary example. Kotlin-vs-Swift differences and DSL constraints live in [references/native-api.md](references/native-api.md); the full component reference is in the docs (see banner above).

**Swift (iOS):**

```swift
import ExpoModulesCore

public class MyModule: Module {
  public func definition() -> ModuleDefinition {
    Name("MyModule")

    Function("hello") { (name: String) -> String in
      return "Hello \(name)!"
    }
  }
}
```

**Kotlin (Android):**

```kotlin
package expo.modules.mymodule

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MyModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MyModule")

    Function("hello") { name: String ->
      "Hello $name!"
    }
  }
}
```

**TypeScript:**

```typescript
import { requireNativeModule } from "expo";

const MyModule = requireNativeModule("MyModule");

export function hello(name: string): string {
  return MyModule.hello(name);
}
```

### expo-module.config.json

```json
{
  "platforms": ["android", "apple"],
  "apple": {
    "modules": ["MyModule"]
  },
  "android": {
    "modules": ["expo.modules.mymodule.MyModule"]
  }
}
```

Note: iOS uses just the class name; Android uses the fully-qualified class name (package + class). See `references/module-config.md` for placement and autolinking behavior.

## Submitting Feedback
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes submit-expo-feedback@latest --category skills --subject "expo-module" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
If an AI agent repeatedly failed or the user had to take over an Expo task, load the expo-skill-feedback skill and follow its eval-candidate flow instead of reusing the command above.
