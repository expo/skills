---
name: expo-native-ui
description: "Framework (OSS). Build or polish Expo screens: native layout, controls, safe areas, keyboard access, media, and platform styling. Use expo-router for navigation and expo-animation for motion."
version: 1.1.2
license: MIT
---

# Native Expo screens

Build the requested screen around its primary task, the app's existing visual
system, and the target platforms. Preserve a working component library or styling
setup; a screen change does not require replacing NativeWind, StyleSheet, icons,
or storage. Use `expo-design-system` for shared tokens and component consistency.

## Choose the relevant surface

- **Native controls:** use `expo-ui` when choosing or integrating SwiftUI/Compose controls; keep existing controls that fit the task and supported SDK.
- **Routes, headers, tabs, sheets, back behavior:** `expo-router`.
- **Motion, gestures, keyboard tracking:** `expo-animation`.
- **Loading, cached content, saves, offline:** `expo-data-fetching`.
- **Platform details:** [controls](./references/controls.md), [icons](./references/icons.md), [media](./references/media.md), [storage](./references/storage.md), [gradients](./references/gradients.md), [blur and glass](./references/visual-effects.md).
- **Custom GPU rendering:** [WebGPU/Three.js integration](./references/webgpu-three.md), only for a requested 3D or GPU surface; this requires a compatible native build.

Read the relevant SDK version's package docs and installed types for exact props
and availability. Use the app's existing Expo Go or development-build workflow;
native dependencies/configuration may require a new build (`expo-dev-client`).

## Layout and interaction decisions

- Give each screen one scrolling owner. A FlatList/FlashList is already a scroll container; do not wrap it in a same-direction ScrollView. Choose a lazy row renderer for large or unbounded datasets.
- Account for top/bottom safe areas and navigator insets without double padding. Automatic scroll inset adjustment is useful with native headers on iOS; verify Android and full-screen surfaces separately.
- Use flex layout and `useWindowDimensions` when actual window measurements are needed. Check narrow windows, rotation, long labels, and large system text.
- Keep a form's primary action reachable above the keyboard. Use `keyboardShouldPersistTaps="handled"` when list/form controls should receive the first tap. Use the keyboard animation recipe only when frame tracking is needed.
- Let native navigation own its header/title when it matches the design. Avoid duplicating a back control or drawing an iOS navigation bar on Android. Preserve intentional brand and custom-screen designs.
- Every enabled control performs its advertised action. Local state can satisfy a prototype; a persisted save must retain the draft on failure and dismiss only after success.
- Provide accessible labels, roles, state, and sufficient touch targets; native rendering alone does not make an assembled screen accessible. Offer text selection for copyable data and errors where useful.

## Styling boundaries

Reuse semantic color roles. Native dynamic colors and web theme tokens need
platform-appropriate fallbacks; opaque `ColorValue` objects are not strings.
A TypeScript cast does not convert them for a string-only image or animation API.
Use a supported resolved/static color at that boundary, and check theme changes.

When using Expo Router's Android dynamic colors, the consuming component must
respond to theme changes, for example by calling `useColorScheme()`, even if it
does not use the returned value. This matters with React Compiler memoization.
See the [SDK 57 Color guidance](https://docs.expo.dev/versions/v57.0.0/sdk/router/color/#colorcolor)
and match it to the installed SDK. Verify a light/dark switch while the screen
remains mounted; separate launches in each theme can miss stale colors.

Use shadows, gradients, blur, and glass only where they help hierarchy or legibility.
Their runtime support varies by SDK, OS, and architecture; retain a supported
fallback rather than replacing working styling with an unsupported effect.

## Verify the screen

Walk through the primary task and its back/dismiss path on the requested platforms.
For data or saves, exercise one failure and recovery. Check keyboard reachability,
empty results, missing images, long text, and light/dark appearance where relevant.
Report what ran and any platform or device checks that remain unavailable.

## Submitting Feedback
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes submit-expo-feedback@latest --category skills --subject "expo-native-ui" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
If an AI agent repeatedly failed or the user had to take over an Expo task, load the expo-skill-feedback skill and follow its eval-candidate flow instead of reusing the command above.
