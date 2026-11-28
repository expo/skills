---
name: debugging
description: Guide for debugging Expo and React Native apps. Covers React Native DevTools, breakpoints, console, network inspection, error handling, and profiling.
version: 1.0.0
license: MIT
---

# Debugging Expo Apps

## Quick Start

1. Start the dev server: `npx expo start`
2. Press **j** to open **React Native DevTools**
3. Use the **Sources** tab to set breakpoints and step through code

React Native DevTools requires **Hermes** (default since SDK 49) and works with Expo Go and dev clients.

## React Native DevTools

Open by pressing **j** in the Expo CLI terminal.

### Sources — Breakpoints & Stepping

- Click a **line number** in the Sources tab to add a breakpoint
- Or add `debugger;` statements directly in your code
- When paused, inspect variables and functions in scope
- Step through code with standard controls (step over, step into, step out, continue)
- Use the Console while paused to evaluate expressions in the current scope

```tsx
function handlePress() {
  debugger; // App pauses here when DevTools is connected
  const result = computeValue();
  console.log(result);
}
```

### Pause on Exceptions

- Enable **Pause on exceptions** in the right panel of the Sources tab
- Toggle **Pause on caught exceptions** to catch errors handled by try/catch or error boundaries

### Console

- Execute JavaScript as if it were part of your app
- When paused at a breakpoint, runs in that breakpoint's scope

### Other Tabs

- **Network** (Expo only): inspect `fetch` requests and responses
- **Memory**: heap snapshots to diagnose memory leaks
- **Components**: inspect the React component tree, props, and styles
- **Profiler**: record and analyze JS performance (debug builds only)

## Developer Menu

Open with **m** in the Expo CLI terminal (or **Ctrl + Cmd + Z** / **Cmd + D** on iOS Simulator, **Cmd + M** on Android Emulator). Provides performance monitor, element inspector, Fast Refresh toggle, and reload.

## Errors and Warnings

- **Redbox**: fatal error — unhandled exceptions or `console.error()`
- **Yellowbox**: warning — `console.warn()`
- Always read the **file name** and **line number** in the stack trace first

## Debugging Strategies

1. **Search first**: error message on Google, Stack Overflow, [Expo forums](https://chat.expo.dev/)
2. **Isolate**: revert to working state, apply changes piece by piece until it breaks
3. **Simplify**: remove libraries (state management, navigation) to narrow down the source
4. **Use breakpoints**: prefer over `console.log` — inspect the full scope
5. **Minimal repro**: extract failing code into a blank `npx create-expo-app` project

## Production Debugging

- Test production mode locally: `npx expo start --no-dev --minify`
- Use [Sentry](https://docs.expo.dev/guides/using-sentry) or [BugSnag](https://docs.expo.dev/guides/using-bugsnag) for crash reporting
- For native crashes, check logs with `adb logcat` (Android) or Xcode Console (iOS)
