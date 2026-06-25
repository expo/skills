---
title: Safari Content Blocker
description: Provides declarative JSON rules to Safari for blocking or hiding web content without runtime code execution.
version: iOS 9.0+
---

# Safari Content Blocker (`content-blocker`)

A content blocker extension supplies Safari with a JSON array of trigger/action rules that block network requests, hide page elements, or strip cookies -- all without executing any code at page-load time. Safari compiles the JSON rules into efficient bytecode at install time, so blocking decisions happen at native speed with zero information leaking back to the extension about the user's browsing activity. This privacy-by-design architecture means the extension has no knowledge of what sites the user visits. The containing app can update rules dynamically and call `SFContentBlockerManager.reloadContentBlocker(withIdentifier:)` to push changes to Safari.

## Apple Documentation

- [Creating a Content Blocker](https://developer.apple.com/documentation/safariservices/creating-a-content-blocker)
- [SFContentBlockerManager](https://developer.apple.com/documentation/safariservices/sfcontentblockermanager)
- [App Extension Programming Guide: Content Blocker](https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/ContentBlocker.html)
- [Safari Content-Blocking Rules Reference](https://developer.apple.com/documentation/safariservices/creating-a-content-blocker#overview)
- [Blocking Content with Your Safari Web Extension](https://developer.apple.com/documentation/safariservices/blocking-content-with-your-safari-web-extension)

## WWDC History

- **[WWDC 2015, Session 511 -- Safari Extensibility: Content Blocking and Shared Links](https://developer.apple.com/videos/play/wwdc2015/511/)** -- Introduced content blockers in iOS 9 and OS X El Capitan. Covered the JSON rule format, trigger/action model, and the privacy-first architecture where Safari compiles rules to bytecode with no runtime callbacks.

## What It Does

1. **Extension returns JSON rules.** The system calls your `NSExtensionRequestHandling` implementation (`beginRequest(with:)`), which returns one or more `NSItemProvider` attachments containing JSON rule arrays.
2. **Safari compiles rules to bytecode.** Safari parses the JSON and compiles it into an optimized bytecode representation. This compilation happens once at install time and after each `reloadContentBlocker` call.
3. **Rules are evaluated per resource load.** For every network request on a page, Safari checks the compiled rules against the URL and resource metadata. Matching happens entirely within the Safari/WebKit process -- no IPC to your extension occurs.
4. **Matched actions execute.** Depending on the action type, Safari blocks the network request, hides a DOM element via CSS, or ignores previously matched rules.
5. **No browsing data reaches the extension.** The extension never learns which URLs the user visits, which rules matched, or any page content. This is enforced architecturally, not by policy.
6. **App can update rules.** The containing app can regenerate the JSON (e.g., based on user preferences) and call `SFContentBlockerManager.reloadContentBlocker(withIdentifier:completionHandler:)` to tell Safari to re-fetch and recompile the rules.

## Use Cases

### Ad blocking
Block advertising network requests by matching known ad-serving domains in `url-filter` triggers. Use `resource-type: ["image", "script", "raw"]` to target ad-related resources. Combine with `css-display-none` actions to hide ad container elements that loaded before the block rule applied.

### Privacy and tracker blocking
Block third-party tracking scripts and pixels by using `load-type: ["third-party"]` triggers combined with a list of known tracker domains in `if-domain` or `url-filter`. Strip cookies from specific domains using the `block-cookies` action type.

### Parental controls and safe browsing
Block access to entire domains by matching broad URL patterns. Use `unless-domain` to allowlist specific sites while blocking everything else. The containing app can present a UI for parents to configure allowed/blocked domains and reload the rules.

### Reader-friendly experience
Hide distracting page elements (pop-ups, newsletter overlays, sticky headers, autoplay video containers) using `css-display-none` actions with CSS selectors targeting common annoyance patterns.

## Key Classes

| Class / Protocol | Role |
|------------------|------|
| `NSExtensionRequestHandling` | Protocol your handler class conforms to. Implement `beginRequest(with:)` to return the JSON rules. |
| `NSExtensionContext` | The context object passed to `beginRequest(with:)`. Call `completeRequest(returningItems:completionHandler:)` with your JSON attachment. |
| `NSItemProvider` | Wraps the JSON file or data as an attachment on the `NSExtensionItem`. |
| `SFContentBlockerManager` | Class in SafariServices used by the containing app to reload rules. Call `reloadContentBlocker(withIdentifier:completionHandler:)`. |

## Implementation

```swift
import UIKit
import MobileCoreServices

// 1. The request handler conforms to NSExtensionRequestHandling.
//    Safari calls beginRequest(with:) to fetch the blocking rules.
class ContentBlockerRequestHandler: NSObject, NSExtensionRequestHandling {

    func beginRequest(with context: NSExtensionContext) {
        // 2. Load a static JSON file bundled with the extension.
        //    You can also build the JSON dynamically based on user settings
        //    stored in a shared App Group container.
        let attachment = NSItemProvider(
            contentsOf: Bundle.main.url(forResource: "blockerList", withExtension: "json")!
        )!

        let item = NSExtensionItem()
        item.attachments = [attachment]

        // 3. Return the rules to Safari. Safari compiles them to bytecode.
        context.completeRequest(returningItems: [item], completionHandler: nil)
    }
}

// 4. Example: dynamically building rules from user preferences.
class DynamicContentBlockerRequestHandler: NSObject, NSExtensionRequestHandling {

    func beginRequest(with context: NSExtensionContext) {
        // 5. Read user preferences from a shared App Group.
        let defaults = UserDefaults(suiteName: "group.com.example.myapp")
        let blockedDomains = defaults?.stringArray(forKey: "blockedDomains") ?? []
        let hideAds = defaults?.bool(forKey: "hideAds") ?? true

        var rules: [[String: Any]] = []

        // 6. Generate block rules for each user-specified domain.
        for domain in blockedDomains {
            rules.append([
                "trigger": ["url-filter": ".*", "if-domain": [domain]],
                "action": ["type": "block"]
            ])
        }

        // 7. Add a CSS-based rule to hide common ad containers.
        if hideAds {
            rules.append([
                "trigger": [
                    "url-filter": ".*",
                    "resource-type": ["document"]
                ],
                "action": [
                    "type": "css-display-none",
                    "selector": ".ad-banner, .ad-container, [id*='google_ads'], [class*='sponsored']"
                ]
            ])
        }

        // 8. Serialize to JSON and return via NSItemProvider.
        guard let jsonData = try? JSONSerialization.data(withJSONObject: rules) else {
            context.cancelRequest(withError: NSError(
                domain: "ContentBlocker", code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Failed to serialize rules"]
            ))
            return
        }

        let tempURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("rules.json")
        try? jsonData.write(to: tempURL)

        let attachment = NSItemProvider(contentsOf: tempURL)!
        let item = NSExtensionItem()
        item.attachments = [attachment]
        context.completeRequest(returningItems: [item], completionHandler: nil)
    }
}
```

### JSON Rule Format Reference

```json
[
  {
    "trigger": {
      "url-filter": "://ads\\.example\\.com/",
      "resource-type": ["script", "image", "raw"],
      "load-type": ["third-party"]
    },
    "action": {
      "type": "block"
    }
  },
  {
    "trigger": {
      "url-filter": ".*",
      "if-domain": ["news.example.com"]
    },
    "action": {
      "type": "css-display-none",
      "selector": ".newsletter-popup, .cookie-banner"
    }
  },
  {
    "trigger": {
      "url-filter": "://tracker\\.example\\.com/"
    },
    "action": {
      "type": "block-cookies"
    }
  },
  {
    "trigger": {
      "url-filter": "://cdn\\.trusted\\.com/",
      "load-type": ["first-party"]
    },
    "action": {
      "type": "ignore-previous-rules"
    }
  }
]
```

### Reloading Rules from the Containing App

```swift
import SafariServices

// Call this from your containing app after updating the JSON rules.
func reloadBlockerRules() {
    // The identifier must match the bundle identifier of the content blocker extension.
    SFContentBlockerManager.reloadContentBlocker(
        withIdentifier: "com.example.myapp.content-blocker"
    ) { error in
        if let error = error {
            print("Failed to reload content blocker: \(error.localizedDescription)")
        } else {
            print("Content blocker rules reloaded successfully.")
        }
    }
}
```

## Usage

- Create: `bun create target content-blocker`
- Edit: `targets/content-blocker/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| iOS | 9.0+ | Safari only. Content blockers apply to all Safari tabs and SFSafariViewController instances. |
| iPadOS | 9.0+ | Same as iOS. |
| macOS | 10.11+ (Safari 9+) | Works in Safari. Also applies to other WebKit-based browsers on macOS 10.12+. |
| watchOS | -- | Not supported. |
| visionOS | -- | Not supported. |
| tvOS | -- | Not supported. |

## Gotchas

- **Hard limit of 50,000 rules per extension.** WebKit enforces a maximum of 50,000 rules per content blocker extension. If your JSON array exceeds this count, Safari silently drops the excess rules. To support more rules, register multiple content blocker extensions in the same app, each with its own 50,000-rule budget.
- **Rules are compiled once, not evaluated per-request.** Safari compiles JSON rules to bytecode at install/reload time. Changes to the JSON file have no effect until `SFContentBlockerManager.reloadContentBlocker(withIdentifier:)` is called from the containing app, or the user toggles the extension off and on in Settings.
- **No runtime code execution.** Unlike Safari Web Extensions, content blocker extensions cannot run JavaScript, inspect page content, or make decisions at load time. The entire blocking logic must be expressible as static JSON trigger/action pairs.
- **The extension never sees browsing data.** By design, the extension process receives zero information about which sites the user visits or which rules matched. You cannot collect analytics about blocked content.
- **url-filter uses a subset of regular expressions.** The `url-filter` field supports a limited regex syntax (no backreferences, no lookahead/lookbehind). Patterns are matched case-insensitively by default. Use `url-filter-is-case-sensitive: true` to override.
- **css-display-none only hides elements, it does not block network requests.** Using `"type": "css-display-none"` sets `display: none` on matching DOM elements but does not prevent the associated resources from loading. Combine with `block` rules for complete blocking.
- **ignore-previous-rules is order-dependent.** The `ignore-previous-rules` action type causes Safari to discard all previously matched rules for the current resource. Rule order in the JSON array matters. Place allowlist rules after block rules.
- **Large rule sets can crash on iOS 17.** Invoking `reloadContentBlocker` with very large JSON payloads (20 MB+) can cause the content blocker XPC service to crash on iOS 17. Keep individual JSON files reasonably sized and split across multiple extensions if needed.
- **User must explicitly enable the extension.** Content blockers are disabled by default. The user must go to Settings > Safari > Content Blockers (iOS) or Safari > Preferences > Extensions (macOS) to enable your blocker. Your containing app should guide the user to this setting.
- **Simulator requires toggling the extension off and on.** In the iOS Simulator, installing a new build or updating rules often does not take effect until you toggle the content blocker off and back on in Settings > Safari > Extensions. This forces Safari to reload, recompile the rules, and pick up changes. On a physical device `reloadContentBlocker` is usually sufficient, but in the Simulator the toggle is the most reliable way to force a refresh during development.
- **No effect in WKWebView.** Content blocker extensions only apply to Safari and `SFSafariViewController`. Arbitrary `WKWebView` instances in other apps are not affected, though `WKWebView` has its own `WKContentRuleListStore` API for programmatic content rules.
