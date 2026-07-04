---
name: expo-tailwind-setup
description: Framework (OSS). Set up Tailwind CSS v4 in Expo with react-native-css and Nativewind v5 for universal styling
version: 1.1.0
license: MIT
---

# Tailwind CSS Setup for Expo with react-native-css

This guide covers setting up Tailwind CSS v4 in Expo using react-native-css and Nativewind v5 for universal styling across iOS, Android, and Web. It follows the official Nativewind v5 installation instructions.

## Overview

This setup uses:

- **Tailwind CSS v4** - Modern CSS-first configuration
- **react-native-css** - CSS runtime for React Native
- **Nativewind v5** - Metro transformer for Tailwind in React Native
- **@tailwindcss/postcss** - PostCSS plugin for Tailwind v4

## Installation

Install `nativewind` and its peer dependencies, then Tailwind CSS as dev dependencies:

```bash
npx expo install nativewind@preview react-native-css@latest react-native-reanimated react-native-safe-area-context
npx expo install --dev tailwindcss @tailwindcss/postcss postcss
```

Optionally add `tailwind-merge` and `clsx` for class composition, and `prettier-plugin-tailwindcss` (dev) for class sorting.

- Do NOT pin `react-native-css` to a specific nightly build. Use `@latest`.
- Do NOT pin `nativewind` to a specific preview build. Use the `preview` dist-tag.
- autoprefixer is not needed in Expo because of lightningcss

### Override the lightningcss version

Force `lightningcss` to a specific version in your `package.json`. Without this you may hit deserialization errors on `global.css` when building.

```json
// package.json (npm / bun)
{
  "overrides": {
    "lightningcss": "1.30.1"
  }
}
```

```json
// package.json (yarn)
{
  "resolutions": {
    "lightningcss": "1.30.1"
  }
}
```

```json
// package.json (pnpm)
{
  "pnpm": {
    "overrides": {
      "lightningcss": "1.30.1"
    }
  }
}
```

## Configuration Files

### Metro Config

Run `npx expo customize metro.config.js` if you don't have one, then wrap the default config with `withNativewind`:

```js
// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

module.exports = withNativewind(config);
```

No options are needed for the standard setup. `withNativewind` defaults to `globalClassNamePolyfill: true`, which adds `className` support to all React Native components, and generates TypeScript types at `nativewind-env.d.ts`. In v4 this function was called `withNativeWind` (capital W); both spellings work in v5, but `withNativewind` is preferred.

### PostCSS Config

Create `postcss.config.mjs`:

```js
// postcss.config.mjs
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

### Global CSS

Create `global.css` and add the Tailwind directives plus the Nativewind theme:

```css
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/preflight.css" layer(base);
@import "tailwindcss/utilities.css";

@import "nativewind/theme";
```

Use these at-rules instead of the standard `@tailwind` directives; they provide better compatibility with `react-native-web`.

### Import your CSS file

Import the CSS file in the same file as the top-most component of your app:

```tsx
// App.tsx
import "./global.css";

export default function App() {
  /* Your App */
}
```

Do NOT import it in the same file that calls `AppRegistry.registerComponent` or the app will not Fast Refresh properly. In Expo Router projects, import it in the root `app/_layout.tsx`.

## IMPORTANT: No Babel Config Needed

With Tailwind v4 and Nativewind v5, you do NOT need a babel.config.js for Tailwind. Remove any Nativewind babel presets if present:

```js
// DELETE babel.config.js if it only contains Nativewind config
// The following is NO LONGER needed:
// module.exports = function (api) {
//   api.cache(true);
//   return {
//     presets: [
//       ["babel-preset-expo", { jsxImportSource: "nativewind" }],
//       "nativewind/babel",
//     ],
//   };
// };
```

## TypeScript Setup

Nativewind extends the React Native types via declaration merging. Metro generates a `nativewind-env.d.ts` file automatically; running `npx expo start --clear` creates it. To create it manually, add a triple-slash directive referencing the types:

```tsx
// nativewind-env.d.ts
/// <reference types="react-native-css/types" />
```

Commit this file with your source code. Do NOT name it `nativewind.d.ts`, the same name as a sibling file or folder (e.g. `app.d.ts` next to an `/app` folder), or the same name as a folder in `node_modules` (e.g. `react.d.ts`), or TypeScript will not pick up the types.

## Usage

`className` works directly on React Native components:

```tsx
import "./global.css";
import { Text, View } from "react-native";

export default function App() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-xl font-bold text-blue-500">
        Welcome to Nativewind!
      </Text>
    </View>
  );
}
```

## Custom Theme Variables

Add custom theme variables in your global.css using `@theme`:

```css
@layer theme {
  @theme {
    /* Custom fonts */
    --font-rounded: "SF Pro Rounded", sans-serif;

    /* Custom line heights */
    --text-xs--line-height: calc(1em / 0.75);
    --text-sm--line-height: calc(1.25em / 0.875);
    --text-base--line-height: calc(1.5em / 1);

    /* Custom leading scales */
    --leading-tight: 1.25em;
    --leading-snug: 1.375em;
    --leading-normal: 1.5em;
  }
}
```

## Platform-Specific Styles

Use platform media queries for platform-specific styling:

```css
@media ios {
  :root {
    --font-mono: ui-monospace;
    --font-serif: ui-serif;
    --font-sans: system-ui;
    --font-rounded: ui-rounded;
  }
}

@media android {
  :root {
    --font-mono: monospace;
    --font-serif: serif;
    --font-sans: normal;
    --font-rounded: normal;
  }
}
```

## Apple System Colors with CSS Variables

Create a CSS file for Apple semantic colors:

```css
/* src/css/sf.css */
@layer base {
  html {
    color-scheme: light;
  }
}

:root {
  /* Accent colors with light/dark mode */
  --sf-blue: light-dark(rgb(0 122 255), rgb(10 132 255));
  --sf-green: light-dark(rgb(52 199 89), rgb(48 209 89));
  --sf-red: light-dark(rgb(255 59 48), rgb(255 69 58));

  /* Gray scales */
  --sf-gray: light-dark(rgb(142 142 147), rgb(142 142 147));
  --sf-gray-2: light-dark(rgb(174 174 178), rgb(99 99 102));

  /* Text colors */
  --sf-text: light-dark(rgb(0 0 0), rgb(255 255 255));
  --sf-text-2: light-dark(rgb(60 60 67 / 0.6), rgb(235 235 245 / 0.6));

  /* Background colors */
  --sf-bg: light-dark(rgb(255 255 255), rgb(0 0 0));
  --sf-bg-2: light-dark(rgb(242 242 247), rgb(28 28 30));
}

/* iOS native colors via platformColor */
@media ios {
  :root {
    --sf-blue: platformColor(systemBlue);
    --sf-green: platformColor(systemGreen);
    --sf-red: platformColor(systemRed);
    --sf-gray: platformColor(systemGray);
    --sf-text: platformColor(label);
    --sf-text-2: platformColor(secondaryLabel);
    --sf-bg: platformColor(systemBackground);
    --sf-bg-2: platformColor(secondarySystemBackground);
  }
}

/* Register as Tailwind theme colors */
@layer theme {
  @theme {
    --color-sf-blue: var(--sf-blue);
    --color-sf-green: var(--sf-green);
    --color-sf-red: var(--sf-red);
    --color-sf-gray: var(--sf-gray);
    --color-sf-text: var(--sf-text);
    --color-sf-text-2: var(--sf-text-2);
    --color-sf-bg: var(--sf-bg);
    --color-sf-bg-2: var(--sf-bg-2);
  }
}
```

Then use in components:

```tsx
<Text className="text-sf-text">Primary text</Text>
<Text className="text-sf-text-2">Secondary text</Text>
<View className="bg-sf-bg">...</View>
```

## Using CSS Variables in JavaScript

react-native-css exposes a hook for reading CSS variables at runtime:

```tsx
import { useNativeVariable } from "react-native-css";

// On web, CSS variables resolve natively:
export const useCSSVariable =
  process.env.EXPO_OS !== "web"
    ? useNativeVariable
    : (variable: string) => `var(${variable})`;

function MyComponent() {
  const blue = useCSSVariable("--sf-blue");

  return <View style={{ borderColor: blue }} />;
}
```

## Optional: Explicit CSS Component Wrappers

The default setup adds `className` support to all React Native components via a babel transform (`globalClassNamePolyfill: true`). If you prefer explicit control over which components accept CSS, disable the polyfill and wrap components manually with `useCssElement`:

```js
// metro.config.js
module.exports = withNativewind(config, {
  // inline variables break PlatformColor in CSS variables
  inlineVariables: false,
  // We add className support manually
  globalClassNamePolyfill: false,
});
```

### Main Components (`src/tw/index.tsx`)

```tsx
import {
  useCssElement,
  useNativeVariable as useFunctionalVariable,
} from "react-native-css";

import { Link as RouterLink } from "expo-router";
import Animated from "react-native-reanimated";
import React from "react";
import {
  View as RNView,
  Text as RNText,
  Pressable as RNPressable,
  ScrollView as RNScrollView,
  TouchableHighlight as RNTouchableHighlight,
  TextInput as RNTextInput,
  StyleSheet,
} from "react-native";

// CSS-enabled Link
export const Link = (
  props: React.ComponentProps<typeof RouterLink> & { className?: string }
) => {
  return useCssElement(RouterLink, props, { className: "style" });
};

Link.Trigger = RouterLink.Trigger;
Link.Menu = RouterLink.Menu;
Link.MenuAction = RouterLink.MenuAction;
Link.Preview = RouterLink.Preview;

// CSS Variable hook
export const useCSSVariable =
  process.env.EXPO_OS !== "web"
    ? useFunctionalVariable
    : (variable: string) => `var(${variable})`;

// View
export type ViewProps = React.ComponentProps<typeof RNView> & {
  className?: string;
};

export const View = (props: ViewProps) => {
  return useCssElement(RNView, props, { className: "style" });
};
View.displayName = "CSS(View)";

// Text
export const Text = (
  props: React.ComponentProps<typeof RNText> & { className?: string }
) => {
  return useCssElement(RNText, props, { className: "style" });
};
Text.displayName = "CSS(Text)";

// ScrollView
export const ScrollView = (
  props: React.ComponentProps<typeof RNScrollView> & {
    className?: string;
    contentContainerClassName?: string;
  }
) => {
  return useCssElement(RNScrollView, props, {
    className: "style",
    contentContainerClassName: "contentContainerStyle",
  });
};
ScrollView.displayName = "CSS(ScrollView)";

// Pressable
export const Pressable = (
  props: React.ComponentProps<typeof RNPressable> & { className?: string }
) => {
  return useCssElement(RNPressable, props, { className: "style" });
};
Pressable.displayName = "CSS(Pressable)";

// TextInput
export const TextInput = (
  props: React.ComponentProps<typeof RNTextInput> & { className?: string }
) => {
  return useCssElement(RNTextInput, props, { className: "style" });
};
TextInput.displayName = "CSS(TextInput)";

// AnimatedScrollView
export const AnimatedScrollView = (
  props: React.ComponentProps<typeof Animated.ScrollView> & {
    className?: string;
    contentClassName?: string;
    contentContainerClassName?: string;
  }
) => {
  return useCssElement(Animated.ScrollView, props, {
    className: "style",
    contentClassName: "contentContainerStyle",
    contentContainerClassName: "contentContainerStyle",
  });
};

// TouchableHighlight with underlayColor extraction
function XXTouchableHighlight(
  props: React.ComponentProps<typeof RNTouchableHighlight>
) {
  const { underlayColor, ...style } = StyleSheet.flatten(props.style) || {};
  return (
    <RNTouchableHighlight
      underlayColor={underlayColor}
      {...props}
      style={style}
    />
  );
}

export const TouchableHighlight = (
  props: React.ComponentProps<typeof RNTouchableHighlight>
) => {
  return useCssElement(XXTouchableHighlight, props, { className: "style" });
};
TouchableHighlight.displayName = "CSS(TouchableHighlight)";
```

### Image Component (`src/tw/image.tsx`)

```tsx
import { useCssElement } from "react-native-css";
import React from "react";
import { StyleSheet } from "react-native";
import Animated from "react-native-reanimated";
import { Image as RNImage } from "expo-image";

const AnimatedExpoImage = Animated.createAnimatedComponent(RNImage);

export type ImageProps = React.ComponentProps<typeof Image>;

function CSSImage(props: React.ComponentProps<typeof AnimatedExpoImage>) {
  // @ts-expect-error: Remap objectFit style to contentFit property
  const { objectFit, objectPosition, ...style } =
    StyleSheet.flatten(props.style) || {};

  return (
    <AnimatedExpoImage
      contentFit={objectFit}
      contentPosition={objectPosition}
      {...props}
      source={
        typeof props.source === "string" ? { uri: props.source } : props.source
      }
      // @ts-expect-error: Style is remapped above
      style={style}
    />
  );
}

export const Image = (
  props: React.ComponentProps<typeof CSSImage> & { className?: string }
) => {
  return useCssElement(CSSImage, props, { className: "style" });
};

Image.displayName = "CSS(Image)";
```

### Animated Components (`src/tw/animated.tsx`)

```tsx
import * as TW from "./index";
import RNAnimated from "react-native-reanimated";

export const Animated = {
  ...RNAnimated,
  View: RNAnimated.createAnimatedComponent(TW.View),
};
```

## Key Differences from Nativewind v4 / Tailwind v3

1. **No babel.config.js** - Configuration is now CSS-first
2. **PostCSS plugin** - Uses `@tailwindcss/postcss` instead of `tailwindcss`
3. **CSS imports** - Use `@import "tailwindcss/..."` plus `@import "nativewind/theme"` instead of `@tailwind` directives
4. **Theme config** - Use `@theme` in CSS instead of `tailwind.config.js`
5. **className everywhere** - The default `globalClassNamePolyfill` adds `className` support to all React Native components; no wrappers needed
6. **Metro config** - `withNativewind` (lowercase w) with no required options

## Troubleshooting

### Install fails with ERESOLVE errors

Do not pin `react-native-css` to a specific nightly build. Stale nightlies fall behind the React Native peer dependency range and cause npm ERESOLVE failures on newer Expo SDKs. Use `react-native-css@latest` instead.

### Styles not applying

1. Ensure `global.css` is imported in the file with your top-most component
2. Verify Metro config has `withNativewind` applied
3. Restart the bundler with `npx expo start --clear`
4. If you disabled `globalClassNamePolyfill`, check that components are wrapped with `useCssElement`

### Build fails with lightningcss deserialization errors

Pin `lightningcss` to `1.30.1` via `overrides` (npm/bun), `resolutions` (yarn), or `pnpm.overrides` (pnpm).

### Platform colors not working

1. Use `platformColor()` in `@media ios` blocks
2. Fall back to `light-dark()` for web/Android

### TypeScript errors on className

Ensure `nativewind-env.d.ts` exists with `/// <reference types="react-native-css/types" />` and is not named after a sibling file, folder, or `node_modules` package.
