---
name: expo-observe-metrics
description: Reference for interpreting EAS Observe app-startup metrics — cold launch, warm launch, bundle load, time to first render, and time to interactive (TTI). Explains what each metric measures, target thresholds (e.g. cold launch under 1.5s, TTI under 3s), common causes of poor values, optimization recommendations, and how to read the TTI frameRate params (slowFrames, frozenFrames, totalDelay) to distinguish slow-but-smooth startup from main-thread contention or hard blocks.
version: 1.0.0
license: MIT
---


# Metrics documentation

### Cold launch time

**What it measures**: Time from process creation to when the system finished allocating memory, starting a fresh runtime environment, loading the app's code and resources from disk, and initializing its components before rendering the UI. This is the slowest type of launch and typically occurs after a fresh install, reboot, or when the OS has killed the app to reclaim memory. It is a native-only metric, meaning that your JavaScript code does not affect this metric, but the React Native runtime initialization is included.

**How to improve**:

- Remove unused native modules
- Avoid static initializers (`+load` methods in Objective-C, static constructors in C++), and native modules or config plugins that add them
- Keep the app’s memory and CPU usage low, so the OS does not have to kill the process while the app is in background – it does not have an impact on this metric itself, but makes subsequent launches warm instead of cold
- If using `expo-updates` with a non-zero `fallbackToCacheTimeout`, the app launch will be blocked waiting for an update check. Keep this value at `0` (default) or set `checkOnLaunch` to `NEVER` / `ERROR_RECOVERY_ONLY` to avoid delaying cold launches

**Our recommendation**: under 1.5s

### Warm launch time

**What it measures**: As opposed to the cold launch, the app process already existed. The OS just brings it to the foreground and recreates the view hierarchy. Most native resources and services necessary for the app are already in memory, so this type of launch is significantly faster.

Warm launch is largely out of the developer's hands — it is the OS restoring state for a process that is already in memory.

**How to improve**:

- Remove unused native modules
- Reduce the number of views in the view hierarchy — the OS has to recreate the view tree on warm launch; a deeply nested or bloated tree takes longer to restore

**Our recommendation**: under 0.5s

### Bundle load time

**What it measures**: Duration of loading the JavaScript bytecode and evaluating it. This starts by loading the bundle and ends when the bundle is finished evaluating, before [`runApplication`](https://reactnative.dev/docs/appregistry#runapplication) is called.

**How to improve**:

- Reduce the bundle size
    - Use tree-shaking (enabled by default as of Expo SDK 54) and adhere to the rules that help the Metro bundler to strip out unnecessary code (see [Tree shaking and code removal](https://docs.expo.dev/guides/tree-shaking/))
    - Analyze your JavaScript bundle to remove unused and big dependencies (see [Analyzing JavaScript bundles with Expo Atlas](https://docs.expo.dev/guides/analyzing-bundles/))
- Lazy-load large screens and components with `React.lazy()` (see [Optimize JavaScript loading](https://reactnative.dev/docs/optimizing-javascript-loading))
- Avoid blocking the JavaScript thread in the top-level scope
    - Don’t do heavy computations
    - Defer any synchronous I/O operations (storage reads and writes)

**Our recommendation**: under 0.3s

### Time to first render

**What it measures**: Time from when the app finishes native launching to when the root React component first renders on the screen. Wrap your root component with `AppMetricsRoot` to measure this automatically. This is the moment the actual content is rendered by React, after the splash screen is hidden. The goal for every app should be to show something meaningful as fast as possible — even if it’s a skeleton loading screen.

**How to improve**:

- Reduce bundle load time (see above)
- Avoid synchronous I/O operations (storage reads and writes)
- Avoid blocking on network requests
- Keep the initial render tree small (defer heavy components)
- Use a lightweight screen as the initial route
- Minimize `useEffect` and `useLayoutEffect` chains that block rendering

**Our recommendation**: under 2s including the cold launch time

### Time to interactive

**What it measures**: Time between the warm/cold launch and when the user can actually tap, scroll, and interact with the app in other ways. It's the most important startup metric because it is what users perceive as "the app is ready". This metric is not reported automatically. To start measuring it, call `AppMetrics.markInteractive()` once the screen is ready for user's interactions — for example, in a `useEffect` that runs after your initial data has loaded. If your app uses deep links, the main screen may not always be the initial screen, so we recommend calling this function in other screens too. Note that only the first call per launch is recorded, so it is safe to call it multiple times (e.g. when the user navigates between screens). If you use `expo-router`, metric’s event automatically includes the current route name.

**What makes an app “interactive”?**

All of these must be true:

- Content is rendered on the screen (not just a splash/skeleton)
- Touch handlers are attached and responsive
- Navigation is functional

**How to improve measurement accuracy:**

Call `AppMetrics.markInteractive()` only after the screen's content is loaded and touch handlers are active — not just on component mount. If your screen fetches data before becoming usable, place the call after the data is ready.

**How to improve**:

- Reduce time to first render (see above)
- Avoid waterfall data fetches before showing interactive content
- Optimize initial network requests
- Avoid rendering large lists (use FlashList or LegendList)
- Reduce heavy work that may block the JavaScript thread and interactions (I/O operations, state hydration, JSON parsing)
- If possible, show cached/local data first

**Extra params**:

Each event of the TTI metrics provides some extra params to help triage the issue.

- **frameRate.slowFrames** (count) — Frames that took ≥17ms to render. If this is high relative to the startup duration, the main thread was consistently busy during launch. Points to heavy layout work, synchronous bridge calls, or too many components rendering at once.
- **frameRate.frozenFrames** (count) — Frames that took ≥700ms to render. These are hard freezes where the app visibly hung. Even one during startup is a serious issue. Usually caused by synchronous I/O, large JSON parsing, or blocking network calls on the main thread.
- **frameRate.totalDelay** (seconds) — Total accumulated time all frames exceeded their target duration. This is the single best "smoothness" number. Compare it to TTI: if TTI is 2.5s and **totalDelay** is 0.1s, startup was slow but smooth (the time was spent on legitimate work). If **totalDelay** is 1.5s, the app was janky for most of the startup — the user was staring at a stuttering screen.
    
    **How to interpret them**:
    
    - High TTI + low total delay → startup is slow but smooth. Optimize what's blocking the launch sequence (bundle size, data fetching, initialization chains)
    - High TTI + high total delay + many slow frames → main thread contention. Offload work, simplify the initial render tree
    - High TTI + high delay + frozen frames → something is blocking hard. Look for synchronous I/O, large JSON parsing, or blocking API calls

**Our recommendation**: below 3 seconds including the cold launch time
