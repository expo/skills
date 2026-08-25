---
name: expo-data-fetching
description: Framework (OSS). Use when implementing or debugging ANY network request, API call, or data fetching. Covers fetch API, React Query, SWR, error handling, caching, offline support, and Expo Router data loaders (`useLoaderData`).
version: 1.0.0
license: MIT
---

# Expo Networking

**You MUST use this skill for ANY networking work including API requests, data fetching, caching, or network debugging.**

You already know how to fetch, cache, retry, and cancel. This skill covers only what is Expo-specific: which client to use, where tokens and secrets live, how env vars behave, and route-level loaders.

## References

- `./references/expo-router-loaders.md`: Route-level data loading with Expo Router loaders (web, SDK 55+, alpha)

## Decision Rules

- **HTTP client**: `import { fetch } from "expo/fetch"` — WinterCG-compliant fetch with streaming response bodies (`response.body.getReader()`), consistent across web and native. **Avoid axios.** On Android/iOS in current SDKs, `expo/fetch` is also installed as the global `fetch` (set `EXPO_PUBLIC_USE_RN_FETCH=1` to keep React Native's built-in fetch as the global).
- **Caching/server state**: React Query (TanStack Query) for complex apps, SWR or custom hooks for simpler needs. Standard setup — wrap the root layout in `QueryClientProvider`, you know the rest.
- **Route-level data loading (web, SDK 55+)**: Expo Router loaders — see `./references/expo-router-loaders.md`. For native, use client-side fetching (React Query, fetch).
- **Tokens**: store in `expo-secure-store`, never AsyncStorage. Refresh flows, retry with exponential backoff, `response.ok` checks, AbortController cleanup — standard patterns, write them cold.
- **Offline**: wire React Query's `onlineManager` to `@react-native-community/netinfo` (there is no `navigator.onLine` on native); React Query persistence for offline caching.
- **API URLs and secrets**: `EXPO_PUBLIC_` env vars for client-safe config; non-prefixed env vars for secrets, readable only in server code (API routes, loaders).

## Canonical Example

```tsx
import { fetch } from "expo/fetch";
import * as SecureStore from "expo-secure-store";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await SecureStore.getItemAsync("auth_token");
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
```

## Environment Variables

```bash
# .env
EXPO_PUBLIC_API_URL=https://api.example.com
```

```tsx
const API_URL = process.env.EXPO_PUBLIC_API_URL; // inlined at build time
```

Rules:

- Only `EXPO_PUBLIC_`-prefixed variables are exposed to the client bundle — and they are **visible in the built app**. Never put secrets (write-access API keys, database passwords) in them.
- Values are inlined at **build time**, not runtime. After changing `.env` files, no dev-server restart is needed — but do a full app reload (`r` in the CLI) so the new values are re-inlined.
- Per-environment config: `.env.development` / `.env.production` are loaded by environment automatically.
- Server-side secrets belong in non-prefixed env vars, read only inside API routes or loaders.

## Common Mistakes

**Wrong: tokens in AsyncStorage**

```tsx
await AsyncStorage.setItem("token", token); // plaintext, not secure
```

**Right: SecureStore for sensitive data**

```tsx
await SecureStore.setItemAsync("token", token);
```

**Wrong: secret in a client env var**

```bash
EXPO_PUBLIC_STRIPE_SECRET=sk_live_... # shipped inside the app bundle
```

**Right: non-prefixed var, read in an API route or loader only**

```bash
STRIPE_SECRET_KEY=sk_live_...
```

## Example Invocations

User: "Where should I put my API key?"
-> Client-safe keys: `EXPO_PUBLIC_` in .env. Secret keys: non-prefixed env vars in API routes/loaders only

User: "How do I configure different API URLs for dev and prod?"
-> `EXPO_PUBLIC_` env vars with .env.development and .env.production files

User: "How do I load data for a page in Expo Router?"
-> See references/expo-router-loaders.md for route-level loaders (web, SDK 55+). For native, use React Query or fetch

User: "How do I handle authentication tokens?"
-> Store in expo-secure-store, implement a standard refresh flow

> **Source of truth:** https://docs.expo.dev/guides/environment-variables/ and https://docs.expo.dev/versions/latest/sdk/expo/ (`expo/fetch` API) — consult the canonical docs when API details matter. Docs URLs serve markdown with `.md` appended; on `/versions/` paths swap `latest` for the project's SDK.

## Submitting Feedback
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes submit-expo-feedback@latest --category skills --subject "expo-data-fetching" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
If an AI agent repeatedly failed or the user had to take over an Expo task, load the expo-skill-feedback skill and follow its eval-candidate flow instead of reusing the command above.
