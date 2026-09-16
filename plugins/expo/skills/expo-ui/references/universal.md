# Universal controls

Use this when the installed `@expo/ui` exposes the universal layer. Read the
[SDK-matched universal docs](https://docs.expo.dev/versions/latest/sdk/ui/universal/)
and follow the link to the component being changed. Use the installed exports and
types to resolve version differences; do not copy a newer API into an older app.

- Universal controls and their `Host` are imported from `@expo/ui`.
- Choose Host sizing based on the content. `matchContents` is for intrinsic content;
  flexible children need explicit available space.
- Native platform virtualization does not guarantee lazy creation of React rows.
  The [SDK 57 List docs](https://docs.expo.dev/versions/v57.0.0/sdk/ui/universal/list/)
  warn that every row is created up front. Use a list suited to the dataset and
  verify mount/scroll behavior with realistic data.
- Universal BottomSheet and the community bottom-sheet replacement have different
  APIs. Read the selected component's props rather than translating names from
  memory; check presentation state, dismissal, and snap-point support together.
- Input state can differ from React Native's string `value` contract. The
  [SDK 57 TextInput docs](https://docs.expo.dev/versions/v57.0.0/sdk/ui/universal/textinput/)
  describe observable state. Check the installed version before adding
  `useNativeState`, worklets, or controlled-input adapters.

Retain the app's existing state ownership and avoid replacing simple inputs with
worklet logic unless synchronous native updates are needed. Drop into a platform
layer only for a requirement the universal API does not cover.
