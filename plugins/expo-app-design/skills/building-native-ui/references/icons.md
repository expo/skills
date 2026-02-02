# Icons (SF Symbols)

Use SF Symbols via `expo-image` for native feel. Never use FontAwesome, Ionicons, or `@expo/vector-icons`.

SF Symbols are supported on Apple platforms (iOS, macOS, tvOS, visionOS) via the `sf:` source prefix in `expo-image` (SDK 55+).

```tsx
import { Image } from "expo-image";
import { Color } from "expo-router";

<Image
  source="sf:square.and.arrow.down"
  style={{ fontSize: 16, color: Color.ios.label }}
/>
```

The `source` format is `sf:<symbol-name>` where the symbol name matches Apple's SF Symbol names.

## Props

```tsx
<Image
  source="sf:star.fill"      // SF Symbol name with sf: prefix (required)
  style={{
    fontSize: 24,            // Size via font size
    color: Color.ios.label,  // Icon color via Color from expo-router
    fontWeight: "regular",   // thin | ultralight | light | regular | medium | semibold | bold | heavy | black
  }}
/>
```

## Common Icons

### Navigation & Actions
- `house.fill` - home
- `gear` - settings
- `magnifyingglass` - search
- `plus` - add
- `xmark` - close
- `chevron.left` - back
- `chevron.right` - forward
- `arrow.left` - back arrow
- `arrow.right` - forward arrow

### Media
- `play.fill` - play
- `pause.fill` - pause
- `stop.fill` - stop
- `backward.fill` - rewind
- `forward.fill` - fast forward
- `speaker.wave.2.fill` - volume
- `speaker.slash.fill` - mute

### Camera
- `camera` - camera
- `camera.fill` - camera filled
- `arrow.triangle.2.circlepath` - flip camera
- `photo` - gallery/photos
- `bolt` - flash
- `bolt.slash` - flash off

### Communication
- `message` - message
- `message.fill` - message filled
- `envelope` - email
- `envelope.fill` - email filled
- `phone` - phone
- `phone.fill` - phone filled
- `video` - video call
- `video.fill` - video call filled

### Social
- `heart` - like
- `heart.fill` - liked
- `star` - favorite
- `star.fill` - favorited
- `hand.thumbsup` - thumbs up
- `hand.thumbsdown` - thumbs down
- `person` - profile
- `person.fill` - profile filled
- `person.2` - people
- `person.2.fill` - people filled

### Content Actions
- `square.and.arrow.up` - share
- `square.and.arrow.down` - download
- `doc.on.doc` - copy
- `trash` - delete
- `pencil` - edit
- `folder` - folder
- `folder.fill` - folder filled
- `bookmark` - bookmark
- `bookmark.fill` - bookmarked

### Status & Feedback
- `checkmark` - success/done
- `checkmark.circle.fill` - completed
- `xmark.circle.fill` - error/failed
- `exclamationmark.triangle` - warning
- `info.circle` - info
- `questionmark.circle` - help
- `bell` - notification
- `bell.fill` - notification filled


## Animated Symbols (sfEffect)

Use the `sfEffect` prop for symbol animations:

```tsx
<Image
  source="sf:checkmark.circle"
  sfEffect="bounce"
  style={{ fontSize: 24 }}
/>
```

### Animation Effects

- `bounce` - Bouncy animation
- `pulse` - Pulsing effect
- `variableColor` - Color cycling
- `scale` - Scale animation

```tsx
// Bounce
<Image source="sf:checkmark.circle" sfEffect="bounce" style={{ fontSize: 24 }} />

// Pulse
<Image source="sf:heart.fill" sfEffect="pulse" style={{ fontSize: 24 }} />

// Variable color (multicolor symbols)
<Image source="sf:wifi" sfEffect="variableColor" style={{ fontSize: 24 }} />

// Scale
<Image source="sf:star.fill" sfEffect="scale" style={{ fontSize: 24 }} />
```

## Transitions

Use the `transition` prop for enter/exit transitions:

```tsx
<Image
  source={`sf:${isFilled ? "star.fill" : "star"}`}
  transition={{ effect: "symbol-bounce" }}
  style={{ fontSize: 24, color: Color.ios.systemYellow }}
/>
```

## Finding Symbol Names

1. Use the SF Symbols app on macOS (free from Apple)
2. Search at https://developer.apple.com/sf-symbols/
3. Symbol names use dot notation: `square.and.arrow.up`

## Migrating from expo-symbols

Replace `SymbolView` from `expo-symbols` with `Image` from `expo-image`:

```tsx
// Before (expo-symbols)
import { SymbolView } from "expo-symbols";
<SymbolView name="star.fill" tintColor={PlatformColor("label")} size={24} weight="bold" />

// After (expo-image, SDK 55+)
import { Image } from "expo-image";
<Image source="sf:star.fill" style={{ fontSize: 24, color: Color.ios.label, fontWeight: "bold" }} />
```

## Best Practices

- Always use SF Symbols over vector icon libraries
- Match symbol weight to nearby text weight
- Use `.fill` variants for selected/active states
- Use `Color` from `expo-router` (e.g. `Color.ios.label`) for dark mode support
- Keep icons at consistent sizes (16, 20, 24, 32)
