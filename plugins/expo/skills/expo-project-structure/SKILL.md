---
name: expo-project-structure
description: Folder structure for a new Expo app — the SDK 55+ `src/` layout, Expo Router `app/` for routes, plus `components/`, `features/`, `hooks/`, `lib/`, `constants/`. Use when scaffolding or laying out a greenfield Expo project, or deciding where a file should live in one. Greenfield guidance only — never restructure an existing app to match.
version: 1.0.0
license: MIT
---

# Expo Project Structure

A starting skeleton for a **greenfield** Expo app — one with no committed folder structure yet.

**Apply only to greenfield projects.** If the app already has a layout, follow its existing conventions and leave files where they are — this is a default to start from, never a standard to enforce or migrate toward. When unsure whether a project counts as greenfield, ask before moving anything.

## The `src/` layout

Since SDK 55, the default `create-expo-app` template ships a top-level `src/` — don't recreate it. For a blank or pre-55 project, create `src/` yourself and point the import alias at it in `tsconfig.json`: `"@/*": ["./src/*"]`.

```
src/
  app/          # Expo Router routes ONLY — screens, layouts, navigation
  components/   # UI shared across features
    ui/         #   design-system primitives (Button, Card, Text)
    common/     #   other generic shared components
  features/     # Self-contained feature modules — auth/, feed/, profile/
  hooks/        # Global custom hooks
  lib/          # API clients, SDK wrappers, third-party config
  constants/    # Theme, colors, layout metrics, config values
  utils/        # Pure helper functions
  store/        # Global state (Redux / Zustand / Jotai), if any
  types/        # Shared TypeScript types
```

Create a directory on first need — an empty `store/` or `types/` earns its place only when something fills it.

## `src/app` is routes-only

`src/app` holds nothing but route files — screens, `_layout` files, and navigation. Everything else (components, hooks, helpers) lives in the sibling directories above. If both `app/` and `src/app/` exist, Expo Router uses `src/app/` only.

## Colocate by feature; promote only what's shared

The lever that keeps a growing app maintainable: **colocate** each feature's own code inside its `features/<name>/` folder, and lift code up to the shared directories only once a *second* feature actually uses it.

```
features/auth/
  components/   # used only by auth — not in src/components
  hooks/
  api.ts
  types.ts
```

- A component used by one screen stays with that screen or feature. Only genuinely cross-feature components belong in `src/components/`.
- Same rule for `hooks/`, `utils/`, and `types/`: feature-local until a second feature needs them.

## Stays at the project root

Config and assets stay outside `src/`: `app.json` / `app.config.ts`, `package.json`, `metro.config.js`, `tsconfig.json`, `assets/`, and `public/`.

For the `src/` precedence and alias mechanics, see Expo's docs: https://docs.expo.dev/router/reference/src-directory/
