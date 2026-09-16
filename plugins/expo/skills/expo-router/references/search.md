# Native header search

Choose the search presentation supported by the installed Router and target
platform: the relevant Stack search API, native search tab, or an in-screen input.
Use [Stack documentation](https://docs.expo.dev/router/advanced/stack/),
[native tabs](https://docs.expo.dev/router/advanced/native-tabs/), and the matching
SDK's Router types for callbacks, refs, and available options. A helper named
`useSearch` in an application is not automatically an Expo Router export.

## Wire behavior, not only the field

Keep search state in the component/provider that owns the results, with one clear
path from text change to filtering/request state. If setting header options through
an effect, avoid recreating unstable option objects on every render and preserve
existing header configuration. Cancel/clear should update both the visible field
and results according to the product behavior.

For small local data, filter directly from current items and query. For server
search, use the existing data layer, debounce only when useful, and prevent old
responses from replacing newer results. Include every filtering input in memo/cache
dependencies. Do not copy a generic debounce hook that closes over stale items.

Distinguish no query, loading, failed search, and resolved zero results. Keep cached
results during a failed refresh when helpful; see `expo-data-fetching`. Suggestions
and recent searches need working selection and the intended privacy/lifetime policy,
not placeholder handlers.

Native-tab search roles and header search fields are separate configuration pieces.
Verify they connect to the intended screen/state and provide a supported alternative
on other platforms. Check focus, cancel, keyboard submission, result taps with the
keyboard open, and returning to the tab/screen. Preserve or clear the query by the
requested navigation behavior, not a sample's default.
