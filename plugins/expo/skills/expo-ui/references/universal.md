# Universal `@expo/ui` components

> Requires Expo SDK 56+.

Universal components are a single-API layer over the platform-native UI toolkits: Jetpack Compose on Android, SwiftUI on iOS, and `react-native-web` / `react-dom` on web. You write one component tree that runs unmodified on all three platforms while keeping a native look and feel — no `.ios.tsx` / `.android.tsx` split.

## Installation

```bash
npx expo install @expo/ui
```

## Usage

Import everything, including `Host`, from the package root (`@expo/ui`). Every tree must be wrapped in `Host`.

```tsx
import { Host, Column, Button, Text } from '@expo/ui';

<Host matchContents>
  <Column>
    <Text>Hello</Text>
    <Button onPress={() => alert('Pressed!')}>Press me</Button>
  </Column>
</Host>;
```

## Components

| Category | Components |
|----------|------------|
| Container | `Host` (required root wrapper) |
| Layout | `Column`, `Row`, `Spacer`, `ScrollView` |
| Display | `Text`, `Icon` |
| Controls | `Button`, `Switch`, `Checkbox`, `Slider`, `TextInput`, `Picker` |
| Disclosure & presentation | `BottomSheet`, `Collapsible` |
| Collections & forms | `List` (with `ListItem`), `FieldGroup` |

## Confirming the API

Before using a component, fetch its docs to confirm props:

- Overview — https://docs.expo.dev/versions/latest/sdk/ui/universal/index.md
- Per component — https://docs.expo.dev/versions/latest/sdk/ui/universal/{component-name}/index.md

## When to drop down to a platform-specific layer

Choose universal components whenever they cover the requirement. Drop down to `@expo/ui/swift-ui` or `@expo/ui/jetpack-compose` only when the universal API doesn't expose the component, modifier, or platform-specific behavior you need — accepting the per-platform file split that requires. See `./swift-ui.md` and `./jetpack-compose.md`.
