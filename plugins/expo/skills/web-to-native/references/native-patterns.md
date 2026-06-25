# Native patterns: redesigning web UX for native

Disclosed reference for [`web-to-native`](../SKILL.md), step 4. `false-friends.md` translates *idioms* (`div` → `View`); this translates *UX patterns* — a web interaction into its native equivalent. Step 4 isn't a port, it's this redesign.

**Reach for `@expo/ui` first.** It renders real SwiftUI (iOS) and Jetpack Compose (Android), so its components look and feel *exactly* like the OS — the difference between "native-ish RN" and "indistinguishable from an app Apple/Google shipped." Drop to styled RN primitives only for custom layouts `@expo/ui` doesn't cover (chat bubbles, bespoke cards). `@expo/ui` is a native module → needs a **dev build**, not Expo Go.

| Web pattern | Native redesign (reach for first) | Why |
|---|---|---|
| Top tab bar / nav links | **NativeTabs** — bottom, liquid glass on iOS 26 (`building-native-ui`) | Thumb-reachable, OS-native bar |
| Modal / dialog | **sheet** — `@expo/ui` BottomSheet / native presentation | Sheets *are* the native modal |
| `<select>` / dropdown | **Picker** or context **Menu** — `@expo/ui` | Native wheel/menu, no custom popover |
| Data table / grid | **List** with sections + swipe actions — `@expo/ui` | Tables don't exist on mobile |
| Form (stacked inputs) | grouped **List** rows: TextField / Switch / Picker — `@expo/ui` | The Settings-app form look |
| Checkbox / toggle | **Switch** — `@expo/ui` | Native switch, not a styled box |
| Date / time input | **DateTimePicker** — `@expo/ui` | Native wheel/calendar |
| Range slider | **Slider** — `@expo/ui` | |
| Hover menu / tooltip | long-press **context Menu** — `@expo/ui` | No hover on touch |
| Toast / snackbar | native banner + **haptic** (`expo-haptics`) | |
| Page header / breadcrumb | **large-title** Stack header, header search, native back (`building-native-ui`) | The native screen frame |
| Infinite-scroll list | virtualized `FlatList` / `FlashList`, momentum scroll | Never `.map()` a long list |
| Buttons | `@expo/ui` **Button** where it fits; `Pressable` for custom | Native press + haptics |
| Multi-column layout | single column + tabs / stack | One thing at a time on a phone |

**The test:** if a screenshot of the native screen could pass for the web version, you reskinned it. Redesign until it could pass for a screen the OS shipped.
