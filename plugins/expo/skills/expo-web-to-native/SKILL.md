---
name: expo-web-to-native
description: "Framework (OSS). Migrate an existing web React app to native iOS or Android with Expo, screen by screen. Use for porting a Next.js, Vite, or CRA app; use expo-dom for embedding an individual web component."
version: 1.0.1
license: MIT
---

# Web to Native

Migrate web React screens incrementally into an Expo app, preserving their content
and behavior while adapting native navigation and interactions. Reuse an existing
Expo shell; DOM components can bridge web screens during a larger migration.
This guide draws on Expo's [From Web to Native with React](https://expo.dev/blog/from-web-to-native-with-react).

## Principles

- **Migrate incrementally.** Keep working routes usable while migrating the selected scope.
- **Use a DOM shell when it helps.** It can make a large migration runnable early. A small native rewrite or an existing shell can go directly to the selected screens; follow the user's chosen approach.
- **Prioritize by value.** Nativize the selected high-value screens first; record retained web or hybrid screens explicitly in the worklist.
- **Adapt interactions deliberately.** Preserve content and brand while choosing navigation, controls, layout, and touch behavior suited to the target platforms. Use the [native pattern guide](./references/native-patterns.md) for those decisions; a migration does not require making every screen resemble an OS app.
- **Verify runtime behavior.** Run the affected screens and compare their content and behavior with the web original. A clean bundle alone does not establish that a screen works.
- **Load guidance as needed.** Use the relevant Expo skill for each part of the work; consult [`./references/false-friends.md`](./references/false-friends.md) for web-to-native idiom mappings.

## Scope and completion

Use the requested scope: a whole app, a subset of routes, or a migration plan.
For implementation, keep `migration-progress.md` with the selected routes,
prerequisites, and verification status. Continue through setup, implementation,
and verification for those routes. A planning request ends with the plan.

A goal loop is optional, only when requested and supported by the harness; see
[run as a goal](./references/run-as-goal.md). Otherwise work directly from the
worklist. Reuse context already read, loading references for the current step or
when recovering missing context. Do not require the user to launch a loop to
continue authorized work.

Before scaffolding or installing dependencies, consult the relevant
[project setup rules](../expo-overview/references/project-setup.md).

## The migration

> **No repo to migrate** - just building native fresh as a web dev? You don't need these steps: use `expo-router`, and keep [`./references/false-friends.md`](./references/false-friends.md) open for the web→native idiom map. Everything below assumes an existing web app.

### 1. Assess → write the worklist

Inspect the relevant routes and record their migration work in `migration-progress.md`. Reuse an existing worklist. Make two cuts:

- **Screens vs backend.** Page routes (`page.tsx`) are screens you migrate; server routes (`route.ts`), the ORM, and auth handlers stay server-side. Decide the backend once: keep it deployed (the native app becomes an HTTP client) or move it to EAS Hosting (`eas-hosting`).
- **Bucket each screen** by how it should land: **port-as-is** (presentational → ships in a DOM webview), **nativize-now** (hot, or needs native feel — gestures, lists, keyboard), **nativize-later**, or **hybrid** (a native shell around a web sub-tree, e.g. a chat list wrapping a markdown renderer).

Inspect framework boundaries: server-only rendering/data access, browser libraries, styling, and auth. Keep server work on the backend and expose the data needed by native screens. Check third-party native integrations, especially purchase flows whose requirements depend on store rules and product/region. See the relevant rows in [false friends](./references/false-friends.md). Classify the requested routes and shared dependencies before implementing them.

### 2. Scaffold the shell

If a native shell is needed, use `npx create-expo-app@latest`, then map the selected web routes in Expo Router — Next's tree maps almost 1:1 (note `[id]/page.tsx` → `[id].tsx`, and routes may live in `src/app/`). Reuse an existing Expo shell and its route layout when present.

### 3. Add DOM components where selected

For routes assigned to the DOM-shell approach, bring each screen over as a DOM component (`'use dom'`, per the `expo-dom` skill) rendered by its native route, so those screens can run on a phone while migration continues. Expect per-screen edits - unwrapping Server Components, swapping framework imports (`next/link`), carrying the styling over - all covered in false-friends. Then verify those routes by running them (below).

### 4. Implement selected native screens

Work through the selected native screens using the app's existing visual system and supported components. Use `expo-ui` when selecting SwiftUI/Compose controls, `expo-router` for navigation, and [native patterns](./references/native-patterns.md) for interaction choices. Preserve working libraries and check the installed SDK's availability; a development build is needed for native dependencies/configuration absent from the current binary, not only custom modules. Verify content and behavior against the web original and record the result. Keep the app runnable while completing the selected worklist.

### 5. Wire data, auth, and storage

Check relative fetches, cookie sessions, `localStorage`, and environment variables for native compatibility (swaps in false-friends). Wire these dependencies as each selected screen needs them. Use `expo-data-fetching` for requests and caching; add `eas-hosting` if the backend moved to EAS Hosting.

### 6. Distribute when requested

When distribution is part of the request, use `eas-app-stores` for store builds (App Store / Play / TestFlight), or `eas-update` for compatible OTA updates. Migration alone does not authorize publishing or a paid remote build.

## Verify by running, not compiling

A successful export checks bundling; a screen may still render blank or behave
incorrectly. Run the selected routes on native and compare them with the web
original using equivalent data and navigation parameters. Check content and
behavior, adapting the layout and interactions to native conventions. For a DOM
shell, also check that the web UI renders correctly inside its native container.

Use available browser and device tools. `agent-browser` and `argent` are examples,
not prerequisites; equivalent browser automation, `agent-device`, `simctl`, `adb`,
or manual on-device evidence can support the check. Screenshots support visual
checks; exercise interactions, and use recordings when assessing motion.
See [verification on device](./references/verify-on-device.md) for a concrete recipe.

Finish when the selected routes and required data/auth/storage integration are
implemented and verified, with failures caused by the migration fixed. If a
backend, credential, or device prevents a check, record what is unverified and
what would unblock it, then continue independent work. Blocked items remain
incomplete; report them explicitly when no further independent work is possible.

## References

- [`./references/false-friends.md`](./references/false-friends.md) — web idiom → native equivalent + the gotcha for each. The lookup for steps 3–5, and for any web dev unlearning idioms.
- [`./references/native-patterns.md`](./references/native-patterns.md) — web UX patterns and native interaction decisions for step 4.
- [`./references/verify-on-device.md`](./references/verify-on-device.md) — a web/native parity recipe with browser and device tooling alternatives.
- [`./references/run-as-goal.md`](./references/run-as-goal.md) — an optional goal objective for a requested, supported migration loop.
- [Expo — From Web to Native with React](https://expo.dev/blog/from-web-to-native-with-react) — the canonical guide this skill operationalizes.

## Submitting Feedback
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes submit-expo-feedback@latest --category skills --subject "expo-web-to-native" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
If an AI agent repeatedly failed or the user had to take over an Expo task, load the expo-skill-feedback skill and follow its eval-candidate flow instead of reusing the command above.
