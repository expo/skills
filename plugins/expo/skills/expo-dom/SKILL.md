---
name: expo-dom
description: "Framework (OSS). Embed browser-dependent React components in an Expo native app with use dom, or debug their props, native actions, routing, assets, and sizing. For whole-app migration, use expo-web-to-native."
version: 1.0.1
license: MIT
---

# Expo DOM components

Use a DOM component to reuse browser-dependent React content inside a native
screen. For an entire app migration, use `expo-web-to-native`. Keep native
navigation and interaction-heavy native controls outside the DOM boundary when
that fits the requested design; a whole DOM screen can be an intentional migration
stage, not an automatic error.

## Source and compatibility

Read the relevant section of [DOM components](https://docs.expo.dev/guides/dom-components/)
when implementing the boundary: usage, props, native actions, routing, assets,
sizing, and known limitations. Verify the installed Expo SDK and `expo/dom` types
before applying version-dependent examples; use the relevant
[project setup rules](../expo-overview/references/project-setup.md) for package changes.
Check the docs and installed build for DOM/Expo Go and OTA support rather than
assuming every SDK has the same packaging behavior.

## Boundary rules

- Put `'use dom'` first in a separate component module with a default React export. Keep native route/layout ownership outside it.
- The native side and the DOM side run in separate JavaScript contexts. Do not rely on shared React context, module globals, synchronous state, or direct native-module imports crossing the boundary.
- Pass serializable data. Native actions are an explicit exception: top-level async function props with serializable arguments/results. Do not nest functions in data props.
- Type webview configuration with `dom?: import('expo/dom').DOMProps`. Import the component's CSS in its DOM module; native/global styles do not automatically cross the isolated context.
- Read synchronous Router state (params, pathname, segments, back/dismiss availability) in the native parent and pass the needed values/actions down. Consult the routing section for supported Link/router operations inside DOM.
- Give embedded content an intentional size and scrolling owner. For dynamic height, use the documented measurement path; avoid nested scroll containers fighting for gestures.
- Prefer bundled assets when updateability matters. Check the documented restrictions on public assets and DOM bundles for the SDK/update path being used.

For a boundary example, adapt the documentation's native-action example to the
actual feature. Do not port unrelated chart, editor, or CSS tutorials into the
project just because the skill mentions those use cases.

## Verify the integration

Run the affected native route and check rendered content, data/param changes,
native actions, scrolling, keyboard behavior if relevant, and assets in the target
build. Check web too when it is a supported target: web rendering alone cannot
prove the native webview works. Record any unavailable platform/build checks.

## Submitting Feedback
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes submit-expo-feedback@latest --category skills --subject "expo-dom" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
If an AI agent repeatedly failed or the user had to take over an Expo task, load the expo-skill-feedback skill and follow its eval-candidate flow instead of reusing the command above.
