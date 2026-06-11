# Platform-specific iOS UI: `@expo/ui/swift-ui`

Use this layer only when the universal `@expo/ui` components don't cover what you need on iOS (see `./universal.md` first). This requires a platform-specific tree, typically in an `.ios.tsx` file.

## Instructions

- Expo UI's API mirrors SwiftUI's API. Use SwiftUI knowledge to decide which components or modifiers to use.
- Components are imported from `@expo/ui/swift-ui`, modifiers from `@expo/ui/swift-ui/modifiers`.
- **The installed package's TypeScript types (`.d.ts`) are the most reliable source of truth** for the exact API on your SDK version (@expo/ui is versioned with the SDK and its API can change between versions) — read the relevant `{Component}/index.d.ts` from the installed `@expo/ui/swift-ui` package in `node_modules`. Use the docs below as the human-readable reference.
- When about to use a component, fetch its docs to confirm the API — https://docs.expo.dev/versions/latest/sdk/ui/swift-ui/{component-name}/index.md
- When unsure about a modifier's API, refer to the docs — https://docs.expo.dev/versions/latest/sdk/ui/swift-ui/modifiers/index.md
- Every SwiftUI tree must be wrapped in `Host`.
- `RNHostView` is specifically for embedding RN components inside a SwiftUI tree. Example:

```jsx
import { Host, VStack, RNHostView } from "@expo/ui/swift-ui";
import { Pressable } from "react-native";

<Host matchContents>
  <VStack>
    <RNHostView matchContents>
      // Here, `Pressable` is an RN component so it is wrapped in `RNHostView`.
      <Pressable />
    </RNHostView>
  </VStack>
</Host>;
```

- If a required modifier or View is missing in Expo UI, it can be extended via a local Expo module. See: https://docs.expo.dev/guides/expo-ui-swift-ui/extending/index.md. Confirm with the user before extending.
