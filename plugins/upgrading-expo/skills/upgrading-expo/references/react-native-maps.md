# react-native-maps

Expo SDK 55 uses `react-native-maps` version 1.26.20+

`react-native-maps@1.22.0` now has an Expo Config Plugin (SDK 53+)

## Migrate configuration to use react-native-maps Expo plugin

### Without Google Maps

Add the plugin to `app.json`

```json
{
  "expo": {
    "plugins": ["react-native-maps"]
  }
}
```

### With Google Maps

If Google is used as the map provider, provide the appropriate platform-specific API key, and migrate any legacy configuration into the plugin configuration.

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

1. Add `react-native-maps` Expo plugin to `app.json`
2. Remove the legacy Google Maps configuration from `app.json`
3. Add platform-specific Google Maps API keys via plugin configuration props
