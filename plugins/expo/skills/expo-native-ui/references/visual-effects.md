# Visual Effects

## Backdrop Blur (expo-blur)

Prefer the `systemMaterial` tint family (`systemMaterial`, `systemThinMaterial`, `systemUltraThinMaterial`, `systemThickMaterial`, `systemChromeMaterial`) — these adapt to dark mode automatically, unlike the fixed `light`/`dark` tints. `intensity` ranges 0-100.

```tsx
import { BlurView } from "expo-blur";

<BlurView
  tint="systemMaterial"
  intensity={100}
  style={{ borderRadius: 16, overflow: "hidden" }}
/>;
```

BlurView requires `overflow: 'hidden'` to clip rounded corners — without it `borderRadius` has no visible effect.

## Liquid Glass (expo-glass-effect, iOS 26+)

```tsx
import { GlassView } from "expo-glass-effect";

<GlassView style={{ borderRadius: 16, padding: 16 }}>
  <Text>Content inside glass</Text>
</GlassView>;
```

Add `isInteractive` when the glass wraps a button or pressable. Canonical glass icon button (the camera example in `media.md` uses this):

```tsx
import { Pressable } from "react-native";
import { Image } from "expo-image";
import { GlassView } from "expo-glass-effect";
import { colors } from "@/theme/colors";

function GlassButton({ icon, onPress }: { icon: string; onPress: () => void }) {
  return (
    <GlassView isInteractive style={{ borderRadius: 50 }}>
      <Pressable style={{ padding: 12 }} onPress={onPress}>
        <Image
          source={`sf:${icon}`}
          tintColor={colors.label as string}
          style={{ width: 24, height: 24 }}
        />
      </Pressable>
    </GlassView>
  );
}
```

### Fallback for Older iOS / Android

Glass is iOS 26+ only. Check `isLiquidGlassAvailable()` and fall back to `BlurView` or a solid background:

```tsx
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { BlurView } from "expo-blur";

function AdaptiveGlass({ children, style }) {
  if (isLiquidGlassAvailable()) {
    return <GlassView style={style}>{children}</GlassView>;
  }

  return (
    <BlurView tint="systemMaterial" intensity={80} style={style}>
      {children}
    </BlurView>
  );
}
```

## Sheet with Glass Background

Make sheet backgrounds liquid glass on iOS 26+ by making the content transparent:

```tsx
<Stack.Screen
  name="sheet"
  options={{
    presentation: "formSheet",
    sheetGrabberVisible: true,
    sheetAllowedDetents: [0.5, 1.0],
    contentStyle: { backgroundColor: "transparent" },
  }}
/>
```

## Best Practices

- Use `systemMaterial` tints for automatic dark mode support
- Always set `overflow: 'hidden'` on BlurView for rounded corners
- Use `isInteractive` on GlassView for buttons and pressables
- Check `isLiquidGlassAvailable()` and provide fallbacks
- Avoid nesting blur views (performance impact)
- Keep blur intensity reasonable (50-100) for readability

> Source: https://docs.expo.dev/versions/latest/sdk/blur-view/ and https://docs.expo.dev/versions/latest/sdk/glass-effect/ — the canonical pages for every tint and prop (append `.md` for markdown; swap `latest` for the project's SDK, e.g. `v57.0.0`). This reference adds only the dark-mode tint rule, the `overflow` gotcha, and the fallback pattern.
