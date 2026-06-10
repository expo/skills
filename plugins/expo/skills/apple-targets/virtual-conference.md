---
title: Virtual Conference Provider Extension
description: Integrates your video or voice calling app with the system Calendar so users see a "Join" button and room-type picker directly on their events.
version: iOS 15.0+, macOS 12.0+
---

# Virtual Conference Provider Extension (`virtual-conference`)

A virtual conference extension lets Calendar show a "Join" button on events that use your app's meeting rooms. When a user creates a new event, they can pick one of your conference room types from the location picker (shown alongside your app icon). The system then calls your extension to generate the meeting URL and details, which Calendar attaches to the event. Apps like Zoom, Microsoft Teams, and Webex use this extension to provide one-tap join from Calendar without opening the browser.

## Apple Documentation

- [EKVirtualConferenceProvider](https://developer.apple.com/documentation/eventkit/ekvirtualconferenceprovider)
- [EKVirtualConferenceDescriptor](https://developer.apple.com/documentation/eventkit/ekvirtualconferencedescriptor)
- [EKVirtualConferenceURLDescriptor](https://developer.apple.com/documentation/eventkit/ekvirtualconferenceurldescriptor)
- [EKVirtualConferenceRoomTypeDescriptor](https://developer.apple.com/documentation/eventkit/ekvirtualconferenceroomtypedescriptor)
- [EventKit Framework Overview](https://developer.apple.com/documentation/eventkit)

## WWDC History

- **[WWDC 2021 -- What's New in Managing Apple Devices](https://developer.apple.com/videos/play/wwdc2021/10130/)** -- `EKVirtualConferenceProvider` was introduced alongside iOS 15 and macOS 12, enabling third-party video conferencing apps to integrate with Calendar.
- **[WWDC 2023, Session 10052 -- Discover Calendar and EventKit](https://developer.apple.com/videos/play/wwdc2023/10052/)** -- Provided the first detailed walkthrough of building a virtual conference extension, including room types, URL descriptors, and the user flow in the Calendar location picker.

## What It Does

1. **User creates or edits a Calendar event.** In the location picker, Calendar shows "Video Call" options from installed apps that provide a virtual conference extension.
2. **Room type selection.** The system calls `fetchAvailableRoomTypes(completionHandler:)` on your `EKVirtualConferenceProvider` subclass. You return an array of `EKVirtualConferenceRoomTypeDescriptor` objects, each with a title and unique identifier.
3. **Conference generation.** When the user picks a room type, the system calls `fetchVirtualConference(identifier:completionHandler:)` with the selected room type identifier. Your extension creates the meeting (e.g., calls your backend API) and returns an `EKVirtualConferenceDescriptor` containing a title, one or more URL descriptors, and optional plain-text details.
4. **Calendar displays join affordance.** The event now shows a "Join" button. Tapping it opens the URL, which typically deep-links into your app.
5. **Shared across devices.** Because the conference data is part of the `EKEvent`, it syncs via iCloud/CalDAV to all the user's devices.

## Use Cases

### Video Conferencing Apps
Apps like Zoom, Microsoft Teams, Google Meet, and Webex can generate meeting links directly from the Calendar event creation flow. Users never need to open the conferencing app separately to create a room -- they just pick it from the Calendar location field and share the event invite.

### Internal Enterprise Communication Tools
Companies with proprietary conferencing systems (e.g., Cisco Jabber, custom WebRTC solutions) can integrate with Calendar so employees see a native "Join" button rather than having to copy-paste meeting URLs from emails or chat.

### Audio-Only Calling Apps
The extension is not limited to video. VoIP or audio bridge apps can provide room types like "Audio Bridge" or "Dial-In Conference" so users can join phone-style meetings from Calendar.

## Key Classes

| Class / Protocol | Role |
|------------------|------|
| `EKVirtualConferenceProvider` | Subclass this as your extension's principal class. Override `fetchAvailableRoomTypes` and `fetchVirtualConference`. |
| `EKVirtualConferenceRoomTypeDescriptor` | Describes one room type (e.g., "Team Meeting", "Webinar"). Has a `title` and a unique `identifier`. |
| `EKVirtualConferenceDescriptor` | The meeting details returned by your extension. Contains a title, an array of `EKVirtualConferenceURLDescriptor`, and optional conference details string. |
| `EKVirtualConferenceURLDescriptor` | A single URL to join the conference. Has a `title` (e.g., "Join via App", "Join via Web") and a `URL`. |

## Implementation

```swift
import EventKit

class VirtualConferenceProvider: EKVirtualConferenceProvider {

    // 1. Declare the room types your app supports.
    //    Calendar shows these in the location picker next to your app icon.
    override func fetchAvailableRoomTypes(
        completionHandler: @escaping ([EKVirtualConferenceRoomTypeDescriptor]?, Error?) -> Void
    ) {
        let standardRoom = EKVirtualConferenceRoomTypeDescriptor(
            title: "Video Meeting",
            identifier: "standard"
        )
        let webinarRoom = EKVirtualConferenceRoomTypeDescriptor(
            title: "Webinar",
            identifier: "webinar"
        )
        // 2. Return all available room types.
        completionHandler([standardRoom, webinarRoom], nil)
    }

    // 3. Called when the user selects one of your room types.
    //    Generate the meeting and return a descriptor with join URLs.
    override func fetchVirtualConference(
        identifier: EKVirtualConferenceRoomTypeIdentifier,
        completionHandler: @escaping (EKVirtualConferenceDescriptor?, Error?) -> Void
    ) {
        // 4. In a real app, call your backend to create a meeting room
        //    and receive a meeting URL. Here we simulate it.
        let meetingId = UUID().uuidString.prefix(8).lowercased()
        let meetingURL = URL(string: "https://meet.example.com/\(meetingId)")!
        let deepLinkURL = URL(string: "myapp://join/\(meetingId)")!

        // 5. Create URL descriptors -- one for the app deep link,
        //    one as a web fallback.
        let appURL = EKVirtualConferenceURLDescriptor(
            title: "Open in MyApp",
            url: deepLinkURL
        )
        let webURL = EKVirtualConferenceURLDescriptor(
            title: "Join via Browser",
            url: meetingURL
        )

        // 6. Build the conference descriptor.
        let title: String
        switch identifier {
        case "webinar":
            title = "MyApp Webinar"
        default:
            title = "MyApp Meeting"
        }

        let descriptor = EKVirtualConferenceDescriptor(
            title: title,
            urlDescriptors: [appURL, webURL],
            conferenceDetails: "Meeting ID: \(meetingId)"
        )

        // 7. Return the descriptor. Calendar attaches it to the event.
        completionHandler(descriptor, nil)
    }
}
```

## Usage

- Create: `bun create target virtual-conference`
- Edit: `targets/virtual-conference/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| iOS | 15.0+ | Full support. Calendar shows room types in location picker. |
| iPadOS | 15.0+ | Same as iOS. |
| macOS | 12.0+ | Calendar.app supports virtual conference extensions. |
| watchOS | -- | Not supported. Calendar on watchOS does not load conference extensions. |
| tvOS | -- | Not supported. |
| visionOS | 1.0+ | Calendar is available; virtual conference extensions are expected to work. |

## Gotchas

- **Your extension is only invoked at event creation time.** The system calls `fetchVirtualConference` when the user picks your room type while creating or editing an event. It is not called again when the event is opened later -- the stored URL descriptors are used directly. If you need to regenerate meeting links, the user must re-select your room type.
- **Room types appear only if your main app is installed.** The extension is bundled inside your app. If the user deletes the app, your room types disappear from the Calendar location picker.
- **No way to programmatically attach a conference to an existing event.** Developers on Apple Developer Forums have reported that there is no public API to set virtual conference data on an `EKEvent` created via `EKEventEditViewController` or `EKEventStore`. The only path is through the user selecting your room type in the Calendar UI.
- **The completion handler must be called promptly.** If `fetchVirtualConference` takes too long (e.g., a slow network call to your backend), the system may time out and show an error. Keep the operation fast or pre-generate meeting IDs.
- **URL descriptors should include a web fallback.** If your first URL uses a custom scheme (`myapp://...`) and the app is not installed on the device receiving the shared event, the join button will fail silently. Always include an `https://` fallback URL.
- **EventKit permission is not required for the extension.** The extension does not need calendar access (`EKEventStore` authorization) to function. It only provides conference details -- it does not read or write events.
- **Zoom has not yet adopted this API.** Despite community requests, as of 2025, Zoom has not shipped an `EKVirtualConferenceProvider` extension. FaceTime is the only first-party provider. Adoption among third-party apps remains limited.
