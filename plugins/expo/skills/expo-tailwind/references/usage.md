# Usage

Write styles with Tailwind classes after the project is configured. Setup steps are in [`./setup.md`](./setup.md).

## Basic Usage

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

## Explicit CSS Component Wrappers

These components are only needed when you disable `globalClassNamePolyfill` in `metro.config.js` (see [`./setup.md`](./setup.md)). With the default setup, `className` already works on every React Native component.

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
<<<<<<< HEAD:plugins/expo/skills/expo-tailwind-setup/SKILL.md

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

Ensure `nativewind-env.d.ts` exists with

```ts
/// <reference types="react-native-css/types" />

declare module '*.css'
```
 and is not named after a sibling file, folder, or `node_modules` package.

## Submitting Feedback

If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes submit-expo-feedback@latest --category skills --subject "expo-tailwind-setup" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
If an AI agent repeatedly failed or the user had to take over an Expo task, load the expo-skill-feedback skill and follow its eval-candidate flow instead of reusing the command above.
||||||| parent of 2fe34ed (Rename expo-tailwind-setup to expo-tailwind and split references):plugins/expo/skills/expo-tailwind-setup/SKILL.md

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

Ensure `nativewind-env.d.ts` exists with

```ts
/// <reference types="react-native-css/types" />

declare module '*.css'
```
 and is not named after a sibling file, folder, or `node_modules` package.

## Submitting Feedback

If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes submit-expo-feedback@latest --category skills --subject "expo-tailwind-setup" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
=======
>>>>>>> 2fe34ed (Rename expo-tailwind-setup to expo-tailwind and split references):plugins/expo/skills/expo-tailwind/references/usage.md
