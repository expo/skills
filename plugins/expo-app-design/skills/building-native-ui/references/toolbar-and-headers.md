# Toolbars and headers

Add native iOS toolbar items to Stack screens. Items can be placed in the header (left/right) or in a bottom toolbar area.

**Important:** iOS only. Available in Expo SDK 55+.

## Basic Usage

```tsx
import { Stack } from "expo-router";

export default function Page() {
  return (
    <>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon="star.fill" onPress={() => {}} />
      </Stack.Toolbar>
      {/* Page content */}
    </>
  );
}
```

## Placement

- `"left"` - Header left
- `"right"` - Header right
- `"bottom"` (default) - Bottom toolbar

## Components

### Button

```tsx
<Stack.Toolbar.Button icon="star.fill" onPress={() => {}} />
<Stack.Toolbar.Button onPress={() => {}}>Add</Stack.Toolbar.Button>
```

**Props:** `icon`, `image`, `onPress`, `disabled`, `hidden`, `variant` (`"plain"` | `"done"` | `"prominent"`), `tintColor`

### Menu

Dropdown menu for grouping actions.

```tsx
<Stack.Toolbar.Menu icon="ellipsis.circle" title="Actions">
  <Stack.Toolbar.MenuAction icon="paperplane" onPress={handleSend}>
    Send
  </Stack.Toolbar.MenuAction>
  <Stack.Toolbar.MenuAction icon="trash" destructive onPress={handleDelete}>
    Delete
  </Stack.Toolbar.MenuAction>
  <Stack.Toolbar.MenuAction icon="tray" isOn={archived} onPress={toggleArchive}>
    Archive
  </Stack.Toolbar.MenuAction>

  {/* Nested inline menu - will add a divider above and below*/}
  <Stack.Toolbar.Menu inline title="Organize">
    <Stack.Toolbar.MenuAction icon="folder" onPress={handleMove}>
      Move
    </Stack.Toolbar.MenuAction>
  </Stack.Toolbar.Menu>
</Stack.Toolbar.Menu>
```

**Menu Props:** All Button props plus `title`, `inline`, `palette`, `elementSize` (`"small"` | `"medium"` | `"large"`)

**MenuAction Props:** `icon`, `onPress`, `isOn`, `destructive`, `disabled`, `subtitle`

When creating a palette with dividers, use `inline` combined with `elementSize="small"`. `palette` will not apply dividers on iOS 26.

### Spacer

```tsx
<Stack.Toolbar.Spacer />           // Bottom toolbar - flexible
<Stack.Toolbar.Spacer width={16} /> // Header - requires explicit width
```

### View

Embed custom React Native components.

```tsx
<Stack.Toolbar.View>
  <Pressable onPress={() => {}}>
    <SymbolView name="line.3.horizontal.decrease.circle" size={24} />
  </Pressable>
</Stack.Toolbar.View>
```

## Recommendations

- For longer toolbars create a separate component toolbar component to keep screen files clean.
- When using `Stack.Toolbar` prefer to add them directly inside the screen component, not in layout files.

## Limitations

- iOS only
- `placement="bottom"` cannot be used in layout files
- `Stack.Toolbar.Badge` only works with `placement="left"` or `"right"`
- Header Spacers require explicit `width`

## Reference

https://docs.expo.dev/versions/unversioned/sdk/router
