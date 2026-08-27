---
name: expo-tailwind-setup
description: Framework (OSS). Set up Tailwind CSS v4 in Expo with react-native-css and NativeWind v5 for universal styling
version: 1.1.0
license: MIT
---

# Tailwind CSS v4 and Nativewind v5 for Expo

Use this skill to install, migrate, or debug Nativewind v5 in an Expo app.

Nativewind v5 is currently a **pre-release that its maintainers do not recommend for production**. If the user did not explicitly request v5 and production stability matters, explain that status before proceeding and offer the [stable v4 setup](https://www.nativewind.dev/docs/getting-started/installation) instead.

Nativewind changes independently from Expo. Treat the [official v5 installation guide](https://www.nativewind.dev/v5/getting-started/installation) and the installed package types as the source of truth. If these instructions disagree with current upstream docs, follow upstream and submit feedback on this skill.

## Install

Use the moving dist-tags documented upstream instead of pinning a preview or nightly build:

```bash
npx expo install nativewind@preview react-native-css@latest react-native-reanimated react-native-safe-area-context
npx expo install --dev tailwindcss @tailwindcss/postcss postcss
```

Do not use `--force` or `--legacy-peer-deps` to hide a conflict. Remove stale explicit pins from `package.json`, then let `expo install` choose Expo-compatible peer versions. `autoprefixer` is unnecessary because Expo uses Lightning CSS.

## Configure

Create `postcss.config.mjs`:

```js
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

Create `global.css`:

```css
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/preflight.css" layer(base);
@import "tailwindcss/utilities.css";

@import "nativewind/theme";
```

Create or update `metro.config.js`:

```js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");

/** @type {import("expo/metro-config").MetroConfig} */
const config = getDefaultConfig(__dirname);

module.exports = withNativewind(config);
```

The default `globalClassNamePolyfill: true` rewrites React Native imports so built-in components accept `className`. Do not disable it or add hand-written wrappers for standard `View`, `Text`, `Pressable`, `ScrollView`, or `TextInput` components in a normal setup.

Nativewind v5 and Tailwind CSS v4 do not require a Nativewind Babel preset. Remove a legacy `nativewind/babel` preset or `jsxImportSource: "nativewind"`; keep `babel.config.js` only if another package needs it.

## Pin Lightning CSS for builds

Nativewind's v5 guide currently pins `lightningcss` to `1.30.1` to avoid stylesheet deserialization errors. Use the syntax for the project's package manager.

For npm, use `overrides` in `package.json`:

```json
{
  "overrides": {
    "lightningcss": "1.30.1"
  }
}
```

For Yarn, use `resolutions` in `package.json`:

```json
{
  "resolutions": {
    "lightningcss": "1.30.1"
  }
}
```

For pnpm 11, use the workspace-level key in `pnpm-workspace.yaml`:

```yaml
overrides:
  lightningcss: 1.30.1
```

For Bun or a later package-manager version, select that package manager's tab in the official installation guide rather than guessing its override syntax.

## Import the stylesheet

Import `global.css` from the file that owns the top-most app component. For Expo Router, that is normally the root layout:

```tsx
// app/_layout.tsx
import "../global.css";
import { Stack } from "expo-router";

export default function RootLayout() {
  return <Stack />;
}
```

Adjust the relative path to the actual stylesheet. Do not import it in the file that calls `AppRegistry.registerComponent`, because that breaks Fast Refresh.

## TypeScript

Starting Metro with a cleared cache generates `nativewind-env.d.ts`. It can also be created explicitly:

```ts
/// <reference types="react-native-css/types" />
```

Commit the generated file. Do not name it `nativewind.d.ts`, give it the same name as a sibling file or directory, or name it after a package in `node_modules`; TypeScript may then ignore the declarations.

## Use `className` directly

```tsx
import { Text, View } from "react-native";

export function Welcome() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-xl font-bold text-blue-500">
        Welcome to Nativewind!
      </Text>
    </View>
  );
}
```

Use wrappers only for third-party components whose style props need mapping. Follow Nativewind's current [third-party component guide](https://www.nativewind.dev/v5/guides/styling-third-party-components) and prefer its public `styled`/interop APIs over copying `useCssElement` internals. If wrapping Expo Router's `Link`, preserve its static `Trigger`, `Menu`, `MenuAction`, and `Preview` properties. If wrapping `expo-image`, map CSS object-fit/object-position values to `contentFit`/`contentPosition` rather than assuming a `style` object is sufficient.

## Migrate a stale v5 setup

1. Remove explicit old preview/nightly dependency pins and any package-manager entry that forces them.
2. Run the two current install commands above.
3. Replace custom `withNativewind` options with `withNativewind(config)` unless the app has a documented reason to override a default.
4. Add `@import "nativewind/theme"` to the global stylesheet.
5. Remove wrappers around standard React Native components and import them directly.
6. Use the correct Lightning CSS override field for the active package manager.
7. Clear Metro and test every requested platform.

## Verify

```bash
npx expo start --clear
# TypeScript projects:
npx tsc --noEmit
```

Render a screen containing direct `className` usage on iOS and Android. If web is in scope, verify it too. Do not accept a web-only pass for a native bundling problem.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `ERESOLVE` mentions an Expo 54 preview or React Native 0.81 | Deprecated `react-native-css` nightly | Remove the stale pin and install `react-native-css@latest` with `expo install` |
| Metro crashes while reading `addedFiles` after importing CSS | Old `react-native-css` emits a legacy watcher event | Upgrade `react-native-css`; do not patch Metro or suppress the error |
| Build cannot deserialize a stylesheet specifier | Incompatible Lightning CSS version | Apply the package-manager-specific `1.30.1` override, reinstall, and clear caches |
| Styles work on web but native bundling fails | Native Metro integration is still broken | Recheck `react-native-css`, `metro.config.js`, and the native logs |
| `className` is missing from React Native types | Declaration file was not generated or is misnamed | Run `npx expo start --clear` and inspect `nativewind-env.d.ts` |
| A third-party component ignores `className` | Its style prop is not mapped | Use the upstream third-party component guidance; do not wrap every built-in component |

## Submitting Feedback
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes submit-expo-feedback@latest --category skills --subject "expo-tailwind-setup" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
If an AI agent repeatedly failed or the user had to take over an Expo task, load the expo-skill-feedback skill and follow its eval-candidate flow instead of reusing the command above.
