---
title: Share Extension
description: Presents a compose UI in the system share sheet so users can share content from any app to your app or service.
version: iOS 8.0+
---

# Share Extension (`share`)

A Share Extension adds your app to the system share sheet, allowing users to send content -- URLs, images, text, files -- directly from any app into yours. The extension runs in a separate process with tight resource constraints and communicates with its containing app through App Groups. You can either subclass `SLComposeServiceViewController` for a standard compose-style UI with a preview and text field, or provide a fully custom `UIViewController` (or SwiftUI view via `UIHostingController`) for complete control over the presentation. Content arrives via `NSExtensionContext.inputItems` as an array of `NSExtensionItem` objects, each carrying `NSItemProvider` attachments that you load asynchronously by type identifier.

## Apple Documentation

- [App Extension Programming Guide: Share](https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/Share.html)
- [SLComposeServiceViewController](https://developer.apple.com/documentation/social/slcomposeserviceviewcontroller)
- [NSExtensionContext](https://developer.apple.com/documentation/foundation/nsextensioncontext)
- [NSItemProvider](https://developer.apple.com/documentation/foundation/nsitemprovider)
- [NSExtensionItem](https://developer.apple.com/documentation/foundation/nsextensionitem)
- [NSExtensionPointIdentifier](https://developer.apple.com/documentation/bundleresources/information-property-list/nsextension/nsextensionpointidentifier)
- [App Groups Entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com_apple_security_application-groups)

## WWDC History

- **[WWDC 2014, Session 205 -- Creating Extensions for iOS and OS X, Part 1](https://developer.apple.com/videos/play/wwdc2014/205/)** -- Introduced app extensions including Share Extensions. Covered `SLComposeServiceViewController`, `NSExtensionContext`, and the share sheet lifecycle.
- **[WWDC 2014, Session 217 -- Creating Extensions for iOS and OS X, Part 2](https://developer.apple.com/videos/play/wwdc2014/217/)** -- Deep dive into data flow between host apps and extensions using `NSExtensionItem` and `NSItemProvider`. Covered returning modified data from Action Extensions (contrast with Share Extensions).
- **[WWDC 2015, Session 224 -- App Extension Best Practices](https://developer.apple.com/videos/play/wwdc2015/224/)** -- Guidance on memory management, activation rules, and sharing data between extension and containing app via App Groups.

## What It Does

1. **User taps Share.** The system presents the share sheet. If the extension's `NSExtensionActivationRule` matches the content being shared, your extension appears in the list.
2. **Extension launches in-process.** The system instantiates your principal class (typically a `SLComposeServiceViewController` subclass or a custom `UIViewController`) in a separate process.
3. **Content is delivered via `NSExtensionContext`.** The `extensionContext.inputItems` array contains `NSExtensionItem` objects. Each item's `attachments` property holds `NSItemProvider` instances representing the shared data.
4. **You load attachments asynchronously.** Call `NSItemProvider.loadItem(forTypeIdentifier:options:)` with the appropriate UTI (e.g., `public.url`, `public.image`, `public.plain-text`) to retrieve the actual data.
5. **User composes and posts.** If using `SLComposeServiceViewController`, the user sees a standard compose view with a text field and content preview. Tapping Post calls `didSelectPost()`.
6. **Extension completes the request.** Call `extensionContext?.completeRequest(returningItems:completionHandler:)` to dismiss the extension. Use `NSURLSession` with a background configuration for any uploads that might outlast the extension process.
7. **Data flows to the main app via App Groups.** Write shared data to an App Group container (`UserDefaults(suiteName:)` or a shared file) so the containing app can access it on next launch.

## Use Cases

### Social media posting
A user selects a photo in the Photos app, taps Share, and picks your social media app. The share extension shows a compose UI where they add a caption. On post, the extension writes the image and caption to the App Group container and enqueues an upload via a background URL session.

### Save to reading list
A user shares a URL from Safari to your read-later app. The extension extracts the URL via `NSItemProvider.loadItem(forTypeIdentifier: "public.url")`, stores it in a shared Core Data store or JSON file in the App Group container, and confirms the save with a brief animation.

### Send to messaging app
A user shares a document from Files to your messaging app. The extension presents a contact picker (custom UI), copies the file to the App Group container, and signals the main app to send the message on next launch or via a background task.

### Quick note capture
A user highlights text in any app and shares it to your note-taking app. The extension grabs the text via `public.plain-text`, optionally lets the user choose a notebook from a configuration item, and writes the note to shared storage.

## Key Classes

| Class / Protocol | Role |
|------------------|------|
| `SLComposeServiceViewController` | Provides a standard compose UI with text field, character count, content preview, and configuration items. Subclass and override `didSelectPost()`, `isContentValid()`, and `configurationItems()`. |
| `UIViewController` | Use a plain view controller (with `UIHostingController` for SwiftUI) for a fully custom share UI when `SLComposeServiceViewController` is too restrictive. |
| `NSExtensionContext` | The bridge between the host app and your extension. Provides `inputItems` and the `completeRequest(returningItems:completionHandler:)` method. |
| `NSExtensionItem` | Represents one item from the host app. Contains `attachments` (array of `NSItemProvider`), `attributedTitle`, and `attributedContentText`. |
| `NSItemProvider` | Wraps a single attachment. Use `hasItemConformingToTypeIdentifier(_:)` to check availability, then `loadItem(forTypeIdentifier:options:)` to retrieve the data. |
| `SLComposeSheetConfigurationItem` | A table-cell-style row at the bottom of the compose sheet for additional options (e.g., choose an account or album). Returned from `configurationItems()`. |
| `UserDefaults(suiteName:)` | Reads/writes preferences in a shared App Group container so both the extension and main app can access them. |

## Implementation

```swift
import UIKit
import Social
import SwiftUI
import UniformTypeIdentifiers

// 1. Subclass SLComposeServiceViewController for the standard compose UI.
class ShareViewController: SLComposeServiceViewController {

    private var sharedURL: URL?
    private var sharedText: String?

    // 2. Called when the compose sheet appears. Begin loading attachments here.
    override func presentationAnimationDidFinish() {
        guard let item = extensionContext?.inputItems.first as? NSExtensionItem,
              let attachments = item.attachments else { return }

        for provider in attachments {
            // 3. Check each attachment for known types and load asynchronously.
            if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] item, _ in
                    if let url = item as? URL {
                        DispatchQueue.main.async {
                            self?.sharedURL = url
                            self?.validateContent()
                        }
                    }
                }
            } else if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { [weak self] item, _ in
                    if let text = item as? String {
                        DispatchQueue.main.async {
                            self?.sharedText = text
                            self?.validateContent()
                        }
                    }
                }
            }
        }
    }

    // 4. Validate that the user has entered enough content to post.
    override func isContentValid() -> Bool {
        return !contentText.isEmpty || sharedURL != nil
    }

    // 5. Called when the user taps Post. Save data to the App Group container.
    override func didSelectPost() {
        let defaults = UserDefaults(suiteName: "group.com.example.myapp")

        var savedItems = defaults?.array(forKey: "sharedItems") as? [[String: String]] ?? []
        var entry: [String: String] = ["text": contentText]
        if let url = sharedURL { entry["url"] = url.absoluteString }
        savedItems.append(entry)
        defaults?.set(savedItems, forKey: "sharedItems")

        // 6. Complete the request to dismiss the extension.
        extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }

    // 7. Add configuration items for additional options (e.g., pick a folder).
    override func configurationItems() -> [Any]! {
        let folder = SLComposeSheetConfigurationItem()!
        folder.title = "Save to"
        folder.value = "Inbox"
        folder.tapHandler = {
            // Push a selection view controller
        }
        return [folder]
    }
}
```

## Usage

- Create: `bun create target share`
- Edit: `targets/share/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| iOS | 8.0+ | Full share sheet support. |
| iPadOS | 8.0+ | Full share sheet support. Appears in popover on iPad. |
| macOS | 10.10+ | Share menu in Finder and apps. Uses `NSViewController` instead of `UIViewController`. |
| Mac Catalyst | 13.1+ | Uses iOS extension APIs. |
| watchOS | -- | Not supported. |
| tvOS | -- | Not supported. |
| visionOS | 1.0+ | Share sheet supported. |

## Gotchas

- **120 MB memory limit.** iOS enforces a hard ~120 MB memory cap on share extensions. Exceeding it triggers an immediate `EXC_RESOURCE` crash with no warning. Avoid loading large images at full resolution; use `CGImageSourceCreateThumbnailAtIndex` to downsample, and defer heavy work until `presentationAnimationDidFinish()`.
- **`SLComposeServiceViewController` silently loads a default UI.** Even if you override the view entirely, the base class still creates its standard compose popup underneath, consuming memory. On iOS 17 this became worse as the system eagerly loads shared URL content. If you need a fully custom UI, consider subclassing `UIViewController` directly instead.
- **Handle multiple attachment types.** Users can share mixed content (e.g., text + image + URL). Always iterate over all `NSItemProvider` attachments and check `hasItemConformingToTypeIdentifier` for each type you support. Do not assume there is only one attachment.
- **`TRUEPREDICATE` will get you rejected.** The default `NSExtensionActivationRule` is `TRUEPREDICATE`, which shows the extension for all content types. Apple rejects App Store submissions that ship with this value. Replace it with specific activation rule keys or a predicate string before submitting.
- **Uploads must use background URL sessions.** The extension process can be terminated at any time after `completeRequest` returns. Use `URLSession` with a `.background` configuration so uploads continue even after the extension is dismissed.
- **App Groups are essential.** The extension runs in a separate sandboxed process. The only way to pass data to your main app is through an App Group shared container (via `UserDefaults(suiteName:)`, shared files, or Core Data with a shared container).
- **`contentText` is only available with `SLComposeServiceViewController`.** If you use a custom `UIViewController`, you must build your own text input and manage the text yourself.
- **No access to the network in some contexts.** Some MDM configurations and content types can restrict network access in extensions. Always handle network failures gracefully and consider queuing uploads for the main app to retry.
- **Keyboard appearance can be delayed.** In the compose view, the keyboard may not appear immediately. Calling `becomeFirstResponder()` in `viewDidAppear` does not always work; use `presentationAnimationDidFinish()` as the safe trigger point.
