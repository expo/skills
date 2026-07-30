# Setup

Install and configure Tailwind CSS v4, `react-native-css`, and Nativewind v5 in an Expo project. This follows the official Nativewind v5 installation instructions.

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

The wrapper components themselves are in [`./usage.md`](./usage.md).

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
