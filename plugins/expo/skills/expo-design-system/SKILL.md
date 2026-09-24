---
name: expo-design-system
description: "Framework (OSS). Create or extend Expo design tokens and shared components, standardize inconsistent screens, or audit design-system drift. Preserve the existing styling library and brand."
version: 1.0.1
license: MIT
---

# Expo design systems

Make related screens consistent through the app's tokens and shared components.
This skill owns reuse and consistency; `expo-native-ui` covers platform layout and
controls. It does not impose a new visual identity on an established app.

## Adopt before adding

Inspect the existing theme and styling library in the area being changed. Extend
NativeWind, Tamagui, Restyle, Unistyles, or a custom theme in its own idiom; do not
create a parallel `theme/` to match an example. For a new system, derive semantic
roles from the requested design and recurring needs in real screens. A small
theme file is enough until splitting it improves use or maintenance.

A repeated number is evidence to inspect, not proof that two values express the
same design decision. Tokenize shared meaning (surface, secondary text, section
gap, destructive action), not every literal that appears twice. Keep local optical
adjustments local. Preserve intentional brand colors, typography, and layout.

## Decisions that belong in the system

| Area | Decision to preserve |
| --- | --- |
| Color | Semantic roles and light/dark contrast; platform colors where suitable, brand pairs where required |
| Spacing | Distinguish related rows, groups, and sections; use the established scale |
| Type | Named styles with correct font weights and accessible scaling |
| Shape and depth | A small coherent set of radii/surfaces/shadows supported by the target runtime |
| Motion | Shared feedback and transition conventions, respecting reduced motion |
| Components | Repeated behavior and visual roles, with only variants/states actually needed |

Use the styling library's current documentation and installed types for theme
syntax. Use [React Native style docs](https://reactnative.dev/docs/style) for RN
primitives and [accessibility](https://reactnative.dev/docs/accessibility) for
interaction semantics. Consult `expo-native-ui` for platform-specific decisions;
API tables and full component tutorials belong in their maintained documentation.

Keep dynamic colors dynamic. Hooks belong in components/hooks, not module-scope
style objects. Opaque platform color values are not strings; do not cast them to
silence a type error in a library that needs a concrete color. Use that library's
supported color representation. Verify theme changes in every supported target.

## Shared component decisions

Extract a component when it has a stable, nameable role and a smaller public API
than its implementation. Reuse across screens is evidence, not a compulsory
numerical threshold. Avoid wrappers that add nothing around native controls.

Expose the variants/sizes the product needs, layout overrides where useful, and
pressed, disabled, loading, or selected states when applicable. Keep accessible
labels available when text becomes a spinner. Use composition where content props
would otherwise grow without bound; retain useful typed slots when they clarify
the API. Preserve the repository's placement and styling conventions.

## Audit and verify

For an audit, read [audit guidance](./references/audit.md). For a screen that feels
generic or poorly adapted to native, use [visual review prompts](./references/native-slop.md)
to identify an observable problem; these are not bans on design choices.

For implementation, inspect affected screens for hierarchy, grouping, alignment,
contrast, and repeated component behavior. Check light/dark appearance and large
text when token changes affect them. Exercise the changed component's important
states and interactions. Fix shared causes without expanding into an app-wide
redesign; an audit-only request ends with findings and recommendations.

## Submitting Feedback
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes submit-expo-feedback@latest --category skills --subject "expo-design-system" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
If an AI agent repeatedly failed or the user had to take over an Expo task, load the expo-skill-feedback skill and follow its eval-candidate flow instead of reusing the command above.
