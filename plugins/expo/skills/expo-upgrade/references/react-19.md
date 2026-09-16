# React 19 during an Expo upgrade

Check the React version selected by the target Expo SDK. Follow the relevant
[React upgrade guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide) for
breaking changes and [React 19 release notes](https://react.dev/blog/2024/12/05/react-19)
for new capabilities; do not install a different React major independently of Expo.

New syntax is not an obligatory migration. React 19 supports reading context with
`use`, rendering a context provider directly, and receiving `ref` as a prop. Existing
`useContext`, `.Provider`, and `forwardRef` usage need not be rewritten just to
complete an SDK upgrade. Adopt new syntax when it helps the requested change and
all supported consumers can use it.

Separate React features from React DOM features. Web form actions, document metadata,
and DOM-specific hooks do not become native controls or navigation APIs. Keep the
app's existing data/mutation layer unless changing it is part of the task.

When a type or runtime error appears, inspect the matching React/type package
versions and the actual breaking change. For ref edits, verify the ref reaches the
underlying native component and still supports focus/measurement or other expected
imperative behavior. Avoid broad codemods for optional modernization.
