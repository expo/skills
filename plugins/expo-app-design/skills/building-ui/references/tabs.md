# Native Tabs

Always prefer NativeTabs from 'expo-router/unstable-native-tabs' for the best iOS experience.

**Requires SDK 54+**

## Basic Usage

```tsx
import {
  NativeTabs,
  Icon,
  Label,
  Badge,
} from "expo-router/unstable-native-tabs";

export default function TabLayout() {
  return (
    <NativeTabs minimizeBehavior="onScrollDown">
      <NativeTabs.Trigger name="index">
        <Label>Home</Label>
        <Icon sf="house.fill" />
        <Badge>9+</Badge>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <Icon sf="gear" />
        <Label>Settings</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="(search)" role="search">
        <Label>Search</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
```

## Rules

- You must include a trigger for each tab
- The `NativeTabs.Trigger` 'name' must match the route name, including parentheses (e.g. `<NativeTabs.Trigger name="(search)">`)
- Prefer search tab to be last in the list so it can combine with the search bar
- Use the 'role' prop for common tab types

## Platform Features

Native Tabs use platform-specific tab bar implementations:

- **iOS 26+**: Liquid glass effects with system-native appearance
- **Android**: Material 3 bottom navigation
- Better performance and native feel

## Icon Component

```tsx
// SF Symbol only (iOS)
<Icon sf="house.fill" />

// With Android drawable
<Icon sf="house.fill" drawable="ic_home" />

// Custom image source
<Icon src={require('./icon.png')} />

// State variants (default/selected)
<Icon sf={{ default: "house", selected: "house.fill" }} />
```

## Label Component

```tsx
// Basic label
<Label>Home</Label>

// Hidden label (icon only)
<Label hidden>Home</Label>
```

## Badge Component

```tsx
// Numeric badge
<Badge>9+</Badge>

// Dot indicator (empty badge)
<Badge />
```

## iOS 26 Features

### Liquid Glass Tab Bar

The tab bar automatically adopts liquid glass appearance on iOS 26+.

### Minimize on Scroll

```tsx
<NativeTabs minimizeBehavior="onScrollDown">
```

### Search Tab

Add a dedicated search tab that integrates with the tab bar search field:

```tsx
<NativeTabs.Trigger name="(search)" role="search">
  <Label>Search</Label>
</NativeTabs.Trigger>
```

**Note**: Place search tab last for best UX.

### Role Prop

Use semantic roles for special tab types:

```tsx
<NativeTabs.Trigger name="search" role="search" />
<NativeTabs.Trigger name="favorites" role="favorites" />
<NativeTabs.Trigger name="more" role="more" />
```

Available roles: `search` | `more` | `favorites` | `bookmarks` | `contacts` | `downloads` | `featured` | `history` | `mostRecent` | `mostViewed` | `recents` | `topRated`

## Customization

### Tint Color

```tsx
<NativeTabs tintColor="#007AFF">
```

### Dynamic Colors (iOS)

Use DynamicColorIOS for colors that adapt to liquid glass:

```tsx
import { DynamicColorIOS, Platform } from 'react-native';

const adaptiveBlue = Platform.select({
  ios: DynamicColorIOS({ light: '#007AFF', dark: '#0A84FF' }),
  default: '#007AFF',
});

<NativeTabs tintColor={adaptiveBlue}>
```

## Conditional Tabs

Hide tabs conditionally:

```tsx
<NativeTabs.Trigger name="admin" hidden={!isAdmin}>
  <Label>Admin</Label>
  <Icon sf="shield.fill" />
</NativeTabs.Trigger>
```

## Behavior Options

```tsx
<NativeTabs.Trigger
  name="home"
  disablePopToTop    // Don't pop stack when tapping active tab
  disableScrollToTop // Don't scroll to top when tapping active tab
>
```

## Using Vector Icons

If you must use @expo/vector-icons instead of SF Symbols:

```tsx
import { VectorIcon } from "expo-router/unstable-native-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";

<NativeTabs.Trigger name="home">
  <VectorIcon vector={Ionicons} name="home" />
  <Label>Home</Label>
</NativeTabs.Trigger>;
```

**Prefer SF Symbols over vector icons for native feel on Apple platforms.**

## Structure with Stacks

Native tabs don't render headers. Nest Stacks inside each tab for navigation headers:

```tsx
// app/(tabs)/_layout.tsx
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";

export default function TabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="(home)">
        <Label>Home</Label>
        <Icon sf="house.fill" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

// app/(tabs)/(home)/_layout.tsx
import Stack from "expo-router/stack";

export default function HomeStack() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{ title: "Home", headerLargeTitle: true }}
      />
      <Stack.Screen name="details" options={{ title: "Details" }} />
    </Stack>
  );
}
```

## Migration from JS Tabs

### Before (JS Tabs)

```tsx
import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <IconSymbol name="house.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) => <IconSymbol name="gear" color={color} />,
        }}
      />
    </Tabs>
  );
}
```

### After (Native Tabs)

```tsx
import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";

export default function TabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Label>Home</Label>
        <Icon sf="house.fill" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <Label>Settings</Label>
        <Icon sf="gear" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
```

### Key Differences

| JS Tabs                    | Native Tabs               |
| -------------------------- | ------------------------- |
| `<Tabs.Screen>`            | `<NativeTabs.Trigger>`    |
| `options={{ title }}`      | `<Label>Title</Label>`    |
| `options={{ tabBarIcon }}` | `<Icon sf="symbol" />`    |
| Props-based API            | React component-based API |
| `tabBarBadge` option       | `<Badge>` component       |

### Migration Steps

1. **Change imports**

   ```tsx
   // Remove
   import { Tabs } from "expo-router";

   // Add
   import {
     NativeTabs,
     Icon,
     Label,
     Badge,
   } from "expo-router/unstable-native-tabs";
   ```

2. **Replace Tabs with NativeTabs**

   ```tsx
   // Before
   <Tabs screenOptions={{ ... }}>

   // After
   <NativeTabs>
   ```

3. **Convert each Screen to Trigger**

   ```tsx
   // Before
   <Tabs.Screen
     name="home"
     options={{
       title: 'Home',
       tabBarIcon: ({ color }) => <Icon name="house" color={color} />,
       tabBarBadge: 3,
     }}
   />

   // After
   <NativeTabs.Trigger name="home">
     <Label>Home</Label>
     <Icon sf="house.fill" />
     <Badge>3</Badge>
   </NativeTabs.Trigger>
   ```

4. **Move headers to nested Stack** - Native tabs don't render headers
   ```
   app/
     (tabs)/
       _layout.tsx      <- NativeTabs
       (home)/
         _layout.tsx    <- Stack with headers
         index.tsx
       (settings)/
         _layout.tsx    <- Stack with headers
         index.tsx
   ```

## Limitations

- **Android**: Maximum 5 tabs (Material Design constraint)
- **Nesting**: Native tabs cannot nest inside other native tabs
- **Tab bar height**: Cannot be measured programmatically
- **FlatList transparency**: Use `disableTransparentOnScrollEdge` to fix issues

## Keyboard Handling (Android)

Configure in app.json:

```json
{
  "expo": {
    "android": {
      "softwareKeyboardLayoutMode": "resize"
    }
  }
}
```

## Common Issues

1. **Icons not showing on Android**: Add `drawable` prop or use `VectorIcon`
2. **Headers missing**: Nest a Stack inside each tab group
3. **Trigger name mismatch**: Ensure `name` matches exact route name including parentheses
4. **Badge not visible**: Badge must be a child of Trigger, not a prop
