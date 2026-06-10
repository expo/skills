---
title: Broadcast Setup UI Extension
description: Presents a configuration interface before a ReplayKit live broadcast begins, allowing users to log in, select a channel, and configure stream settings.
version: iOS 10.0+, tvOS 10.0+, macOS 11.0+
---

# Broadcast Setup UI Extension (`broadcast-setup-ui`)

An extension that displays a modal view controller when the user starts a live broadcast through ReplayKit. The setup UI appears after the user picks your broadcast service from `RPBroadcastActivityViewController` or the system broadcast picker, and before any audio or video data starts flowing. Your view controller collects whatever configuration is needed -- account credentials, stream title, channel selection, quality preset -- then calls `extensionContext?.completeRequest(withBroadcast:setupInfo:)` to hand a `setupInfo` dictionary to the paired broadcast-upload extension and begin the broadcast. This is the companion to the `broadcast-upload` extension type.

## Apple Documentation

- [ReplayKit Framework](https://developer.apple.com/documentation/replaykit)
- [RPBroadcastActivityViewController](https://developer.apple.com/documentation/replaykit/rpbroadcastactivityviewcontroller)
- [RPSystemBroadcastPickerView](https://developer.apple.com/documentation/replaykit/rpsystembroadcastpickerview)
- [NSExtensionContext.completeRequest(withBroadcast:setupInfo:)](https://developer.apple.com/documentation/replaykit/nsextensioncontext)
- [App Extension Programming Guide -- Broadcast](https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/ExtensionOverview.html)

## WWDC History

- **[WWDC 2016, Session 601 -- Go Live with ReplayKit](https://developer.apple.com/videos/play/wwdc2016/601/)** -- Introduced broadcast extensions as a pair: a setup UI extension to collect user preferences and an upload extension to stream the data. Demonstrated live game streaming through a Mobcrush extension.
- **[WWDC 2017, Session 606 -- What's New with Screen Recording and Live Broadcast](https://developer.apple.com/videos/play/wwdc2017/606/)** -- Introduced ReplayKit 2 with system-wide broadcast from Control Center. Noted that Control Center broadcasts bypass the setup UI extension entirely, calling `broadcastStarted(withSetupInfo: nil)` on the upload extension.
- **[WWDC 2018, Session 601 -- Live Screen Broadcast with ReplayKit](https://developer.apple.com/videos/play/wwdc2018/601/)** -- Introduced `RPSystemBroadcastPickerView` (iOS 12+), which lets apps embed a broadcast button that can target a specific upload extension by bundle ID, potentially bypassing the setup UI for simpler flows. Covered best practices for handling sign-in inside broadcast extensions.
- **[WWDC 2020, Session 10633 -- Capture and Stream Apps on the Mac with ReplayKit](https://developer.apple.com/videos/play/wwdc2020/10633/)** -- Brought ReplayKit broadcast extensions to macOS, including Mac Catalyst support.

## What It Does

1. The user taps a broadcast button in an app (via `RPBroadcastActivityViewController` or `RPSystemBroadcastPickerView`) or selects a broadcast service from Control Center.
2. If the broadcast is started from within an app using `RPBroadcastActivityViewController`, the system presents a list of available broadcast services. The user picks yours.
3. The system launches your setup UI extension and displays your `BroadcastSetupViewController` as a modal sheet.
4. Your view controller presents login fields, channel pickers, quality selectors, or any other configuration UI.
5. When the user confirms, you call `extensionContext?.completeRequest(withBroadcast: broadcastURL, setupInfo: setupInfo)`. The `broadcastURL` is a URL where viewers can watch the stream. The `setupInfo` dictionary is forwarded to the paired broadcast-upload extension's `broadcastStarted(withSetupInfo:)` method.
6. If the user cancels, you call `extensionContext?.cancelRequest(withError:)` and the broadcast is aborted.
7. After the setup completes successfully, the system launches the broadcast-upload extension and begins delivering `CMSampleBuffer` objects.

## Use Cases

### Live Game Streaming Platforms

A game streaming service (Twitch, YouTube Gaming) presents a setup UI where the user authenticates, selects a stream title, and picks a quality preset before going live. The `setupInfo` dictionary passes the server URL and stream key to the upload extension.

### Video Conferencing Screen Sharing

An enterprise conferencing app shows a setup screen to select which meeting room to broadcast into, confirm permissions, and choose whether to include microphone audio. The setup info includes the room ID and auth token.

### Educational Broadcasting

An instructor selects which class section to stream to and whether to record a local copy. The setup UI reads class rosters from shared `UserDefaults` (via App Groups) and passes the selected section ID to the upload extension.

## Key Classes

| Class | Role |
|-------|------|
| `UIViewController` | Subclass this as your `BroadcastSetupViewController`. Presents the configuration interface to the user. |
| `NSExtensionContext` | Provides `completeRequest(withBroadcast:setupInfo:)` to start the broadcast and `cancelRequest(withError:)` to abort it. |
| `RPBroadcastActivityViewController` | System-provided view controller (used by the host app) that lists available broadcast services and launches your setup UI. |
| `RPSystemBroadcastPickerView` | UIView (iOS 12+) that displays a system picker button. Can set `preferredExtension` to target a specific upload extension, bypassing setup UI for simpler flows. |

## Implementation

### Stream Configuration Setup UI

A realistic broadcast setup UI extension that presents a login form and channel picker, then passes stream configuration to the paired upload extension:

```swift
import ReplayKit
import UIKit

class BroadcastSetupViewController: UIViewController {

    private let serverURLField = UITextField()
    private let streamKeyField = UITextField()
    private let channelPicker = UISegmentedControl(items: ["Main", "Gaming", "IRL"])
    private let startButton = UIButton(type: .system)
    private let cancelButton = UIButton(type: .system)

    // 1. Build the setup UI programmatically. Xcode's template provides no
    //    default UI -- init(nibName:bundle:) is called with nil for both.
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        serverURLField.placeholder = "rtmp://live.example.com/stream"
        serverURLField.borderStyle = .roundedRect
        serverURLField.autocapitalizationType = .none

        streamKeyField.placeholder = "Stream key"
        streamKeyField.borderStyle = .roundedRect
        streamKeyField.isSecureTextEntry = true

        channelPicker.selectedSegmentIndex = 0

        startButton.setTitle("Go Live", for: .normal)
        startButton.addTarget(self, action: #selector(startTapped), for: .touchUpInside)

        cancelButton.setTitle("Cancel", for: .normal)
        cancelButton.addTarget(self, action: #selector(cancelTapped), for: .touchUpInside)

        // 2. Lay out controls in a vertical stack
        let stack = UIStackView(arrangedSubviews: [
            serverURLField, streamKeyField, channelPicker, startButton, cancelButton
        ])
        stack.axis = .vertical
        stack.spacing = 16
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
        ])

        // 3. Pre-fill from shared UserDefaults if the user has broadcast before.
        //    Requires the App Groups entitlement.
        if let defaults = UserDefaults(suiteName: "group.com.example.broadcast") {
            serverURLField.text = defaults.string(forKey: "lastServerURL")
            streamKeyField.text = defaults.string(forKey: "lastStreamKey")
        }
    }

    // 4. User confirmed -- build the setupInfo dictionary and hand it off.
    @objc private func startTapped() {
        let serverURL = serverURLField.text ?? "rtmp://live.example.com/stream"
        let streamKey = streamKeyField.text ?? ""
        let channel = channelPicker.titleForSegment(at: channelPicker.selectedSegmentIndex) ?? "Main"

        // 5. Persist the configuration for next time
        if let defaults = UserDefaults(suiteName: "group.com.example.broadcast") {
            defaults.set(serverURL, forKey: "lastServerURL")
            defaults.set(streamKey, forKey: "lastStreamKey")
        }

        // 6. The broadcastURL is where viewers can watch the stream.
        //    This URL is surfaced by RPBroadcastActivityViewController in the host app.
        let broadcastURL = URL(string: "https://example.com/live/\(channel.lowercased())")!

        // 7. setupInfo is forwarded to the upload extension's broadcastStarted(withSetupInfo:).
        //    Keys and values must be NSCoding & NSObjectProtocol.
        let setupInfo: [String: NSCoding & NSObjectProtocol] = [
            "serverURL": serverURL as NSString,
            "streamKey": streamKey as NSString,
            "channel": channel as NSString,
        ]

        // 8. Tell ReplayKit the setup is complete. This dismisses the setup UI
        //    and launches the broadcast-upload extension.
        extensionContext?.completeRequest(withBroadcast: broadcastURL, setupInfo: setupInfo)
    }

    // 9. User cancelled -- dismiss without starting a broadcast.
    @objc private func cancelTapped() {
        let error = NSError(
            domain: "com.example.broadcast",
            code: -1,
            userInfo: [NSLocalizedDescriptionKey: "User cancelled broadcast setup."]
        )
        extensionContext?.cancelRequest(withError: error)
    }
}
```

## Usage

- Create: `bun create target broadcast-setup-ui`
- Edit: `targets/broadcast-setup-ui/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| iOS | 10.0+ | Full support. System-wide broadcast from Control Center added in iOS 11, but Control Center bypasses the setup UI. |
| iPadOS | 10.0+ | Full support. |
| macOS | 11.0+ | Supported via Mac Catalyst. |
| tvOS | 10.0+ | Supported for in-app broadcasts only. |
| visionOS | -- | Not supported. |
| watchOS | -- | Not supported. |

## Gotchas

- **Control Center broadcasts bypass the setup UI entirely.** When a user starts a broadcast from Control Center (iOS 11+), the system launches only the upload extension and calls `broadcastStarted(withSetupInfo: nil)`. Your upload extension must handle a `nil` `setupInfo` gracefully -- fall back to configuration stored in shared `UserDefaults` via App Groups.
- **`RPSystemBroadcastPickerView` (iOS 12+) can also bypass setup UI.** When the host app sets `preferredExtension` to a specific upload extension bundle ID, the system may skip your setup UI and go straight to broadcasting. For simpler flows where no login is needed, this is intentional.
- **Xcode's template provides no visible UI.** The generated `BroadcastSetupViewController` stub has an empty `viewDidLoad`. You must build the entire view hierarchy programmatically or via a nib. The `init(nibName:bundle:)` initializer is called with `nil` for both parameters by default, so if you use Interface Builder, override `init` to provide your nib name explicitly.
- **The setupInfo dictionary values must conform to `NSCoding & NSObjectProtocol`.** You cannot pass arbitrary Swift types. Stick to `NSString`, `NSNumber`, `NSData`, `NSURL`, and `NSArray`/`NSDictionary` containing those types.
- **50MB memory limit applies to the setup UI extension process too.** Although the setup UI typically uses far less memory than the upload extension, loading large images or complex storyboards can push you close to the limit on older devices.
- **The extension cannot present additional view controllers.** Your `BroadcastSetupViewController` is presented modally by the system. Pushing or presenting additional view controllers on top of it may not work reliably. Keep your entire setup flow in a single view controller, or use child view controllers and container views.
- **iOS 13.0 had a bug with `RPSystemBroadcastPickerView`.** Tapping the picker button could throw an exception. This was fixed in iOS 13.1. If you support iOS 13.0, guard against this or use `RPBroadcastActivityViewController` as a fallback.
