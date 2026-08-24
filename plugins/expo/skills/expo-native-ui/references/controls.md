# Native Controls

> **Prefer `@expo/ui` for these controls.** Its `Slider`, `Switch`, `DateTimePicker`, `Menu`, and segmented pickers render as real SwiftUI / Jetpack Compose and follow platform design conventions automatically — recommended over the React Native controls below. See the **`expo-ui`** skill; use the React Native fallbacks below only when you're not using `@expo/ui`.

## Fallback Packages

When not using `@expo/ui`, use these — standard props apply, see each package's docs:

| Control | Package | Notes |
| --- | --- | --- |
| Switch | `react-native` built-in | Built-in haptics |
| Segmented control | `@react-native-segmented-control/segmented-control` | Rules below; `values` accepts strings or `Image`s, not icon objects |
| Slider | `@react-native-community/slider` | Set `step` for discrete values |
| Date/time picker | `@react-native-community/datetimepicker` | Built-in haptics; `mode`: `date` \| `time` \| `datetime` |
| Wheel picker | `@react-native-picker/picker` | For 5+ options |
| Stepper | — none | React Native has no Stepper component (do not import one); compose +/- buttons |

## Segmented Control Rules

- Use for non-navigational tabs or mode selection
- Maximum 4 options — use a picker for more
- Keep labels short (1-2 words)

## Rules

- **Haptics**: Switch and DateTimePicker have haptics built in — don't add extra
- **Dark mode**: avoid custom track/thumb/tint colors — native styling adapts automatically
- **Accessibility**: native controls ship correct accessibility labels by default — don't override

> Source: https://docs.expo.dev/versions/latest/sdk/ui/ — the canonical `@expo/ui` component list (append `.md` for markdown; swap `latest` for the project's SDK, e.g. `v57.0.0`). This reference adds only the fallback-package mapping and control rules the docs do not cover.
