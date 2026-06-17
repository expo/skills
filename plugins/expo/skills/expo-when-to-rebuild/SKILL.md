---
name: expo-when-to-rebuild
description: Decide whether a JavaScript, app-config, or dependency change requires a new native development build — and which kind to create (cloud EAS Build vs. local, CNG `npx expo prebuild --clean` vs. `npx expo run`). Use when a native change isn't showing up in the app, after editing app.json/app.config.js or a config plugin, after installing a library that includes native code, when deciding between Expo Go and a development build, or when asking "do I need to rebuild?", "do I need to run prebuild again?", or "EAS Build or local?".
---

# When to Rebuild an Expo App

The one question this skill answers: **I changed something — will it just show up, or do I need a new native build?**

It comes down to a single boundary. A change that stays in **JavaScript** is picked up instantly by Metro and Fast Refresh — no build. A change that crosses into **native** is compiled into the binary (native modules are linked in at build time via autolinking), so it needs a new development build. This is also the line between **Expo Go and a development build**: Expo Go ships a fixed set of native modules, so the moment your change needs custom native code you switch to a development build — and rebuild whenever the native side changes.

The diagram below is the flow; ["What counts as native"](#what-counts-as-native) resolves its two decision points.

## The core development loop

```mermaid
flowchart TD
    Start([Make a change to the project])

    Start --> JS[Write JavaScript<br/>application code]
    Start --> Config["Update app config<br/>(app.json) or config plugin"]
    Start --> Native[Write native code or modify<br/>native configuration]
    Start --> Lib[Install a library from npm]

    JS --> Reflect

    Config --> Q1{Does the change impact<br/>the native project?}
    Q1 -->|No| Reflect
    Q1 -->|Yes| Build

    Native --> Build

    Lib --> Q2{Does the library<br/>include native code?}
    Q2 -->|Yes| Build
    Q2 -->|No| Start

    Build[Create a new<br/>development build]
    Build -->|Cloud-based| EAS[Create a new development<br/>build with EAS Build]
    Build -->|Local| Q3{"Do you use Continuous<br/>Native Generation (CNG)?"}

    Q3 -->|Yes| Prebuild["Run prebuild<br/>npx expo prebuild --clean"]
    Q3 -->|No| Run["Create a new development<br/>build with npx expo run"]
    Prebuild --> Run

    EAS --> Reflect
    Run --> Reflect

    Reflect([See the change<br/>reflected in your app])
```

"Rebuild" means **create a new development build** (locally or with EAS). The first one is a *build*; every one after a native change is a *rebuild*.

## What counts as "native"

The diagram's two decision diamonds resolve like this:

- **"Does the change impact the native project?"** (app config) — **Yes** for anything that maps to a native setting: app name, icon, splash, `ios.bundleIdentifier` / `android.package`, permissions, `scheme`, `orientation`, and any `plugins` / config plugin. **No** for values read at runtime via `expo-constants` (e.g. `extra`), which update on reload in dev. When unsure, treat it as native and rebuild.
- **"Does the library include native code?"** — **Yes** if the package ships native code or a config plugin (or its install steps tell you to edit `app.json` or native files); **No** for pure-JavaScript packages, which Metro just bundles.

Bumping the Expo SDK or upgrading native dependencies always crosses into native — rebuild (see [upgrading-expo](../upgrading-expo/SKILL.md)).

## Creating a build: local vs. cloud (EAS)

Once you know a build is required, choose where it runs:

- **Cloud — EAS Build** (`eas build --profile development`): builds on Expo's servers. No Xcode or Android Studio required, works the same on every machine, and is the right choice for teams and CI. This is the recommended default.
- **Local** (`npx expo run:ios` / `npx expo run:android`, or `eas build --local`): compiles on your machine. Faster iteration if you already have the native toolchains installed, and works offline.

For the mechanics of creating and distributing the build (EAS profiles, TestFlight, installing on devices), see [expo-dev-client](../expo-dev-client/SKILL.md).

## CNG and prebuild

**Continuous Native Generation (CNG)** means the `android` and `ios` native projects are *generated on demand* from your `app.json`/`app.config.js` and `package.json` — the same way `node_modules` is generated from `package.json`. A fresh `npx create-expo-app` has **no** `android`/`ios` directories by default; that is CNG.

`npx expo prebuild` generates those native directories and applies your app config to them. With CNG you treat the native projects as build artifacts, not source you edit by hand.

### When do I need to run prebuild again?

Re-run prebuild for any change that crosses into native — the same changes covered in ["What counts as native"](#what-counts-as-native) (a native app-config property, a config plugin, or a native dependency).

> [!IMPORTANT]
> Running `npx expo prebuild` again **layers** changes on top of the existing native files and can produce inconsistent results. To keep prebuild deterministic:
>
> 1. Keep `android` and `ios` out of version control — in a CNG project they're git-ignored by default; treat them as build artifacts.
> 2. Always regenerate from scratch with **`npx expo prebuild --clean`**.

If instead you commit and hand-edit `android`/`ios` yourself (you are not using CNG), skip prebuild and build directly with `npx expo run`.

### Note on `npx expo run`

`npx expo run:ios` / `npx expo run:android` generate the native directories before compiling, so the first run doubles as your prebuild.

## Related skills

- **[expo-dev-client](../expo-dev-client/SKILL.md)** — *how* to create and distribute a development build (EAS profiles, TestFlight, installing locally). This skill tells you *whether and which*; that one tells you *how*.
- **[expo-module](../expo-module/SKILL.md)** — writing native modules and config plugins (the changes that force a rebuild).
- **[upgrading-expo](../upgrading-expo/SKILL.md)** — SDK upgrades also require `prebuild --clean` and a rebuild.
- **[expo-cicd-workflows](../expo-cicd-workflows/SKILL.md)** — automate builds in CI with EAS Workflows.

## References

- [Develop an app with Expo](https://docs.expo.dev/workflow/overview/) — the core development loop
- [Continuous Native Generation (CNG)](https://docs.expo.dev/workflow/continuous-native-generation/)
- [Configure with app config](https://docs.expo.dev/workflow/configuration/)
- [Using libraries](https://docs.expo.dev/workflow/using-libraries/)
- [Development builds: introduction](https://docs.expo.dev/develop/development-builds/introduction/)
