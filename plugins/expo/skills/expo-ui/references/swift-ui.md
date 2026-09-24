# SwiftUI integration

Use for iOS-specific controls or behavior that the selected universal API does
not cover. Read the [SDK-matched SwiftUI docs](https://docs.expo.dev/versions/latest/sdk/ui/swift-ui/)
for the component, modifiers, Host sizing, and React Native embedding boundary.
Read only the relevant installed declarations/source when exact exports or props
are unclear. The component-list script in `../scripts/` can help discover names.

Keep platform-only views out of render paths for unsupported targets. A portable
pattern is platform components outside the route tree, imported by a common route,
with implementations or an intentional fallback for other supported platforms.
[Expo Router supports platform route extensions](https://docs.expo.dev/router/advanced/platform-specific-modules/)
when a non-platform route also exists; platform suffixes are not categorically
forbidden inside `app/`.

Use the `Host` exported for the layer/version being used. Universal Host is from
`@expo/ui`; platform packages also expose their own Host in documented versions.
Do not rewrite a valid platform Host import based on a universal example.

A native UI tree and a React Native tree have different child contracts. Use the
documented `RNHostView` bridge where needed. For a blank or collapsed control,
check Host dimensions and supported child types before replacing the component.

When the toolkit lacks a needed control/modifier, compare the existing app's RN
alternative with a local Expo module. Extend native code when the requested scope
warrants it; account for build and other-platform support rather than introducing
an unconditional approval pause or a mandatory rewrite.
