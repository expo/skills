# Native patterns: redesigning web UX for native

Disclosed reference for [`web-to-native`](../SKILL.md), step 4. `false-friends.md` translates *idioms* (`div` → `View`); this translates *UX patterns* — a web interaction into its native equivalent. Step 4 isn't a port, it's this redesign.

**Reach for `@expo/ui` first.** It renders real SwiftUI (iOS) and Jetpack Compose (Android), so its components look and feel *exactly* like the OS — the difference between "native-ish RN" and "indistinguishable from an app Apple/Google shipped." See the `expo-ui` skill. Drop to styled RN primitives only for what `@expo/ui` doesn't cover: custom layouts (chat bubbles, bespoke cards) and **large data lists** (`@expo/ui` `List` is a JS-thread node per item — use `FlashList`/`FlatList` for feeds). `@expo/ui` is a native module → needs a **dev build**, not Expo Go.

| Web pattern | Native redesign — reach for first | Why |
|---|---|---|
| Top tab bar / nav links | **NativeTabs** — bottom, liquid glass on iOS 26 (`building-native-ui`) | Thumb-reachable, OS-native bar |
| Page header / breadcrumb | **large-title** Stack header + header **search field** (`building-native-ui`) | The native screen frame |
| In-page tabs / toggle group | **SegmentedControl** — `@expo/ui` (`community/segmented-control`) | Native segmented switch |
| Modal / dialog | **BottomSheet** — `@expo/ui` (`community/bottom-sheet`) | Sheets *are* the native modal |
| `<select>` / dropdown | **Picker**, or long-press **MenuView** — `@expo/ui` (`community/menu`) | Native wheel / menu, no popover |
| Accordion / "show more" | **Collapsible** — `@expo/ui` | Native disclosure |
| Settings / short list | **List** + **FieldGroup** rows (Switch / Picker / TextInput) — `@expo/ui` | The Settings-app look |
| Data feed / table / long list | **FlashList** / `FlatList`, virtualized + momentum | Tables don't exist on mobile; `@expo/ui` `List` isn't for big data |
| Checkbox / toggle | **Switch** (on/off) or **Checkbox** (multi-select) — `@expo/ui` | Native control, not a styled box |
| Date / time input | **DateTimePicker** — `@expo/ui` (`community/datetime-picker`) | Native wheel / calendar |
| Range slider | **Slider** — `@expo/ui` | |
| Onboarding / carousel / swipe pages | **PagerView** — `@expo/ui` (`community/pager-view`) | Native paging, not a scroll strip |
| Refresh button / auto-poll | pull-to-refresh (`RefreshControl`) | The native refresh gesture |
| Hover menu / tooltip | long-press **MenuView** context menu — `@expo/ui` (`community/menu`) | No hover on touch |
| Toast / snackbar | native banner + **haptic** (`expo-haptics`) | |
| Buttons | `@expo/ui` **Button**; `Pressable` for custom | Native press + haptics |
| Multi-column layout | single column + tabs / stack | One thing at a time on a phone |

**The test:** if a screenshot of the native screen could pass for the web version, you reskinned it. Redesign until it could pass for a screen the OS shipped.
