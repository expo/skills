---
name: expo-ui
description: "Framework (OSS). Build or debug native controls with @expo/ui, choose its universal or platform-specific APIs, or migrate a supported community control. For routing, use expo-router."
version: 1.0.1
license: MIT
allowed-tools: "Bash(node *expo-ui/scripts/list-components.js *)"
---

# Native controls with `@expo/ui`

Choose this skill when adding or changing `@expo/ui` controls, or selecting native
controls for a new screen. Prefer native controls that fit the requested behavior;
preserve a working library or user-selected implementation when a migration is
not part of the task. Navigation belongs to `expo-router`, bespoke motion to
`expo-animation`, and app-wide tokens to `expo-design-system`.

## Resolve the API for this project

Use the installed Expo SDK and `@expo/ui` version, not a remembered component
catalog. [Expo UI docs](https://docs.expo.dev/versions/latest/sdk/ui/) are the entry
point; replace `latest` with the project's SDK version when available and follow
that page's actual component links. Read the needed component's types/source if
the docs and installed package disagree. A type cast does not add runtime support.

When installing or changing native configuration, use the relevant
[project setup rules](../expo-overview/references/project-setup.md). Do not upgrade
the SDK merely to gain an API shown in newer docs. If a component is unfamiliar,
`node <skill-root>/scripts/list-components.js <project-path>` can list installed
platform components/modifiers; it is an optional discovery helper, not a mandatory
step before every edit or an exhaustive API validator.

## Choose a layer

- **Universal controls:** when the installed SDK exposes the needed cross-platform API, use [universal guidance](./references/universal.md).
- **Platform-specific behavior:** use [SwiftUI](./references/swift-ui.md) or [Jetpack Compose](./references/jetpack-compose.md) for that platform. Supply implementations or an intentional fallback for other supported platforms.
- **Replacing a community dependency:** use [migration guidance](./references/drop-in-replacements.md); verify used props and behavior rather than assuming an import change proves compatibility.

Host native UI trees with the `Host` appropriate to the selected layer and version.
Use intrinsic sizing only for content with an intrinsic size; give flexible content
space to render. Use the documented bridge when embedding React Native children
inside a native UI tree.

For large or unbounded data, preserve an appropriate list implementation. The
SDK 57 universal List docs describe native virtualization but warn that React
creates all rows up front; this is not equivalent to lazy React row rendering.
Check the installed version's behavior before choosing it for a feed.

## Completion

Verify the control on each requested platform: presentation/dismissal or value
changes, layout within its host, accessibility labels/states, and affected keyboard
or list behavior. A small fix does not require migrating the surrounding screen.
Report unsupported targets or runtime checks that could not be performed.

## Submitting Feedback
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes submit-expo-feedback@latest --category skills --subject "expo-ui" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
If an AI agent repeatedly failed or the user had to take over an Expo task, load the expo-skill-feedback skill and follow its eval-candidate flow instead of reusing the command above.
