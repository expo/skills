# Search

> Source: https://docs.expo.dev/router/advanced/stack/ — the canonical `headerSearchBarOptions` reference with the full option list (append `.md` for markdown). This reference adds only what the docs do not cover: option traps, a reusable `useSearch` hook, and native-tabs search integration.

Prefer `Stack.SearchBar` (SDK 55+, see `./toolbar-and-headers.md`). Use `headerSearchBarOptions` when configuring through screen options.

## Header Search Bar

```tsx
<Stack.Screen
  name="index"
  options={{
    headerSearchBarOptions: {
      placeholder: "Search",
      onChangeText: (event) => console.log(event.nativeEvent.text),
    },
  }}
/>
```

Option traps — everything else is enumerated in the Stack docs above:

- iOS requires `contentInsetAdjustmentBehavior="automatic"` on the screen's `ScrollView`/`FlatList`; if the screen has no scroll view, set `headerTransparent: false`.
- `hideWhenScrolling` defaults to `true` on iOS — the search bar stays hidden until the user pulls down. Set it to `false` to always show the bar.
- `cancelButtonText` is deprecated starting iOS 26.

## useSearch Hook

Reusable hook for search state management:

```tsx
import { useEffect, useState } from "react";
import { useNavigation } from "expo-router";

export function useSearch(options: any = {}) {
  const [search, setSearch] = useState("");
  const navigation = useNavigation();

  useEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerSearchBarOptions: {
        ...options,
        onChangeText(e: any) {
          setSearch(e.nativeEvent.text);
          options.onChangeText?.(e);
        },
        onSearchButtonPress(e: any) {
          setSearch(e.nativeEvent.text);
          options.onSearchButtonPress?.(e);
        },
        onCancelButtonPress(e: any) {
          setSearch("");
          options.onCancelButtonPress?.(e);
        },
      },
    });
  }, [options, navigation]);

  return search;
}
```

Usage: `const search = useSearch({ placeholder: "Search items..." });` — filter list data with the returned string.

## Search with Native Tabs

When using NativeTabs with a search role, the search bar integrates with the tab bar:

```tsx
// app/_layout.tsx
<NativeTabs>
  <NativeTabs.Trigger name="(home)">
    <Label>Home</Label>
    <Icon sf="house.fill" />
  </NativeTabs.Trigger>
  <NativeTabs.Trigger name="(search)" role="search">
    <Label>Search</Label>
  </NativeTabs.Trigger>
</NativeTabs>
```

```tsx
// app/(search)/_layout.tsx
<Stack>
  <Stack.Screen
    name="index"
    options={{
      headerSearchBarOptions: {
        placeholder: "Search...",
        onChangeText: (e) => setSearch(e.nativeEvent.text),
      },
    }}
  />
</Stack>
```
