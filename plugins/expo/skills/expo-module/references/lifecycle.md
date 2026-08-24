# Lifecycle Hooks: Constraints

Three hook surfaces exist: hooks inside the module definition (`OnCreate`, `OnDestroy`, app foreground/background, Android activity events), iOS AppDelegate subscribers, and Android lifecycle listeners.

> **Source of truth:** https://docs.expo.dev/modules/module-api/ — consult the canonical docs when API details matter; module-definition lifecycle hooks are enumerated there. For hooks outside the module definition: https://docs.expo.dev/modules/appdelegate-subscribers/ (iOS) and https://docs.expo.dev/modules/android-lifecycle-listeners/ (Android).

## Constraints the docs don't spell out

- Prefer `OnCreate` in the module definition over class initializers for setup.
- iOS AppDelegate subscribers only fire if the app's `AppDelegate` extends `ExpoAppDelegate` (the default in Expo-generated projects). Register the subscriber class in `expo-module.config.json` under `apple.appDelegateSubscribers`.
- Subscriber result aggregation: `didFinishLaunchingWithOptions` returns `true` if **any** subscriber returns `true`; `didReceiveRemoteNotification` results merge with priority `failed` > `newData` > `noData`.
- Android listeners are registered from a `Package` class (`createReactActivityLifecycleListeners` / `createApplicationLifecycleListeners`), not from the module definition.
- `ReactActivityLifecycleListener` supports only `onCreate`, `onResume`, `onPause`, `onDestroy`, `onNewIntent`, `onBackPressed`. `onStart` and `onStop` are **not supported** — the implementation hooks into `ReactActivityDelegate`, which lacks those methods.
- `ApplicationLifecycleListener` supports only `onCreate` and `onConfigurationChanged`.
