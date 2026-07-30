---
name: expo-tailwind
description: Framework (OSS). Tailwind CSS v4 in Expo with react-native-css and Nativewind v5 for universal styling across iOS, Android, and web. Use when installing or configuring Tailwind in an Expo app (Metro, PostCSS, global.css, lightningcss, TypeScript types), or when writing styles with className, theme variables, platform-specific CSS, Apple system colors, or useCssElement wrappers.
version: 1.2.0
license: MIT
---

# Tailwind CSS for Expo with react-native-css

Tailwind CSS v4 in Expo uses `react-native-css` for the runtime and Nativewind v5 for the Metro transformer. Styles work on iOS, Android, and web. This skill follows the official Nativewind v5 installation instructions.

Load the reference that matches the task:

- **Installing or configuring Tailwind** - read [`./references/setup.md`](./references/setup.md). Covers package install, the required `lightningcss` override, `metro.config.js`, `postcss.config.mjs`, `global.css`, where to import the CSS file, why no babel config is needed, TypeScript types, differences from Nativewind v4, and troubleshooting.
- **Writing styles in an app that is already set up** - read [`./references/usage.md`](./references/usage.md). Covers `className` on React Native components, `@theme` variables, platform media queries, Apple system colors with `platformColor()`, reading CSS variables in JavaScript, and the optional `useCssElement` component wrappers.

## Quick start

For a new setup, install the packages, then follow [`./references/setup.md`](./references/setup.md) for each config file:

```bash
npx expo install nativewind@preview react-native-css@latest react-native-reanimated react-native-safe-area-context
npx expo install --dev tailwindcss @tailwindcss/postcss postcss
```

Rules that apply to every project:

- Use `react-native-css@latest` and `nativewind@preview`. Do NOT pin either to a nightly or preview build number.
- Pin `lightningcss` to `1.30.1` in `package.json` (`overrides`, `resolutions`, or `pnpm.overrides`).
- Do NOT add a `babel.config.js` for Tailwind. Nativewind v5 is CSS-first, and `tailwind.config.js` is replaced by `@theme` in CSS.
- Import `global.css` in the file that holds your top-most component (`app/_layout.tsx` in Expo Router), not in the file that calls `AppRegistry.registerComponent`.
- After config changes, restart the bundler with `npx expo start --clear`.

## Submitting Feedback
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes submit-expo-feedback@latest --category skills --subject "expo-tailwind" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
