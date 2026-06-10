---
title: Safari Web Extension
description: Adds browser functionality to Safari using the cross-browser WebExtension API with manifest.json, content scripts, background scripts, and a popup UI.
version: iOS 15.0+, macOS 11.0+
---

# Safari Web Extension (`safari`)

A Safari Web Extension uses the standard cross-browser WebExtension API -- the same `manifest.json`, content scripts, background scripts, and popup HTML used by Chrome and Firefox extensions -- packaged inside a native iOS or macOS app. Unlike every other Apple extension type, the bulk of the logic is written in JavaScript/HTML/CSS rather than Swift. A thin native `SafariWebExtensionHandler` class (conforming to `NSExtensionRequestHandling`) acts as the bridge for native messaging via `browser.runtime.sendNativeMessage()`. The extension requires a containing app to be distributed through the App Store, and users must explicitly enable it in Safari's settings. This architecture is fundamentally different from other iOS extensions: there is no `NSExtensionContext.inputItems` flow, no `NSItemProvider` attachments, and no share sheet -- instead, the extension operates within Safari's tab and page lifecycle through the WebExtension API.

## Apple Documentation

- [Safari Web Extensions Overview](https://developer.apple.com/documentation/safariservices/safari-web-extensions)
- [Creating a Safari Web Extension](https://developer.apple.com/documentation/safariservices/creating-a-safari-web-extension)
- [Assessing Your Safari Web Extension's Browser Compatibility](https://developer.apple.com/documentation/safariservices/assessing-your-safari-web-extension-s-browser-compatibility)
- [Messaging a Web Extension's Native App](https://developer.apple.com/documentation/safariservices/messaging-a-web-extension-s-native-app)
- [SFSafariExtensionHandler (macOS)](https://developer.apple.com/documentation/safariservices/sfsafariextensionhandler)
- [Converting a Web Extension for Safari](https://developer.apple.com/documentation/safariservices/converting-a-web-extension-for-safari)
- [Running Your Safari Web Extension During Development](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension-during-development)

## WWDC History

- **[WWDC 2020, Session 10665 -- Meet Safari Web Extensions](https://developer.apple.com/videos/play/wwdc2020/10665/)** -- Introduced Safari Web Extensions on macOS. Covered the `manifest.json` format, `safari-web-extension-converter` tool, and the privacy-focused permissions model.
- **[WWDC 2021, Session 10104 -- Meet Safari Web Extensions on iOS](https://developer.apple.com/videos/play/wwdc2021/10104/)** -- Brought Safari Web Extensions to iOS 15 and iPadOS 15. Demonstrated building a single extension that works across iPhone, iPad, and Mac.
- **[WWDC 2021, Session 10027 -- Explore Safari Web Extension Improvements](https://developer.apple.com/videos/play/wwdc2021/10027/)** -- Introduced non-persistent background pages for better performance, the `declarativeNetRequest` API for content blocking, and tab-override pages.
- **[WWDC 2022, Session 10099 -- What's New in Safari Web Extensions](https://developer.apple.com/videos/play/wwdc2022/10099/)** -- Manifest v3 support, `declarativeNetRequest` improvements, and updated permissions UI.
- **[WWDC 2023, Session 10119 -- What's New in Safari Extensions](https://developer.apple.com/videos/play/wwdc2023/10119/)** -- Per-site permissions, profile-aware extensions, and additional WebExtension API coverage.

## What It Does

1. **User enables the extension.** In iOS Settings > Safari > Extensions (or Safari > Preferences > Extensions on macOS), the user toggles the extension on and grants per-site or all-sites permission.
2. **Content scripts inject into web pages.** Scripts listed in `manifest.json`'s `content_scripts` array run in the context of matching web pages. They can read and modify the DOM, intercept events, and communicate with the background script.
3. **Background script handles events.** The `background.service_worker` (manifest v3) or `background.scripts` (manifest v2) file runs in a separate context. It handles extension events (install, tab updates, messages from content scripts, alarms) and manages extension-wide state.
4. **Popup UI provides controls.** The `action.default_popup` HTML page appears when the user taps the extension icon in Safari's toolbar. It can communicate with the background script to read/write state and trigger actions.
5. **Native messaging bridges to Swift.** Calling `browser.runtime.sendNativeMessage("application.id", message)` from JavaScript sends a message to the native `SafariWebExtensionHandler.beginRequest(with:)` method. The native side can access Keychain, Core Data, file system, or any iOS API and return a response.
6. **Permissions control access.** The `permissions` and `host_permissions` arrays in `manifest.json` declare what APIs and domains the extension needs. Safari's privacy model requires explicit user consent for each site (or all sites).

## Use Cases

### Ad and tracker blocking
A `declarativeNetRequest`-based extension with rules defined in JSON files that block network requests matching specific URL patterns. No background script needed for basic blocking -- Safari evaluates the rules natively for better performance and privacy.

### Password manager autofill
A content script detects login forms on web pages and offers to fill credentials. The content script sends a message to the background script, which calls `browser.runtime.sendNativeMessage()` to request credentials from the native app's Keychain storage via `SafariWebExtensionHandler`.

### Page translation
A content script extracts the page text, sends it to the background script, which calls a translation API. The translated text is sent back to the content script, which replaces the DOM content. The popup provides language selection and toggle controls.

### Reading mode and accessibility
A content script applies custom CSS and DOM transformations to simplify page layouts, adjust fonts, or add dark mode. User preferences are stored via `browser.storage.local` and synced across devices with `browser.storage.sync`.

## Key Classes

| Class / Protocol | Role |
|------------------|------|
| `SafariWebExtensionHandler` | Native Swift class conforming to `NSExtensionRequestHandling`. Receives messages from `browser.runtime.sendNativeMessage()` and returns responses. The bridge between WebExtension JavaScript and native iOS/macOS APIs. |
| `NSExtensionRequestHandling` | Protocol that `SafariWebExtensionHandler` conforms to. Provides `beginRequest(with:)` where native message handling occurs. |
| `NSExtensionContext` | Delivers the incoming message and provides `completeRequest(returningItems:)` to send the response back to JavaScript. |
| `SFExtensionMessageKey` | String constant used as the key in `NSExtensionItem.userInfo` to extract the message dictionary sent from JavaScript and to set the response dictionary. |
| `SFSafariApplication` (macOS) | On macOS, provides methods to interact with Safari (get active window, dispatch messages to extension). Not available on iOS. |
| `SFContentBlockerManager` | Used by both content blocker extensions and web extensions to reload content blocking rules. Call `reloadContentBlocker(withIdentifier:)` when rules change. |

## Implementation

```swift
import SafariServices
import os.log

// 1. The native handler receives messages from browser.runtime.sendNativeMessage().
class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    func beginRequest(with context: NSExtensionContext) {
        // 2. Extract the message sent from JavaScript.
        let item = context.inputItems[0] as! NSExtensionItem
        guard let message = item.userInfo?[SFExtensionMessageKey] as? [String: Any] else {
            context.completeRequest(returningItems: [], completionHandler: nil)
            return
        }

        os_log(.default, "Received native message: %{public}@", String(describing: message))

        let action = message["action"] as? String ?? ""

        // 3. Handle different message types from the JavaScript side.
        var responseData: [String: Any] = [:]

        switch action {
        case "getCredentials":
            // 4. Access native-only APIs like Keychain.
            let domain = message["domain"] as? String ?? ""
            responseData = [
                "username": lookupUsername(for: domain),
                "found": true
            ]

        case "savePreference":
            // 5. Write to UserDefaults in the shared App Group.
            let key = message["key"] as? String ?? ""
            let value = message["value"] as? String ?? ""
            let defaults = UserDefaults(suiteName: "group.com.example.myapp")
            defaults?.set(value, forKey: key)
            responseData = ["saved": true]

        default:
            responseData = ["error": "Unknown action: \(action)"]
        }

        // 6. Send the response back to the JavaScript callback.
        let response = NSExtensionItem()
        response.userInfo = [SFExtensionMessageKey: responseData]
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }

    private func lookupUsername(for domain: String) -> String {
        // In a real app, query the Keychain or Core Data here.
        return "user@example.com"
    }
}
```

The `manifest.json` defines the extension structure, permissions, and scripts:

```json
{
    "manifest_version": 3,
    "name": "My Safari Extension",
    "version": "1.0",
    "description": "Example Safari Web Extension",

    "icons": {
        "48": "images/icon-48.png",
        "96": "images/icon-96.png",
        "128": "images/icon-128.png"
    },

    "background": {
        "service_worker": "background.js"
    },

    "content_scripts": [{
        "js": ["content.js"],
        "matches": ["*://*.example.com/*"]
    }],

    "action": {
        "default_popup": "popup.html",
        "default_icon": {
            "16": "images/toolbar-icon-16.png",
            "32": "images/toolbar-icon-32.png"
        }
    },

    "permissions": [
        "storage",
        "activeTab",
        "nativeMessaging"
    ]
}
```

The `background.js` handles extension lifecycle events and native messaging:

```javascript
// 7. Listen for messages from content scripts.
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getCredentials") {
    // 8. Forward to the native SafariWebExtensionHandler.
    browser.runtime.sendNativeMessage(
      "application.id",
      { action: "getCredentials", domain: message.domain },
      (response) => {
        // 9. Relay the native response back to the content script.
        sendResponse(response);
      }
    );
    return true; // Keep the message channel open for async response.
  }
});

// 10. Handle extension install and update events.
browser.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    console.log("Extension installed");
  }
});
```

## Usage

- Create: `bun create target safari`
- Edit: `targets/safari/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| iOS | 15.0+ | Safari Web Extensions introduced. Users enable in Settings > Safari > Extensions. |
| iPadOS | 15.0+ | Same as iOS. Extensions work in both compact and regular size classes. |
| macOS | 11.0+ | Safari Web Extensions introduced at WWDC 2020. Full desktop extension support. |
| Mac Catalyst | 15.0+ | Can share the same extension target between iOS and Mac Catalyst builds. |
| watchOS | -- | Not supported. |
| tvOS | -- | Not supported. |
| visionOS | 1.0+ | Safari available; extension support follows iOS model. |

## Gotchas

- **Service worker lifecycle is unreliable on iOS.** On iOS 17.4 through 17.5, the service worker would stop after approximately 30 seconds. On iOS 18+, the hard timeout was removed but the service worker can still die and fail to wake up for subsequent events. Content scripts and popup messages may silently fail when the service worker is dead. Consider using `background.scripts` with a non-persistent page instead of `service_worker` if you need more reliable background processing.
- **`sendNativeMessage` response handler may not fire.** Apple has acknowledged a bug where the response callback from `browser.runtime.sendNativeMessage()` never executes. As a workaround, use `browser.runtime.connectNative()` with port-based messaging instead.
- **Manifest v3 debugging is broken in Safari.** When using manifest v3 with `background.service_worker`, the Web Inspector shows "No Web Extension Background Content" and you cannot inspect or view `console.log` output from the service worker. Manifest v2 background pages can be inspected normally.
- **`preferred_environment` controls background mode.** When both `background.scripts` and `background.service_worker` are in `manifest.json`, Safari uses `scripts` unless `preferred_environment` is set to `"service_worker"`. On iOS, background content cannot be persistent -- set `"persistent": false` or the build will fail.
- **User must explicitly enable the extension.** Unlike other extension types that appear automatically, Safari Web Extensions require the user to navigate to Settings > Safari > Extensions and toggle the extension on. Your containing app should guide users through this with a deep link to the settings page.
- **Per-site permission model.** Safari asks for permission on each domain the extension wants to access. Extensions declared with broad host permissions (`<all_urls>`) trigger a more prominent permission prompt. Users can revoke per-site access at any time.
- **`webRequest` API dropped in Safari 18.4 for manifest v3.** After the macOS 15.4 / Safari 18.4 update, non-persistent background content cannot listen to `webRequest` events. Use `declarativeNetRequest` instead for request interception and blocking.
- **Safari does not extend service worker lifetime for native messaging.** Unlike Chrome, which keeps the service worker alive while a native messaging connection is open, Safari will terminate the service worker on its normal schedule. Long-running native messaging sessions will be interrupted.
- **Cross-browser differences exist.** Safari uses the `browser.*` namespace (with Promise support) rather than Chrome's `chrome.*` namespace. Some APIs like `browser.webRequest` have restrictions. Always test in Safari separately. Apple provides a compatibility assessment tool to check your manifest and API usage.
- **The containing app is required but can be minimal.** Apple requires a native iOS/macOS app to wrap the extension for App Store distribution. The app can be a simple single-screen app that explains the extension and links to Safari settings, but it must exist.
- **Extension resources must be in the `assets/` directory.** The `manifest.json`, JavaScript files, HTML files, CSS, and images for the web extension must all be inside the `assets/` (or `Resources/`) directory of the extension target. The `SafariWebExtensionHandler.swift` lives at the target root alongside them.
