---
title: Shield Action Extension
description: Handles button taps on the Screen Time shield overlay, allowing the app to close the shielded app, defer the action, or do nothing in response to user interaction.
version: iOS 15.0+
---

# Shield Action Extension (`shield-action`)

A Shield Action extension responds to user taps on the primary and secondary buttons of the Screen Time shield overlay. When `ManagedSettingsStore` applies a shield to an app, website, or activity category, the system displays a blocking overlay. This extension controls what happens when the user taps either button on that overlay. It is one of three extension types in Apple's Screen Time API suite (alongside Device Activity Monitor and Shield Configuration) and requires the Family Controls entitlement. The extension subclasses `ShieldActionDelegate` and returns a `ShieldActionResponse` (`.close`, `.defer`, or `.none`) to tell the system how to proceed.

## Apple Documentation

- [ShieldActionDelegate](https://developer.apple.com/documentation/managedsettings/shieldactiondelegate)
- [ShieldAction](https://developer.apple.com/documentation/managedsettings/shieldaction)
- [ShieldActionResponse](https://developer.apple.com/documentation/managedsettings/shieldactionresponse)
- [handle(action:for:completionHandler:) -- Application](https://developer.apple.com/documentation/managedsettings/shieldactiondelegate/handle(action:for:completionhandler:)-9hcqc)
- [handle(action:for:completionHandler:) -- WebDomain](https://developer.apple.com/documentation/managedsettings/shieldactiondelegate/handle(action:for:completionhandler:)-9o7ql)
- [handle(action:for:completionHandler:) -- ActivityCategory](https://developer.apple.com/documentation/managedsettings/shieldactiondelegate/handle(action:for:completionhandler:)-3akjf)
- [ManagedSettings Framework](https://developer.apple.com/documentation/managedsettings)

## WWDC History

- **[WWDC 2021, Session 10123 -- Meet the Screen Time API](https://developer.apple.com/videos/play/wwdc2021/10123/)** -- Introduced the Screen Time API with three frameworks. Demonstrated the shield action handler (originally `ShieldActionHandler`) for responding to button taps on the shield overlay.
- **[WWDC 2022, Session 110336 -- What's New in Screen Time API](https://developer.apple.com/videos/play/wwdc2022/110336/)** -- Renamed `ShieldActionHandler` to `ShieldActionDelegate`. Added individual authorization for non-child use cases. Clarified the extension lifecycle and response model.

## What It Does

1. **Shield is displayed.** When `ManagedSettingsStore.shield.applications` or `.shield.applicationCategories` contains tokens, the system overlays a shield on those apps or websites.
2. **User taps a button.** The shield presents up to two buttons (primary and secondary, whose labels are customized by the Shield Configuration extension). When tapped, the system launches the Shield Action extension.
3. **Extension receives the action.** The system calls `handle(action:for:completionHandler:)` with a `ShieldAction` (`.primaryButtonPressed` or `.secondaryButtonPressed`) and the token identifying the shielded application, web domain, or activity category.
4. **Extension returns a response.** The completion handler is called with one of three `ShieldActionResponse` values:
   - `.close` -- Dismisses the shielded app (sends it to background).
   - `.defer` -- Tells the system to let the user ask a guardian for permission (triggers the Screen Time approval flow for child authorization).
   - `.none` -- Does nothing; the shield remains visible.
5. **Extension can perform side effects.** Before calling the completion handler, the extension can update `ManagedSettingsStore`, write to App Group shared storage, or log analytics.

## Use Cases

### Parental controls with guardian approval

The primary button is labeled "Ask for More Time" (set by the Shield Configuration extension). When tapped, the Shield Action extension returns `.defer`, which triggers the system's built-in guardian approval prompt. If the guardian approves, the shield is temporarily lifted.

### Hard block with dismiss

A digital wellbeing app shields social media apps after a daily limit. The primary button is labeled "Close App" and returns `.close`. The secondary button is hidden (no label set in Shield Configuration). The user can only dismiss the app.

### Logging and analytics

An enterprise management app wants to track how often employees attempt to bypass work-hour restrictions. The extension logs each tap to App Group shared storage before returning `.close`, allowing the management dashboard to display compliance metrics.

## Key Classes

| Class / Protocol | Role |
|------------------|------|
| `ShieldActionDelegate` | Base class for the extension's principal class. Override `handle(action:for:completionHandler:)` for applications, web domains, and activity categories. |
| `ShieldAction` | Enum with cases `.primaryButtonPressed` and `.secondaryButtonPressed`. |
| `ShieldActionResponse` | Enum with cases `.close`, `.defer`, and `.none`. Returned via the completion handler. |
| `ApplicationToken` | Opaque token identifying a shielded application. |
| `WebDomainToken` | Opaque token identifying a shielded web domain. |
| `ActivityCategoryToken` | Opaque token identifying a shielded activity category. |
| `ManagedSettingsStore` | Can be used inside the extension to modify shields or restrictions in response to a button tap. |

## Implementation

```swift
import ManagedSettings

// 1. Subclass ShieldActionDelegate. The class name must match the
//    NSExtensionPrincipalClass value in Info.plist.
class ShieldActionExtension: ShieldActionDelegate {

    // 2. Handle button taps on shields covering individual applications.
    override func handle(
        action: ShieldAction,
        for application: ApplicationToken,
        completionHandler: @escaping (ShieldActionResponse) -> Void
    ) {
        switch action {
        case .primaryButtonPressed:
            // 3. Close the shielded app (sends it to background).
            completionHandler(.close)

        case .secondaryButtonPressed:
            // 4. Defer to the guardian approval flow (child authorization)
            //    or do nothing (individual authorization).
            completionHandler(.defer)

        @unknown default:
            completionHandler(.none)
        }
    }

    // 5. Handle button taps on shields covering web domains (Safari, WebKit views).
    override func handle(
        action: ShieldAction,
        for webDomain: WebDomainToken,
        completionHandler: @escaping (ShieldActionResponse) -> Void
    ) {
        switch action {
        case .primaryButtonPressed:
            completionHandler(.close)
        case .secondaryButtonPressed:
            completionHandler(.defer)
        @unknown default:
            completionHandler(.none)
        }
    }

    // 6. Handle button taps on shields covering entire activity categories.
    override func handle(
        action: ShieldAction,
        for category: ActivityCategoryToken,
        completionHandler: @escaping (ShieldActionResponse) -> Void
    ) {
        switch action {
        case .primaryButtonPressed:
            // 7. Example: log the event to shared storage before closing.
            let defaults = UserDefaults(suiteName: "group.com.example.myapp")
            let count = (defaults?.integer(forKey: "shieldDismissCount") ?? 0) + 1
            defaults?.set(count, forKey: "shieldDismissCount")

            completionHandler(.close)
        case .secondaryButtonPressed:
            completionHandler(.defer)
        @unknown default:
            completionHandler(.none)
        }
    }
}
```

## Usage

- Create: `bun create target shield-action`
- Edit: `targets/shield-action/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| iOS | 15.0+ | Full support. Individual authorization added in 16.0+. |
| iPadOS | 15.0+ | Same as iOS. |
| macOS | -- | Not supported. Screen Time API is iOS/iPadOS only. |
| watchOS | -- | Not supported. |
| visionOS | -- | Not supported. |
| tvOS | -- | Not supported. |

## Gotchas

- **Cannot open the parent app.** There is no `ShieldActionResponse` case that opens the host app. Developers have requested `.openParentApp` on Apple Developer Forums, but as of iOS 18 it does not exist. The only options are `.close`, `.defer`, and `.none`.
- **`.defer` only works with child authorization.** When using `AuthorizationCenter.requestAuthorization(for: .individual)`, returning `.defer` has no meaningful effect because there is no guardian to approve the request. Use `.close` or `.none` instead for individual authorization flows.
- **App Group is required for shared state.** The extension runs in a separate process. To share data (e.g., dismiss counts, user preferences) with the host app or other extensions, add the App Groups capability to both the extension target and the main app target and use `UserDefaults(suiteName:)` or a shared file container.
- **Family Controls entitlement requires Apple approval.** The `com.apple.developer.family-controls` entitlement must be requested through Apple's developer portal. Without approval, development builds work but TestFlight and App Store distribution will be rejected.
- **Completion handler must be called.** Failing to call the `completionHandler` leaves the shield in an undefined state. Always call it in every code path, including error cases.
- **No custom UI in this extension.** The Shield Action extension is headless. It processes the button tap and returns a response. All visual customization of the shield (labels, colors, icons) is handled by the separate Shield Configuration extension.
- **The class was renamed in Xcode 14.** WWDC 2021 materials reference `ShieldActionHandler`. This was renamed to `ShieldActionDelegate` in iOS 16 / Xcode 14. Code samples from early tutorials may use the old name and will not compile.
- **Three separate `handle` overloads.** You must override the correct overload for the token type you are shielding (Application, WebDomain, or ActivityCategory). If you only override the Application variant but shield by category, the category button taps will use the default behavior.
