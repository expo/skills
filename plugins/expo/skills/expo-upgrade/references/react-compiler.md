# React Compiler adoption

Use this when compiler adoption is requested or when debugging a project that
already enables it. An SDK upgrade does not require adopting the compiler or
removing existing memoization.

Follow the [Expo React Compiler guide](https://docs.expo.dev/guides/react-compiler/)
for the installed SDK. For the SDK 54+ opt-in setup, install the compiler package
as well as enabling the app-config flag:

```bash
npx expo install babel-plugin-react-compiler --dev
```

Merge into the existing app config:

```json
{
  "expo": {
    "experiments": {
      "reactCompiler": true
    }
  }
}
```

Keep the project's existing Babel customizations and use the SDK's supported
`babel-preset-expo` integration. Older SDKs can require different setup. The
compiler is a build-time React transform, not a reason by itself to change the
app's native architecture.

Existing `useMemo`, `useCallback`, and `React.memo` can remain. The compiler only
optimizes code it can safely transform; enabling it does not guarantee every
component is optimized or eliminate every re-render. Use the
[React incremental-adoption guidance](https://react.dev/learn/react-compiler/incremental-adoption)
for exclusions and targeted migration rather than blanket cleanup.

Restart Metro after configuration changes. Check compilation with the guide's
React DevTools verification, then exercise the affected interactions. For a
regression, isolate the component or configuration and use supported compiler
diagnostics/opt-outs; changing native architecture or deleting all caches is not
the default troubleshooting step.
