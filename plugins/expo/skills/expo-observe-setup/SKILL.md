---
name: expo-observe-setup
description: Use when adding EAS Observe and the `expo-observe` library (AppMetricsRoot, AppMetrics) to an existing Expo project to collect production app-startup performance metrics — covers prerequisites (private preview access, SDK 55+, EAS project), installation, wrapping the root layout with AppMetricsRoot, and calling AppMetrics.markInteractive() to record Time to Interactive (TTI). Examples for both Expo Router and non-router apps.
version: 1.0.0
license: MIT
---

# Set up Expo Observe in an existing project

EAS Observe collects app-startup performance metrics (cold launch, warm launch, bundle load, TTR, TTI) from production Expo apps. This skill summarizes the steps to add `expo-observe` to an existing project.

> Source: https://docs.expo.dev/eas/observe/get-started/ — consult this page for the latest guidance, since Expo Observe is in preview and may change.

## Prerequisites

Before installing, confirm all of the following:

1. **Access to the Expo Observe preview.** Expo Observe is in Private Preview; access is granted on request via the [Expo Observe announcement](https://expo.dev/changelog/introducing-expo-observe).
2. **An Expo account.** Sign up at [expo.dev/signup](https://expo.dev/signup) if needed.
3. **Expo SDK 55 or later.** Run `npx expo-doctor` to check, and `npx expo install --fix` to update dependencies.
4. **An EAS project.** The app must have `extra.eas.projectId` set in its app config. If not, run `eas init` to create one.

## Step 1 — Install the library

From the project root:

```sh
npx expo install --fix
npx expo install expo-observe
```

`expo-observe` exports the `AppMetricsRoot` HOC and the `AppMetrics` API used in the next steps.

## Step 2 — Wrap the root layout with `AppMetricsRoot`

`AppMetricsRoot.wrap()` automatically measures **Time to First Render (TTR)**. Apply it to the file that exports the app's root component.

**With Expo Router** (`app/_layout.tsx`):

```tsx
import { Stack } from 'expo-router';
import { AppMetricsRoot } from 'expo-observe';

function RootLayout() {
  return <Stack />;
}

export default AppMetricsRoot.wrap(RootLayout);
```

**Without Expo Router** (`App.tsx`): wrap the default-exported `App` component the same way — `export default AppMetricsRoot.wrap(App);`.

## Step 3 — Call `AppMetrics.markInteractive()`

TTI is **not** collected automatically. Call `AppMetrics.markInteractive()` after the screen is genuinely ready for the user — i.e. after splash-screen-blocking work like update checks, authentication, initial data fetching, or splash animations finishes. Place the call in a `useEffect` that runs once that work resolves.

**With Expo Router:**

```tsx
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { AppMetrics, AppMetricsRoot } from 'expo-observe';
import { useEffect, useState } from 'react';

SplashScreen.preventAutoHideAsync();

function RootLayout() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        await authenticateUser();
        await fetchInitialData();
      } catch (e) {
        console.warn(e);
      } finally {
        setIsReady(true);
      }
    }
    prepare();
  }, []);

  useEffect(() => {
    if (isReady) {
      SplashScreen.hide();
      AppMetrics.markInteractive();
    }
  }, [isReady]);

  if (!isReady) return null;
  return <Stack />;
}

export default AppMetricsRoot.wrap(RootLayout);
```

**Without Expo Router:** the structure is the same in `App.tsx`. Use `SplashScreen.hideAsync()` instead of `SplashScreen.hide()` and replace `<Stack />` with the app's root tree.

### Multiple entry screens

`markInteractive()` is safe to call repeatedly — only the **first** call per session is recorded. If the app has more than one entry screen (onboarding, login, deep-link targets), call `markInteractive()` on **each one**. Otherwise TTI will be missing for sessions that open via a deep link to a screen without the call.

## Step 4 — Build the app

Metrics are collected from real builds, not from `expo start`:

```sh
eas build
```

> By default, metrics are not dispatched when `NODE_ENV=development`. To exercise the integration locally, see [Enable metrics in development](https://docs.expo.dev/eas/observe/configuration/#enable-metrics-in-development) (set `enableInDebug: true` in the app config).

## Step 5 — View the metrics

Open the **Observe** tab in the EAS dashboard at `https://expo.dev/accounts/[account]/projects/[project]/observe` to view metrics from the app.

To query metrics from the terminal with the EAS CLI, see the `expo-observe-queries` skill. For interpreting the metrics themselves, see `expo-observe-metrics`.

## Quick checklist

- [ ] Preview access granted, SDK ≥ 55, EAS project linked.
- [ ] `expo-observe` installed via `npx expo install`.
- [ ] Root component exported through `AppMetricsRoot.wrap(...)`.
- [ ] `AppMetrics.markInteractive()` called from every entry screen once it is genuinely interactive.
- [ ] New build produced with `eas build` and metrics visible in the Observe dashboard.
