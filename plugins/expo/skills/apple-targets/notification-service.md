---
title: Notification Service Extension
description: Intercepts and modifies remote notification content before display, enabling image downloads, payload decryption, and content enrichment in the background.
version: iOS 10.0+
---

# Notification Service Extension (`notification-service`)

A notification service extension runs in the background when a remote push notification arrives, giving you up to 30 seconds to modify the notification content before the system displays it. The most common use is downloading an image from a URL in the payload and attaching it so the notification displays a rich media preview. It also handles end-to-end encryption decryption, content localization, and analytics tracking.

## Apple Documentation

- [UNNotificationServiceExtension](https://developer.apple.com/documentation/usernotifications/unnotificationserviceextension) -- The class you subclass to modify remote notification content before delivery.
- [didReceive(_:withContentHandler:)](https://developer.apple.com/documentation/usernotifications/unnotificationserviceextension/1648229-didreceive) -- Called when a notification arrives. Modify content and call the handler.
- [serviceExtensionTimeWillExpire()](https://developer.apple.com/documentation/usernotifications/unnotificationserviceextension/1648227-serviceextensiontimewillexpire) -- Last-chance callback before the system delivers the original notification.
- [Modifying Content in Newly Delivered Notifications](https://developer.apple.com/documentation/usernotifications/modifying-content-in-newly-delivered-notifications) -- Apple's guide to implementing a notification service extension.

## WWDC History

- **[WWDC 2016, Session 708 -- Advanced Notifications](https://developer.apple.com/videos/play/wwdc2016/708/)** -- Introduced notification service extensions as part of the new UserNotifications framework. Covers the extension lifecycle, mutable-content flag, and the 30-second processing window.
- **[WWDC 2017, Session 708 -- Best Practices and What's New in User Notifications](https://developer.apple.com/videos/play/wwdc2017/708/)** -- Best practices for service extension performance and reliability.
- **[WWDC 2018, Session 710 -- What's New in User Notifications](https://developer.apple.com/videos/play/wwdc2018/710/)** -- Grouped notifications and how service extensions interact with notification threading.

## What It Does

1. Your server sends a remote push notification with `"mutable-content": 1` in the `aps` dictionary.
2. The system launches (or reuses) your service extension process before displaying the notification.
3. The system calls `didReceive(_:withContentHandler:)` with the original notification request.
4. Your code modifies the `UNMutableNotificationContent` -- downloading images, decrypting the body, changing the title, adding attachments.
5. You call the `contentHandler` with the modified content.
6. If you take too long (~30 seconds), the system calls `serviceExtensionTimeWillExpire()` as a last chance to deliver your best-effort modification.
7. If neither method calls the handler in time, the system displays the original unmodified notification.

## Use Cases

### Rich push notifications with images
The most common use case. Your server includes an image URL in the push payload's `userInfo`. The service extension downloads the image, saves it to a temporary file, and attaches it as a `UNNotificationAttachment`. The notification then shows a thumbnail on the right side and a full preview when expanded.

### End-to-end encrypted messaging
Messaging apps that encrypt notification payloads on the server. The service extension decrypts the ciphertext using keys stored in the shared Keychain (via App Groups), then replaces the placeholder title and body with the actual message content.

### Analytics and delivery tracking
Confirm that a push notification was actually delivered to the device. The service extension pings your analytics endpoint when the notification arrives, providing delivery confirmation independent of whether the user opens the notification.

### Content localization and enrichment
Enrich a minimal push payload with locally-available data. For example, a payload containing only a conversation ID can be expanded by the service extension into a full message preview by querying a local database or shared Core Data store.

## Key Classes

| Class | Role |
|-------|------|
| `UNNotificationServiceExtension` | Abstract class to subclass. Override `didReceive(_:withContentHandler:)` and `serviceExtensionTimeWillExpire()`. |
| `UNNotificationRequest` | The incoming notification request containing the original `UNNotificationContent`. |
| `UNMutableNotificationContent` | Mutable copy of the notification content. Modify `title`, `body`, `subtitle`, `attachments`, `userInfo`, `badge`, `sound`, `threadIdentifier`. |
| `UNNotificationAttachment` | A media file (image, audio, video) attached to the notification. Created from a file URL on disk. |

## Implementation

### Downloading an Image for Rich Notifications

The standard implementation: download an image from a URL in the push payload and attach it to the notification.

```swift
import UserNotifications

class NotificationService: UNNotificationServiceExtension {

    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?

    override func didReceive(
        _ request: UNNotificationRequest,
        withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
    ) {
        self.contentHandler = contentHandler
        bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)

        guard let bestAttemptContent = bestAttemptContent else {
            contentHandler(request.content)
            return
        }

        // 1. Extract the image URL from the push payload's userInfo
        guard let imageURLString = request.content.userInfo["image_url"] as? String,
              let imageURL = URL(string: imageURLString) else {
            // No image to download -- deliver the content as-is
            contentHandler(bestAttemptContent)
            return
        }

        // 2. Download the image to a temporary file
        let task = URLSession.shared.downloadTask(with: imageURL) { location, response, error in
            defer { contentHandler(bestAttemptContent) }

            guard let location = location, error == nil else { return }

            // 3. Determine file extension from the response MIME type
            let fileExtension: String
            if let mimeType = response?.mimeType {
                switch mimeType {
                case "image/png": fileExtension = "png"
                case "image/gif": fileExtension = "gif"
                case "image/jpeg": fileExtension = "jpg"
                default: fileExtension = "jpg"
                }
            } else {
                fileExtension = "jpg"
            }

            // 4. Move the file to a uniquely-named temporary path
            //    (UNNotificationAttachment requires the file extension)
            let tempDir = FileManager.default.temporaryDirectory
            let tempFile = tempDir
                .appendingPathComponent(UUID().uuidString)
                .appendingPathExtension(fileExtension)

            do {
                try FileManager.default.moveItem(at: location, to: tempFile)

                // 5. Create the attachment and add it to the notification
                let attachment = try UNNotificationAttachment(
                    identifier: "image",
                    url: tempFile,
                    options: nil
                )
                bestAttemptContent.attachments = [attachment]
            } catch {
                // If attachment creation fails, deliver without the image
                print("Notification attachment error: \(error)")
            }
        }
        task.resume()
    }

    override func serviceExtensionTimeWillExpire() {
        // 6. Called when the system is about to kill the extension.
        //    Deliver whatever you have -- possibly without the image.
        if let contentHandler = contentHandler,
           let bestAttemptContent = bestAttemptContent {
            contentHandler(bestAttemptContent)
        }
    }
}
```

### Decrypting Encrypted Notification Content

A service extension that decrypts an encrypted payload using a key stored in the shared Keychain:

```swift
import UserNotifications
import CryptoKit

class NotificationService: UNNotificationServiceExtension {

    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?

    override func didReceive(
        _ request: UNNotificationRequest,
        withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
    ) {
        self.contentHandler = contentHandler
        bestAttemptContent = (request.content.mutableCopy() as? UNMutableNotificationContent)

        guard let bestAttemptContent = bestAttemptContent else {
            contentHandler(request.content)
            return
        }

        // 1. Extract the encrypted payload from userInfo
        guard let encryptedBase64 = request.content.userInfo["encrypted_body"] as? String,
              let encryptedData = Data(base64Encoded: encryptedBase64) else {
            contentHandler(bestAttemptContent)
            return
        }

        // 2. Retrieve the decryption key from the shared Keychain (via App Groups)
        guard let symmetricKey = loadKeyFromSharedKeychain() else {
            bestAttemptContent.body = "New encrypted message"
            contentHandler(bestAttemptContent)
            return
        }

        // 3. Decrypt the content
        do {
            let sealedBox = try AES.GCM.SealedBox(combined: encryptedData)
            let decryptedData = try AES.GCM.open(sealedBox, using: symmetricKey)

            if let decryptedString = String(data: decryptedData, encoding: .utf8) {
                // 4. Replace the placeholder body with the decrypted message
                bestAttemptContent.body = decryptedString
            }
        } catch {
            bestAttemptContent.body = "New encrypted message"
        }

        contentHandler(bestAttemptContent)
    }

    override func serviceExtensionTimeWillExpire() {
        if let contentHandler = contentHandler,
           let bestAttemptContent = bestAttemptContent {
            bestAttemptContent.body = "New encrypted message"
            contentHandler(bestAttemptContent)
        }
    }

    private func loadKeyFromSharedKeychain() -> SymmetricKey? {
        // Load from Keychain with kSecAttrAccessGroup set to your App Group
        // Implementation depends on your key storage strategy
        return nil
    }
}
```

### Example Push Payload

The push notification must include `mutable-content: 1` to trigger the service extension:

```json
{
  "aps": {
    "alert": {
      "title": "New Photo",
      "body": "Sarah shared a photo with you"
    },
    "mutable-content": 1,
    "sound": "default"
  },
  "image_url": "https://example.com/photos/12345.jpg"
}
```

## Usage

- Create: `bun create target notification-service`
- Edit: `targets/notification-service/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| iOS | 10.0+ | Full support. |
| iPadOS | 10.0+ | Full support. |
| macOS | 10.14+ | Supported for native macOS apps receiving remote notifications. |
| Mac Catalyst | 13.0+ | Supported. |
| visionOS | -- | Not documented. |
| watchOS | -- | Not supported. watchOS notifications are processed by the paired iPhone. |
| tvOS | -- | Not supported. tvOS does not display notification banners. |

## Gotchas

- **Push must include `mutable-content: 1`.** Without this flag in the `aps` dictionary, the system will never launch your service extension. This is the single most common reason the extension appears to "not work." The payload must also include an `alert` dictionary (title, subtitle, or body) -- silent notifications do not trigger the extension.

- **You have approximately 30 seconds.** The system enforces a hard time limit. If neither `didReceive` nor `serviceExtensionTimeWillExpire` calls the content handler in time, the original unmodified notification is displayed. Always implement `serviceExtensionTimeWillExpire()` as a fallback.

- **Memory limit is approximately 24 MB.** The extension runs in a constrained process. Downloading or processing large images can push you over the limit, causing immediate termination with no callback. Resize images before creating attachments if the source is large.

- **The extension does not run when the app is in the foreground.** If your app is active and implements `userNotificationCenter(_:willPresent:withCompletionHandler:)`, the delegate receives the original unmodified payload. The service extension is skipped entirely.

- **The extension process is reused between notifications.** iOS keeps the extension process alive after processing a notification. A second notification arriving shortly after reuses the same process. This means stale state from a previous `didReceive` call can leak into the next one. Always reset `bestAttemptContent` and `contentHandler` at the start of each call.

- **Attachments require files on disk with correct extensions.** `UNNotificationAttachment` reads the file extension to determine the media type. A file named `image` with no extension will fail. Always append `.jpg`, `.png`, `.gif`, or `.mp4` to your temporary files.

- **Shared data requires App Groups.** The extension runs in a separate process and sandbox. To access shared preferences, databases, or Keychain items, configure an App Group on both the main app and the extension. Use `UserDefaults(suiteName:)` or `kSecAttrAccessGroup` for Keychain.

- **Debugging is difficult.** You cannot launch the extension target directly. Attach the debugger to the extension process by selecting Debug > Attach to Process by PID or Name in Xcode after sending a push notification. Use `Console.app` filtering by your extension's bundle ID to see logs.

- **`content-available: 1` is not `mutable-content: 1`.** These are different flags. `content-available` triggers background app refresh (silent push). `mutable-content` triggers the service extension. You can use both, but they serve different purposes. Confusing the two is a common mistake.

- **Notification filtering requires a special entitlement.** Since iOS 13.3, you can suppress notification display entirely by not calling the content handler. However, this requires the `com.apple.developer.usernotifications.filtering` entitlement, which must be requested from Apple. Without it, suppressing delivery will show the original notification.
