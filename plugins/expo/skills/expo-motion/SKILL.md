---
name: expo-motion
description: Framework (OSS). Motion craft for Expo apps - whether something should animate at all, and how to make it feel right when it should. Covers the animate-or-not decision, duration and easing budgets, spring configuration, Reanimated 4 CSS transitions and shared values, entering/exiting and layout animations, gestures with real physics (velocity handoff, momentum, rubber-banding, swipe-to-dismiss), haptics, worklet threading, animation performance and jank, reduced motion, and reviewing motion. Use when adding or changing an animation, adding a gesture, or when something feels sluggish, janky, laggy, or "off". For screen styling and semantic colors use expo-native-ui; for navigation transitions use expo-router.
version: 1.0.0
license: MIT
---

# Expo Motion

Motion is what separates an app that looks native from one that feels native. Most generated Expo UI gets it
wrong in the same two ways: it animates things that shouldn't animate, and it hand-rolls interactions the OS
already ships.

For screen styling, semantic colors, and visual effects use the `expo-native-ui` skill. For routes, stacks,
and navigation transitions use the `expo-router` skill.

## References

Consult these resources as needed:

```
references/
  animations.md              Reanimated 4: CSS transitions/animations, shared values, entering/exiting, layout, lists, scroll, text
  animation-performance.md   Worklet threading, Bundle Mode, cost rules, feature flags, 120fps, measuring jank
  gestures.md                Gesture Handler: pan/tap/pinch, velocity handoff, momentum, rubber-banding, swipe-to-dismiss, haptics
  review-checklist.md        Reviewing motion: what to flag, the order to fix in, required output format
```

## 1. Use the native presentation instead of building the interaction

The platform ships these with correct physics. Each is one prop instead of a hundred lines of gesture code:

| Instead of building | Use |
| --- | --- |
| A pan-gesture bottom sheet | `presentation: 'formSheet'` + `sheetAllowedDetents` |
| A long-press menu or peek overlay | `Link.Menu` / `Link.Preview` |
| An animated route change | The native stack — push, pop, and modal transitions are free |
| A cross-fade between tabs | `NativeTabs` |
| A custom pull-to-refresh | `RefreshControl` |
| A hand-animated header collapse | Stack `headerLargeTitle` options |
| A custom keyboard-avoiding animation | The built-in keyboard props |

Hand-animating navigation is the single most common way generated Expo UI ends up worse than the default.
Check for a native affordance before writing an animation.

## 2. Decide whether it should animate at all

Every animation needs a purpose you can name:

- **Feedback** — the interface heard the user
- **Spatial consistency** — where something came from or went
- **State indication** — a change is legible
- **Preventing a jarring change** — content would otherwise teleport in or vanish

"It looks cool" is not on the list. If you can't name the purpose, don't animate.

Then check how often the user sees it:

| Frequency | Decision |
| --- | --- |
| 100+/day, or keyboard-initiated | No animation. Ever. |
| Tens/day (row taps, toggles) | None, or so fast it reads as instant |
| Occasional (sheets, modals, toasts, settings) | Standard animation |
| Rare / first-run (onboarding, empty state, success) | The delight budget lives here |

Frequently-seen motion is what makes an app feel slow. **Deleting an animation is a legitimate fix**, and
often the correct one.

## 3. Pick the mechanism

| The animation is | Use |
| --- | --- |
| A state-driven A→B property change | CSS transition (`transitionProperty`) |
| A predefined keyframe sequence (pulse, loader, choreography) | CSS animation (`animationName`) |
| Driven by a gesture, per-frame math, or a layout read | Shared value + `useAnimatedStyle` |
| An element entering or leaving the tree | `entering` / `exiting` / `layout` |
| More than ~100 animated views on low-end Android, ~500 on iOS | `@shopify/react-native-skia` |

**Default to CSS transitions.** They are declarative and skip worklet execution entirely. A button press is a
state change, not a gesture — use `Pressable` + state + a transition, not a shared value. Reach for shared
values only when the animation must follow a finger or compute every frame.

Details and code in `references/animations.md`.

## 4. Duration budget

| Element | Duration |
| --- | --- |
| Press feedback | 100-160ms |
| Tooltips, small popovers | 125-200ms |
| Dropdowns, selects | 150-250ms |
| Sheets, drawers, modals | 200-500ms |

UI motion stays **under 300ms** unless you can say why. A 180ms transition reads as more responsive than a
400ms one; a 300ms press feedback reads as broken.

## 5. Easing and springs, with real values

- Entering and exiting use **ease-out**. **Never `ease-in` on UI** — it delays the frames the user watches
  most, so it feels sluggish at an identical duration.
- Built-in easings are weak. For deliberate motion use `Easing.bezier(0.23, 1, 0.32, 1)` (enter/exit) or
  `Easing.bezier(0.32, 0.72, 0, 1)` (drawers and sheets).
- **Prefer Reanimated's named spring presets** over hand-tuned numbers, imported from
  `react-native-reanimated`:

  | Preset | Feel | Use for |
  | --- | --- | --- |
  | `GentleSpringConfig` | Critically damped, no overshoot | Most UI. The default. |
  | `SnappySpringConfig` | Fast, overshoot clamped | Snapping into place |
  | `WigglySpringConfig` | Visibly bouncy | Playful, momentum-carrying motion only |

- Hand-configuring: `withSpring(to, { duration: 350, dampingRatio: 1 })`. `dampingRatio: 1` is critically
  damped and right for most UI. Drop to `0.8` **only** when a gesture carried momentum in — overshoot on a
  menu that just faded in feels wrong, overshoot on a card you flicked feels right.
- The config is a **mutually exclusive union**: `{ stiffness, damping }` **or**
  `{ duration, dampingRatio, clamp }`. Mixing `damping` with `duration` is a type error.

## 6. Rules that crash or jank apps

- **Use `scheduleOnRN` from `react-native-worklets`** to call JS-thread code from a worklet or gesture
  callback. `runOnJS` still exists but is deprecated; `scheduleOnRN(fn, ...args)` takes arguments directly
  rather than returning a curried function.
- Calling any **non-worklet function** (a `setState`, navigation, a native module) directly from a gesture
  callback throws *"Tried to synchronously call a non-worklet function on the UI thread"*. Wrap it in
  `scheduleOnRN`.
- **`GestureHandlerRootView` must wrap the app** or `GestureDetector` crashes at runtime. With Expo Router it
  goes around `<Stack />` in the root `_layout.tsx`.
- **Never animate layout properties** (`width`, `height`, `top`, `left`, `margin`, `padding`) — each frame
  forces a layout pass. Animate `transform`, `opacity`, `backgroundColor`; use `scale` for size changes.
- **Never read `sharedValue.value` during render or in an event handler** — it blocks the JS thread on a
  UI-thread sync. Derive with `useDerivedValue`.
- **Never write `sharedValue.value` during render** — it silently drops or resets updates. Write in an
  effect, a gesture callback, or an event handler.
- **No `entering` on recycled list rows** (`FlatList`, `FlashList`) — it re-fires on every recycle. Use
  `Animated.FlatList`'s `itemLayoutAnimation`.
- **No `Color` / `PlatformColor` values in Reanimated styles** — use static colors there.
- **Never `PanResponder`** or React Native's `Animated` API. Both run on the JS thread.

## 7. Reduced motion

Gate non-essential motion on `useReducedMotion()`, or set a global policy with
`<ReducedMotionConfig mode={ReduceMotion.System} />`.

Reduced motion means **gentler, not zero**: keep opacity and color changes that aid comprehension, drop
movement and overshoot. `useReducedMotion()` reads the setting at app start and does not update live.

## 8. Verify by recording, not screenshotting

A still image cannot show wrong easing, a dropped frame, or a janky transition — all of which pass a
screenshot check and still betray the app.

```bash
xcrun simctl io booted recordVideo feel.mov   # iOS
adb shell screenrecord /sdcard/feel.mp4       # Android
```

Judge motion in a **release** build. Debug adds enough JS overhead that timings are meaningless. Test gestures
at both slow and fast speeds — velocity-based behavior only shows up under a quick flick, which is exactly
what a distance-only implementation gets wrong.

## Reviewing motion

When asked to review, audit, improve, or diagnose animation — "make this feel better", "the sheet feels
sluggish", "why is this janky" — read `references/review-checklist.md` and follow it. It defines what to flag,
the order to prefer fixes in, and the required output: a single Before/After/Why table followed by a verdict.

## Submitting Feedback
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes submit-expo-feedback@latest --category skills --subject "expo-motion" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
