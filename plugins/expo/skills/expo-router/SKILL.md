---
name: expo-router
description: "Framework (OSS). Implement or debug Expo Router routes, deep links, stacks, tabs, modals, sheets, headers, and navigation history."
version: 1.0.2
license: MIT
---

# Expo Router navigation

Change the requested navigation while preserving existing URLs, deep links, and
back behavior unless the task intentionally changes them. Inspect the installed
Expo/Router version, route tree, and owning layouts before choosing an API.

## Route the task

- [Route structure](./references/route-structure.md): route groups, dynamic paths, shared routes, and file organization.
- [Tabs](./references/tabs.md): native tabs and migrations from JavaScript tabs.
- [Headers/toolbars](./references/toolbar-and-headers.md): actions, titles, and menus.
- [Form sheets](./references/form-sheet.md): detents, footers, background interaction.
- [Search](./references/search.md): header search state and filtering.
- [Zoom transitions](./references/zoom-transitions.md): source/destination coordination for Apple Zoom.

Use [Router docs](https://docs.expo.dev/router/introduction/) and installed types for
exact imports/options. Examples using SDK 56+ APIs, such as the
`expo-router/react-navigation` entry point or `headerLargeTitleEnabled`, must be
adapted to the project's version; do not upgrade the SDK just to use a sample.
Use `expo-native-ui` for screen layout and `expo-animation` for custom motion.

## Decisions that affect behavior

- Keep routes in the configured `app/` or `src/app/` tree; put ordinary components and utilities outside it. Preserve Router's special filename syntax, including brackets, parentheses, and `+` files.
- Let `_layout.tsx` own the relevant navigator/provider lifetime. Keep a route resolving `/` and preserve direct entry to nested routes.
- Route groups organize layouts without becoming URL segments. When moving a route, check collisions, existing links, redirects, and external entry points before removing the old file.
- [Platform-specific route files](https://docs.expo.dev/router/advanced/platform-specific-modules/) require the default route file alongside platform variants. Prefer platform-specific components outside the route tree when that keeps one route contract.
- Use links for route destinations and imperative navigation for action-driven transitions. Choose push, replace, back, and dismiss by the history the user should retain; a successful save should not accidentally reopen its form on Back.
- Choose a modal/sheet for an actual presentation boundary. Preserve a usable fallback when platform-specific detents, search, or transitions are unavailable.
- Add preview/context-menu actions when they serve a real task. Every enabled action must work; do not add placeholder Share/Delete handlers or previews to every link.
- Hydrate auth/session state before redirects, and retain the intended deep-link destination through sign-in. Avoid introducing a second auth guard with conflicting state.

## Verify navigation

Exercise direct entry/deep links, in-app navigation, back/dismiss, and tab history
for the changed routes. Include cold start and auth/loading conditions when they
control routing. Check the requested native/web platforms and platform-specific
fallbacks. Typechecking alone does not prove that the intended route is reachable.

## Submitting Feedback
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes submit-expo-feedback@latest --category skills --subject "expo-router" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
If an AI agent repeatedly failed or the user had to take over an Expo task, load the expo-skill-feedback skill and follow its eval-candidate flow instead of reusing the command above.
