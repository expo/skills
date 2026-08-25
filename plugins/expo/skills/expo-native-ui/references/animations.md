# Animations

Use Reanimated v4. Avoid React Native's built-in Animated API.

For anything beyond the defaults below — gestures, keyboard-driven layout, springs, shared values, staggered lists — load the sibling **`expo-animation`** skill instead of improvising here.

## Entering, Exiting, Layout

Use `Animated.View` with `entering`/`exiting` presets; `layout` animates position changes when siblings mount/unmount.

```tsx
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";

function App() {
  return (
    <Animated.View
      entering={FadeIn}
      exiting={FadeOut}
      layout={LinearTransition}
    />
  );
}
```

## Scroll-Driven

Pair `useAnimatedRef` with `useScrollViewOffset` for high-performance scroll animations on the UI thread:

```tsx
import Animated, {
  useAnimatedRef,
  useScrollViewOffset,
  useAnimatedStyle,
  interpolate,
} from "react-native-reanimated";

function Page() {
  const ref = useAnimatedRef();
  const scroll = useScrollViewOffset(ref);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(scroll.value, [0, 30], [0, 1], "clamp"),
  }));

  return (
    <Animated.ScrollView ref={ref}>
      <Animated.View style={style} />
    </Animated.ScrollView>
  );
}
```

## Best Practices

- Add entering and exiting animations for state changes
- Use layout animations when items are added/removed from lists
- Use `useAnimatedStyle` for scroll-driven animations
- Prefer `interpolate` with "clamp" for bounded values
- You can't pass `Color` (from expo-router) or `PlatformColor` values to reanimated views or styles; use static colors instead
- Keep animations under 300ms for responsive feel
- Use spring animations for natural movement
- Avoid animating layout properties (width, height) when possible — prefer transforms

> Source: https://docs.swmansion.com/react-native-reanimated/ — the canonical Reanimated docs (preset catalog, modifiers, hooks). This reference adds only the Expo-specific defaults and the `Color`/`PlatformColor` gotcha above.
