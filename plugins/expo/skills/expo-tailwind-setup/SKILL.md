---
name: expo-tailwind-setup
description: Framework (OSS). Set up Tailwind CSS v4 in Expo with react-native-css and NativeWind v5 for universal styling
version: 1.0.0
license: MIT
---

# Tailwind CSS Setup for Expo with react-native-css

This guide covers setting up Tailwind CSS v4 in Expo using react-native-css and NativeWind v5 for universal styling across iOS, Android, and Web.

> **Version stamp:** version pins below were verified against `nativewind@5.0.0-preview.x` and a nightly `react-native-css` build. Re-verify pins when NativeWind v5 stable ships — at that point most of this setup becomes canonical at https://www.nativewind.dev/.

## Overview

This setup uses:

- **Tailwind CSS v4** - Modern CSS-first configuration
- **react-native-css** - CSS runtime for React Native
- **NativeWind v5** - Metro transformer for Tailwind in React Native
- **@tailwindcss/postcss** - PostCSS plugin for Tailwind v4

## Installation

```bash
# Install dependencies
npx expo install tailwindcss@^4 nativewind@5.0.0-preview.2 react-native-css@0.0.0-nightly.5ce6396 @tailwindcss/postcss
```

Add resolutions for lightningcss compatibility:

```json
// package.json
{
  "resolutions": {
    "lightningcss": "1.30.1"
  }
}
```

- autoprefixer is not needed in Expo because of lightningcss
- postcss is included in expo by default

## Configuration Files

### Metro Config

Create or update `metro.config.js`:

```js
// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativewind } = require("nativewind/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

module.exports = withNativewind(config, {
  // inline variables break PlatformColor in CSS variables
  inlineVariables: false,
  // We add className support manually
  globalClassNamePolyfill: false,
});
```

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

Create `src/global.css`:

```css
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/preflight.css" layer(base);
@import "tailwindcss/utilities.css";

/* Platform-specific font families */
@media android {
  :root {
    --font-mono: monospace;
    --font-rounded: normal;
    --font-serif: serif;
    --font-sans: normal;
  }
}

@media ios {
  :root {
    --font-mono: ui-monospace;
    --font-serif: ui-serif;
    --font-sans: system-ui;
    --font-rounded: ui-rounded;
  }
}
```

The `@media ios` / `@media android` blocks are the general platform-override mechanism — use the same pattern for any platform-specific variable, not just fonts.

## IMPORTANT: No Babel Config Needed

With Tailwind v4 and NativeWind v5, you do NOT need a babel.config.js for Tailwind. Remove any NativeWind babel presets if present:

```js
// DELETE babel.config.js if it only contains NativeWind config
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

## CSS Component Wrappers

react-native-css requires explicit CSS element wrapping — no automatic global `className` support. Create one wrapper per component you use, all following the same pattern.

### Canonical pattern (`src/tw/index.tsx`)

```tsx
import {
  useCssElement,
  useNativeVariable as useFunctionalVariable,
} from "react-native-css";
import React from "react";
import { View as RNView } from "react-native";

export type ViewProps = React.ComponentProps<typeof RNView> & {
  className?: string;
};

export const View = (props: ViewProps) => {
  return useCssElement(RNView, props, { className: "style" });
};
View.displayName = "CSS(View)";

// CSS Variable hook: native needs the runtime hook, web resolves var() itself
export const useCSSVariable =
  process.env.EXPO_OS !== "web"
    ? useFunctionalVariable
    : (variable: string) => `var(${variable})`;
```

Repeat this exact pattern for every component you style — `Text`, `Pressable`, `TextInput`, `ScrollView`, expo-router's `Link`, `Animated.ScrollView` — only the wrapped component changes. The third `useCssElement` argument maps className props to style props; components with multiple style targets take multiple entries, e.g. ScrollView:

```tsx
useCssElement(RNScrollView, props, {
  className: "style",
  contentContainerClassName: "contentContainerStyle",
});
```

Components that carry static subcomponents lose them when wrapped — reattach them or they are `undefined` at runtime. expo-router's `Link` ships `Link.Trigger` / `Link.Menu` / `Link.MenuAction` / `Link.Preview`:

```tsx
import { Link as RouterLink } from "expo-router";
// ...wrap RouterLink with useCssElement as above, then:
Link.Trigger = RouterLink.Trigger;
Link.Menu = RouterLink.Menu;
Link.MenuAction = RouterLink.MenuAction;
Link.Preview = RouterLink.Preview;
```

For Reanimated, animate the CSS wrapper (not the reverse): `RNAnimated.createAnimatedComponent(View)`.

Two components need extra handling because CSS properties do not map 1:1 onto their props:

### Gotcha 1: TouchableHighlight (`underlayColor` is a prop, not a style)

Extract `underlayColor` from the flattened style before it reaches the native component:

```tsx
import { TouchableHighlight as RNTouchableHighlight, StyleSheet } from "react-native";

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

### Gotcha 2: Image (`objectFit` style → `contentFit` prop) (`src/tw/image.tsx`)

expo-image takes `contentFit`/`contentPosition` props, not CSS `objectFit`/`objectPosition` styles — remap them:

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

## Usage

Always import from your wrapper directory (`@/tw`), never from `react-native` directly, and style with `className`:

```tsx
import { View, Text } from "@/tw";

<View className="flex-1 p-4 gap-4 bg-white">
  <Text className="text-xl font-bold text-gray-900">Hello Tailwind!</Text>
</View>;
```

Utility classes behave as standard Tailwind v4: https://tailwindcss.com/docs/styling-with-utility-classes

## Custom Theme Variables

Extend the theme with `@theme` inside `@layer theme` in `global.css` — there is no `tailwind.config.js` in v4; theme tokens are CSS variables (`--font-*`, `--text-*--line-height`, `--leading-*`, `--color-*`). Full syntax: https://tailwindcss.com/docs/theme

```css
@layer theme {
  @theme {
    --font-rounded: "SF Pro Rounded", sans-serif;
    --leading-tight: 1.25em; /* use em units so line heights scale on native */
  }
}
```

## Apple System Colors with CSS Variables

Three-layer pattern in a dedicated CSS file (e.g. `src/css/sf.css`): `light-dark()` fallbacks for web/Android, real semantic colors via `platformColor()` in `@media ios`, then registration as Tailwind colors in `@theme`:

```css
/* src/css/sf.css */
@layer base {
  html {
    color-scheme: light;
  }
}

:root {
  /* Fallback for web/Android */
  --sf-blue: light-dark(rgb(0 122 255), rgb(10 132 255));
  --sf-text: light-dark(rgb(0 0 0), rgb(255 255 255));
  --sf-bg: light-dark(rgb(255 255 255), rgb(0 0 0));
}

/* iOS: native semantic colors */
@media ios {
  :root {
    --sf-blue: platformColor(systemBlue);
    --sf-text: platformColor(label);
    --sf-bg: platformColor(systemBackground);
  }
}

/* Register as Tailwind theme colors */
@layer theme {
  @theme {
    --color-sf-blue: var(--sf-blue);
    --color-sf-text: var(--sf-text);
    --color-sf-bg: var(--sf-bg);
  }
}
```

Extend the palette (greens, reds, gray scale, secondary text/backgrounds) the same way — take `platformColor()` names and light/dark fallback values from Apple's HIG color reference: https://developer.apple.com/design/human-interface-guidelines/color. The HIG lists RGB values only for system colors and grays; semantic colors appear name-only, so their fallbacks are recorded here:

```css
--sf-text-2: light-dark(rgb(60 60 67 / 0.6), rgb(235 235 245 / 0.6)); /* secondaryLabel */
--sf-bg-2: light-dark(rgb(242 242 247), rgb(28 28 30)); /* secondarySystemBackground */
```

Then use in components:

```tsx
<Text className="text-sf-text">Primary text</Text>
<View className="bg-sf-bg">...</View>
```

## Using CSS Variables in JavaScript

Use the `useCSSVariable` hook:

```tsx
import { useCSSVariable } from "@/tw";

function MyComponent() {
  const blue = useCSSVariable("--sf-blue");

  return <View style={{ borderColor: blue }} />;
}
```

## Key Differences from NativeWind v4 / Tailwind v3

1. **No babel.config.js** - Configuration is now CSS-first
2. **PostCSS plugin** - Uses `@tailwindcss/postcss` instead of `tailwindcss`
3. **CSS imports** - Use `@import "tailwindcss/..."` instead of `@tailwind` directives
4. **Theme config** - Use `@theme` in CSS instead of `tailwind.config.js`
5. **Component wrappers** - Must wrap components with `useCssElement` for className support
6. **Metro config** - Use `withNativewind` with different options (`inlineVariables: false`)

## Troubleshooting

### Styles not applying

1. Ensure you have the CSS file imported in your app entry
2. Check that components are wrapped with `useCssElement`
3. Verify Metro config has `withNativewind` applied

### Platform colors not working

1. Use `platformColor()` in `@media ios` blocks
2. Fall back to `light-dark()` for web/Android

### TypeScript errors

Add className to component props:

```tsx
type Props = React.ComponentProps<typeof RNView> & { className?: string };
```

## Submitting Feedback
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes submit-expo-feedback@latest --category skills --subject "expo-tailwind-setup" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
If an AI agent repeatedly failed or the user had to take over an Expo task, load the expo-skill-feedback skill and follow its eval-candidate flow instead of reusing the command above.
