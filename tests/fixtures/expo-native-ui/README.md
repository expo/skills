# Native UI guidance regression scenarios

These agent scenarios cover ENG-25814. They test decisions and generated code, not exact skill wording. No app build or external writes are required.

For each scenario, start a fresh agent with only the prompt below and access to `plugins/expo/skills/expo-native-ui/SKILL.md` and its references. Do not give it the acceptance criteria. Inspect the response against the criteria afterward. These are manual behavioral tests, not part of automated CI.

## Existing cross-platform icons

Prompt:

> Use the expo-native-ui skill to review this SDK 57 screen icon. The app ships on iOS, Android, and web. Would you change its library or names? Explain briefly and show any necessary code.
>
> ```tsx
> import { SymbolView } from "expo-symbols";
> <SymbolView name={{ ios: "gear", android: "settings", web: "settings" }} size={24} />;
> ```

Acceptance:

- Preserves working `SymbolView` code and all three platform names.
- Identifies SF Symbols on iOS and Material Symbols on Android/web.
- Does not replace the icon with an `expo-image` `sf:` source or claim it works on Android/web.

## Missing Android and web icons

Prompt:

> Use the expo-native-ui skill to fix this download icon, which appears on iOS but is blank on Android and web. Give the smallest code change and explain why it works. Also explain whether expo-image's sf: source or SDK 57's @expo/ui Icon could cover the same three targets.
>
> ```tsx
> import { SymbolView } from "expo-symbols";
> <SymbolView name="square.and.arrow.down" size={24} />;
> ```

Acceptance:

- Keeps `SymbolView`, supplying `ios: "square.and.arrow.down"`, `android: "download"`, and `web: "download"`.
- Explains that a string name is iOS-only and a missing platform name yields the fallback or nothing.
- Scopes `expo-image` `sf:` to iOS and the SDK 57 `@expo/ui` Icon option to iOS/Android, including `Icon.select` and `@expo/material-symbols` when describing its API.

## Legacy iOS shadow migration

Prompt:

> Use the expo-native-ui skill to convert this legacy iOS shadow to a boxShadow value while preserving blur and effective opacity. Return a literal value and explain the calculation.
>
> ```tsx
> {
>   shadowColor: "rgba(24, 48, 72, 0.6)",
>   shadowOpacity: 0.25,
>   shadowOffset: { width: -2, height: 5 },
>   shadowRadius: 7,
> }
> ```

Acceptance:

- Produces `blurRadius: 14`, offsets `-2` and `5`, and color `rgba(24, 48, 72, 0.15)`, or an equivalent CSS string.
- Doubles the legacy radius and multiplies existing color alpha by shadow opacity.
- Omits legacy shadow props and any separate opacity field inside `boxShadow`.
- Does not claim the same factor converts Android elevation.
