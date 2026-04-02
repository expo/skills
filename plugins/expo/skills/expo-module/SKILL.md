---
name: expo-module
description: Guide for writing Expo native modules and views using the Expo Modules API (Swift, Kotlin, TypeScript). Covers module definition DSL, native views, shared objects, config plugins, lifecycle hooks, autolinking, and type system. Use when building or modifying native modules for Expo.
version: 1.0.0
license: MIT
---

# Writing Expo Modules

Complete reference for building native modules and views using the Expo Modules API. Covers Swift (iOS), Kotlin (Android), and TypeScript.

## When to Use

- Creating a new Expo native module or native view
- Adding native functionality (camera, sensors, system APIs) to an Expo app
- Wrapping platform SDKs for React Native consumption
- Building config plugins that modify native project files

## References

Consult these resources as needed:

```
references/
  native-module.md           Module definition DSL: Name, Function, AsyncFunction, Property, Constant, Events, type system, shared objects
  native-view.md             Native view components: View, Prop, EventDispatcher, view lifecycle, ref-based functions
  lifecycle.md               Lifecycle hooks: module, iOS app/AppDelegate, Android activity/application listeners
  config-plugin.md           Config plugins: modifying Info.plist, AndroidManifest.xml, reading values in native code
  module-config.md           expo-module.config.json fields and autolinking configuration
```

## Quick Start

### Create a Local Module (in existing app)

```bash
npx create-expo-module@latest --local
```

Generated structure:

```
modules/
  my-module/
    android/
    ios/
    src/
    expo-module.config.json
    index.ts
```

### Create a Standalone Module (for publishing)

```bash
npx create-expo-module@latest my-module
```

---

## Minimal Module

The Swift and Kotlin DSL share the same structure. Both platforms are shown here for reference — in other reference files, Swift is shown as the primary language unless the Kotlin pattern meaningfully differs.

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

Note: iOS uses just the class name; Android uses the fully-qualified class name (package + class). See `references/module-config.md` for all fields.
