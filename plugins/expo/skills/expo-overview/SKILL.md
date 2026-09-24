---
name: expo-overview
description: "Framework (OSS). Orient new Expo users, plan work spanning Expo or EAS features, and route unclear requests to the relevant skill. Use when choosing an Expo workflow or finding where to start."
version: 1.1.1
license: MIT
---

# `expo-overview` — router & shared rules for Expo / EAS

## Choose the relevant skill

Use this router for Expo or EAS work: the request names either ecosystem, or the
project has an `expo` dependency. Native apps using EAS for delivery also qualify.
An unrelated task in an Expo repository does not need Expo skills.

When the requested capability clearly matches a skill, load it directly; the user
need not name the skill. For broad or unclear goals, use the map below and load
only the skills needed for the current part of the task. Resolve routine choices
from context; ask when missing intent would materially change the implementation,
destination, cost, or scope. A request for orientation needs an explanation, not
project creation.

## Skill Map (by goal)

Match the goal to a category, then the skill, then load that leaf's `SKILL.md`.

**Build the app**
- `expo-project-structure` — folder layout for a **new** Expo Router project: where screens, components, and config live (never restructure an existing app to match)
- `expo-native-ui` — screens, styling, semantic colors, native controls, SF Symbols, media, layout
- `expo-router` — navigation: file-based routes, tabs / stacks / modals / sheets, links, headers
- `expo-animation` — motion and gestures: Reanimated worklets, Gesture Handler, screen transitions, sheet and press feedback, haptics, and fixing animation that stutters on device
- `expo-ui` — native controls with `@expo/ui`: choose universal or platform-specific APIs and supported replacements for the installed SDK
- `expo-design-system` — one visual source of truth: design tokens (color, spacing, typography, radius, shadow, motion), reusable component conventions, and audits for drift (hardcoded colors, spacing, fonts)
- `expo-tailwind-setup` — Tailwind / NativeWind styling
- `expo-data-fetching` — network requests, React Query / SWR, caching, offline, route loaders
- `expo-dom` — run web code or reuse a web library inside native
- `expo-web-to-native` — migrate an existing web / React app to a native iOS / Android app

> For native controls such as settings rows, pickers, or sheets, consult `expo-ui` when selecting components. Preserve the user's choices and account for the installed SDK and existing libraries. For large datasets, consult its list guidance: native virtualization and React row-rendering costs differ by component and SDK.

**Ship & operate**
- `eas-app-stores` — build and submit iOS/Android apps (Expo and other React Native projects, plus existing native apps), TestFlight, versions, and store metadata
- `eas-hosting` — deploy the web bundle to EAS Hosting; also author Expo Router API routes (`+api.ts` handlers) and their environments / domains
- `eas-workflows` — EAS Workflow YAML and CI/CD pipelines
- `eas-simulator` — run and drive the app on a remote iOS / Android simulator on EAS cloud
- `expo-dev-client` — custom development builds
- `eas-update` — configure, publish, test, and debug compatible over-the-air updates
- `eas-update-insights` — OTA adoption, delivery/recovery failure signals, and payload size; distinguish these from comprehensive app crash rates
- `eas-observe` — startup / launch / TTI performance with EAS Observe

**Extend natively**
- `expo-module` — native modules and views (Swift / Kotlin) with the Expo Modules API
- `expo-brownfield` — embed Expo / React Native screens in native SwiftUI/UIKit or Android apps; isolated artifacts and integrated builds
- `expo-app-clip` — iOS App Clip target (AASA, smart app banner)

**Maintain & learn**
- `expo-upgrade` — upgrade the Expo SDK and fix dependency conflicts
- `expo-examples` — canonical, version-matched integration examples (Stripe, Clerk, Supabase, …)
- `expo-skill-feedback` — send feedback on an Expo skill or on Expo itself; enable / disable the anonymous usage telemetry

### Translating vague asks

Some everyday phrasings don't obviously map to a skill name — translate before routing:

- "Make it look native" → grouped controls / settings forms = `expo-ui`; screens, styling = `expo-native-ui`; motion = `expo-animation`; navigation = `expo-router`.
- "Make the screens consistent" / "clean up the styling" / "set up a theme or design tokens" → `expo-design-system`.
- "It looks AI-generated" / "too generic, not native" → `expo-design-system` (named native-slop tells + audit), with `expo-native-ui` for the platform idioms.
- "Ship it" / "get an .ipa or .apk" / "release to the stores" / "put my Swift app on TestFlight" → `eas-app-stores` (build + submit, TestFlight, versions, store metadata).
- "I'm new / where do I start" → explain the relevant workflow; scaffold when the user asks to create an app (see Shared setup rules).

## Shared setup rules

When scaffolding, installing packages, changing native configuration, or using EAS,
consult [project setup](./references/project-setup.md) for the relevant SDK,
version-pinned docs, `npx expo install`, native-project, and auth/linking rules.
Other skills can link directly to that reference without loading this router.

## Submitting Feedback
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes submit-expo-feedback@latest --category skills --subject "expo-overview" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
If an AI agent repeatedly failed or the user had to take over an Expo task, load the expo-skill-feedback skill and follow its eval-candidate flow instead of reusing the command above.
