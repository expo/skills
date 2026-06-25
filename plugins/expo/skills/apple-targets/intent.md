---
title: Siri Intents Extension
description: Handles Siri voice commands and system intents using the legacy SiriKit framework, allowing your app to respond to predefined intent domains like messaging, payments, and ride booking.
version: iOS 10.0+
---

# Siri Intents Extension (`intent`)

A background extension that receives and processes Siri voice requests on behalf of your app. When a user speaks a command that matches one of Apple's predefined intent domains (messaging, payments, workouts, etc.), the system routes the structured intent to your extension, which resolves parameters, confirms feasibility, and handles the action -- all without launching your main app.

## Apple Documentation

- [SiriKit Overview](https://developer.apple.com/documentation/sirikit)
- [Creating an Intents App Extension](https://developer.apple.com/documentation/sirikit/intent_handling_infrastructure/creating_an_intents_app_extension)
- [INExtension](https://developer.apple.com/documentation/intents/inextension)
- [INSendMessageIntentHandling](https://developer.apple.com/documentation/intents/insendmessageintenthandling)
- [Intents Framework](https://developer.apple.com/documentation/intents)
- [NSExtensionPointIdentifier](https://developer.apple.com/documentation/bundleresources/information-property-list/nsextension/nsextensionpointidentifier)

## WWDC History

- **[WWDC 2016, Session 217 -- Introducing SiriKit](https://developer.apple.com/videos/play/wwdc2016/217/)** -- Introduced the Intents framework with support for messaging, VoIP calling, payments, photo search, workouts, and ride booking domains.
- **[WWDC 2016, Session 225 -- Extending Your Apps with SiriKit](https://developer.apple.com/videos/play/wwdc2016/225/)** -- Deep dive into building your first Intents extension and bringing custom UI into Siri.
- **[WWDC 2017, Session 214 -- What's New in SiriKit](https://developer.apple.com/videos/play/wwdc2017/214/)** -- Added lists and notes domain, visual codes, and new payment intents for iOS 11.
- **[WWDC 2018, Session 211 -- Introduction to Siri Shortcuts](https://developer.apple.com/videos/play/wwdc2018/211/)** -- Introduced custom intents via IntentDefinition files and Siri Shortcuts for iOS 12.
- **[WWDC 2019, Session 207 -- Introducing SiriKit Media Intents](https://developer.apple.com/videos/play/wwdc2019/207/)** -- Added INPlayMediaIntent for audio apps, enabling "Play X on MyApp" commands.
- **[WWDC 2020, Session 10073 -- Empower Your Intents](https://developer.apple.com/videos/play/wwdc2020/10073/)** -- In-app intent handling, rich disambiguation with images and subtitles, improved parameters.
- **[WWDC 2020, Session 10068 -- What's New in SiriKit and Shortcuts](https://developer.apple.com/videos/play/wwdc2020/10068/)** -- New shortcut running experience, folders, and event triggers in iOS 14.
- **[WWDC 2022, Session 10032 -- Dive into App Intents](https://developer.apple.com/videos/play/wwdc2022/10032/)** -- Introduced the modern App Intents framework as the successor for custom intents. Legacy SiriKit Intents remain necessary for messaging, media, and other built-in domains.

## What It Does

1. The user speaks a command to Siri that maps to a supported intent domain (e.g., "Send a message to John using MyApp").
2. Siri parses the voice input into a structured `INIntent` object with typed parameters.
3. The system launches your Intents extension in the background and calls `handler(for:)` on your `INExtension` subclass.
4. Your handler implements a three-phase protocol:
   - **Resolve** -- Validate and disambiguate each parameter (e.g., which "John" did they mean?).
   - **Confirm** -- Verify the action is feasible (e.g., is the user authenticated? Is there network connectivity?).
   - **Handle** -- Execute the action and return a response with a success or failure code.
5. Siri presents the result to the user, optionally showing your custom Intent UI extension if one is configured.

## Use Cases

### Messaging apps
A chat application that lets users send messages, search conversations, and mark messages as read entirely through Siri voice commands, without opening the app.

### Ride booking services
A transportation app that allows users to request rides, check ride status, and get ETAs through Siri, integrating with the ride-booking intent domain.

### Payment and banking apps
A banking app that handles "Send $50 to Sarah" commands through the payments domain, resolving contacts, confirming amounts, and executing transfers via Siri.

### Fitness and workout apps
A workout tracker that starts, pauses, and ends workout sessions through Siri voice commands using the workouts intent domain.

## Key Classes

| Class / Protocol | Role |
|-----------------|------|
| `INExtension` | Principal class of the extension. Subclass it and override `handler(for:)` to route intents to the correct handler object. |
| `INIntent` | Base class for all system intents. Each domain has concrete subclasses like `INSendMessageIntent`. |
| `INIntentHandling` | Base protocol. Domain-specific protocols like `INSendMessageIntentHandling` add resolve/confirm/handle methods. |
| `INIntentResponse` | Base class for intent responses. Carry a response code (`.success`, `.failure`, etc.) and an optional `NSUserActivity` for handoff. |
| `INInteraction` | Wraps an intent and its response. Used for donating completed interactions to the system for Siri Suggestions. |
| `INPerson` | Represents a contact in messaging and calling intents. Contains handle, display name, and optional image. |

## Implementation

### Messaging Intent Handler (Resolve / Confirm / Handle)

```swift
import Intents

// 1. Subclass INExtension as the principal class declared in Info.plist.
//    Route each intent type to the appropriate handler.
class IntentHandler: INExtension {
    override func handler(for intent: INIntent) -> Any {
        switch intent {
        case is INSendMessageIntent:
            return SendMessageHandler()
        case is INSearchForMessagesIntent:
            return SearchMessagesHandler()
        default:
            return self
        }
    }
}

// 2. Implement the full resolve/confirm/handle cycle for sending messages.
class SendMessageHandler: NSObject, INSendMessageIntentHandling {

    // 3. RESOLVE: Disambiguate recipients. Siri calls this before confirmation.
    func resolveRecipients(
        for intent: INSendMessageIntent,
        with completion: @escaping ([INSendMessageRecipientResolutionResult]) -> Void
    ) {
        guard let recipients = intent.recipients, !recipients.isEmpty else {
            completion([.needsValue()])
            return
        }

        var results = [INSendMessageRecipientResolutionResult]()
        for recipient in recipients {
            // 4. Look up matching contacts in your app's data store.
            let matches = ContactStore.shared.findContacts(matching: recipient)

            switch matches.count {
            case 0:
                results.append(.unsupported())
            case 1:
                results.append(.success(with: matches[0]))
            default:
                // 5. Multiple matches -- ask Siri to let the user pick one.
                results.append(.disambiguation(with: matches))
            }
        }
        completion(results)
    }

    // 6. RESOLVE: Validate the message content.
    func resolveContent(
        for intent: INSendMessageIntent,
        with completion: @escaping (INStringResolutionResult) -> Void
    ) {
        if let text = intent.content, !text.isEmpty {
            completion(.success(with: text))
        } else {
            completion(.needsValue())
        }
    }

    // 7. CONFIRM: Verify the app is ready to send (e.g., user is logged in).
    func confirm(
        intent: INSendMessageIntent,
        completion: @escaping (INSendMessageIntentResponse) -> Void
    ) {
        guard AuthManager.shared.isAuthenticated else {
            let response = INSendMessageIntentResponse(code: .failureRequiringAppLaunch, userActivity: nil)
            completion(response)
            return
        }
        completion(INSendMessageIntentResponse(code: .ready, userActivity: nil))
    }

    // 8. HANDLE: Actually send the message and return the result.
    func handle(
        intent: INSendMessageIntent,
        completion: @escaping (INSendMessageIntentResponse) -> Void
    ) {
        guard let recipients = intent.recipients,
              let content = intent.content else {
            completion(INSendMessageIntentResponse(code: .failure, userActivity: nil))
            return
        }

        MessageService.shared.send(
            content: content,
            to: recipients.compactMap { $0.personHandle?.value }
        ) { success in
            let code: INSendMessageIntentResponseCode = success ? .success : .failure
            let activity = NSUserActivity(activityType: NSStringFromClass(INSendMessageIntent.self))
            completion(INSendMessageIntentResponse(code: code, userActivity: activity))
        }
    }
}

// 9. Donate completed interactions so the system can offer Siri Suggestions.
func donateInteraction(for intent: INSendMessageIntent, response: INSendMessageIntentResponse) {
    let interaction = INInteraction(intent: intent, response: response)
    interaction.donate { error in
        if let error = error {
            print("Donation failed: \(error.localizedDescription)")
        }
    }
}
```

### Custom Intent via IntentDefinition File

For domains not covered by built-in intents, you can define custom intents using an `.intentdefinition` file in Xcode:

```swift
import Intents

// 1. Xcode auto-generates OrderCoffeeIntent from your IntentDefinition file.
//    Implement the generated handling protocol.
class OrderCoffeeHandler: NSObject, OrderCoffeeIntentHandling {

    // 2. Resolve the coffee size parameter.
    func resolveCoffeeSize(
        for intent: OrderCoffeeIntent,
        with completion: @escaping (CoffeeSizeResolutionResult) -> Void
    ) {
        if intent.coffeeSize == .unknown {
            completion(.needsValue())
        } else {
            completion(.success(with: intent.coffeeSize))
        }
    }

    // 3. Confirm the order is valid.
    func confirm(
        intent: OrderCoffeeIntent,
        completion: @escaping (OrderCoffeeIntentResponse) -> Void
    ) {
        completion(OrderCoffeeIntentResponse(code: .ready, userActivity: nil))
    }

    // 4. Place the order.
    func handle(
        intent: OrderCoffeeIntent,
        completion: @escaping (OrderCoffeeIntentResponse) -> Void
    ) {
        CoffeeOrderService.shared.place(
            size: intent.coffeeSize,
            flavor: intent.flavor
        ) { orderId in
            let response = OrderCoffeeIntentResponse(code: .success, userActivity: nil)
            response.orderNumber = NSNumber(value: orderId)
            completion(response)
        }
    }
}
```

## Usage

- Create: `bun create target intent`
- Edit: `targets/intent/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| iOS | 10.0+ | Full support for all intent domains. |
| iPadOS | 10.0+ | Full support. |
| macOS | 11.0+ | Limited domain support (primarily messaging and media). |
| watchOS | 3.2+ | Supports intents via a separate watchOS extension target. |
| tvOS | -- | Not supported. |
| visionOS | 1.0+ | Supported via compatible iOS intents. |

## Gotchas

- **IntentDefinition file must be in both targets.** If you define custom intents, the `.intentdefinition` file must be included in both the Intents extension and your main app target. Missing it from the app target causes Siri Shortcuts to fail silently.
- **Extension memory limit is ~30 MB.** Intents extensions run in a constrained environment. Loading large frameworks, images, or data stores will cause the system to kill your extension with no crash log visible to the user.
- **The Intents framework is legacy for custom intents.** Apple recommends App Intents (iOS 16+) for all new custom intent work. SiriKit Intents remain required only for built-in domains like messaging (`INSendMessageIntent`) and media (`INPlayMediaIntent`) that have not yet migrated to App Intents.
- **`handler(for:)` must return synchronously.** You cannot perform async work in this method. Return the handler object immediately and do all async work in the resolve/confirm/handle methods.
- **IntentsSupported in Info.plist must match.** The `IntentsSupported` array in your extension's Info.plist must list every intent class name you handle. If an intent is missing from this list, Siri will not route it to your extension, with no error or diagnostic message.
- **Siri Shortcuts donation requires the main app.** Donating `INInteraction` objects to improve Siri Suggestions only works from the main app process, not from the extension. Donate after the user completes the action in your app.
- **In-app intent handling (iOS 14+) can replace the extension.** For simpler use cases, you can handle intents directly in your main app by registering handlers on `INInteraction`. This avoids the extension's memory constraints but requires your app to launch.
