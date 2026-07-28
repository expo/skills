# Animations

Use Reanimated v4. Avoid React Native's built-in Animated API.

Read the Motion section of `SKILL.md` first — it decides *whether* to animate. This file decides *how*.
For gestures see `gestures.md`; for threading and cost see `animation-performance.md`.

## Pick the mechanism

```
Is it driven by a gesture, per-frame math, or a layout read?
├── YES → Shared value + useAnimatedStyle
└── NO  → Is the element entering or leaving the tree?
    ├── YES → entering / exiting / layout
    └── NO  → Is it a predefined keyframe sequence (pulse, loader, choreography)?
        ├── YES → CSS animation (animationName)
        └── NO  → CSS transition (transitionProperty)   ← the default
```

Past ~100 animated views on low-end Android or ~500 on iOS, stop animating native views and render to a
single canvas with `@shopify/react-native-skia`.

Default to CSS transitions and CSS animations. They are declarative and skip worklet execution entirely.
Reach for shared values only when the animation must follow a finger or compute something every frame.

## CSS Transitions

The right tool whenever a style should animate because state changed.

```tsx
<Animated.View
  style={{
    opacity: isVisible ? 1 : 0,
    transitionProperty: "opacity",
    transitionDuration: 200,
    transitionTimingFunction: "ease-out",
  }}
/>
```

Multiple properties — the arrays are positional, so order must match `transitionProperty`:

```tsx
transitionProperty: ["transform", "opacity"],
transitionDuration: [160, 120],
transitionTimingFunction: ["ease-out", "linear"],
```

### Press feedback is a transition, not a gesture

A button press is a state change. Use `Pressable` + state and skip shared values, worklets, and thread
bridging entirely:

```tsx
import { useState } from "react";
import { Pressable } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";

function PressableCard({ children, onPress }) {
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
    >
      <Animated.View
        style={{
          transform: [{ scale: pressed ? 0.97 : 1 }],
          transitionProperty: "transform",
          transitionDuration: 120,
          transitionTimingFunction: "ease-out",
        }}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}
```

Keep the press scale subtle — 0.95 to 0.98. Feedback must appear on press *in*, not on release.

### Timing functions

Predefined: `'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'step-start' | 'step-end'`.

For a stronger curve, import the parametrized helpers:

```tsx
import { cubicBezier } from "react-native-reanimated";

transitionTimingFunction: cubicBezier(0.23, 1, 0.32, 1),   // strong ease-out
```

`steps(n, modifier)` and `linear(...points)` are also available. Never use `ease-in` for UI.

### Rules

- Never `transitionProperty: 'all'` — it evaluates every style property every frame.
- `flexDirection`, `justifyContent`, `alignItems` and friends are discrete and snap by default. Add
  `transitionBehavior: 'allow-discrete'` to flip them at the midpoint, or use a layout animation.
- A negative `transitionDelay` starts the transition partway through.
- Transitions are interruptible: a new target retargets from the current on-screen value.
- Lifecycle callbacks exist if you need them: `onTransitionRun`, `onTransitionStart`, `onTransitionEnd`,
  `onTransitionCancel`. The payload's `elapsedTime` is in **seconds**.

## CSS Animations

For keyframe sequences that don't depend on state — loaders, pulses, entrance choreography.

```tsx
const pulse = {
  "0%": { opacity: 1 },
  "50%": { opacity: 0.4 },
  "100%": { opacity: 1 },
};

<Animated.View
  style={{
    animationName: pulse,
    animationDuration: "1200ms",
    animationIterationCount: "infinite",
    animationTimingFunction: "ease-in-out",
  }}
/>;
```

The element's current state is the implicit `0%` keyframe, so only define the frames that differ.

### Rules

- The timing function on the last keyframe is ignored — there is nothing after it to animate toward.
- Every `transform` array must list its properties in the same order across all keyframes.
- `animationIterationCount: 'infinite'` stops automatically on unmount. No cleanup needed.
- **Keyframe animations restart from zero when re-triggered.** They are wrong for anything the user can
  fire rapidly or interrupt — use a transition or a spring there.
- Pause and resume with `animationPlayState: 'paused' | 'running'`.

## Entering and Exiting Animations

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

### Common Presets

**Entering:** `FadeIn`, `FadeInUp`, `FadeInDown`, `FadeInLeft`, `FadeInRight`, `SlideInUp`, `SlideInDown`,
`SlideInLeft`, `SlideInRight`, `ZoomIn`, `ZoomInUp`, `ZoomInDown`, `BounceIn`, `BounceInUp`, `BounceInDown`

**Exiting:** `FadeOut`, `FadeOutUp`, `FadeOutDown`, `FadeOutLeft`, `FadeOutRight`, `SlideOutUp`,
`SlideOutDown`, `SlideOutLeft`, `SlideOutRight`, `ZoomOut`, `ZoomOutUp`, `ZoomOutDown`, `BounceOut`,
`BounceOutUp`, `BounceOutDown`

**Layout:** `LinearTransition`, `SequencedTransition`, `FadingTransition`

### Modifiers

```tsx
FadeIn.duration(200);                              // ms
FadeIn.delay(100);
FadeIn.springify().damping(15).stiffness(100);
FadeIn.easing(Easing.bezier(0.23, 1, 0.32, 1));
FadeInDown.duration(200).delay(100);               // chained
```

### Rules

- Enter and exit along the same path. `SlideInDown` pairs with `SlideOutDown`, not `SlideOutUp` — an
  element that leaves the way it arrived keeps the user oriented.
- Prefer `FadeIn`/`FadeInUp` over `ZoomIn` for ordinary content. `ZoomIn` starts from a near-zero scale,
  which reads as appearing from nowhere.
- Reserve `BounceIn` for the rare/first-run tier. Bounce on routine UI feels unserious.
- An `exiting` animation on an unmounting component delays the unmount for its duration. Keep exits short.
- Views can be flattened away by the renderer, which silently drops the animation. Giving the view a
  `style` or a `collapsable={false}` prop keeps it.
- `entering` conflicts with a manually set `nativeID` on the same view.

## Lists

Per-item `entering` on a **recycled** list (`FlatList`, `FlashList`) re-fires every time a row is recycled
during scroll. It looks broken and it costs frames. Use `itemLayoutAnimation` on `Animated.FlatList`:

```tsx
<Animated.FlatList
  data={items}
  itemLayoutAnimation={LinearTransition}
  renderItem={renderItem}
/>
```

- `itemLayoutAnimation` works only with a single column — `numColumns` cannot exceed 1.
- `skipEnteringExitingAnimations` suppresses item enter/exit on list mount and unmount.
- `Animated.FlatList` does not support `CellRendererComponent` (it is typed `never`). Use
  `CellRendererComponentStyle` instead.
- Per-item entrances are fine on a **short, non-recycled** list rendered with `.map()`.

### Stagger

Only for a short group the user sees occasionally. Keep the step at 30-80ms, and never block interaction
while it plays:

```tsx
{items.map((item, index) => (
  <Animated.View key={item.id} entering={FadeInUp.delay(index * 50)}>
    <ListItem item={item} />
  </Animated.View>
))}
```

A 20-item list at 50ms is a one-second wait before the last row appears. Cap the total, or don't stagger.

## Shared Value Animations

For gesture-driven motion, per-frame math, and layout reads.

```tsx
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  GentleSpringConfig,
} from "react-native-reanimated";

const offset = useSharedValue(0);

offset.value = withSpring(100, GentleSpringConfig);
offset.value = withTiming(100, { duration: 200 });

const style = useAnimatedStyle(() => ({
  transform: [{ translateX: offset.value }],
}));
```

### Spring configuration

Prefer the named presets over hand-tuned numbers — they are exported from `react-native-reanimated`:

| Preset | Feel | Use for |
| --- | --- | --- |
| `GentleSpringConfig` | Critically damped, no overshoot | Most UI. The default choice. |
| `SnappySpringConfig` | Fast, overshoot clamped | Snapping into place |
| `WigglySpringConfig` | Visibly bouncy | Playful, momentum-carrying motion only |

Each has a `...WithDuration` variant (`GentleSpringConfigWithDuration`, etc.) expressed as
`{ duration, dampingRatio }` instead of physics.

Hand-configuring:

```tsx
withSpring(target, { duration: 350, dampingRatio: 1 });   // critically damped
withSpring(target, { duration: 350, dampingRatio: 0.8 }); // slight overshoot
```

- The config is a **mutually exclusive union**: `{ stiffness, damping }` **or**
  `{ duration, dampingRatio, clamp }`. Mixing `damping` with `duration` is a type error.
- `dampingRatio: 1` is critically damped; `<1` overshoots; `>1` is overdamped.
- `duration` is *perceptual* — the real settle time is about 1.5x it. It defaults to 550ms.
- Reserve `dampingRatio < 1` for motion a gesture threw. See `gestures.md` for velocity handoff.
- `overshootClamping: true` forbids passing the target at all.

### Rules

- Springs retarget from the current value **and** velocity when interrupted, which is why they are correct
  for anything a user can grab mid-flight.
- Never read `sharedValue.value` in render, an event handler, or `useEffect` — it forces a UI→JS sync that
  blocks the JS thread. Derive with `useDerivedValue`.
- **Never write `sharedValue.value` during render either.** It appears to work and then silently drops or
  resets updates, because render is not a commit — React may discard or replay it. Mutate in an effect, a
  gesture callback, or an event handler:

  ```tsx
  // Bad — write during render; the value goes stale or snaps back to its initial value
  progress.value = withTiming(count);

  // Good
  useEffect(() => {
    progress.value = withTiming(count, { duration: 200 });
  }, [count]);
  ```

  When the value is purely derived from a prop or another shared value, skip the write entirely and use
  `useDerivedValue`.
- You can't pass `Color` / `PlatformColor` values to Reanimated views or styles; use static colors instead.

## Scroll-Driven Animations

```tsx
import Animated, {
  useAnimatedRef,
  useScrollOffset,
  useAnimatedStyle,
  interpolate,
} from "react-native-reanimated";

function Page() {
  const ref = useAnimatedRef();
  const scroll = useScrollOffset(ref);

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

`useScrollOffset` is the current name; `useScrollViewOffset` still works as an alias. Always pass `"clamp"`
to `interpolate` for bounded values, or the style keeps extrapolating past the input range.

Before building a scroll animation, check whether the native header already does it — large-title collapse
and blur-on-scroll are Stack options, not animations you write.

## Keyboard Animations

```tsx
import Animated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
} from "react-native-reanimated";

function KeyboardAwareView() {
  const keyboard = useAnimatedKeyboard();

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -keyboard.height.value }],
  }));

  return <Animated.View style={style}>{/* content */}</Animated.View>;
}
```

Use `translateY` rather than animating `paddingBottom` — padding forces a layout pass every frame.

## Animating Text

Never drive text content from React state on a per-frame basis — it re-renders the tree every frame. Write
to the native text node directly with `animatedProps`:

```tsx
import Animated, { useAnimatedProps } from "react-native-reanimated";
import { TextInput } from "react-native";

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

function Counter({ progress }: { progress: SharedValue<number> }) {
  const animatedProps = useAnimatedProps(() => ({
    text: String(Math.round(progress.value)),
    defaultValue: "0",
  }));

  return (
    <AnimatedTextInput animatedProps={animatedProps} editable={false} />
  );
}
```

Pair any changing number with `{ fontVariant: 'tabular-nums' }` so the digits don't shift width.

## Infinite Animations

CSS animations with `animationIterationCount: 'infinite'` clean up on unmount by themselves. Shared-value
loops do not — cancel them:

```tsx
useEffect(() => {
  offset.value = withRepeat(withTiming(1, { duration: 800 }), -1, true);
  return () => cancelAnimation(offset);
}, []);
```

Never start an infinite animation outside the component lifecycle (module scope, a global timer). It cannot
be cleaned up and it will leak.

## Threading

Call JS-thread functions from a worklet with `scheduleOnRN` from `react-native-worklets`:

```tsx
import { scheduleOnRN } from "react-native-worklets";

scheduleOnRN(setCount, newCount);
```

`runOnJS` still exists but is deprecated in favour of `scheduleOnRN`. The difference in shape matters:
`scheduleOnRN(fn, ...args)` takes arguments directly, while `runOnJS(fn)(...args)` returned a curried
function. Functions passed to `scheduleOnRN` must be defined in JS-thread scope — they cannot be created
inside a worklet.

## Prefer Non-Layout Properties

Animating `top`, `left`, `width`, `height`, `margin`, or `padding` forces a layout pass on every frame.

Animate instead:

- `transform` — `translateX`, `translateY`, `scale`, `rotate`
- `opacity`
- `backgroundColor`

If the design calls for a size change, `scale` gives the same visual result without touching layout.

## Supported Style Properties

Most React Native style properties animate. The exceptions worth knowing:

- **`flexBasis`**: computed but never applied. Use `flexGrow` / `flexShrink`.
- **Shadows**: `shadowOffset`, `shadowOpacity`, `shadowRadius` don't work on Android — use `boxShadow`.
- **Web shadows**: must appear in every keyframe or they are lost.
- **`tintColor` on iOS**: must be in the `Image`'s initial style; adding it later has no effect.
- **Style inheritance**: not supported. Properties that inherit in CSS must be set explicitly.
- **Mixed-unit margins**: interpolating absolute against percentage margins gives unexpected results.

## Accessibility

Gate non-essential motion:

```tsx
const reduceMotion = useReducedMotion();

<Animated.View entering={reduceMotion ? undefined : FadeIn} />;
```

Or set the policy globally near the app root:

```tsx
import { ReducedMotionConfig, ReduceMotion } from "react-native-reanimated";

<ReducedMotionConfig mode={ReduceMotion.System} />;
```

`useReducedMotion()` reads the setting at app start and does not update if the user changes it while the app
is running. When reduced motion is on, `withSpring`/`withTiming` jump straight to the target, entering and
layout animations jump to their endpoint, and exiting animations are skipped entirely — so don't put
anything load-bearing in an exit callback.

## Best Practices

- Check the Motion section of `SKILL.md` before adding an animation. High-frequency and keyboard-initiated
  interactions should not animate at all.
- Use a layout animation when items are added to or removed from a list; use `itemLayoutAnimation` if that
  list recycles.
- Use `useAnimatedStyle` for scroll-driven animation, and `interpolate` with `"clamp"` for bounded values.
- Keep UI animations under 300ms. Press feedback belongs at 100-160ms.
- Prefer transitions and springs over keyframes for anything interruptible.
- Reach for a spring when motion follows a gesture; a duration curve is fine for state changes.
- Avoid animating layout properties — prefer transforms.
- Judge the result on a recording from a release build, not a screenshot from a debug build.
