# Icons (SF Symbols)

Use SF Symbols for native feel. Never use FontAwesome, Ionicons, or other vector icon libraries. Render them with `expo-image` and an `sf:` source — not `expo-symbols` or `@expo/vector-icons`.

## Usage

```tsx
import { Image } from "expo-image";
import { colors } from "@/theme/colors";

<Image
  source="sf:square.and.arrow.down"
  tintColor={colors.label as string}
  style={{ width: 16, height: 16 }}
/>;
```

- `tintColor` on `expo-image` accepts only `string` — cast `Color` values: `colors.label as string`
- `sf:` sources are iOS-only; provide a different `source` on Android/web

## Animations (iOS 17+)

- Animate in place with `sfEffect`: `sfEffect="bounce"` or `sfEffect={{ effect: "pulse", repeat: -1 }}`. Effect types: `bounce`, `pulse`, `variable-color`, `scale`, `wiggle`, `rotate`, `breathe`, `draw/on`, `draw/off` (plus `/up`, `/down`, `/iterative`, `/cumulative` variants).
- Animate symbol *changes* with `transition={{ effect: "sf:replace" }}` (also `sf:down-up`, `sf:up-up`, `sf:off-up`) — runs when the `source` swaps, e.g. `heart` → `heart.fill`.

## Finding Symbol Names

Browse the free SF Symbols app on macOS or https://developer.apple.com/sf-symbols/. Names use dot notation (`square.and.arrow.up`); do not invent names — verify they exist in the catalog.

## Rules

- Use `.fill` variants for selected/active states
- Tint with the cross-platform `colors` helper (see SKILL.md "Colors") so icons adapt to dark mode
- Keep icons at consistent sizes (16, 20, 24, 32)

> Source: https://docs.expo.dev/versions/latest/sdk/image/ — the canonical `expo-image` page covering `sf:` sources, `sfEffect`, and transitions (append `.md` for markdown; swap `latest` for the project's SDK, e.g. `v57.0.0`). This reference adds only the icon-selection rules above.
