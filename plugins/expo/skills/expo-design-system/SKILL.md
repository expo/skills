---
name: expo-design-system
description: Framework (OSS). Build and maintain a design system inside an Expo app - a reusable theme of design tokens (color, spacing, typography, radius, shadow, motion), reusable component structure with variant/size/state prop conventions, and rules for when to extract a repeated view into a shared component. Use when creating or organizing theme files and design tokens (theme.ts / theme/), extending an existing theme or styling library (NativeWind, Tamagui, Restyle, Unistyles) in its own idiom, standardizing styles so screens (including AI-generated ones) look consistent and polished, fixing an app that looks AI-generated or generic instead of native (the named native-slop tells), building an in-app component library, or auditing an app for design-system drift (hardcoded colors, spacing, fonts). For platform styling specifics (semantic colors, HIG rules, native controls) use expo-native-ui; for folder layout of a new app use expo-project-structure.
version: 1.0.0
license: MIT
---

# Expo Design Systems

Make every screen in an app draw from one visual source of truth: a token theme and a small set of reusable components. This skill defines where tokens live, what they cover, how reusable components are shaped, and when a repeated view earns promotion into the system.

Sibling skills own the layers around this one:

- `expo-native-ui` - platform styling rules (HIG, semantic colors, controls, shadows syntax). Follow it for **what values look native**; follow this skill for **where values live and how they're reused**.
- `expo-project-structure` - folder skeleton for new apps.
- `expo-animation` - whether custom motion is needed, and its timing, springs, and reduced-motion behavior.

For an existing styling library, preserve its token names, scale, and storage format; follow that library's version-matched setup guidance. The examples below are defaults for an app without a system, not a migration target.

## References

Consult these resources as needed:

```
references/
  audit.md        Audit an existing app for design-system drift: grep checks,
                  scoring rubric, incremental adoption plan, and templates for
                  documenting or extending components
  native-slop.md  The 20 named anti-pattern tells of AI-generated apps (The Web
                  Modal, Everything's a Card, ...) with grep checks for the greppable ones
```

## Adopt Before You Build

In an app that already has screens, the first move is detection, not construction. Before writing any token file:

1. **Look for a declared system.** Check `package.json` for a styling library - NativeWind/Tailwind, Tamagui, Restyle, Unistyles, styled-components. Then look for a token file: `theme.ts`, `src/theme/`, `constants/theme.ts`, or `constants/Colors.ts` (the create-expo-app default).
2. **If one exists, it is the source of truth.** Extend it in its own idiom - its names, its scale, its storage format. Audit drift against that system, not against the examples below.
3. **If only de facto values exist** - the same greys and paddings repeated across screens, no theme file - derive tokens from those values. Use a 4-point grid as a starting point for custom layout spacing, not for typography, hairlines, or native control metrics (`references/audit.md` §5).
4. **Never introduce a second system beside an existing one.** A fresh `src/theme/` next to a Tamagui config is design-system drift, not adoption.

Only when nothing exists do the defaults below apply as written.

## The Theme

In an app without an existing system, all design tokens live under `src/theme/`. In a project without a `src/` folder (the default `create-expo-app` template has `app/`, `components/`, and `constants/` at the root), use the equivalent top-level location - typically `theme/` or the existing `constants/` - and keep the same file layout. Start small and split by token class as it grows:

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

Build the palette from platform semantic colors: `Color` from `expo-router` wrapped in `Platform.select`, centralized in `theme/colors.ts`. Semantic colors resolve on-device and adapt to light/dark automatically - prefer them for backgrounds, labels, and separators. (`expo-native-ui` "Colors" covers the full palette and rationale; the minimal version is:)

```tsx
// theme/colors.ts
import { Platform } from "react-native";
import { Color } from "expo-router";

export const colors = {
  label: Platform.select({
    ios: Color.ios.label,
    android: Color.android.dynamic.onSurface,
    default: "#000000",
  })!,
  secondaryLabel: Platform.select({
    ios: Color.ios.secondaryLabel,
    android: Color.android.dynamic.onSurfaceVariant,
    default: "#3c3c43",
  })!,
  separator: Platform.select({
    ios: Color.ios.separator,
    android: Color.android.dynamic.outlineVariant,
    default: "#c6c6c8",
  })!,
  systemBackground: Platform.select({
    ios: Color.ios.systemBackground,
    android: Color.android.dynamic.surface,
    default: "#ffffff",
  })!,
  systemBlue: Platform.select({
    ios: Color.ios.systemBlue,
    android: Color.android.dynamic.primary,
    default: "#007aff",
  })!,
  // Pair Android's dynamic primary with its corresponding foreground.
  onTint: Platform.select({
    ios: "#ffffff",
    android: Color.android.dynamic.onPrimary,
    default: "#ffffff",
  })!,
};
```

Add brand colors as explicit light/dark pairs only when the brand requires values the platform doesn't provide:

```tsx
// theme/brand.ts
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

**Static-safe vs hook-only.** The two patterns above have different reach - keep the boundary explicit:

- Semantic/platform colors (`colors` above) are **static-safe**: they resolve on-device, so plain token files like `theme/typography.ts` can import them at module scope.
- Brand light/dark pairs are **hook-only**: `useBrandColors()` reads the color scheme at render time, so brand colors can only be applied inside components. A static token file cannot call the hook.
- The boundary is evaluation time, not file placement: never call a hook at module scope. If a static style (a `type` ramp step, a `variants` object) needs the brand accent, apply the hook's color in the component at render time. Keep foreground/background pairs together and check their contrast in both modes; fixed white is not a universal foreground for dynamic accents.

### Spacing

For custom layout in an app without a scale, start with this 4-point grid. Name steps by size, not by use:

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

- Use `gap` with spacing tokens between siblings; use padding inside containers and margin outside them.
- Screen edge padding is `spacing.md` unless the design says otherwise - pick one and keep it.
- Prefer an existing step when it preserves the intended grouping and alignment. Keep native control metrics and safe-area insets intact rather than rounding them to this grid.
- If the same in-between multiple of 4 keeps recurring (12 and 20 are common), add it to the scale as a named step instead of scattering literals. The audit whitelist must then include it too.

### Typography

Define named text roles, not raw font sizes. Prefer native text styles for native controls. This is an iOS-oriented starting ramp for custom React Native text; use the app's Material typography on Android, with platform-specific values behind the same roles when needed. The spacing grid does not constrain font sizes or line heights:

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

If the project bundles static font files (one file per weight, loaded with `expo-font` or the config plugin), set weight via `fontFamily` names instead and omit `fontWeight` - otherwise iOS synthesizes the weight or falls back to the system font:

```tsx
headline: { fontSize: 17, fontFamily: "SFProRounded-Semibold", color: colors.label },
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

**Dynamic Type.** Text scales with the user's system text-size setting (`allowFontScaling` is on by default). Use padding or `minHeight` around text so rows can grow, and check large accessibility text sizes. Let labels wrap or reflow before considering a per-element `maxFontSizeMultiplier` for constrained chrome; dense rows alone are not a reason to cap readable text. Never disable scaling app-wide with `allowFontScaling={false}`.

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

Use `expo-animation` to choose motion for the interaction, then store reused timing/spring configs in `theme/motion.ts`. Keep timing durations and spring configs distinct; a generic `slow` duration should not replace a native sheet or navigation transition. Preserve built-in feedback on native controls.

Reanimated caveat: don't pass `Color`/`PlatformColor` token values into Reanimated styles - use static colors there (see `expo-native-ui`).

## Reusable Components

The theme controls values; components control structure. Shared primitives live in `src/components/` (see `expo-project-structure`). Check `expo-ui` before creating a custom control; the contract and Button example below apply when a custom React Native primitive is needed.

### The component contract

Custom interactive primitives define the applicable parts of this contract; text and layout primitives do not need button variants or pressed/loading states:

- **Variants** - visual intent: `primary`, `secondary`, `ghost`, `destructive`. Add a variant only when a real screen needs it.
- **Sizes** - `sm`, `md`, `lg`. Default `md`. Sizes map to spacing/typography tokens, never to fresh numbers.
- **States** - default, **pressed** (not hover - this is touch), disabled, loading. Handle pressed with a `Pressable` style function; never leave a tappable element without pressed feedback.
- **Style override** - accept a `style` prop and merge it **last**, so callers can adjust layout (margins, flex) without forking the component. Callers may override layout, not identity - a caller changing a button's colors is a signal the variant set is missing something.
- **Accessibility** - custom interactive primitives expose their role and disabled/busy/selected state as applicable. Text children can supply the label; icon-only controls and buttons that replace text with a spinner need an explicit label that remains available while loading. Verify labels on native controls too.

```tsx
// components/button.tsx
import { Pressable, ActivityIndicator, Platform, useColorScheme, ViewStyle, StyleProp } from "react-native";
import { colors, spacing, radius } from "@/theme";
import { ThemedText } from "./themed-text";

const variants = {
  primary: { backgroundColor: colors.systemBlue, color: colors.onTint },
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
  useColorScheme(); // Re-render Android semantic colors when the OS theme changes.
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: variants[variant].backgroundColor,
          borderRadius: radius.md,
          borderCurve: "continuous",
          alignItems: "center",
          justifyContent: "center",
          minHeight: Platform.OS === "android" ? 48 : 44,
          minWidth: Platform.OS === "android" ? 48 : 44,
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

Use semantic content props when they keep a simple control clear (`title` on Button). When a container starts accumulating slots (`leftIcon`, `subtitle`, `footerText`, `badgeCount`), prefer composition with `children` instead of adding a prop for every layout.

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

Recheck the rendered result after fixing a value; moving it into the theme does not itself fix the layout. If the same defect recurs across screens, fix the shared token or component. Also run the primary-task and content checks in `expo-native-ui`'s Behavior section; screenshots alone cannot verify interaction.

## Named Failures: Native Slop

Use these names to recognize common mistakes when building and reviewing:

- **The Web Modal** - a custom centered dialog used for composing or picking. Prefer a native sheet (`formSheet`, `@expo/ui` BottomSheet) or menu; native confirmation alerts remain appropriate for consequential actions.
- **Everything's a Card** - every row and section in its own white rounded shadowed box. Use grouped lists; group with background and hairlines, not borders.
- **Emoji Iconography** - 🔥 ⚙️ ✨ as tab or button icons. SF Symbols on iOS, Material icons on Android.
- **The Purple-Gradient Hero** - a decorative gradient intro pushing the task below the fold. Lead task screens with useful content; retain a hero when it serves the requested experience.
- **The Spinner Blink** - a full-screen spinner between every state, or "No items yet" flashing during the first load. Every screen has four states (see `expo-data-fetching`).

Treat visual tells as review prompts, not blanket bans on cards, fonts, or branding. Fix the observable problem and respect the user's brief and existing design system. The full list of 20 and candidate grep checks are in `./references/native-slop.md`; use them to explain the problem and replacement when reviewing a screen.

## Auditing an Existing App

To measure drift in an app that already has screens - hardcoded hex values, arbitrary spacing, inconsistent component APIs - follow `./references/audit.md`. It contains grep-based checks, a scoring rubric, an incremental adoption order for fixing a drifted app, and templates for documenting existing components and proposing new ones.

## Submitting Feedback
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes submit-expo-feedback@latest --category skills --subject "expo-design-system" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
If an AI agent repeatedly failed or the user had to take over an Expo task, load the expo-skill-feedback skill and follow its eval-candidate flow instead of reusing the command above.
