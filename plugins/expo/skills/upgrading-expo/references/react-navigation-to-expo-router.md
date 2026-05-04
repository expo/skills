# Migrating from react-navigation to expo-router

## Steps

1. Remove every `@react-navigation/*` dependency from `package.json` and reinstall, if necessary remove `node_modules` and reinstall.
2. Replace imports using the map below. Use the narrowest entry point that matches the code's intent.
3. Validate: search for remaining `@react-navigation/` references, then run typecheck/build/start.

## API Mapping

- If the project uses `@react-navigation/stack`, ask the user if they want to try to migrate to `expo-router` native stack. If they do, replace `@react-navigation/stack` with `expo-router` and rewrite imports to use the root `expo-router` entry point. If they don't, replace `@react-navigation/stack` with `expo-router/js-stack` and rewrite imports to use that entry point.
- If the project uses `@react-navigation/bottom-tabs`, ask the user if they want to try to migrate to `expo-router` native bottom tabs. If they do, replace the tab package with `expo-router` and rewrite imports to use the root `expo-router` entry point. If they don't, replace the tab package with `expo-router/js-tabs` and rewrite imports to use that entry point.

| Old import                                     | New import                |
| ---------------------------------------------- | ------------------------- |
| `@react-navigation/native`                     | `expo-router`             |
| `@react-navigation/bottom-tabs`                | `expo-router/js-tabs`     |
| `@react-navigation/material-top-tabs`          | `expo-router/js-top-tabs` |
| JS stack navigator (`@react-navigation/stack`) | `expo-router/js-stack`    |

`expo-router` re-exports: `ThemeProvider`, `DarkTheme`, `DefaultTheme`, `useTheme`, `useNavigation`, `useFocusEffect`, `useIsFocused`, `createNavigatorFactory`, `useNavigationBuilder`, `withLayoutContext`, `TabRouter`, `TabActions`, `CommonActions`.

If there is something that cannot be replaced with `expo-router` and does not have a clear alternative, ask the user to create the issue in `expo/expo` repository with the detailed report on what and why is needed to be exported.

**Stack caveat:** Do NOT rewrite `import { Stack } from "expo-router"` to `expo-router/js-stack`. The root `Stack` is correct for route layout files; only use `expo-router/js-stack` when replacing a JS stack navigator.

## Done when

1. No `@react-navigation/*` entries in `package.json`.
2. No `@react-navigation/` imports in source files.
