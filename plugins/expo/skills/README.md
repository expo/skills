# Expo Skills Index

Every skill in this directory is a sibling folder containing a `SKILL.md`. Skills are discovered **one level deep** - `skills/<skill-name>/SKILL.md` - so this index groups them for humans; the filesystem stays flat. Each skill's frontmatter `description` is prefixed with its category so agents can see the free vs paid boundary in the always-loaded metadata.

## Framework (open source)

Free, open-source Expo SDK and React Native skills. Descriptions are prefixed `Framework (OSS).`.

| Skill | Use it for |
| --- | --- |
| `expo-router` | Expo Router navigation: file-based routes, links, native stacks, modals, sheets, native tabs, and headers. |
| `expo-native-ui` | Native-feeling screen styling, semantic colors, controls, icons, media, animations, and visual effects. |
| `expo-ui` | `@expo/ui` native components: universal cross-platform first, plus SwiftUI and Jetpack Compose. |
| `expo-data-fetching` | API calls, React Query, SWR, caching, offline support, and Expo Router data loaders. |
| `expo-tailwind-setup` | Tailwind CSS v4, `react-native-css`, and NativeWind v5 setup. |
| `expo-dom` | Expo DOM components for gradually using web code in native apps. |
| `expo-web-to-native` | Migrating an existing web/React app (Next.js, Vite, CRA) to a native iOS/Android app with Expo. |
| `expo-module` | Expo native modules and views with Swift, Kotlin, TypeScript, config plugins, and autolinking. |
| `expo-brownfield` | Adding Expo or React Native to an existing iOS or Android app. |
| `expo-dev-client` | Development clients (local builds are free; EAS Build/TestFlight is a paid step). |
| `expo-examples` | The `expo/examples` repo of `with-*` integrations to adapt or scaffold from. |
| `expo-app-clip` | iOS App Clip targets, AASA files, associated domains, and Smart App Banners. |
| `expo-upgrade` | Expo SDK upgrades, dependency conflicts, deprecated packages, and cache cleanup. |

## Services & paid distribution

Skills whose core purpose uses paid Expo Application Services (EAS). Descriptions are prefixed `EAS service (paid).`, and each `SKILL.md` opens with a costs/plan-limits callout.

| Skill | Use it for | Paid dependency |
| --- | --- | --- |
| `eas-app-stores` | Production builds, App Store, Play Store, TestFlight, eas.json profiles, versioning, and store metadata. | EAS + Apple/Google accounts |
| `eas-hosting` | Deploying Expo websites and Expo Router API routes to EAS Hosting: secrets, custom domains, Cloudflare Workers. | EAS Hosting usage |
| `eas-workflows` | EAS Workflow YAML files and CI/CD automation. | EAS build/compute minutes |
| `eas-observe` | EAS Observe setup and launch, route, event, and version metrics. | EAS Observe usage |
| `eas-update-insights` | EAS Update health, crash rates, launch counts, payload size, and rollout gates. | EAS Update usage |
| `eas-simulator` | Remote iOS/Android simulators on EAS cloud, driven from the CLI or an agent, with browser preview. | EAS Simulator usage |

## Adding a skill

1. Create `skills/<skill-name>/SKILL.md` (one level deep - do not nest under a category folder, or it will not be discovered).
2. Prefix the frontmatter `description` with the category label (`Framework (OSS).` or `EAS service (paid).`).
3. For a services skill, open the body with a costs/plan-limits callout right after the H1.
4. Add the skill to the table above, to `skills.sh.json`, and to the root and plugin `README.md` lists.
5. Bump the version in all three plugin manifests (see `CONTRIBUTING.md`).
