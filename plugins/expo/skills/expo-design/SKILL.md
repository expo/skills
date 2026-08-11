---
name: expo-design
description: Framework (OSS). Build and maintain a design system inside an Expo app - a reusable theme of design tokens (color, spacing, typography, radius, shadow, motion), reusable component structure with variant/size/state prop conventions, and rules for when to extract a repeated view into a shared component. Use when creating or organizing theme.ts / theme/ files, adding design tokens, standardizing styles across screens, building an in-app component library, auditing for hardcoded style values, or making AI-generated screens look consistent and polished. For platform styling specifics (semantic colors, HIG rules, native controls) use expo-native-ui; for Tailwind/CSS setup use expo-tailwind-setup; for folder layout of a new app use expo-project-structure.
version: 1.0.0
license: MIT
---

# Expo Design Systems

Make every screen in an app draw from one visual source of truth: a token theme and a small set of reusable components. This skill defines where tokens live, what they cover, how reusable components are shaped, and when a repeated view earns promotion into the system.

Sibling skills own the layers around this one:

- `expo-native-ui` - platform styling rules (HIG, semantic colors, controls, shadows syntax). Follow it for **what values look native**; follow this skill for **where values live and how they're reused**.
- `expo-tailwind-setup` - if the project uses Tailwind, tokens live in `global.css` as CSS variables instead of TypeScript. The scales and naming in this skill still apply; only the storage format changes.
- `expo-project-structure` - folder skeleton for new apps.

## References

Consult these resources as needed:

```
references/
  audit.md      Audit an existing app for design-system drift: grep checks,
                scoring rubric, and templates for documenting or extending components
```

## The Theme

All design tokens live under `src/theme/`. Start small and split by token class as it grows:

```
src/theme/
  colors.ts       # see expo-native-ui "Colors" for the palette pattern
  spacing.ts
  typography.ts
  radius.ts
  shadows.ts
  motion.ts
  index.ts        # re-exports everything: import { spacing, type } from "@/theme"
```

A brand-new app can begin with a single `src/theme.ts` holding all of the objects below, then promote it to the folder form once any one class needs its own file (same promotion rule as components). Either way there is exactly **one** theme entry point - never two competing token files.

Rules that make a theme worth having:

- **Every repeated visual value is a token.** A literal that appears twice belongs in the theme.
- **Components import tokens; screens import components.** A screen file that imports `spacing` for layout padding is fine; a screen file redefining a button color is drift.
- **Never hardcode** hex colors, font sizes, or spacing multiples outside `src/theme/`. One-off values that are genuinely local (an icon's 17px optical nudge) may stay inline - with a comment saying why.

### Colors

Use the semantic-color palette pattern from `expo-native-ui` ("Colors" section): `Color` from `expo-router` wrapped in `Platform.select`, centralized in `theme/colors.ts`. Semantic colors adapt to light/dark automatically - prefer them for backgrounds, labels, and separators.

Add brand colors as explicit light/dark pairs only when the brand requires values the platform doesn't provide:

```tsx
// theme/colors.ts (brand additions)
import { useColorScheme } from "react-native";

const brandPalette = {
  light: { accent: "#5B21B6", accentContrast: "#FFFFFF" },
  dark: { accent: "#A78BFA", accentContrast: "#1E1B4B" },
} as const;

export function useBrandColors() {
  const scheme = useColorScheme();
  return brandPalette[scheme === "dark" ? "dark" : "light"];
}
```

Keep the brand set tiny (accent, accentContrast, maybe a tint per feature). Everything else stays semantic.

### Spacing

One scale, based on a 4-point grid. Name steps by size, not by use:

```tsx
// theme/spacing.ts
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;
```

- Use `gap` with spacing tokens for layout rhythm (`expo-native-ui` prefers gap over margin).
- Screen edge padding is `spacing.md` unless the design says otherwise - pick one and keep it.
- If a layout needs a value between steps, use the nearest step. The grid is the point.

### Typography

Define named text styles, not raw font sizes. Mirror the platform ramp (Apple text styles) so sizes feel native:

```tsx
// theme/typography.ts
import { TextStyle } from "react-native";
import { colors } from "./colors";

export const type = {
  largeTitle: { fontSize: 34, fontWeight: "700", color: colors.label },
  title: { fontSize: 22, fontWeight: "600", color: colors.label },
  headline: { fontSize: 17, fontWeight: "600", color: colors.label },
  body: { fontSize: 17, fontWeight: "400", color: colors.label },
  subhead: { fontSize: 15, fontWeight: "400", color: colors.secondaryLabel },
  caption: { fontSize: 12, fontWeight: "400", color: colors.secondaryLabel },
} as const satisfies Record<string, TextStyle>;
```

Expose them through one component so screens never touch `fontSize`:

```tsx
// components/themed-text.tsx
import { Text, TextProps } from "react-native";
import { type } from "@/theme";

export function ThemedText({
  variant = "body",
  style,
  ...props
}: TextProps & { variant?: keyof typeof type }) {
  return <Text style={[type[variant], style]} {...props} />;
}
```

Screen titles still come from the navigation stack header (`expo-native-ui` rule), so `largeTitle` is mostly for non-stack contexts.

### Radius

```tsx
// theme/radius.ts
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 9999, // capsules
} as const;
```

Pair every non-capsule radius with `borderCurve: "continuous"` (per `expo-native-ui`).

### Shadows

Shadows are `boxShadow` strings (never legacy shadow/elevation props - see `expo-native-ui`). Two or three elevation levels are enough:

```tsx
// theme/shadows.ts
export const shadows = {
  card: "0 1px 2px rgba(0, 0, 0, 0.05)",
  raised: "0 4px 12px rgba(0, 0, 0, 0.10)",
  overlay: "0 8px 24px rgba(0, 0, 0, 0.18)",
} as const;
```

### Motion

Durations and shared spring/easing configs, so animations across the app feel related:

```tsx
// theme/motion.ts
export const motion = {
  fast: 150, // state feedback: press, toggle
  base: 250, // element transitions: enter/exit
  slow: 400, // large surfaces: sheets, screens
} as const;
```

Reanimated caveat: don't pass `Color`/`PlatformColor` token values into Reanimated styles - use static colors there (see `expo-native-ui`).

## Reusable Components

The theme controls values; components control structure. Shared primitives live in `src/components/` (see `expo-project-structure`).

### The component contract

Every design-system primitive defines, explicitly:

- **Variants** - visual intent: `primary`, `secondary`, `ghost`, `destructive`. Add a variant only when a real screen needs it.
- **Sizes** - `sm`, `md`, `lg`. Default `md`. Sizes map to spacing/typography tokens, never to fresh numbers.
- **States** - default, **pressed** (not hover - this is touch), disabled, loading. Handle pressed with a `Pressable` style function; never leave a tappable element without pressed feedback.
- **Style override** - accept a `style` prop and merge it **last**, so callers can adjust layout (margins, flex) without forking the component. Callers may override layout, not identity - a caller changing a button's colors is a signal the variant set is missing something.

```tsx
// components/button.tsx
import { Pressable, ActivityIndicator, ViewStyle, StyleProp } from "react-native";
import { colors, spacing, radius } from "@/theme";
import { ThemedText } from "./themed-text";

const variants = {
  primary: { backgroundColor: colors.systemBlue, color: "#ffffff" },
  secondary: { backgroundColor: colors.separator, color: colors.label },
} as const;

const sizes = {
  sm: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  md: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
} as const;

export function Button({
  variant = "primary",
  size = "md",
  title,
  loading,
  disabled,
  style,
  onPress,
}: {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  title: string;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: variants[variant].backgroundColor,
          borderRadius: radius.md,
          borderCurve: "continuous",
          alignItems: "center",
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
          ...sizes[size],
        },
        style, // caller overrides merge last
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variants[variant].color as string} />
      ) : (
        <ThemedText variant="headline" style={{ color: variants[variant].color }}>
          {title}
        </ThemedText>
      )}
    </Pressable>
  );
}
```

### Composition over configuration

When a component's props start describing *content* (`leftIcon`, `subtitle`, `footerText`, `badgeCount`), stop adding props and accept `children` instead. A `Card` that renders `children` with token padding outlives any `Card` with twelve content props. Reserve props for the contract above: variant, size, state, style.

### When to extract - and when not to

Promote a view into `src/components/` when **all** of these hold:

1. It appears (or is about to appear) in **two or more screens**. Until then it stays colocated in `screens/<name>/` (see `expo-project-structure`).
2. It has a **nameable role** ("Card", "EmptyState", "Badge") - not "the thing on the profile screen".
3. Its API is **smaller than its implementation**. If the props would just re-expose every internal style, it isn't a reusable component yet - it's a screen fragment.

Promotion path: inline JSX → component in `screens/<name>/` → `src/components/`. Move one step at a time, when the trigger fires - never speculatively. Wrong abstractions cost more than duplication; a second copy of a view is cheaper than a primitive with a bad API.

Do **not** wrap platform components that already carry the design language (`Switch`, `DateTimePicker`, stack headers, `@expo/ui` views) just to route them through the system. Native styling *is* the design system for those.

## Where Decisions Live

| Decision | Lives in | Example |
|---|---|---|
| A visual value used anywhere twice | `src/theme/` | brand accent, spacing step |
| Structure + variants of a reused element | `src/components/` | Button, Card, EmptyState |
| One screen's private composition | `screens/<name>/` | profile header layout |
| One-off local adjustment | inline, with a comment | optical nudge on an icon |
| Screen titles, top-level chrome | navigation stack options | header title, large title |

## Self-Critique Pass

After building or changing a screen, screenshot it and check it against these principles (from [Expo's design-principles guide](https://expo.dev/blog/how-to-apply-professional-design-principles-in-ai-app-development)). Each one maps to a system fix, not a local tweak:

- **Hierarchy / contrast** - is the most important element obviously first? Fix with `type` ramp steps, not ad-hoc font sizes.
- **Proximity / white space** - do related items sit closer than unrelated ones? Fix with `gap` + spacing tokens.
- **Repetition / unity** - do all corners, shadows, and accents match? If not, a value escaped the theme - move it in.
- **Alignment** - do edges share axes? Fix with consistent screen edge padding.

If a screen fails the same check twice, the fix belongs in the theme or a component - not in the screen.

## Auditing an Existing App

To measure drift in an app that already has screens - hardcoded hex values, arbitrary spacing, inconsistent component APIs - follow `./references/audit.md`. It contains grep-based checks, a scoring rubric, and templates for documenting existing components and proposing new ones.

## Submitting Feedback
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes submit-expo-feedback@latest --category skills --subject "expo-design" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
If an AI agent repeatedly failed or the user had to take over an Expo task, load the expo-skill-feedback skill and follow its eval-candidate flow instead of reusing the command above.
