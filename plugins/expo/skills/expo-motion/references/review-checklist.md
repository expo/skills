# Reviewing Motion

The bar for auditing animation, gesture, and motion code in an Expo app. Default to flagging — approval is
earned. Motion that "works" but feels sluggish, fires too often, or drops frames is a regression.

This reviews motion only. For general code review, use a general review skill.

## Flag on sight

### Crashes and correctness

| Signal | Why |
| --- | --- |
| A non-worklet call in a gesture callback (`setState`, navigation, a native module) | Throws *"Tried to synchronously call a non-worklet function on the UI thread"*. Wrap in `scheduleOnRN`. |
| No `GestureHandlerRootView` above a `GestureDetector` | Runtime crash. |
| `runOnJS` | Deprecated. Use `scheduleOnRN` (arguments passed directly, not curried). |
| `PanResponder`, or React Native's `Animated` API | Runs on the JS thread. Use Gesture Handler / Reanimated. |
| Gesture Handler v2 gesture not wrapped in `useMemo` | Recognizer re-attaches every render and loses state mid-gesture. |
| RN touch handlers mixed with Gesture Handler in one tree | Double-tap bugs and competing recognizers. |
| `Color` / `PlatformColor` passed into a Reanimated style | Not supported. Use a static color. |
| `'worklet'` missing on an imported function used in a worklet | Autoworkletization is per-file. |

### Performance

| Signal | Why |
| --- | --- |
| Animating `width`, `height`, `top`, `left`, `margin`, `padding` | Layout pass every frame. Use `transform` / `opacity` / `backgroundColor`; `scale` for size. |
| `sharedValue.value` read in render, an event handler, or `useEffect` | Forces a UI→JS sync that blocks the JS thread. Use `useDerivedValue`. |
| `sharedValue.value` **written** during render | Silently drops or resets the update — render is not a commit. Move it into an effect or a callback, or use `useDerivedValue`. |
| `transitionProperty: 'all'` | Evaluates every style property every frame. |
| `entering` on a recycled `FlatList` / `FlashList` row | Re-fires on every recycle. Use `itemLayoutAnimation`. |
| A worklet closing over a large object | Serialized on every invocation. Destructure first. |
| Text content driven from state per frame | Re-renders the tree every frame. Use `animatedProps` on an animated `TextInput`. |
| An infinite shared-value animation with no `cancelAnimation` teardown | Leaks. |
| More than ~100 animated views on Android / ~500 on iOS | Move to Skia. |
| Timings quoted from a debug build | Meaningless. Re-measure in release. |

### Feel

| Signal | Why |
| --- | --- |
| A hand-rolled sheet, menu, or navigation transition | The platform ships it with correct physics. `presentation: 'formSheet'`, `Link.Menu`, the native stack. |
| Animation on a keyboard-initiated or 100+/day action | Makes the app feel slow. Remove it. |
| An animation with no nameable purpose | Feedback, spatial consistency, state indication, or preventing a jarring change. Otherwise delete. |
| `ease-in` on UI | Delays the frames the user watches most. Use `ease-out` or a custom curve. |
| UI duration over 300ms with no stated reason | Over budget. Press feedback belongs at 100-160ms. |
| Feedback on release instead of press | Reads as dead. |
| `ZoomIn` / `scale(0)`-style entrance on ordinary content | Appears from nowhere. Start from a visible scale plus opacity. |
| Exit path different from the enter path | Disorienting. A sheet that rises from the bottom dismisses to the bottom. |
| CSS keyframes on rapidly-triggered or gesture-driven motion | Restart from zero instead of retargeting. Use a transition or spring. |
| Distance-only swipe dismissal | A fast short flick does nothing. Add a velocity threshold. |
| A hard stop at a drag boundary | Reads as frozen. Use `withDecay` with `rubberBandEffect` + `clamp`. |
| No velocity handed to the spring at gesture release | Visible discontinuity between drag and animation. |
| `dampingRatio < 1` / `BounceIn` on motion no gesture threw | Overshoot without momentum feels unmotivated. |
| Symmetric timing on a press-and-hold | The deliberate phase should be slow, the response snappy. |
| A whole grid or list appearing at once, occasionally seen | A 30-80ms stagger belongs here. |
| Stagger long enough to make the last item wait ~1s | Over budget. Cap the total or drop the stagger. |
| No `useReducedMotion` / `ReducedMotionConfig` on movement | Accessibility gap. Gentler, not zero. |
| Haptics on every interaction | Trains users to ignore them. Commits and selection changes only, same frame as the visual. |
| Icon-only control with no `accessibilityLabel` | Invisible to a screen reader. |

## Prefer fixes in this order

1. **Delete it** — high frequency, no purpose, or keyboard-triggered.
2. **Replace it with the native presentation** — sheet, menu, stack transition.
3. **Reduce it** — shorter, smaller transform, fewer animated properties.
4. **Fix the easing** — `ease-in` → `ease-out` or a strong `cubicBezier`.
5. **Fix the physicality** — velocity handoff, rubber-banding, correct entry scale, matching exit path.
6. **Make it interruptible** — keyframes → transitions or springs.
7. **Move it off the layout path** — layout props → `transform` / `opacity`.
8. **Asymmetric timing** — slow the deliberate phase, snap the response.
9. **Polish** — stagger, `itemLayoutAnimation`, spring presets.
10. **Accessibility** — reduced motion, labels, tap targets.

Earlier moves beat later ones. Deleting an animation is a real fix, not a cop-out.

## Required output

### Part 1 — Findings table

One markdown table, one row per issue, most severe first. Never a "Before:/After:" list.

| Before | After | Why |
| --- | --- | --- |
| `withTiming(offset, { duration: 300 })` on press | `transitionProperty: 'transform'`, `transitionDuration: 120` | Press feedback is a state change, not a gesture; 300ms reads as broken |
| `if (translationX > 100) dismiss()` | Add `\|\| Math.abs(velocityX) > 500` | A fast 60pt flick currently does nothing |
| `entering={FadeInUp.delay(i * 50)}` on a `FlatList` row | `itemLayoutAnimation={LinearTransition}` on `Animated.FlatList` | `entering` re-fires on every row recycle |
| Custom pan-gesture bottom sheet | `presentation: 'formSheet'` with `sheetAllowedDetents` | The platform ships correct physics; ~100 lines deleted |

Cite `file:line` for every row. Use exact values — the curve, the duration, the config — never "make it
faster".

### Part 2 — Verdict

Group remaining commentary by impact, highest first. Omit empty tiers.

1. **Crashes and correctness** — threading, missing root view, deprecated APIs
2. **Feel-breaking** — sluggish easing, hand-rolled native interactions, motion on high-frequency actions
3. **Missed deletions** — animations that should be removed or drastically reduced
4. **Performance** — layout-property animation, JS-thread reads, recycled-row entrances
5. **Interruptibility and timing** — keyframes where springs belong, symmetric timing
6. **Physicality and cohesion** — velocity, boundaries, entry/exit paths, personality mismatch
7. **Accessibility** — reduced motion, labels, tap targets

Close with an explicit decision:

- **Block** — any crash-class finding, motion on a keyboard/high-frequency action, a hand-rolled native
  interaction, or a layout-property animation with an easy transform fix.
- **Approve** — no crash-class findings, nothing that should obviously be deleted, durations and easing in
  budget, interruptibility handled, reduced motion respected.

## What code review cannot tell you

Say so rather than guessing. Some things only a running app answers:

- Whether a spring's bounce is right, or a crossfade lands cleanly.
- Whether a gesture feels glued to the finger.
- Whether the app drops frames — that needs a release build and a profile.

When feel is the question, put a verification step in the finding instead of a verdict: record a few seconds
of video (`xcrun simctl io booted recordVideo feel.mov` / `adb shell screenrecord`), drive the gesture at
both slow and fast speeds, and watch it back. Temporarily multiplying a duration by 3-5x makes timing bugs
visible that are invisible at full speed.
