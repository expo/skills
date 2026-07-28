# Animation Performance and Threading

Reanimated 4 requires the New Architecture (Fabric). Everything here assumes it.

## Runtimes — pick the target first

```
What does the work need?
├── Drive animation or respond to native events on the same frame?
│   └── UI Runtime (main thread, one per app)
├── Heavy computation or background processing?
│   └── Worker Runtime (custom thread, many per app)
└── React state, navigation, or an RN API?
    └── RN Runtime (JS thread, one per app)
```

Runtimes do **not** share memory. Data crosses a boundary by serialization (an immutable copy) or through a
`Synchronizable` (shared mutable state).

## Scheduling API

| Need | UI Runtime | Worker Runtime | RN Runtime |
| --- | --- | --- | --- |
| Fire and forget | `scheduleOnUI(fn, ...args)` | `scheduleOnRuntime(rt, fn, ...args)` | `scheduleOnRN(fn, ...args)` |
| Await the result | `await runOnUIAsync(fn, ...args)` | `await runOnRuntimeAsync(rt, fn, ...args)` | — |
| Block for the result | `runOnUISync(fn, ...args)` | `runOnRuntimeSync(rt, fn, ...args)` | — |

All from `react-native-worklets`.

- `runOnJS` and `runOnUI` still exist but are **deprecated** — use `scheduleOnRN` and `scheduleOnUI`. The
  shape differs: `scheduleOnRN(fn, ...args)` passes arguments directly; `runOnJS(fn)(...args)` returned a
  curried function.
- The scheduling APIs can only be called **from the RN Runtime** unless Bundle Mode is on. Calling
  `scheduleOnUI` from a worklet throws.

## The `'worklet'` directive

Add `'worklet';` as the first statement of any function that must run on a Worklet Runtime:

```tsx
function computeOnUI() {
  "worklet";
  return 2 + 2;
}
```

- Callbacks passed **inline** to `scheduleOnUI`, gesture hooks, `useAnimatedStyle`, and friends are
  autoworkletized by the Babel plugin. Don't add the directive to those.
- **Imported functions need the directive explicitly** — autoworkletization only applies within one file.
- **Conditional expressions bypass autoworkletization.** Add `'worklet';` to each branch by hand.
- **Worklets are not hoisted.** Referencing one before its declaration crashes at runtime.
- A file starting with a top-level `'worklet';` workletizes all of its top-level functions.

Expo ships the Worklets Babel plugin by default since SDK 54. Nothing to configure.

## Cost rules

- **Never animate layout properties.** `top`, `left`, `width`, `height`, `margin`, `padding` force a layout
  pass every frame. Animate `transform`, `opacity`, `backgroundColor`. Use `scale` for size changes.
- **Never read `sharedValue.value` on the JS thread** — not in render, not in an event handler, not in
  `useEffect`. It forces a UI→JS synchronization that blocks the JS thread. Use `useDerivedValue`.
- **Keep worklet closures small.** A worklet serializes everything it captures. Destructure first:

  ```tsx
  // Bad — serializes the whole theme object every invocation
  const theme = useTheme();
  const style = useAnimatedStyle(() => ({ backgroundColor: theme.colors.primary }));

  // Good — captures one string
  const primary = useTheme().colors.primary;
  const style = useAnimatedStyle(() => ({ backgroundColor: primary }));
  ```

- **Don't drive text from state per frame.** Use `animatedProps` on an animated `TextInput` (see
  `animations.md`).

## Memoization

Gesture objects and frame callbacks are recreated every render unless memoized:

```tsx
const frameCallback = useFrameCallback(
  useCallback((frameInfo) => {
    // runs on the UI thread every frame
  }, [])
);

// Gesture Handler v2 only — v3 hooks memoize internally
const pan = useMemo(() => Gesture.Pan().onUpdate(/* … */), []);
```

React Compiler handles this automatically. **Under React Compiler, access shared values with `get()` and
`set()` rather than the `.value` property** — direct `.value` mutation is not something the compiler can
reason about.

## How many animated views

| Platform | Practical limit |
| --- | --- |
| iOS | ~500 animated components |
| Low-end Android | ~100 animated components |

Past that, stop animating native views. Render to a single canvas with `@shopify/react-native-skia`, which
avoids per-view overhead entirely. For long lists, reduce animation complexity — or drop it — on low-end
devices via `useReducedMotion`.

## 120fps on ProMotion

iOS caps animation at 60fps even on ProMotion hardware without an opt-in. Set it through `app.json` rather
than editing the plist by hand, so prebuild doesn't overwrite it:

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "CADisableMinimumFrameDurationOnPhone": true
      }
    }
  }
}
```

Requires a rebuild. `IOS_DYNAMIC_FRAMERATE_ENABLED` (a worklets static flag, on by default) drops an
expensive animation from 120fps back to 60 rather than dropping frames.

## Feature flags for known New Architecture jank

Enable these at the app entry point, before any Reanimated code runs.

| Symptom | Fix | Needs |
| --- | --- | --- |
| Sticky headers / animated views flicker while a list scrolls | `DISABLE_COMMIT_PAUSING_MECHANISM` + RN's `preventShadowTreeCommitExhaustion` | RN 0.81+ |
| FPS drops when many animated components are on screen | `USE_COMMIT_HOOK_ONLY_FOR_REACT_COMMITS` | RN 0.80+, Reanimated 4.2+ |
| Low FPS with many simultaneous animations | `ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS` / `IOS_SYNCHRONOUSLY_UPDATE_UI_PROPS` | 4.0+ / 4.2+ |

The synchronous-UI-props flags can interfere with touch detection on animated `transform` elements. When
they're on, use `Pressable` from `react-native-gesture-handler` rather than the core one.

## Bundle Mode (experimental)

Bundle Mode gives worklets the full JS bundle, so third-party libraries can run on Worklet Runtimes without
patching, and `scheduleOn*` becomes callable from any runtime.

1. Enable it in the Babel plugin: `bundleMode: true`, and `strictGlobal: true` (recommended — prevents
   implicit global capture).
2. Wrap the Metro config with `getBundleModeMetroConfig` from `react-native-worklets/bundleMode`.
3. Set the static feature flag in `package.json`:

   ```json
   {
     "worklets": {
       "staticFeatureFlags": { "BUNDLE_MODE_ENABLED": true }
     }
   }
   ```

4. Allow-list any third-party module you want to use inside a worklet via the plugin's
   `workletizableModules` option. Libraries that import React Native internals cannot run on a Worklet
   Runtime — they would load a second RN instance.

**Static feature flags do not work in Expo Go.** Bundle Mode needs `npx expo prebuild` and a development
build. `fetch` inside a worklet additionally requires `FETCH_PREVIEW_ENABLED`.

Dynamic flags can be toggled at runtime with `setDynamicFeatureFlag('FLAG_NAME', true)`.

## Measure, don't guess

- **Always profile a release build.** Debug adds Metro, Hermes debug mode, and dev warnings — enough
  overhead that animation timings mean nothing. `npx expo run:ios --configuration Release`, or
  `--variant release` on Android.
- **Record video, don't screenshot.** `xcrun simctl io booted recordVideo feel.mov` /
  `adb shell screenrecord`. Dropped frames and wrong easing are invisible in a still.
- For a real profile — CPU hotspots, re-render counts, FPS traces — use the React Native profiler tooling
  rather than reasoning about the code. Find the bottleneck before changing anything.

## Troubleshooting

| Error | Cause and fix |
| --- | --- |
| *"Failed to create a worklet"* | Babel plugin missing. Present by default on Expo SDK 54+; otherwise add `react-native-worklets/plugin` and rebuild. |
| *"Native part of Worklets doesn't seem to be initialized"* | Rebuild after installing or upgrading. |
| *"Tried to synchronously call a non-worklet function on the UI thread"* | Add `'worklet';` to the function, or wrap the call in `scheduleOnRN`. |
| *"Tried to modify key of an object which has been converted to a serializable"* | A worklet captured the object and something mutated it later. Use `useSharedValue`, or destructure the needed fields before capture. |
| Version mismatch errors | `npx expo start --clear`. If it persists, a dependency bundles worklets built against an older plugin. |
