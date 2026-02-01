---
name: native-modules
description: Use when creating, modifying, or designing Expo native modules for iOS and Android. Covers module API design, native views, marshalling, shared objects, AppDelegate integration, config plugins, and verification.
version: 1.0.0
license: MIT
---

# Expo Native Modules

## References

Consult these resources as needed:

- ./references/marshalling.md -- Using `@retroactive Convertible` and `AnyArgument` for complex Swift type marshalling

## API Design

Design native APIs as if you were contributing W3C specs for the browser, take inspiration from modern web modules like `std:kv-storage` and `clipboard`. Aim for 100% backwards compatibility like the web. Create escape hatches for single-platform functionality.

- Avoid extraneous abstractions. Directly expose native functionality.
- Avoid unnecessary async methods. Use sync methods when possible.
- Prefer string union types for API options instead of boolean flags, enums, or multiple parameters. eg instead of `capture(options: { isHighQuality: boolean })`, use `capture(options: { quality: 'high' | 'medium' | 'low' })`.
- Use optionality for availability checks instead of extraneous `isAvailable` functions or constants. eg `snapshot.capture?.()` instead of `snapshot.isAvailable && snapshot.capture()`.
- New Architecture only. NEVER support legacy React Native architecture.
- ALWAYS use only Expo modules API.
- Prefer Swift and Kotlin.
- Marshalling is awesome for platform-specific APIs — see `./references/marshalling.md`.

Example of a well-designed module:

```ts
import { NativeModule } from "expo";

declare class AppClipModule extends NativeModule<{}> {
  prompt(): void;
  isAppClip?: boolean;
}

// This call loads the native module object from the JSI.
const AppClipNative =
  typeof expo !== "undefined"
    ? ((expo.modules.AppClip as AppClipModule) ?? {})
    : {};

if (AppClipNative?.isAppClip) {
  navigator.appClip = {
    prompt: AppClipNative.prompt,
  };
}

declare global {
  interface Navigator {
    /**
     * Only available in an App Clip context.
     * @expo
     */
    appClip?: {
      /** Open the SKOverlay */
      prompt: () => void;
    };
  }
}

export {};
```

Simple web-style interface, global type augmentation, docs in type definitions, optional availability checks.

Never do this:

```ts
import { NativeModulesProxy } from "expo-modules-core";
const { ExpoAppClip } = NativeModulesProxy;
export default {
  promptAppClip() {
    return ExpoAppClip.promptAppClip();
  },
  isAppClipAvailable() {
    return ExpoAppClip.isAppClipAvailable();
  },
};
```

Avoid hard-to-import APIs like `import * as MediaLibrary from 'expo-media-library'` — prefer `import { MediaLibrary } from 'expo/media'`. Do not wrap native modules in extra layers for no reason. Do not use boolean flags when string unions work. Never support legacy architecture.

## Views

Take API inspiration from great web component libraries like BaseUI and Radix.

- https://base-ui.com/react/components/progress
- https://www.radix-ui.com/primitives/docs/components/progress

Consider if you're building a control or a display component. Controls should have more interactive APIs, while display components should be more declarative.

Prefer functions on views instead of `useImperativeHandle` + `findNodeHandle`:

```swift
AsyncFunction("capture") { (view, options: Options) -> Ref in
  return try capture(self.appContext, view)
}
```

Remember to export views in the module:

```swift
import ExpoModulesCore

public class ExpoWebViewModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoWebView")

    View(ExpoWebView.self) {}
  }
}
```

## Shared Objects

Shared objects are long-lived native instances shared to JS. Use them to keep heavy state objects (like a decoded bitmap) alive across React components rather than spinning up a new native instance every time a component mounts.

- https://docs.expo.dev/modules/shared-objects/
- https://expo.dev/blog/the-real-world-impact-of-shared-objects

## AppDelegate Integration

To respond to app lifecycle events, implement the `ExpoAppDelegateSubscriber` protocol:

```swift
import ExpoModulesCore

public class ExpoHeadAppDelegateSubscriber: ExpoAppDelegateSubscriber {
  public func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    launchedActivity = userActivity
    // ...
    return false
  }
}
```

Then register the subscriber in `expo-module.config.json`:

```json
{
  "platforms": ["apple", "android", "web"],
  "apple": {
    "modules": ["ExpoHeadModule"],
    "appDelegateSubscribers": ["ExpoHeadAppDelegateSubscriber"]
  }
}
```

## Ecosystem Integration

- Create a Config Plugin for setting up all permissions and entitlements.
- Permissions APIs should follow Expo's permission model and implement hooks.
  - Ref: https://github.com/expo/expo/blob/843d5e108ff70539ac353721d3a7765a5d08d502/packages/expo-media-library/src/MediaLibrary.ts#L502-L519
- Document when things don't work in Expo Go and link to dev client instructions.
- Consider creating Expo devtools plugins for interacting with native APIs. Optimize for Claude Code usage, e.g. a Bun CLI before a UI.
  - Ref: https://docs.expo.dev/debugging/devtools-plugins
- If any feature launches the app or could benefit from deep linking, add an Expo Router integration. `expo-quick-actions` has a `expo-quick-actions/router` import for automatic deep linking. Other examples: Expo notifications, widgets, siri shortcuts.
  - Ref: https://github.com/EvanBacon/expo-quick-actions

## Documentation

- If you have a function like `isAvailable()`, explain why it exists. Research cases where it may return false such as in a simulator or particular OS version.
- Document OS version availability for functions and constants in the type definitions.

## Verification

Run `yarn expo run:ios --no-bundler` in an Expo app to headlessly compile the module and verify there are no compilation errors.
