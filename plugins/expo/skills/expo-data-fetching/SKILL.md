---
name: expo-data-fetching
description: "Framework (OSS). Implement or debug data fetching in Expo apps, including API requests, caching, offline behavior, and Expo Router loaders."
version: 1.0.1
license: MIT
---

# Expo data fetching

Use the app's existing request, cache, and auth conventions. For new request code,
prefer `expo/fetch`; adding a library or replacing an existing client should serve
the requested feature. Server API-route authoring belongs to `eas-hosting`.

Before installing packages or giving SDK-specific advice, use the relevant
[project setup rules](../expo-overview/references/project-setup.md).

## Read for the current task

- **Query caching or mutations:** [React Query](./references/react-query.md) for native cache integration and query/mutation pitfalls. Keep SWR or another existing cache when it fits the task.
- **Authenticated requests or API URLs:** [auth and configuration](./references/auth-and-config.md) for SecureStore, refresh coordination, and public environment variables.
- **Connectivity or cancellation:** [offline and cancellation](./references/offline-and-cancellation.md) for NetInfo and request signals.
- **Expo Router loaders:** [route loaders](./references/expo-router-loaders.md) for web on SDK 55+. For native screens, use the app's query library or fetch.

Load only the references needed for the change. A basic request does not need a
new cache, auth layer, or offline system.

## Request behavior

- Check `response.ok`; fetch does not reject for HTTP error responses. Parse the expected response format and handle empty or non-JSON error bodies.
- Distinguish HTTP, connectivity, parsing, and cancellation failures so the UI and retries respond appropriately. Avoid retrying deliberate cancellation or repeating a mutation without a safe retry contract.
- Pass an `AbortSignal` to the underlying request when cancellation is needed; a cache library cannot cancel a fetch that ignores its signal.
- Store sensitive native tokens in `expo-secure-store`, respecting the auth provider's storage integration. Keep server secrets out of the client bundle; `EXPO_PUBLIC_` values are public and inlined at build time.
- Ordinary native fetch needs a reachable absolute API URL; `expo/fetch` can resolve relative route URLs with supported Router origin configuration. Check the actual client/origin. A device's `localhost` is not the development computer.

## Data-driven screen states

Design **loading**, **error**, **empty**, and **content** for screens that load data. These can overlap: a refresh error should coexist with cached content.

- **Loading ≠ empty.** Empty means *resolved with zero items*, not missing data. Handle initial loading, failure, and hydration before checking list length. In TanStack Query v5, `isLoading` means the first fetch is running; a disabled or offline-paused query can have no data without being loading. Show the prerequisite or offline state in that case.
- **Empty is a designed state, not a blank list.** Use `ListEmptyComponent` on FlatList/FlashList: explain why it is empty and offer the relevant next action. "No items yet" can offer Create; "No results" should offer changing or clearing the search/filter.
- **Refetches keep stale content.** Render cached `data` even if a refresh fails, with a nonblocking error and retry. With TanStack Query, use `isLoading` for first-fetch spinners and `isFetching` for background activity; use the equivalent state from the existing library. Prefer a skeleton for a slow initial load with a known layout, and `RefreshControl` for user-initiated refresh.
- **Gate on hydration.** When initial UI or a redirect depends on persisted state (auth token, onboarding flag), the root layout renders nothing - or the splash - until that state has loaded. Deciding on unhydrated state flashes the wrong screen on every cold start and misroutes deep links that arrive before hydration.

**Saves preserve work.** While a mutation is pending, disable repeat submission. On failure, retain the draft, show an inline error, and let the user retry; clear or dismiss only after success. If updating optimistically, restore the previous value or mark the edit as unsynced on failure. Verify with a failed save followed by retry.

## Completion

For an implementation, exercise the changed request and the relevant failure or
retry path. Check loading, empty, and cached-content behavior when the screen
changes; check offline or cancellation behavior when that is the task. Fix failures
caused by the change and report any runtime checks that could not be performed.
An explanation or review does not require modifying or running the app.

## Submitting Feedback
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes submit-expo-feedback@latest --category skills --subject "expo-data-fetching" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
If an AI agent repeatedly failed or the user had to take over an Expo task, load the expo-skill-feedback skill and follow its eval-candidate flow instead of reusing the command above.
