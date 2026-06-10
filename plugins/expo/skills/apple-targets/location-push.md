---
title: Location Push Service Extension
description: Receives a special APNs push notification and requests a one-shot device location for location-sharing apps without requiring the app to be running.
version: iOS 15.0+
---

# Location Push Service Extension (`location-push`)

A Location Push Service Extension gives location-sharing apps a power-efficient way to retrieve a user's location on demand. When your server sends a specially typed APNs push (`"location"` push type), the system wakes the extension in the background -- even if the app is not running. The extension creates a `CLLocationManager`, calls `requestLocation()`, and sends the result back to your server. This avoids the need for continuous background location tracking, dramatically reducing battery impact. The extension is gated behind a managed entitlement (`com.apple.developer.location.push`) that requires explicit approval from Apple.

## Apple Documentation

- [CLLocationPushServiceExtension](https://developer.apple.com/documentation/corelocation/cllocationpushserviceextension)
- [Creating a Location Push Service Extension](https://developer.apple.com/documentation/corelocation/creating-a-location-push-service-extension)
- [Location Push Service Extension Entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.location.push)
- [CLLocationManager](https://developer.apple.com/documentation/corelocation/cllocationmanager)
- [Core Location Framework](https://developer.apple.com/documentation/corelocation)

## WWDC History

- **[WWDC 2021, Session 10102 -- Meet the Location Button](https://developer.apple.com/videos/play/wwdc2021/10102/)** -- Introduced the Location Push Service Extension alongside the CLLocationButton, covering the push-based location retrieval architecture and entitlement requirements.

## What It Does

1. **App registers for location pushes.** Your main app calls `CLLocationManager.startMonitoringLocationPushes(completion:)` to receive an APNs device token specific to location pushes. You send this token to your server.
2. **Server sends a location push.** Your server sends an APNs notification with push type `"location"` and topic `<bundle-id>.location-query` to the device token. The payload can contain arbitrary data (e.g. a request ID).
3. **System wakes the extension.** iOS launches your `CLLocationPushServiceExtension` and calls `didReceiveLocationPushPayload(_:completion:)` with the push payload dictionary.
4. **Extension requests location.** You create a `CLLocationManager`, set its delegate, and call `requestLocation()`. The system delivers a single location fix to your delegate's `locationManager(_:didUpdateLocations:)` method.
5. **Extension sends location to server.** You process the location (ideally end-to-end encrypting it for the requesting user), send it to your server via a network request, and call the provided `completion()` handler.
6. **System terminates the extension.** After you call `completion()`, or after approximately 30 seconds, the system terminates the extension. If you fail to call `completion()`, `serviceExtensionWillTerminate()` is called as a last chance.

## Use Cases

### Find My-style device location sharing

A family safety app lets users request each other's location. When User A taps "Find User B," the server sends a location push to User B's device. The extension retrieves the location, encrypts it, and posts it back. User A sees the updated location on a map -- all without User B needing to have the app open.

### Fleet and asset tracking

A logistics company needs periodic location updates from delivery drivers' phones. Instead of maintaining constant GPS tracking (which drains battery), the dispatch system sends location pushes at defined intervals (e.g. every 15 minutes) to collect position reports on demand.

### Emergency check-in systems

A workplace safety app allows a control room to ping field workers' devices for their current location during an emergency roll call. The location push fires even if the worker's app is backgrounded or terminated.

## Key Classes

| Class / Protocol | Role |
|------------------|------|
| `CLLocationPushServiceExtension` | Protocol your extension's principal class adopts. Provides `didReceiveLocationPushPayload(_:completion:)` and `serviceExtensionWillTerminate()`. |
| `CLLocationManager` | Used within the extension to call `requestLocation()` for a single location fix. Also used in the main app to call `startMonitoringLocationPushes(completion:)` for token registration. |
| `CLLocationManagerDelegate` | Delegate protocol that receives the location result via `locationManager(_:didUpdateLocations:)` or errors via `locationManager(_:didFailWithError:)`. |
| `CLLocation` | The location object containing latitude, longitude, altitude, accuracy, and timestamp. |

## Implementation

```swift
import CoreLocation

// 1. Adopt CLLocationPushServiceExtension on your principal class. Also
//    conform to CLLocationManagerDelegate to receive the location result.
class LocationPushService: NSObject,
    CLLocationPushServiceExtension,
    CLLocationManagerDelegate
{
    var completion: (() -> Void)?
    var locationManager: CLLocationManager?

    // 2. Called when a location push arrives. The payload dictionary contains
    //    whatever your server included in the APNs notification body.
    func didReceiveLocationPushPayload(
        _ payload: [String: Any],
        completion: @escaping () -> Void
    ) {
        self.completion = completion

        // 3. Create a location manager and request a single location fix.
        //    The user must have granted "Always" location permission to the
        //    main app for this to succeed.
        self.locationManager = CLLocationManager()
        self.locationManager!.delegate = self
        self.locationManager!.requestLocation()
    }

    // 4. Called if the system is about to terminate the extension before
    //    completion() was called. Use this as a last-chance cleanup.
    func serviceExtensionWillTerminate() {
        self.completion?()
    }

    // MARK: - CLLocationManagerDelegate

    func locationManager(
        _ manager: CLLocationManager,
        didUpdateLocations locations: [CLLocation]
    ) {
        guard let location = locations.first else {
            self.completion?()
            return
        }

        // 5. Process the location. In a real app, you would end-to-end
        //    encrypt the coordinates and send them to your server.
        let latitude = location.coordinate.latitude
        let longitude = location.coordinate.longitude
        print("Location: \(latitude), \(longitude)")

        // 6. Send location to your server (simplified example).
        sendLocationToServer(latitude: latitude, longitude: longitude) {
            // 7. ALWAYS call completion() when done. Failing to call it
            //    will cause the system to terminate the extension after ~30s.
            self.completion?()
        }
    }

    func locationManager(
        _ manager: CLLocationManager,
        didFailWithError error: Error
    ) {
        // 8. Location request failed (e.g. location services disabled,
        //    no GPS fix available). Still must call completion().
        print("Location error: \(error.localizedDescription)")
        self.completion?()
    }

    private func sendLocationToServer(
        latitude: Double,
        longitude: Double,
        done: @escaping () -> Void
    ) {
        // 9. In production, create a URLSession data task to POST the
        //    encrypted location to your server. Call done() in the
        //    completion handler.
        var request = URLRequest(
            url: URL(string: "https://api.example.com/location")!
        )
        request.httpMethod = "POST"
        request.httpBody = try? JSONSerialization.data(withJSONObject: [
            "lat": latitude,
            "lng": longitude,
            "timestamp": Date().timeIntervalSince1970,
        ])

        URLSession.shared.dataTask(with: request) { _, _, _ in
            done()
        }.resume()
    }
}
```

## Usage

- Create: `bun create target location-push`
- Edit: `targets/location-push/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| iOS | 15.0+ | Full support. Requires managed entitlement approval from Apple. |
| iPadOS | 15.0+ | Supported on iPads with location hardware. |
| macOS | -- | Not supported. |
| watchOS | -- | Not supported. |
| visionOS | -- | Not supported. |
| tvOS | -- | Not supported. |

## Gotchas

- **Requires Apple entitlement approval.** The `com.apple.developer.location.push` entitlement is a managed capability. You must apply through your Apple Developer account and be approved before you can distribute the app. Development provisioning profiles may work without approval, but distribution profiles require it. Approval can take weeks to months.
- **User must grant "Always" location permission.** The extension only fires if the user has granted your app "Always" location authorization. "When In Use" is not sufficient because the extension runs when the app is not in the foreground.
- **APNs push type must be "location".** The push notification sent by your server must use `apns-push-type: location` in the HTTP/2 headers and the topic must be `<bundle-id>.location-query`. Using the wrong push type or topic will silently fail.
- **Extension has approximately 30 seconds to complete.** If you do not call the `completion()` handler within about 30 seconds, the system calls `serviceExtensionWillTerminate()` and kills the extension. Plan your network requests accordingly.
- **Single location fix only.** `requestLocation()` delivers one location and then stops. You cannot start continuous location updates or use `startUpdatingLocation()` within the extension. The fix accuracy depends on available hardware and conditions.
- **Deployment target mismatch causes silent failure.** Xcode may set the extension's deployment target to the latest iOS version by default. If the device runs an older iOS version, the extension silently fails with a `missingPushExtension` error. Ensure the deployment target is set to iOS 15.0.
- **No background processing beyond the location request.** The extension cannot schedule background tasks, play audio, or perform other background activities. It exists solely to handle the location push and respond.
- **End-to-end encryption is strongly recommended.** Apple designed this API for peer-to-peer location sharing. Transmitting raw coordinates to a server without encryption is a privacy concern and may affect App Store review.
- **Token is separate from regular push tokens.** The token returned by `startMonitoringLocationPushes(completion:)` is distinct from your regular APNs push token. You must manage and send this token separately to your server.
