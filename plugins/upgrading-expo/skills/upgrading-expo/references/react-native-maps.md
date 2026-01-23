# react-native-maps

Expo SDK 55 uses `react-native-maps` version 1.26.20+

An Expo plug-in for `react-native-maps` was introduced in version 1.22 and it requires Expo SDK 53+

## Migrate configuration to use react-native-maps Expo plug-in

### Without Google Maps

Add plug-in to `app.json`

```json
{
  "expo": {
    "plugins": ["react-native-maps"]
  }
}
```

### With Google Maps

If you're using Google as the map provider, also provide an API key for the respective platform.

Move legacy configuration in the platform-specific keys and move it to plug-in configuration.

Before (Expo SDK 54 and below):

```json
{
  "expo": {
    "android": {
      "config": {
        "googleMaps": {
          "apiKey": "ANDROID_GOOGLE_MAPS_API_KEY",
        },
      },
    },
    "ios": {
      "config": {
        "googleMapsApiKey":  "IOS_GOOGLE_MAPS_API_KEY",
      },
    }
  }
}
```

Before (Expo SDK 54 and below):

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-maps",
        {
          "androidGoogleMapsApiKey": "ANDROID_GOOGLE_MAPS_API_KEY",
          "iosGoogleMapsApiKey": "IOS_GOOGLE_MAPS_API_KEY"
        }
      ]
    ]
  }
}
```

### Migration Steps

1. Remove legacy configuration
2. Add `react-native-maps` Expo plug-in configuration

## Cleanup Checklist

When upgrading to SDK 55:

- [ ] Use `rect-native-maps` Expo plug-in
- [ ] Add Google Maps API keys for each platform in use
