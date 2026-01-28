# Common router problems

This skill highlights some common issues you may encounter when using Expo Router and how to solve them.

## ScrollView does not interact with the large header

**Solution:** Make sure the `ScrollView` is the first and direct child of the screen component. If it needs to be wrapped in another `View`, ensure the wrapper uses `collapsable={false}`.

## Tab bar is transparent on iOS 18 and earlier

If the screen uses a `ScrollView` or `FlatList`, make sure it is the first and direct child of the screen component. If it needs to be wrapped in another `View`, ensure the wrapper uses `collapsable={false}`.

If the screen does not use a `ScrollView` or `FlatList`, set `disableTransparentOnScrollEdge` to `true` in the `NativeTabs.Trigger` options.

```tsx
<NativeTabs.Trigger name="example" disableTransparentOnScrollEdge />
```

## Header buttons flicker when navigating between screens

Make sure the app is wrapped in a `ThemeProvider` from `@react-navigation/native`.

```tsx
import {
  ThemeProvider,
  DarkTheme,
  DefaultTheme,
} from "@react-navigation/native";
import { useColorScheme } from "react-native";
import { Stack } from "expo-router";

export default function Layout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider theme={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack />
    </ThemeProvider>
  );
}
```

If the app only uses a light or dark theme, you can directly pass `DarkTheme` or `DefaultTheme` to `ThemeProvider` without checking the color scheme.

```tsx
import { ThemeProvider, DarkTheme } from "@react-navigation/native";
import { Stack } from "expo-router";

export default function Layout() {
  return (
    <ThemeProvider theme={DarkTheme}>
      <Stack />
    </ThemeProvider>
  );
}
```
