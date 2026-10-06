---
name: expo-web-to-native
description: Migrate an existing web React app to a native iOS/Android app with Expo. Use when the user wants to turn a website into a mobile app, port a Next.js/Vite/CRA React codebase to React Native, reuse web code on native incrementally, or asks how web idioms (the DOM, CSS, React Router, localStorage, window) map to native. This is the end-to-end migration guide; use the `expo-dom` skill for the DOM-component mechanism itself.
version: 1.0.0
license: MIT
---

# Web to Native

A web React app does not *convert* to native — there is no transpiler. It **migrates**, screen by screen, the way a strangler fig grows around a tree and slowly replaces it: stand up a native shell, run the whole web UI inside it on day one, then strangle each screen into native in priority order. This skill is the spine that orders the work; each step hands off to an existing Expo skill rather than re-explaining it. It operationalizes Expo's [From Web to Native with React](https://expo.dev/blog/from-web-to-native-with-react) — read that for the why.

```mermaid
flowchart TD
    A1[1 · Assess: write the worklist] --> A2[2 · Scaffold Expo shell]
    A2 --> A3[3 · DOM-component shell<br/>· expo-dom · SHIP DAY ONE]
    A3 --> A4[4 · Strangle screens to native<br/>highest-value first · expo-router]
    A4 -->|more screens| A4
    A4 --> A5[5 · Wire data / auth / storage<br/>· expo-data-fetching]
    A5 --> A6[6 · Ship · eas-app-stores]
```

## Principles

- **Migrate, don't rewrite.** Never big-bang it; every step keeps the app shippable.
- **Keep an early runnable milestone.** For a whole-app incremental migration, a DOM-component shell (step 3) brings up the web UI early. For a requested native screen, implement that screen directly when appropriate.
- **Strangle by value.** Nativize the hot screens; leave the rest in the webview. Each DOM screen carries a ~2 MB web runtime — reason enough not to ship everything as DOM.
- **Nativize means redesign, not reskin.** A strangled screen should look like Apple/Google shipped it, not the web page reskinned. **Reach for `@expo/ui` first** - it renders real SwiftUI/Compose, so it feels *exactly* like the OS; styled RN primitives are the fallback for custom layouts only. Plus platform navigation (`expo-router`: NativeTabs, large titles), liquid glass and native components via `@expo/ui`, and mobile UX (sheets, swipe, haptics). The web→native pattern map is [`./references/native-patterns.md`](./references/native-patterns.md). If it still feels like a website, you ported instead of redesigned.
- **Verify by running, not compiling.** A clean build proves nothing (a blank webview compiles fine). Run each screen — but judge *content and behavior* against the web original, not pixels (a nativized screen should look more native, not identical).
- **Orchestrate, don't reinvent.** Each step routes into an existing skill. The value here is the *order* and the *gotchas* — the idiom-by-idiom mappings live in [`./references/false-friends.md`](./references/false-friends.md).

## Track progress; use a goal loop only when requested

Use `migration-progress.md` to track the requested screens during the current task. A migration request alone does not request a persistent goal, recurring task, or unattended execution. If the user explicitly asks for a supported goal loop, adapt [`./references/run-as-goal.md`](./references/run-as-goal.md) to their scope and budget. Honor later corrections, cancellation, and the host's execution limits; the skill does not supply authorization for extra work.

## The migration

Apply these steps to the requested screens. For a single-screen task, inspect only the routes and dependencies needed for that screen, reuse an existing native shell, and leave other screens and the backend in place. The whole-app examples below do not expand that scope.

> **No repo to migrate** - just building native fresh as a web dev? You don't need these steps: use `expo-router`, and keep [`./references/false-friends.md`](./references/false-friends.md) open for the web→native idiom map. Everything below assumes an existing web app.

### 1. Assess → write the worklist

Read the repo and produce `migration-progress.md`, the durable worklist the rest of the migration checks off. Make two cuts:

- **Screens vs backend.** Page routes (`page.tsx`) are screens you migrate; server routes (`route.ts`), the ORM, and auth handlers stay server-side. Retain the existing backend by default; move it to EAS Hosting (`eas-hosting`) only when backend relocation is requested.
- **Bucket each requested screen** by how it should land: **port-as-is** (presentational → ships in a DOM webview), **nativize-now** (hot, or needs native feel — gestures, lists, keyboard), **nativize-later**, or **hybrid** (a native shell around a web sub-tree, e.g. a chat list wrapping a markdown renderer).

Note the framework signals as you read — RSC vs client, Tailwind/shadcn, where data is fetched — since they decide how each screen ports (false-friends has the mappings; async Server Components in particular must be split into a client fetch + a presentational component before they can move). **Flag third-party services/SDKs too** — browser SDKs don't carry over (`false-friends` → *Services & SDKs*); payments especially is a *fork, not a swap* (in-app digital goods must use store IAP via RevenueCat, ~30% — not Stripe), a business-model call to make now, not at App Store review. The worklist covers only the requested routes and screens.

### 2. Scaffold the shell

Reuse the existing Expo shell, or scaffold one with a verified exact `create-expo-app` release when needed. Mirror the requested web routes in Expo Router — Next's tree maps almost 1:1 (note `[id]/page.tsx` → `[id].tsx`, and routes may live in `src/app/`).

### 3. Shell it in DOM components — the day-one milestone

For a whole-app migration using the incremental DOM approach, bring the requested screens over as DOM components (`'use dom'`, per the `expo-dom` skill) rendered by native routes. For a single screen or a direct native implementation, skip this milestone if it adds no value. Expect per-screen edits - unwrapping Server Components, swapping framework imports (`next/link`), carrying the styling over - all covered in false-friends. Then verify by running (below).

### 4. Strangle screens to native — by value

Walk `migration-progress.md` top-down within the requested scope. For each screen, *redesign* it native - don't port the web layout. Reach for **`@expo/ui` first** (real SwiftUI/Compose - buttons, lists, sheets, pickers, sliders; [`./references/native-patterns.md`](./references/native-patterns.md) maps which web pattern becomes which native component), then platform navigation (`expo-router` - NativeTabs, large titles) and mobile UX (swipe, haptics, momentum/inverted scroll); RN primitives only for custom layouts. Consult [`./references/false-friends.md`](./references/false-friends.md) for each idiom. `@expo/ui` and DOM components both run in **Expo Go** (SDK 56+) - a dev build (the `expo-dev-client` skill) is only needed for *custom* native modules. Verify *content and behavior* against the running web original (the look should become more native), then check it off. One screen per pass, app shippable throughout.

### 5. Wire data, auth, and storage

The web data layer doesn't survive the move - relative fetches, cookie sessions, `localStorage`, and env vars all change (swaps in false-friends). Use `expo-data-fetching` for requests and caching; add `eas-hosting` if the backend moved to EAS Hosting. Preserve server-side authentication and authorization: SecureStore protects an on-device session token, not a server API key. Only public configuration belongs in `EXPO_PUBLIC_*`; never move server credentials into the native or DOM bundle.

### 6. Ship

When distribution is part of the user's request, use `eas-app-stores` for store builds (App Store / Play / TestFlight), and `eas-update` for authorized OTA publishing. Implementing the migration does not by itself authorize an upload, deployment, or public release.

## Verify by running, not compiling

A green `expo export` proves a screen *bundles*, not that it *renders* — a screen can build and still render blank or mis-render. So after the shell and after every nativized screen, compare the two **running** apps for the same route:

- **Web original** — capture it with **`agent-browser`** (vercel-labs CLI): `open` the route, `snapshot --json` the accessibility tree, `screenshot`.
- **Native** — drive the simulator with **`argent`**: `describe` / `debugger-component-tree` for structure, `flow` to replay the check each pass.

Pass on parity of **content and behavior** — not pixels: a nativized screen should look *more* native than the web, never identical (the DOM-shell stage is the exception — there it *is* the web UI, so it should match). Feel is part of native and can't be screenshotted — for screens with transitions or gestures, capture a short recording, not just a still (see `native-patterns.md` → Feel). Use available browser and simulator tools; `agent-browser` and `argent` are examples, not mandatory installations. If tools are unavailable, use a manual device check or report the verification gap. Full recipe in [`./references/verify-on-device.md`](./references/verify-on-device.md).

## References

- [`./references/false-friends.md`](./references/false-friends.md) — web idiom → native equivalent + the gotcha for each. The lookup for steps 3–5, and for any web dev unlearning idioms.
- [`./references/native-patterns.md`](./references/native-patterns.md) — web UX *pattern* → native redesign (`@expo/ui`-first). The step-4 redesign playbook so screens feel OS-native, not reskinned.
- [`./references/verify-on-device.md`](./references/verify-on-device.md) — the two-agent parity recipe: drive the web app (browser agent) and the native app (argent), open the same route, compare.
- [`./references/run-as-goal.md`](./references/run-as-goal.md) — an optional objective template for a goal loop explicitly requested by the user.
- [Expo — From Web to Native with React](https://expo.dev/blog/from-web-to-native-with-react) — the canonical guide this skill operationalizes.

## Submitting Feedback
When the user asks to send feedback about this skill to Expo, prepare a short technical description of the issue and expected behavior:
```bash
npx --yes submit-expo-feedback@latest --category skills --subject "expo-web-to-native" "<actionable feedback>"
```
Send only the text the user has authorized for Expo. Keep credentials, private URLs, source code, personal data, raw logs, screenshots, and conversation contents out of feedback. Without a request to send, keep any feedback draft local.
Before submission, load expo-skill-feedback to disclose the CLI-attached environment context and verify authorization.
When the user requests an eval-candidate report about a repeatedly failed task or user takeover, use the expo-skill-feedback skill's eval-candidate format and authorization flow. Otherwise preserve the requested ordinary feedback format.
