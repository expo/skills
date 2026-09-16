# TanStack Query in Expo

Use this only when the app uses or has chosen TanStack Query. Preserve an existing
SWR/custom cache when the requested change fits it. Consult the installed major
version's [React Native integration](https://tanstack.com/query/latest/docs/framework/react/react-native)
and [query cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation)
guides for setup and APIs; provider/query/mutation tutorials belong there.

## Expo integration decisions

- Keep the QueryClient stable for its intended lifetime and preserve existing root providers/layouts. Do not instantiate it on every render or copy a replacement Router layout from a sample.
- Native app focus and connectivity differ from browser focus/online events. Connect AppState/network status to the cache only when needed, using one owned subscription and its cleanup. See [offline and cancellation](./offline-and-cancellation.md).
- Include request-defining inputs and user/tenant scope in cache keys. Do not let an account switch display another account's cached records.
- Choose freshness and retry policy from the data and API behavior; a sample's five-minute stale time or retry count is not a product requirement.
- Pass the query's signal into `expo/fetch` or the actual underlying request when cancellation should stop IO. Merely receiving the signal does not abort a request.
- In v5, `isLoading` represents an initial running fetch; disabled/paused queries can lack data without being loading. Handle prerequisites, offline pause, errors, and resolved empty content explicitly. Keep cached content during refresh failure.
- Mutations must preserve drafts on error, prevent repeat submissions while pending, and invalidate/update the affected keys. Optimistic writes need rollback or a visible unsynced state; invalidating everything can obscure the actual data dependencies.

Verify the changed request/mutation with its failure path and the relevant cache
transition (refresh, account change, focus return, or offline resume). Do not add a
persistence layer solely to satisfy a cache setup checklist.
