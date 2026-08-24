# Expo Router Data Loaders

Route-level data loading for **web** apps, following the Remix/React Router loader model: export an async `loader` function from a route file, read it with `useLoaderData`.

**Status:** alpha, SDK 55+. This reference is verified against the SDK 55/56-era docs (2026-08) and the API is still moving (e.g. typed `createStaticLoader` / `createServerLoader` helpers from `expo-router/server` were added after the first release). Treat the rules below as stable judgment; get exact signatures from the docs.

> **Source of truth:** https://docs.expo.dev/router/web/data-loaders/ — consult the canonical docs when API details matter (append `.md` for markdown).

## Execution Model

- **Initial page load:** the loader runs server-side (or at build time for static); its return value is serialized as JSON and embedded in the HTML.
- **Client-side navigation:** the browser fetches loader data over HTTP; the route suspends until it arrives.

## Server vs Static

Enable via the `expo-router` plugin in app config:

```json
{
  "expo": {
    "web": { "output": "server" },
    "plugins": [
      ["expo-router", {
        "unstable_useServerDataLoaders": true,
        "unstable_useServerRendering": true
      }]
    ]
  }
}
```

| | `web.output: "server"` | `web.output: "static"` |
|---|---|---|
| `unstable_useServerDataLoaders` | Required | Required |
| `unstable_useServerRendering` | Required | Not required |
| Loader runs | Every request (live server) | At build time (`npx expo export`) |
| Data freshness | Fresh on each initial request | Stale until next build |
| `request` object | Full access (headers, cookies) | **Always `undefined`** (no HTTP request at build time) |
| Hosting | Node.js server (EAS Hosting) | Any static host |
| Use case | Personalized/dynamic content | Marketing pages, blogs, docs |

## Minimal Example

```tsx
// app/posts/index.tsx
import { Suspense } from "react";
import { useLoaderData } from "expo-router";
import { ActivityIndicator, View, Text } from "react-native";

export async function loader() {
  const response = await fetch("https://api.example.com/posts");
  return { posts: await response.json() };
}

function PostList() {
  const { posts } = useLoaderData<typeof loader>();
  return (
    <View>
      {posts.map((post) => (
        <Text key={post.id}>{post.title}</Text>
      ))}
    </View>
  );
}

export default function Posts() {
  return (
    <Suspense fallback={<ActivityIndicator size="large" />}>
      <PostList />
    </Suspense>
  );
}
```

Dynamic routes, catch-alls, query params, typed loaders, `StatusError`, and `setResponseHeaders` follow the docs page above.

## Rules

- Loaders are **web-only**; use client-side fetching (React Query, fetch) for native.
- Loaders cannot be used in `_layout` files — only in route files.
- The `<Suspense>` boundary must be **above** the component calling `useLoaderData()` — `useLoaderData` suspends during client-side navigation (on initial load the data is already in the HTML), so put it in a child component and wrap that child.
- The `request` argument is an immutable `Request`-like object and is `undefined` in static mode — always use optional chaining (`request?.headers`).
- `params` contains **path parameters only** (`Record<string, string | string[]>`; cast like `params.id as string`). Query parameters come from `new URL(request.url).searchParams` — server output mode only.
- Return **JSON-serializable values only**: no `Date`, `Map`, `Set`, class instances, functions, streams, or async iterables.
- Loaders run on the server, so read secrets from non-prefixed `process.env` vars — never `EXPO_PUBLIC_` (those are embedded in the client bundle).
- Throw `StatusError` (from `expo-server`) for HTTP error responses; set headers with `setResponseHeaders`. Export an `ErrorBoundary` from the route file — it catches loader throws (including `StatusError`).
- Type loaders that take params with the `LoaderFunction` type. Import location drifted across releases (`expo-server` in early SDK 55 examples, `expo-router/server` in current docs) — match your SDK's docs.
- Validate and sanitize user input (params, query strings) before using it in database queries or API calls.
- **Known limitation:** loader data is cached on the client for the session/during navigation with no built-in way to invalidate it yet; this will be addressed in a future release.
