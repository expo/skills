# Gestures

React Native Gesture Handler. Never `PanResponder` — it runs on the JS thread and drops frames under load.

**Before building a gesture, check whether the platform already ships it.** A bottom sheet is
`presentation: 'formSheet'`. A long-press menu is `Link.Menu`. Swipe-to-go-back is the native stack.
Pull-to-refresh is `RefreshControl`. Hand-rolled versions of these are worse and cost a hundred lines.

## Which API — read `package.json` first

**The Expo SDK 57 default template pins Gesture Handler `~2.32.0`, so the builder API is what you write
unless the project explicitly upgraded.** The v3 hook API does not exist in 2.x — importing `usePanGesture`
there fails. Check before writing a gesture:

```
"react-native-gesture-handler" version
├── starts with "2." → builder API: Gesture.Pan(), wrap in useMemo   ← Expo SDK 57 default
└── starts with "3." → hook API: usePanGesture(), memoization built in
```

Gesture Handler 3.x ships **both** APIs, so v2 code keeps working after an upgrade. The examples below use
the v2 builder form; the v3 equivalent is a config object with the callback names from the table.

| Concept | v2 builder | v3 hook |
| --- | --- | --- |
| Create | `Gesture.Pan().onUpdate(fn)` | `usePanGesture({ onUpdate: fn })` |
| Activation callback | `.onStart(fn)` | `onActivate: fn` |
| Deactivation callback | `.onEnd(fn)` | `onDeactivate: fn` |
| Simultaneous | `Gesture.Simultaneous(a, b)` | `useSimultaneousGestures(a, b)` |
| Race / competing | `Gesture.Race(a, b)` | `useCompetingGestures(a, b)` |
| Exclusive | `Gesture.Exclusive(a, b)` | `useExclusiveGestures(a, b)` |
| Cross-component | `.simultaneousWithExternalGesture()` | `.simultaneousWith()` |
| Cross-component | `.requireExternalGestureToFail()` | `.requireToFail()` |
| Cross-component | `.blocksExternalGesture()` | `.block()` |
| Memoization | `useMemo` — **mandatory** | automatic |
| Buttons / scrollables | `RectButton`, `ScrollView` | same plain names; v2 versions renamed `Legacy*` |

v3 callback names in full: `onBegin`, `onActivate`, `onUpdate`, `onDeactivate`, `onFinalize`. Discrete
gestures (tap, long press, fling) have no `onUpdate`.

v3 hooks: `usePanGesture`, `useTapGesture`, `usePinchGesture`, `useRotationGesture`, `useLongPressGesture`,
`useFlingGesture`, `useHoverGesture`, `useManualGesture`, `useNativeGesture`.

**v2 only — memoize every gesture.** Without `useMemo` the object is recreated each render, the recognizer
re-attaches, and it loses state mid-gesture:

```tsx
const pan = useMemo(() => Gesture.Pan().onUpdate(/* … */), []);
```

## `GestureHandlerRootView` is mandatory

`GestureDetector` crashes at runtime without it as an ancestor. With Expo Router it wraps `<Stack />` in the
root layout:

```tsx
// app/_layout.tsx
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function RootLayout() {
  return (
    <GestureHandlerRootView>
      <Stack />
    </GestureHandlerRootView>
  );
}
```

Nested instances are ignored — only the topmost counts. Default style is `{ flex: 1 }`.

## The crash you will hit

With Reanimated installed, gesture callbacks are workletized and run on the UI thread. Calling **any**
non-worklet function from one — a `setState`, a navigation call, a native module method, a `useCallback`
handler — throws *"Tried to synchronously call a non-worklet function on the UI thread"*.

```tsx
import { scheduleOnRN } from "react-native-worklets";

// WRONG — crashes
const pan = useMemo(() => Gesture.Pan().onEnd(() => onDismiss()), []);

// CORRECT — hops to the JS thread
const pan = useMemo(() => Gesture.Pan().onEnd(() => scheduleOnRN(onDismiss)), []);
```

This applies to every callback — v2 `onBegin`/`onStart`/`onUpdate`/`onEnd`/`onFinalize`, v3
`onBegin`/`onActivate`/`onUpdate`/`onDeactivate`/`onFinalize`, and all the `onTouches*` variants. Only
worklet-safe code — shared value writes, other worklets, Reanimated animation functions — runs directly.

**Don't add `'worklet'` to inline callbacks.** The Babel plugin workletizes them. Only a standalone function
assigned to a variable before being passed in needs the directive.

## Scroll containers and buttons

When gestures are in the tree, import these from `react-native-gesture-handler`, not `react-native`:

```tsx
import { ScrollView, FlatList, Pressable, RectButton } from "react-native-gesture-handler";
```

Never mix React Native touch handlers with Gesture Handler in the same tree — it produces double-tap bugs
and gestures that fight each other. Pick one system per app.

## Physics — what separates "fluid" from "fine"

### Track 1:1, and respect where they grabbed

The element must stay glued to the finger, offset from the grab point rather than snapping its center to it.
Require a small activation threshold first so a tap isn't read as a drag:

```tsx
const translateX = useSharedValue(0);
const start = useSharedValue(0);

const pan = useMemo(
  () =>
    Gesture.Pan()
      .activeOffsetX([-10, 10]) // ~10pt of hysteresis before committing
      .onStart(() => {
        start.value = translateX.value; // continue from where it is, not from 0
      })
      .onUpdate((e) => {
        translateX.value = start.value + e.translationX;
      }),
  []
);
```

Accumulating onto the value at activation is what makes a second drag continue smoothly instead of jumping.

### Hand the release velocity to the animation

The seam between dragging and animating is where gestures feel cheap. Pass the finger's velocity into the
spring so there is no discontinuity:

```tsx
.onEnd((e) => {
  translateX.value = withSpring(0, {
    velocity: e.velocityX,
    duration: 350,
    dampingRatio: 0.8, // slight overshoot is right here — a gesture carried momentum
  });
})
```

`dampingRatio < 1` is justified **only** after a real flick. On motion the user didn't throw, use `1`.

### Project the landing point with `withDecay`

Don't snap from the release point — let momentum carry, the way scrolling does. `withDecay` is the built-in
deceleration model:

```tsx
.onEnd((e) => {
  translateY.value = withDecay({
    velocity: e.velocityY,
    deceleration: 0.998, // default; lower is snappier
    clamp: [minY, maxY],
  });
})
```

### Rubber-band at boundaries, never hard-stop

A hard stop reads as frozen. Progressive resistance reads as "responsive, but there's nothing more here":

```tsx
translateY.value = withDecay({
  velocity: e.velocityY,
  rubberBandEffect: true,
  clamp: [minY, maxY],        // REQUIRED when rubberBandEffect is true
  rubberBandFactor: 0.6,      // default; higher resists less
});
```

`rubberBandEffect: true` without `clamp` is a type error — the effect needs bounds to bounce against.

### Dismiss on velocity, not distance alone

A quick 60pt flick should dismiss. Distance-only thresholds ignore intent:

```tsx
const SWIPE_THRESHOLD = 100;
const VELOCITY_THRESHOLD = 500;   // pt/s

.onEnd((e) => {
  const shouldDismiss =
    Math.abs(e.translationX) > SWIPE_THRESHOLD ||
    Math.abs(e.velocityX) > VELOCITY_THRESHOLD;

  if (shouldDismiss) {
    translateX.value = withSpring(Math.sign(e.velocityX || e.translationX) * SCREEN_WIDTH, {
      velocity: e.velocityX,
      duration: 250,
      dampingRatio: 1,
    });
    scheduleOnRN(onDismiss);
  } else {
    translateX.value = withSpring(0, { velocity: e.velocityX });
  }
})
```

Decide direction from the **sign of the velocity**, not the position, when the two disagree.

### Give X and Y their own springs

A single spring over a 2D distance desynchronizes when the axes have different velocities. Animate
`translateX` and `translateY` as separate shared values with separate springs.

### Interruptibility

Shared values and springs retarget from the current value and velocity, so a user can grab a moving element
and reverse it. CSS keyframe animations restart from zero — never use them for gesture-driven motion. Never
lock out input while a transition plays.

## Patterns

### Swipe-to-dismiss

Enter and exit along the same edge. A row that swipes away to the right should not fade out in place — the
exit path is what makes the gesture feel like it did something.

### List row actions

Use `ReanimatedSwipeable` rather than building a pan gesture per row — it handles the action reveal, the snap
points, and close-on-scroll. Note it is a **subpath import**, not a root export:

```tsx
import ReanimatedSwipeable from "react-native-gesture-handler/ReanimatedSwipeable";
```

### Pan inside a scroll view

The pan and the scroll compete. Constrain the pan to the perpendicular axis with `.activeOffsetX([-10, 10])`
and `.failOffsetY([-5, 5])` so the scroll wins vertical movement, or compose explicitly — v2
`Gesture.Simultaneous(a, b)` / `Gesture.Race(a, b)`, v3 `useSimultaneousGestures` / `useCompetingGestures`.

### SVG and text targets

`GestureDetector` can break an SVG hierarchy. On v3, use `InterceptingGestureDetector` with
`VirtualGestureDetector` for sub-elements of an SVG or a `Text` run. On v2 there is no equivalent — wrap the
whole SVG in a single `GestureDetector` and hit-test yourself from the gesture coordinates.

## Haptics

Fire `expo-haptics` on the **causal** event — the snap, the commit, the selection change — and on the same
frame as the visual. Latency between the two destroys the illusion.

```tsx
import * as Haptics from "expo-haptics";

.onEnd((e) => {
  if (shouldDismiss) {
    scheduleOnRN(Haptics.impactAsync, Haptics.ImpactFeedbackStyle.Light);
  }
})
```

Reserve haptics for meaningful moments. Firing them on every interaction trains users to ignore all of them.

## Verify on a device, at speed

Gesture feel cannot be checked from source or a screenshot. Drive the real thing and record it:

```bash
xcrun simctl io booted recordVideo feel.mov
```

Test the same gesture slow *and* fast — velocity-based dismissal only shows up under a quick flick, which is
exactly the case a distance-only implementation gets wrong.
