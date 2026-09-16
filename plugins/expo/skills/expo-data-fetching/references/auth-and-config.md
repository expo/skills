# Authenticated requests and API configuration

Use the auth provider's supported session and storage lifecycle. Do not add a
parallel token manager just because an example has one. For native credentials,
consult [SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/) for the
installed SDK and the provider's native integration; web cookies/storage have
different security and lifecycle requirements.

## Integration boundaries

- Wait for session hydration before protected requests or redirects. Distinguish no session from an expired session and a failed refresh.
- If implementing refresh, coordinate concurrent requests around one refresh attempt, bound replay, and prevent a logout/account switch from restoring an old session. Clear user-scoped caches on the correct lifecycle boundary.
- Preserve cancellation through wrappers and retries. Replay a mutation only when its API contract makes that safe. Use `Headers` when merging generic `RequestInit.headers`; spreading that value assumes it is a plain object.
- Keep server secrets out of client bundles and native config. An unprefixed variable is not automatically secret if copied into public app config or another bundled value.

Read [Expo environment variables](https://docs.expo.dev/guides/environment-variables/)
for supported loading, static property access, and build/update inlining. Use the
project's selected environment; do not rely on `NODE_ENV` to select a production
API for every Expo command. TypeScript declarations do not validate missing values.

For API routes, read [native requests and origin configuration](https://docs.expo.dev/router/web/api-routes/).
Ordinary native fetch needs a reachable absolute URL; Expo's `expo/fetch` can resolve
relative route URLs with the supported Router origin configuration. Check the
actual client and configured origin before converting every request. A physical
device's `localhost` is the device, not the development computer.

Verify cold start, valid session, expired/failed refresh, and logout/account switch
when touching auth; verify the resolved API destination in the intended dev/build
or update environment. Avoid printing credentials while inspecting configuration.
