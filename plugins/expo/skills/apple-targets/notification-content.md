---
title: Notification Content Extension
description: Displays a custom view controller when a notification is expanded, replacing the default notification UI with rich interactive content like images, maps, or custom controls.
version: iOS 10.0+
---

# Notification Content Extension (`notification-content`)

A notification content extension provides a custom user interface that appears when a user long-presses or 3D Touches a notification. Instead of the system's default layout, your extension renders a full `UIViewController` with any combination of images, video, maps, custom drawing, and -- starting with iOS 12 -- interactive controls like buttons and sliders.

## Apple Documentation

- [UNNotificationContentExtension](https://developer.apple.com/documentation/usernotificationsui/unnotificationcontentextension) -- The protocol your view controller adopts to receive and display notification content.
- [Customizing the Appearance of Notifications](https://developer.apple.com/documentation/usernotificationsui/customizing-the-appearance-of-notifications) -- Apple's guide to building notification content extensions.
- [UNNotificationContentExtensionResponseOption](https://developer.apple.com/documentation/usernotificationsui/unnotificationcontentextensionresponseoption) -- Return values for action handling in the extension.
- [Modifying and Presenting Notifications (Archive)](https://developer.apple.com/library/archive/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/ModifyingNotifications.html) -- Legacy guide covering both service and content extensions.

## WWDC History

- **[WWDC 2016, Session 708 -- Advanced Notifications](https://developer.apple.com/videos/play/wwdc2016/708/)** -- Introduced notification content extensions alongside the new UserNotifications framework. Covers custom UI, media attachments, and action handling.
- **[WWDC 2017, Session 708 -- Best Practices and What's New in User Notifications](https://developer.apple.com/videos/play/wwdc2017/708/)** -- Refined guidance on content extension best practices and hidden default content.
- **[WWDC 2018, Session 710 -- What's New in User Notifications](https://developer.apple.com/videos/play/wwdc2018/710/)** -- Added interactive controls (buttons, sliders) via `UNNotificationExtensionUserInteractionEnabled`, dynamic action button updates, and `performNotificationDefaultAction` / `dismissNotificationContentExtension` methods.

## What It Does

1. A local or remote notification arrives with a `categoryIdentifier` matching the extension's `UNNotificationExtensionCategory` in Info.plist.
2. The user long-presses (or 3D Touches) the notification banner.
3. The system loads the extension's `UIViewController` and calls `didReceive(_:)` with the full `UNNotification`.
4. Your view controller populates its UI -- images, labels, maps, media players, custom views.
5. If the notification category defines actions, the system renders action buttons below your custom view.
6. When the user taps an action, the system calls `didReceive(_:completionHandler:)` on your view controller, giving you a chance to update the UI before dismissing.

## Use Cases

### Messaging apps with rich media
Display inline images, GIFs, or video thumbnails directly in the notification. A chat app can show the sender's avatar, the message bubble, and a preview of any attached media -- all without opening the app.

### Delivery and ride-sharing apps with maps
Embed a `MKMapView` showing the driver's current location or the package's delivery route. The map updates each time a new notification arrives for the same conversation thread.

### Calendar and event apps with quick RSVP
Show event details (time, location, attendee list) in a styled card layout with interactive "Accept" / "Decline" buttons (iOS 12+) that update the UI inline and call your server.

### Sports and live score apps
Display a custom scoreboard layout with team logos, scores, and game clock. Each score update notification refreshes the same expanded view.

## Key Classes

| Class / Protocol | Role |
|-----------------|------|
| `UNNotificationContentExtension` | Protocol adopted by your `UIViewController`. Provides `didReceive(_:)` to populate UI and optionally `didReceive(_:completionHandler:)` to handle actions. |
| `UNNotification` | The delivered notification passed to your extension, containing the full `UNNotificationContent`. |
| `UNNotificationContent` | The notification payload -- title, subtitle, body, attachments, userInfo, categoryIdentifier. |
| `UNNotificationAction` | An action button registered on the notification category. The system renders these below your view. |
| `NSExtensionContext` | Provides `performNotificationDefaultAction()` to open the app and `dismissNotificationContentExtension()` to dismiss (iOS 12+). |

## Implementation

### Rich Media Notification with Action Handling

A notification content extension that displays an image from the notification's attachments and handles a "Like" action with inline UI feedback.

```swift
import UIKit
import UserNotifications
import UserNotificationsUI

class NotificationViewController: UIViewController, UNNotificationContentExtension {

    // 1. Create UI elements programmatically (or use a storyboard)
    private let imageView: UIImageView = {
        let iv = UIImageView()
        iv.contentMode = .scaleAspectFill
        iv.clipsToBounds = true
        iv.translatesAutoresizingMaskIntoConstraints = false
        return iv
    }()

    private let titleLabel: UILabel = {
        let label = UILabel()
        label.font = .boldSystemFont(ofSize: 17)
        label.numberOfLines = 2
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()

    private let bodyLabel: UILabel = {
        let label = UILabel()
        label.font = .systemFont(ofSize: 15)
        label.textColor = .secondaryLabel
        label.numberOfLines = 0
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()

    override func viewDidLoad() {
        super.viewDidLoad()

        // 2. Layout the custom UI
        view.addSubview(imageView)
        view.addSubview(titleLabel)
        view.addSubview(bodyLabel)

        NSLayoutConstraint.activate([
            imageView.topAnchor.constraint(equalTo: view.topAnchor),
            imageView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            imageView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            imageView.heightAnchor.constraint(equalTo: view.widthAnchor, multiplier: 0.5625),

            titleLabel.topAnchor.constraint(equalTo: imageView.bottomAnchor, constant: 12),
            titleLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            titleLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),

            bodyLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 4),
            bodyLabel.leadingAnchor.constraint(equalTo: titleLabel.leadingAnchor),
            bodyLabel.trailingAnchor.constraint(equalTo: titleLabel.trailingAnchor),
            bodyLabel.bottomAnchor.constraint(lessThanOrEqualTo: view.bottomAnchor, constant: -12),
        ])
    }

    // 3. Called when the notification is expanded -- populate your UI
    func didReceive(_ notification: UNNotification) {
        let content = notification.request.content

        titleLabel.text = content.title
        bodyLabel.text = content.body

        // 4. Load the first attachment (e.g., an image downloaded by a service extension)
        if let attachment = content.attachments.first,
           attachment.url.startAccessingSecurityScopedResource() {
            defer { attachment.url.stopAccessingSecurityScopedResource() }
            if let data = try? Data(contentsOf: attachment.url) {
                imageView.image = UIImage(data: data)
            }
        }

        // 5. Adjust preferred content size based on whether there's an image
        if imageView.image == nil {
            imageView.isHidden = true
            preferredContentSize = CGSize(width: view.bounds.width, height: 80)
        }
    }

    // 6. Handle action button taps inline (optional)
    func didReceive(
        _ response: UNNotificationResponse,
        completionHandler completion: @escaping (UNNotificationContentExtensionResponseOption) -> Void
    ) {
        switch response.actionIdentifier {
        case "LIKE_ACTION":
            // 7. Update UI to reflect the action
            titleLabel.text = "Liked!"
            titleLabel.textColor = .systemBlue

            // 8. Dismiss after a short delay so the user sees the feedback
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) {
                completion(.dismiss)
            }

        case "REPLY_ACTION":
            // 9. Open the app for complex interactions
            completion(.dismissAndForwardAction)

        default:
            completion(.doNotDismiss)
        }
    }
}
```

### Registering the Notification Category (in your main app)

Your main app must register the category that triggers the content extension:

```swift
import UserNotifications

func registerNotificationCategories() {
    let likeAction = UNNotificationAction(
        identifier: "LIKE_ACTION",
        title: "Like",
        options: []
    )
    let replyAction = UNTextInputNotificationAction(
        identifier: "REPLY_ACTION",
        title: "Reply",
        options: [],
        textInputButtonTitle: "Send",
        textInputPlaceholder: "Type a reply..."
    )

    // The category identifier must match UNNotificationExtensionCategory in the extension's Info.plist
    let category = UNNotificationCategory(
        identifier: "myNotificationCategory",
        actions: [likeAction, replyAction],
        intentIdentifiers: [],
        options: []
    )

    UNUserNotificationCenter.current().setNotificationCategories([category])
}
```

## Usage

- Create: `bun create target notification-content`
- Edit: `targets/notification-content/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| iOS | 10.0+ | Full support. Interactive controls from iOS 12+. |
| iPadOS | 10.0+ | Full support. Some layout inconsistencies with `UNNotificationExtensionInitialContentSizeRatio` on iPad. |
| macOS | 11.0+ | Listed in API docs but does not work reliably for native macOS apps. Works via Mac Catalyst. |
| visionOS | -- | Not supported. |
| watchOS | -- | Not supported. watchOS uses WatchKit notification interfaces instead. |
| tvOS | -- | Not supported. |

## Gotchas

- **Category identifier must match exactly.** The `UNNotificationExtensionCategory` value in your extension's Info.plist must be an exact, case-sensitive match to the `categoryIdentifier` on the notification and the category registered with `UNUserNotificationCenter`. A mismatch causes the extension to silently never appear.

- **Touch events are blocked before iOS 12.** Prior to iOS 12, the system prevents delivery of all touch events to your view controller. Gesture recognizers and interactive controls will not work. On iOS 12+, set `UNNotificationExtensionUserInteractionEnabled` to `true` in Info.plist to enable interaction.

- **`preferredContentSize` timing is tricky.** At `viewDidLoad` time, the view's `bounds.size.width` is not yet correct (it reports full screen size). Set `preferredContentSize` in `didReceive(_:)` after layout, or use `UNNotificationExtensionInitialContentSizeRatio` in Info.plist as the initial aspect ratio and let Auto Layout handle the rest.

- **One extension per category set.** Each content extension must handle a unique set of categories. If two extensions claim the same category identifier, behavior is undefined. Use an array value for `UNNotificationExtensionCategory` if one extension handles multiple categories.

- **iPad layout sizing is inconsistent.** Several developers have reported that iPad does not respect `UNNotificationExtensionInitialContentSizeRatio` correctly, and Auto Layout guides can report very large values during the first layout pass. Test on iPad hardware or simulator specifically.

- **Action buttons are system-managed.** The system automatically renders action buttons defined on the `UNNotificationCategory` below your custom view. Do not create your own action buttons -- use `didReceive(_:completionHandler:)` to intercept taps and update your UI.

- **Attachments require security-scoped access.** When reading notification attachment files, you must call `startAccessingSecurityScopedResource()` before and `stopAccessingSecurityScopedResource()` after. Without this, file reads will fail silently or throw permission errors.

- **The extension has a separate memory budget.** Content extensions run in their own process with limited memory (roughly 120 MB on recent devices). Loading large images or video without downsampling can cause the system to kill the extension.

- **Default content is shown unless hidden.** The system shows the standard notification title/body below your custom view by default. Set `UNNotificationExtensionDefaultContentHidden` to `true` in Info.plist if your custom UI already displays this information.
