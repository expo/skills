---
name: expo-overview
description: "Framework (OSS). Entry point and router for any Expo or EAS task — load this skill first, before writing any code, whenever the task involves building, extending, or modifying a React Native / Expo app. Triggers on: any multi-screen app spec or design to implement (tabs, stacks, maps, lists, navigation); building from a screenshot or design reference; adding screens or features to an existing Expo project; or when the request mentions Expo, EAS, React Native, or any expo-* package. Handles phrasings like 'implement a mobile app', 'build an app from this screenshot', 'make my app look native', 'build a beautiful app', 'align with iOS / SwiftUI best practices', 'add navigation', 'fetch some data', 'upgrade my SDK', 'add Expo to my existing native app', 'ship to the App Store', or 'I'm new to Expo, where do I start'. Detects the real goal, routes to the right expo-* / eas-* skill, and owns the shared environment and setup rules the other Expo skills rely on."
version: 1.0.0
license: MIT
---

# `expo-overview` — router & shared rules for Expo / EAS

## Start Here — read before doing anything

**Do not guess the skill from project files alone.** Many Expo goals look similar from
the filesystem but need different skills.

1. **Read the user's goal** — what outcome do they want, in plain terms?
2. **Classify it** using the Skill Map below, translating casual phrasing to a goal.
3. **Confirm intent** if ambiguous ("Sounds like you want to ship to the stores — that's
   `eas-app-stores`. Right?"), then load that skill's `SKILL.md` and follow it.
4. **Trust the leaf skill** — it has its own detection logic and steps. Don't improvise.

## Skill Map (by goal)

Match the goal to a category, then the skill, then load that leaf's `SKILL.md`.

**Build the app**
- `expo-native-ui` — screens, styling, semantic colors, native controls, SF Symbols, media, animations, layout
- `expo-router` — navigation: file-based routes, tabs / stacks / modals / sheets, links, headers
- `expo-ui` — native UI components via `@expo/ui`: BottomSheet, Picker, Slider, Button, Menu, Section, and more — real SwiftUI on iOS, Jetpack Compose on Android, available in Expo Go on SDK 56+; also drop-in replacements for `@gorhom/bottom-sheet`, `datetimepicker`, etc.
- `expo-tailwind-setup` — Tailwind / NativeWind styling
- `expo-data-fetching` — network requests, React Query / SWR, caching, offline, route loaders
- `expo-dom` — run web code or reuse a web library inside native
- `expo-web-to-native` — migrate an existing web / React app to a native iOS / Android app

> **Component selection rule:** whenever you need a UI component (list rows, bottom sheets, pickers, sliders, menus, buttons, segmented controls, toggles), **consult `expo-ui` first** to check whether `@expo/ui` has a native equivalent before reaching for a React Native built-in or a community library. Native `@expo/ui` components give the best platform fit with zero extra install steps on SDK 56+. Load `expo-ui` alongside `expo-native-ui` for any app that renders lists, detail sheets, or form controls.

**Ship & operate**
- `eas-app-stores` — build and submit to the App Store / Play Store / TestFlight, versions, and store metadata
- `eas-hosting` — deploy the web bundle and Expo Router API routes to EAS Hosting
- `eas-workflows` — EAS Workflow YAML and CI/CD pipelines
- `eas-simulator` — run and drive the app on a remote iOS / Android simulator on EAS cloud
- `expo-dev-client` — custom development builds
- `eas-update-insights` — OTA update health: crash rate, adoption, payload size
- `eas-observe` — startup / launch / TTI performance with EAS Observe

**Extend natively**
- `expo-module` — native modules and views (Swift / Kotlin) with the Expo Modules API
- `expo-brownfield` — embed Expo / React Native in an existing native app
- `expo-app-clip` — iOS App Clip target (AASA, smart app banner)

**Maintain & learn**
- `expo-upgrade` — upgrade the Expo SDK and fix dependency conflicts
- `expo-examples` — canonical, version-matched integration examples (Stripe, Clerk, Supabase, …)

### Translating vague asks

Some everyday phrasings don't obviously map to a skill name — translate before routing:

- "Make it look native" → grouped controls / settings forms = `expo-ui`; screens, styling, animations = `expo-native-ui`; navigation = `expo-router`.
- "Ship it" / "get an .ipa or .apk" / "release to the stores" → `eas-app-stores` (build + submit, TestFlight, versions, store metadata).
- "I'm new / where do I start" → scaffold first (see First Run), then route by goal.

## First Run / shared rules

These apply across every Expo skill, so handle them here once instead of repeating them
in each leaf.

- **No Expo project yet?** Start one the standard way before routing to a feature skill:
  `npx create-expo-app@latest`. Then classify the user's goal and route.
- **Detect the SDK version** before giving version-specific advice: read the `expo`
  version in `package.json` (and `app.json` / `app.config.{js,ts}`). Many APIs and
  defaults differ by SDK.
- **Managed vs. bare/prebuild**: the presence of committed `ios/` and `android/`
  directories means native projects exist (prebuild or bare). Config-plugin and
  native-setup steps differ — note which one the project is in.
- **Install packages with `npx expo install <pkg>`**, not raw `npm`/`yarn`/`pnpm add`,
  so versions stay compatible with the project's SDK.
- **EAS auth & linking** (only needed for build/submit/update/observe/workflows): check
  login with `eas whoami`, log in with `eas login`. A project is linked when
  `extra.eas.projectId` exists in the app config; create it with `eas init` if missing.

## When NOT to use this skill

- The user already named a specific Expo workflow or tool → go straight to that skill.
- A more specific `expo-*` / `eas-*` skill obviously fits the request → use it and skip
  the router hop.
