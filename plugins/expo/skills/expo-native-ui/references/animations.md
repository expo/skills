# Animations

Motion is owned by the **`expo-animation`** skill — load it for any animation work: the animate-or-not decision, springs and timing values, entering/exiting, gestures, keyboard-driven UI, scroll effects, interruption handling, and reduced motion. Don't take animation guidance from this file.

The only native-UI-specific caveat lives here:

## Colors in Reanimated Styles

`Color` (from `expo-router`) and `PlatformColor` values are opaque native color objects, not strings — they can't be passed into Reanimated views, animated styles, or color interpolations. Use static colors inside animated styles, and keep semantic colors on the non-animated parts of the tree.

```tsx
// Not supported — semantic color object inside an animated style
const style = useAnimatedStyle(() => ({ backgroundColor: colors.systemBackground }));

// Supported — static value in the animated style
const style = useAnimatedStyle(() => ({ backgroundColor: "rgba(0, 0, 0, 0.4)" }));
```
