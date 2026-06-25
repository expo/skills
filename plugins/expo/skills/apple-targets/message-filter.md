---
title: SMS/MMS Message Filter Extension
description: Filters SMS and MMS messages from unknown senders into Junk, Promotions, or Transactions folders in the Messages app.
version: iOS 11.0+
---

# SMS/MMS Message Filter Extension (`message-filter`)

A Message Filter extension lets your app classify incoming SMS and MMS messages from unknown senders (people not in the recipient's contacts). When a message arrives from an unknown number, iOS passes the sender and message body to your extension, which returns a filtering action -- allow, junk, promotion, or transaction. The system then routes the message to the appropriate folder in the Messages app. The extension operates entirely on-device by default, but can optionally defer to a network server for more sophisticated classification. Only messages from unknown senders are ever passed to the extension; messages from known contacts are never filtered.

## Apple Documentation

- [Creating a Message Filter App Extension](https://developer.apple.com/documentation/identitylookup/creating-a-message-filter-app-extension)
- [ILMessageFilterExtension](https://developer.apple.com/documentation/identitylookup/ilmessagefilterextension)
- [ILMessageFilterQueryHandling](https://developer.apple.com/documentation/identitylookup/ilmessagefilterqueryhandling)
- [ILMessageFilterAction](https://developer.apple.com/documentation/identitylookup/ilmessagefilteraction)
- [ILMessageFilterQueryResponse (subAction)](https://developer.apple.com/documentation/identitylookup/ilmessagefilterqueryresponse/subaction)
- [SMS and MMS Message Filtering](https://developer.apple.com/documentation/identitylookup/sms-and-mms-message-filtering)
- [IdentityLookup Framework](https://developer.apple.com/documentation/identitylookup)

## WWDC History

- **[WWDC 2017, Session 249 -- Filtering Unwanted Messages with Identity Lookup](https://developer.apple.com/videos/play/wwdc2017/249/)** -- Introduced the IdentityLookup framework and the Message Filter extension point, covering on-device classification and network deferral.
- **[WWDC 2022, Session 110341 -- Explore SMS Message Filters](https://developer.apple.com/videos/play/wwdc2022/110341/)** -- Added 12 sub-categories under Promotions and Transactions (iOS 16), plus the `ILMessageFilterCapabilitiesQueryHandling` protocol for declaring supported sub-actions.

## What It Does

1. **Unknown sender message arrives.** When an SMS or MMS is received from a number not in the user's contacts, iOS invokes the enabled Message Filter extension.
2. **Extension receives the query.** Your `ILMessageFilterQueryHandling` implementation receives an `ILMessageFilterQueryRequest` containing the sender and message body.
3. **On-device classification.** Your extension inspects the message content and returns an `ILMessageFilterQueryResponse` with an action: `.allow`, `.junk`, `.promotion`, or `.transaction`.
4. **Optional network deferral.** If your extension returns `.none`, the system forwards the query to your server (URL configured in Info.plist under `ILMessageFilterExtensionNetworkURL`). The server response is passed back through your extension for final classification.
5. **Sub-categories (iOS 16+).** Your extension can declare supported sub-actions (e.g. Finance, Orders, Health under Transactions; Coupons, Offers under Promotions) via `ILMessageFilterCapabilitiesQueryHandling`. Messages are then sorted into sub-folders in the Messages app.
6. **User enables in Settings.** The extension is inactive until the user goes to Settings > Messages > Unknown & Spam and selects your filter.

## Use Cases

### Spam and phishing protection

A security app scans message content for known phishing patterns (shortened URLs, urgency language, OTP interception attempts) and marks matching messages as junk. The user never sees them in their primary inbox.

### Promotional message organization

An e-commerce companion app classifies delivery notifications as Transactions and marketing offers as Promotions, letting the user keep their primary SMS inbox clean while still seeing important order updates.

### Regional SMS filtering

In countries with high SMS spam volume (India, Brazil), a locally popular filter app uses a combination of on-device keyword matching and server-side crowd-sourced databases to classify messages into granular sub-categories like Finance, Health, and Public Services.

## Key Classes

| Class / Protocol | Role |
|------------------|------|
| `ILMessageFilterExtension` | Abstract base class for the extension's principal class. Subclass this to create your filter. |
| `ILMessageFilterQueryHandling` | Protocol your extension adopts. Requires `handle(_:context:completion:)` to classify each message. |
| `ILMessageFilterQueryRequest` | Contains the sender's address and the message body. Passed to your handler. |
| `ILMessageFilterQueryResponse` | Your reply. Set `.action` to `.allow`, `.junk`, `.promotion`, or `.transaction`. Optionally set `.subAction` (iOS 16+). |
| `ILMessageFilterAction` | Enum of top-level filter actions: `.none`, `.allow`, `.junk`, `.promotion`, `.transaction`. |
| `ILMessageFilterSubAction` | Enum of sub-categories (iOS 16+): `.transactionalFinance`, `.transactionalOrders`, `.transactionalHealth`, `.promotionalOffers`, `.promotionalCoupons`, and more. |
| `ILMessageFilterCapabilitiesQueryHandling` | Protocol (iOS 16+) for declaring which sub-actions your filter supports. The system calls this to configure folder UI. |
| `ILMessageFilterExtensionContext` | Extension context providing `deferQueryRequestToNetwork()` for server-side classification. |

## Implementation

```swift
import IdentityLookup

// 1. Subclass ILMessageFilterExtension -- the system loads this as the
//    extension's principal class.
final class MessageFilterExtension: ILMessageFilterExtension {}

// 2. Adopt ILMessageFilterQueryHandling to receive and classify messages.
extension MessageFilterExtension: ILMessageFilterQueryHandling {

    func handle(
        _ queryRequest: ILMessageFilterQueryRequest,
        context: ILMessageFilterExtensionContext,
        completion: @escaping (ILMessageFilterQueryResponse) -> Void
    ) {
        // 3. Attempt to classify the message using on-device logic first.
        let (action, subAction) = classifyLocally(queryRequest)

        if action != .none {
            // 4. We have a confident local classification -- respond immediately.
            let response = ILMessageFilterQueryResponse()
            response.action = action
            response.subAction = subAction
            completion(response)
        } else {
            // 5. Uncertain -- defer to the network server configured in
            //    Info.plist under ILMessageFilterExtensionNetworkURL.
            //    The system sends the query to your server and calls back
            //    with the server's JSON response.
            context.deferQueryRequestToNetwork { networkResponse, error in
                let response = ILMessageFilterQueryResponse()

                if let networkResponse = networkResponse {
                    // 6. Parse the server response and set the action.
                    response.action = self.action(
                        for: networkResponse
                    )
                } else {
                    // 7. Network failed -- allow the message through rather
                    //    than silently dropping legitimate messages.
                    response.action = .allow
                }

                completion(response)
            }
        }
    }

    // 8. Local classification using keyword matching, regex, or a
    //    local database of known spam senders.
    private func classifyLocally(
        _ request: ILMessageFilterQueryRequest
    ) -> (ILMessageFilterAction, ILMessageFilterSubAction) {
        guard let body = request.messageBody?.lowercased() else {
            return (.none, .none)
        }

        // 9. Example: classify OTP and banking messages as transactions.
        let transactionKeywords = ["otp", "verification code", "one-time password", "account ending"]
        if transactionKeywords.contains(where: { body.contains($0) }) {
            return (.transaction, .transactionalFinance)
        }

        // 10. Example: classify marketing messages as promotions.
        let promoKeywords = ["unsubscribe", "limited time", "% off", "free shipping"]
        if promoKeywords.contains(where: { body.contains($0) }) {
            return (.promotion, .promotionalOffers)
        }

        // 11. No confident match -- return .none to defer to network or allow.
        return (.none, .none)
    }

    private func action(
        for networkResponse: ILNetworkResponse
    ) -> ILMessageFilterAction {
        // 12. Parse the server's JSON response. The format is up to you, but
        //     the response must map to an ILMessageFilterAction.
        guard let data = networkResponse.urlResponse.url.flatMap({ _ in
            try? JSONSerialization.jsonObject(with: Data()) as? [String: Any]
        }) else {
            return .allow
        }

        switch data["action"] as? String {
        case "junk": return .junk
        case "promotion": return .promotion
        case "transaction": return .transaction
        default: return .allow
        }
    }
}
```

## Usage

- Create: `bun create target message-filter`
- Edit: `targets/message-filter/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| iOS | 11.0+ | Full support. Sub-categories added in iOS 16.0+. |
| iPadOS | 11.0+ | Supported on iPads with cellular capability. |
| macOS | -- | Not supported. |
| watchOS | -- | Not supported. |
| visionOS | -- | Not supported. |
| tvOS | -- | Not supported. |

## Gotchas

- **Only unknown senders are filtered.** Messages from contacts, known senders, and iMessage conversations are never passed to the extension. Your filter has zero visibility into messages from people in the user's address book.
- **The extension never sees iMessages.** Only SMS and MMS messages are filtered. iMessage (blue bubble) conversations are completely excluded from the IdentityLookup pipeline.
- **Network URL must be HTTPS and statically configured.** The `ILMessageFilterExtensionNetworkURL` in Info.plist must be a hardcoded HTTPS URL. It cannot vary per user or per request. The server must not require any ATS exceptions, and the URL must pass Associated Domains validation.
- **Sub-categories are region-dependent.** While the API is available globally, the Messages app folder UI for Transactions, Promotions, and sub-categories is only surfaced in certain regions (notably India and Brazil as of iOS 16). In other regions, messages are classified as Junk or allowed through without sub-folder sorting.
- **User must manually enable the filter.** Go to Settings > Messages > Unknown & Spam and select your filter. Only one third-party SMS filter can be active at a time across all installed apps.
- **Privacy constraints prevent data exfiltration.** The extension cannot make arbitrary network requests. The only network path is the system-managed deferral to your configured server URL. You cannot send message content to analytics or other endpoints.
- **No access to message metadata beyond sender and body.** The `ILMessageFilterQueryRequest` provides only the sender address and message body text. You do not receive timestamps, attachments, or thread context.
- **Sub-action support requires capabilities declaration (iOS 16+).** To use sub-categories, your extension must also adopt `ILMessageFilterCapabilitiesQueryHandling` and return the sub-actions you support in `handle(_:capabilitiesQueryRequest:context:completion:)`. Without this, the system only uses top-level actions.
