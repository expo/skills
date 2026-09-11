# Native patterns: redesigning web UX for native

Disclosed reference for [`expo-web-to-native`](../SKILL.md), step 4. `false-friends.md` translates *idioms* (`div` → `View`); this translates *UX patterns* - a web interaction into its native equivalent. Step 4 isn't a port, it's this redesign.

**Reach for `@expo/ui` first.** It renders real SwiftUI (iOS) and Jetpack Compose (Android), so its components look and feel *exactly* like the OS — the difference between "native-ish RN" and "indistinguishable from an app Apple/Google shipped." See the `expo-ui` skill. Drop to styled RN primitives only for what `@expo/ui` doesn't cover: custom layouts (chat bubbles, bespoke cards) and **large data lists** (`@expo/ui` `List` is a JS-thread node per item — use `FlashList`/`FlatList` for feeds). `@expo/ui` runs in **Expo Go** (SDK 56+) — no dev build needed; reach for a dev build (the `expo-dev-client` skill) only for *custom* native modules.

| Web pattern | Native redesign — reach for first | Why |
|---|---|---|
| Top tab bar / nav links | **NativeTabs** - bottom, liquid glass on iOS 26 (`expo-router`) | Thumb-reachable, OS-native bar |
| Page header / breadcrumb | Native Stack header; iOS large title and header search where appropriate (`expo-router`) | Platform navigation chrome |
| In-page tabs / toggle group | **SegmentedControl** — `@expo/ui` (`community/segmented-control`) | Native segmented switch |
| Modal / dialog | Native sheet for composing/picking; native alert for uncommon irreversible confirmations | Choose by task; routine reversible actions can offer undo |
| `<select>` / dropdown | **Picker**, or long-press **MenuView** — `@expo/ui` (`community/menu`) | Native wheel / menu, no popover |
| Accordion / "show more" | **Collapsible** — `@expo/ui` | Native disclosure |
| Settings / short list | **List** + **FieldGroup** rows (Switch / Picker / TextInput) — `@expo/ui` | The Settings-app look |
| Data feed / table / long list | **FlashList** / `FlatList`, virtualized + momentum | Tables don't exist on mobile; `@expo/ui` `List` isn't for big data |
| Checkbox / toggle | **Switch** (on/off) or **Checkbox** (multi-select) — `@expo/ui` | Native control, not a styled box |
| Date / time input | **DateTimePicker** — `@expo/ui` (`community/datetimepicker`) | Native wheel / calendar |
| Range slider | **Slider** — `@expo/ui` | |
| Onboarding / carousel / swipe pages | **PagerView** — `@expo/ui` (`community/pager-view`) | Native paging, not a scroll strip |
| Refresh button / auto-poll | pull-to-refresh (`RefreshControl`) | The native refresh gesture |
| Hover menu / tooltip | long-press **MenuView** context menu — `@expo/ui` (`community/menu`) | No hover on touch |
| Toast / snackbar | Nonblocking status feedback; haptics only when useful and not already provided | Follow `expo-animation`'s frequency and haptic rules |
| Buttons | `@expo/ui` **Button**; `Pressable` for custom | Native press + haptics |
| Multi-column layout | single column + tabs / stack | One thing at a time on a phone |

**The test:** preserve the product's identity while adapting navigation, controls, touch targets, and keyboard behavior to the platform. Visual resemblance to the web version alone is not a failure.

## Feel — beyond the components

The table gets the right *components*; native behavior also includes motion and touch. Preserve built-in feedback, then use `expo-animation` to decide whether custom motion is needed. `expo-router` owns navigation/transitions and `expo-native-ui` owns layout and visual effects:

- **Transitions for free** - use Expo Router's native-stack so push/pop, modals, and sheets animate with real platform physics; shared-element zoom via `expo-router` `zoom-transitions.md`.
- **Motion** - Reanimated (`withSpring`/`withTiming`) + `react-native-gesture-handler` for swipes/drags → load the `expo-animation` skill (purpose gate, timing values, interruption).
- **Touch** — preserve native feedback; add haptics to custom interactions only per `expo-animation`'s frequency gate, without duplicating a control's existing response.
- **Native rhythm** — large-title collapse on scroll, momentum / inverted scroll, a keyboard that pushes content (`KeyboardAvoidingView`).
- **Respect reduced motion** — gate non-essential animation on Reanimated's `useReducedMotion()`.

**Feel can't be screenshotted.** A janky transition or wrong easing passes a still-image parity check and still betrays the app — for screens with motion, verify with a short recording (iOS `xcrun simctl io booted recordVideo feel.mov`; Android `adb shell screenrecord`; or a device-agent flow), not just a screenshot.
