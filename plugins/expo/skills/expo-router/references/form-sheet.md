# Form Sheets in Expo Router

Form sheets with the Expo Router Stack navigator: set `presentation: "formSheet"` on a `Stack.Screen`.

> Source: https://docs.expo.dev/router/advanced/modals/ — the canonical modal and form-sheet page (detent configuration, sizing, full options; append `.md` for markdown). This reference adds only what the docs do not cover: iOS footer layout (the docs only have the Android-only `unstable_sheetFooter`), undimmed-detent semantics, and transparent/liquid-glass backgrounds.

## Configuration

```tsx
// app/_layout.tsx
import { Stack } from "expo-router";

export default function Layout() {
  return (
    <Stack>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="about"
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: [0.25],
          headerTransparent: true,
          contentStyle: { backgroundColor: "transparent" },
          sheetGrabberVisible: true,
        }}
      >
        <Stack.Header style={{ backgroundColor: "transparent" }}></Stack.Header>
      </Stack.Screen>
    </Stack>
  );
}
```

- `contentStyle: { backgroundColor: "transparent" }` makes the sheet background liquid glass on iOS 26+.
- With `sheetAllowedDetents: "fitToContents"`, `flex: 1` is not supported — the sheet needs explicit content sizing to compute its height.

## Footer Pinned to the Bottom

> Requires Expo SDK 55 or later.

Give the root view and the main content `flex: 1`; whatever follows the content sits at the sheet's bottom edge:

```tsx
// app/about.tsx
import { View, Text } from "react-native";

export default function AboutSheet() {
  return (
    <View style={{ flex: 1 }}>
      {/* Main content */}
      <View style={{ flex: 1, padding: 16 }}>
        <Text>Sheet Content</Text>
      </View>

      {/* Footer - stays at bottom */}
      <View style={{ padding: 16 }}>
        <Text>Footer Content</Text>
      </View>
    </View>
  );
}
```

## Form Sheet with Interactive Content Below

Use `sheetLargestUndimmedDetentIndex` (zero-indexed) to keep content behind the form sheet interactive — e.g. letting users pan a map beneath it. Setting it to `1` allows interaction at the first two detents but dims on the third.

```tsx
// app/_layout.tsx
import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="info-sheet"
        options={{
          presentation: "formSheet",
          sheetAllowedDetents: [0.2, 0.5, 1.0],
          sheetLargestUndimmedDetentIndex: 1,
          /* other options */
        }}
      />
    </Stack>
  )
}
```

## Troubleshooting

### Content not filling sheet

Make sure the root View uses `flex: 1`:

```tsx
<View style={{ flex: 1 }}>{/* content */}</View>
```

### Sheet background showing through

Set `contentStyle: { backgroundColor: 'transparent' }` in options and style your content container with the desired background color instead.
