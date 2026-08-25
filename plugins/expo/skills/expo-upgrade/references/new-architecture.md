# New Architecture

The New Architecture is enabled by default since Expo SDK 53 (opt-in on SDK 52, experimental before that).

> **Source of truth:** https://docs.expo.dev/guides/new-architecture/ — consult the canonical guide for configuration and rollout details (it links the React Native announcement for the JSI/Fabric/TurboModules concepts).

## Configuration

New Architecture is enabled by default. To explicitly disable (not recommended):

```json
{
  "expo": {
    "newArchEnabled": false
  }
}
```

## Expo Go

Expo Go only supports the New Architecture as of SDK 53. Apps using the old architecture must use development builds.

## Common Migration Issues

### Native Module Compatibility

Some older native modules may not support the New Architecture. Check:

1. Module documentation for New Architecture support
2. GitHub issues for compatibility discussions
3. Consider alternatives if module is unmaintained

### Reanimated

React Native Reanimated requires `react-native-worklets` in SDK 54+:

```bash
npx expo install react-native-worklets
```

### Layout Animations

Some layout animations behave differently. Test thoroughly after upgrading.

## Verifying New Architecture

Log once from app code — `true` when Fabric is active:

```tsx
const isNewArch = global._IS_FABRIC !== undefined;
```

## Troubleshooting

1. **Clear caches** — `npx expo start --clear`
2. **Clean prebuild** — `npx expo prebuild --clean`
3. **Check native modules** — Ensure all dependencies support New Architecture
4. **Review console warnings** — Legacy modules log compatibility warnings
