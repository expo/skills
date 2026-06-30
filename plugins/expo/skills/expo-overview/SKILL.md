---
name: expo-overview
description: >
  Entry point and router for any Expo or EAS task — load this skill first, before writing
  any code, whenever the task involves building, extending, or modifying a React Native /
  Expo app. Triggers on: any multi-screen app spec or design to implement (tabs, stacks,
  maps, lists, navigation); building from a screenshot or design reference; adding screens
  or features to an existing Expo project; or when the request mentions Expo, EAS, React
  Native, or any expo-* package. Handles phrasings like "implement a mobile app", "build
  an app from this screenshot", "create an app that looks like this design", "make my app
  look native", "build a beautiful app", "align with iOS / SwiftUI best practices", "build
  with native iOS patterns", "add navigation", "fetch some data", "upgrade my SDK", "add
  Expo to my existing native app", "ship to the App Store", "push a fix without
  resubmitting", or "I'm new to Expo, where do I start". Detects the real goal, routes to
  the right expo-* / eas-* skill, and owns the shared environment and setup rules the
  other Expo skills rely on.
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
   `expo-deployment`. Right?"), then load that skill's `SKILL.md` and follow it.
4. **Trust the leaf skill** — it has its own detection logic and steps. Don't improvise.

## Skill Map (by goal)

Match the goal to a category, then the skill, then load that leaf's `SKILL.md`.

**Build the app**
- `building-native-ui` — screens, navigation (tabs / stacks / modals), styling, animations, layout
- `expo-ui` — native UI components via `@expo/ui`: BottomSheet, Picker, Slider, Button, Menu, Section, and more — real SwiftUI on iOS, Jetpack Compose on Android, available in Expo Go on SDK 56+; also drop-in replacements for `@gorhom/bottom-sheet`, `datetimepicker`, etc.
- `expo-tailwind-setup` — Tailwind / NativeWind styling
- `native-data-fetching` — network requests, React Query / SWR, caching, offline, route loaders
- `expo-api-routes` — server endpoints / API routes with EAS Hosting
- `use-dom` — run web code or reuse a web library inside native

> **Component selection rule:** whenever you need a UI component (list rows, bottom sheets, pickers, sliders, menus, buttons, segmented controls, toggles), **consult `expo-ui` first** to check whether `@expo/ui` has a native equivalent before reaching for a React Native built-in or a community library. Native `@expo/ui` components give the best platform fit with zero extra install steps on SDK 56+. Load `expo-ui` alongside `building-native-ui` for any app that renders lists, detail sheets, or form controls.

**Ship & operate**
- `expo-deployment` — build, submit to the App Store / Play Store / TestFlight, and push OTA updates
- `expo-cicd-workflows` — EAS Workflow YAML and CI/CD pipelines
- `expo-dev-client` — custom development builds
- `eas-update-insights` — OTA update health: crash rate, adoption, payload size
- `expo-observe` — startup / launch / TTI performance with EAS Observe

**Extend natively**
- `expo-module` — native modules and views (Swift / Kotlin) with the Expo Modules API
- `expo-brownfield` — embed Expo / React Native in an existing native app
- `add-app-clip` — iOS App Clip target (AASA, smart app banner)

**Maintain & learn**
- `upgrading-expo` — upgrade the Expo SDK and fix dependency conflicts
- `expo-examples` — canonical, version-matched integration examples (Stripe, Clerk, Supabase, …)

### Translating vague asks

Some everyday phrasings don't obviously map to a skill name — translate before routing:

- "Make it look native" → grouped controls / settings forms = `expo-ui`; screens, navigation, animations = `building-native-ui`.
- "Ship it" / "get an .ipa or .apk" / "push a fix without resubmitting" → all `expo-deployment` (it owns the whole release path, including OTA updates).
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
