# Route Structure

> Source: https://docs.expo.dev/router/basics/notation/ — the canonical notation reference (dynamic `[id]`, groups `(name)`, params; append `.md` for markdown). Shared and array routes: https://docs.expo.dev/router/advanced/shared-routes/. This reference adds only what the docs do not cover: structure opinions and the array-route anchor recipe.

## File Conventions

- Routes belong in the `app` directory
- Use `[]` for dynamic routes, e.g. `[id].tsx`; `[...slug].tsx` is a catch-all matching `/docs/a`, `/docs/a/b`, … (not on the notation docs page)
- Routes can never be named `(foo).tsx` - use `(foo)/index.tsx` instead
- Use `(group)` routes to simplify the public URL structure
- NEVER co-locate components, types, or utilities in the app directory - these should be in separate directories like `components/`, `utils/`, etc.
- The app directory should only contain route and `_layout` files; every file should export a default component
- Ensure the app always has a route that matches "/" so the app is never blank
- ALWAYS use `_layout.tsx` files to define stacks
- Create `app/+not-found.tsx` (default-exporting a component) to handle unmatched routes

## Stacks and Tabs Structure

When an app has tabs, the header and title should be set in a Stack that is nested INSIDE each tab. This allows tabs to have their own headers and distinct histories. The root layout should often not have a header.

- Set the 'headerShown' option to false on the tab layout
- Use (group) routes to simplify the public URL structure
- You may need to delete or refactor existing routes to fit this structure

Example structure:

```
app/
  _layout.tsx — <Tabs />
  (home)/
    _layout.tsx — <Stack />
    index.tsx — <ScrollView />
  (settings)/
    _layout.tsx — <Stack />
    index.tsx — <ScrollView />
  (home,settings)/
    info.tsx — <ScrollView /> (shared across tabs)
```

## Array Routes for Multiple Stacks

Use array routes '(index,settings)' to create multiple stacks. This is useful for tabs that need to share screens across stacks.

```
app/
  _layout.tsx — <Tabs />
  (index,settings)/
    _layout.tsx — <Stack />
    index.tsx — <ScrollView />
    settings.tsx — <ScrollView />
```

This requires a specialized layout with explicit anchor routes:

```tsx
// app/(index,settings)/_layout.tsx
import { useMemo } from "react";
import Stack from "expo-router/stack";

export const unstable_settings = {
  index: { anchor: "index" },
  settings: { anchor: "settings" },
};

export default function Layout({ segment }: { segment: string }) {
  const screen = segment.match(/\((.*)\)/)?.[1]!;

  const options = useMemo(() => {
    switch (screen) {
      case "index":
        return { headerRight: () => <></> };
      default:
        return {};
    }
  }, [screen]);

  return (
    <Stack>
      <Stack.Screen name={screen} options={options} />
    </Stack>
  );
}
```

## Complete App Structure Example

```
app/
  _layout.tsx — <NativeTabs />
  (index,search)/
    _layout.tsx — <Stack />
    index.tsx — Main list
    search.tsx — Search view
    i/[id].tsx — Detail page
components/
  theme.tsx
  list.tsx
utils/
  storage.ts
  use-search.ts
```

## Route Settings

Export `unstable_settings` to configure route behavior:

```tsx
export const unstable_settings = {
  anchor: "index",
};
```

- `initialRouteName` was renamed to `anchor` in v4 (the docs still use the old name in places)
