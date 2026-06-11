---
name: expo-ui
description: "Build native UI with the @expo/ui package: real SwiftUI on iOS and Jetpack Compose on Android rendered from React in an Expo or React Native app. Covers universal cross-platform components (Host, Column, Row, Button, Text, List, and more imported from @expo/ui), drop-in replacements for popular React Native community libraries (BottomSheet, DateTimePicker, Slider, Menu, etc.), and platform-specific SwiftUI (@expo/ui/swift-ui) and Jetpack Compose (@expo/ui/jetpack-compose) trees and modifiers. Use when adding or reviewing @expo/ui Host/RNHostView trees, building native-feeling UI where standard React Native components fall short (lists with swipe actions and sections, settings forms with toggles, menus, sheets, pickers, sliders), choosing between universal and platform-specific components, or replacing an RN community UI library with a native @expo/ui equivalent. Not for custom native modules, Expo Router navigation, Reanimated, or data fetching."
version: 1.0.0
license: MIT
---

# Expo UI (`@expo/ui`)

`@expo/ui` renders real native UI from React: SwiftUI on iOS, Jetpack Compose on Android. It offers three layers — pick the highest one that satisfies the requirement.

> These instructions track the latest Expo SDK. The **universal** layer requires **SDK 56+**. Drop-in replacements and the platform-specific layers also exist on SDK 55. For component details on a specific SDK, refer to the Expo UI docs for that version.

## Installation

```bash
npx expo install @expo/ui
```

A native rebuild is required after installation (`npx expo run:ios` / `npx expo run:android`). Drop-in replacements list Expo Go support in the docs — check the component's doc page before assuming a custom build is required.

Every `@expo/ui` tree — universal or platform-specific — must be wrapped in `Host`.

## Choosing an approach (read this first)

Work down this list and stop at the first layer that meets the need:

1. **Universal components — start here.** Import from the `@expo/ui` root. One component tree runs unmodified on iOS, Android, and web from a single source (Compose on Android, SwiftUI on iOS, `react-native-web`/`react-dom` on web). No platform file splits. → `./references/universal.md`

2. **Drop-in replacements.** API-compatible swaps for popular React Native community libraries (`@gorhom/bottom-sheet`, `@react-native-community/datetimepicker`, `@react-native-community/slider`, and more), backed by native `@expo/ui` components. Import each from `@expo/ui/community/<name>` (e.g. `@expo/ui/community/bottom-sheet`). Reach for these when migrating an existing app off a community UI dependency. → `./references/drop-in-replacements.md`

3. **Platform-specific (SwiftUI / Jetpack Compose).** Import from `@expo/ui/swift-ui` or `@expo/ui/jetpack-compose`. Use **only** when the universal layer is missing a component or modifier you need, or when you need platform-specific behavior or optimization. **Downside:** you write two trees and split them into `.ios.tsx` / `.android.tsx` files (or branch on `Platform.OS`) — more code to maintain. → `./references/swift-ui.md` and `./references/jetpack-compose.md`

## References

Consult these resources as needed:

```
references/
  universal.md             Universal @expo/ui components and when to use them (SDK 56+)
  drop-in-replacements.md  API-compatible replacements for RN community UI libraries
  swift-ui.md              Platform-specific iOS UI: @expo/ui/swift-ui, RNHostView, extending
  jetpack-compose.md       Platform-specific Android UI: @expo/ui/jetpack-compose, LazyColumn, icons
```
