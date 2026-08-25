# CSS Gradients

> **New Architecture Only**: CSS gradients require React Native's New Architecture (Fabric). They are not available in the old architecture or Expo Go.

Use standard CSS gradient strings with the `experimental_backgroundImage` style property. The prop is **experimental** — its name and behavior may change between React Native releases.

```tsx
// Scrim over an image
<View style={{ position: "relative" }}>
  <Image source={{ uri: "..." }} style={{ width: "100%", height: 200 }} />
  <View
    style={{
      position: "absolute",
      inset: 0,
      experimental_backgroundImage:
        "linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, transparent 50%)",
    }}
  />
</View>
```

`linear-gradient` and `radial-gradient` use normal web CSS syntax: direction keywords (`to bottom`) or degrees (`135deg`), `rgba()`/`transparent`, percentage color stops, and comma-separated gradients to stack layers.

## Rules

- Do NOT use `expo-linear-gradient` — use CSS gradients instead
- Gradients are strings, not objects
