---
title: Quick Look Preview Provider
description: Renders full-size previews of custom file types for Quick Look, enabling space-bar preview in Finder, share sheet previews, and in-app QLPreviewController display.
version: iOS 13.0+, macOS 10.15+
---

# Quick Look Preview Provider (`quicklook-preview`)

A Quick Look Preview extension renders full-size previews for custom file types throughout the system. On macOS, pressing the space bar on a file in Finder triggers Quick Look; on iOS, previews appear in the Files app, share sheets, drag-and-drop, and any app using `QLPreviewController`. There are two approaches: a view-controller-based preview (subclass `UIViewController` conforming to `QLPreviewingController`) for rich interactive previews, or a data-based preview (subclass `QLPreviewProvider`) for returning static content like HTML, PDF, or images. The view-controller approach is the default template and works on iOS; the data-based `QLPreviewProvider` approach was added in iOS 15/macOS 12 and is preferred for cross-platform extensions.

## Apple Documentation

- [Quick Look Framework](https://developer.apple.com/documentation/quicklook)
- [Quick Look UI Framework](https://developer.apple.com/documentation/quicklookui)
- [QLPreviewingController](https://developer.apple.com/documentation/quicklook/qlpreviewingcontroller)
- [QLPreviewProvider](https://developer.apple.com/documentation/quicklookui/qlpreviewprovider)
- [QLPreviewReply](https://developer.apple.com/documentation/quicklookui/qlpreviewreply)
- [QLFilePreviewRequest](https://developer.apple.com/documentation/quicklook/qlfilepreviewrequest)
- [QLPreviewController](https://developer.apple.com/documentation/quicklook/qlpreviewcontroller)
- [Providing Previews of Your Custom File Types](https://developer.apple.com/documentation/quicklook/providing-previews-of-your-custom-file-types)

## WWDC History

- **[WWDC 2019, Session 719 -- What's New in File Management and Quick Look](https://developer.apple.com/videos/play/wwdc2019/719/)** -- Introduced the Quick Look Preview extension point for iOS alongside the thumbnail extension. Covered view-controller-based previews using `QLPreviewingController`.
- **[WWDC 2021, Session 10012 -- What's New in Quick Look](https://developer.apple.com/videos/play/wwdc2021/10012/)** -- Introduced the data-based `QLPreviewProvider` API for cross-platform support (iOS 15+/macOS 12+). Covered `QLPreviewReply` with PDF, data, and string initializers.

## What It Does

1. **Quick Look requests a preview.** When the user presses space bar (macOS), taps a file in Files (iOS), or any app invokes `QLPreviewController`, the system checks for a registered preview extension matching the file's UTI.
2. **View-controller approach (iOS 13+).** The system instantiates your `UIViewController` subclass conforming to `QLPreviewingController` and calls `preparePreviewOfFile(at:completionHandler:)`. You populate your view hierarchy and call the completion handler.
3. **Data-based approach (iOS 15+).** The system calls your `QLPreviewProvider` subclass's `providePreview(for:_:)`. You create a `QLPreviewReply` containing the preview data (HTML, PDF, image, or drawn content) and call the completion handler.
4. **The system displays the preview.** The rendered content is shown in the Quick Look panel (macOS) or the preview controller (iOS). The user can zoom, scroll, and interact with the content.

## Use Cases

### Custom document format

A productivity app (Notion, Bear) exports files in a custom format. The preview extension parses the file and returns an HTML-based `QLPreviewReply` with styled content, so users can preview documents from Finder without opening the app.

### 3D model viewer

A 3D design tool registers custom model file UTIs. The preview extension uses SceneKit or a Metal-backed view controller to render a rotatable 3D preview of the model.

### Code and configuration files

A developer tool registers custom config formats. The preview extension renders syntax-highlighted source code as an HTML page with a monospaced font, making files readable in Quick Look.

### Scientific data visualization

A research application stores data in a custom binary format. The preview extension reads the data, generates a chart or graph using Core Graphics, and returns it as a PDF-based `QLPreviewReply`.

## Key Classes

| Class / Protocol | Role |
|------------------|------|
| `QLPreviewingController` | Protocol for view-controller-based previews. Implement `preparePreviewOfFile(at:completionHandler:)`. |
| `QLPreviewProvider` | Subclass for data-based previews (iOS 15+). Override `providePreview(for:_:)`. |
| `QLPreviewReply` | The reply object for data-based previews. Initializers for drawing, PDF, data (with content type), file URL, and string. |
| `QLFilePreviewRequest` | The request object for data-based previews. Contains `fileURL` and `contentType`. |
| `QLPreviewController` | Client-side view controller for displaying Quick Look previews. Not used in the extension itself. |
| `QLPreviewReplyAttachment` | Inline attachment (e.g., images) for HTML-based preview replies. |

## Implementation

### View-Controller-Based Preview (iOS 13+)

```swift
import UIKit
import QuickLook

// 1. Subclass UIViewController and conform to QLPreviewingController.
//    This is the approach used by the default Xcode template.
class PreviewViewController: UIViewController, QLPreviewingController {

    private let textView = UITextView()

    override func viewDidLoad() {
        super.viewDidLoad()

        // 2. Set up your preview UI. You have full UIKit available here,
        //    including scroll views, collection views, and custom drawing.
        textView.isEditable = false
        textView.font = .monospacedSystemFont(ofSize: 14, weight: .regular)
        textView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(textView)
        NSLayoutConstraint.activate([
            textView.topAnchor.constraint(equalTo: view.topAnchor),
            textView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            textView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            textView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
    }

    // 3. Called when a file needs to be previewed. Load the file and
    //    populate your UI, then call the handler to signal readiness.
    func preparePreviewOfFile(at url: URL, completionHandler handler: @escaping (Error?) -> Void) {
        do {
            let content = try String(contentsOf: url, encoding: .utf8)
            let document = try CustomDocument.parse(content)

            // 4. Render the document into attributed text with syntax highlighting.
            textView.attributedText = document.attributedRepresentation()
            handler(nil)
        } catch {
            handler(error)
        }
    }

    // 5. Optional: preview searchable items from Spotlight.
    func preparePreviewOfSearchableItem(identifier: String,
                                         queryString: String?,
                                         completionHandler handler: @escaping (Error?) -> Void) {
        // Resolve the item from your app's Spotlight index and display it.
        handler(nil)
    }
}
```

### Data-Based Preview with HTML (iOS 15+)

```swift
import QuickLook
import QuickLookUI
import UniformTypeIdentifiers

// 6. Subclass QLPreviewProvider for a data-based (non-view-controller) preview.
//    This approach works cross-platform on iOS and macOS.
class PreviewProvider: QLPreviewProvider {

    override func providePreview(for request: QLFilePreviewRequest,
                                  _ handler: @escaping (QLPreviewReply?, Error?) -> Void) {
        do {
            let content = try String(contentsOf: request.fileURL, encoding: .utf8)
            let document = try CustomDocument.parse(content)

            // 7. Generate an HTML representation of the document.
            let html = """
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { font-family: -apple-system, sans-serif; padding: 20px;
                           background: white; color: #333; }
                    h1 { color: #007AFF; }
                    pre { background: #f5f5f5; padding: 12px; border-radius: 8px;
                          font-size: 13px; overflow-x: auto; }
                    .metadata { color: #888; font-size: 12px; }
                </style>
            </head>
            <body>
                <h1>\(document.title)</h1>
                <p class="metadata">Created: \(document.createdAt) | Items: \(document.items.count)</p>
                <pre>\(document.formattedContent)</pre>
            </body>
            </html>
            """

            // 8. Create a reply with HTML content. The system renders it in a web view.
            let reply = QLPreviewReply(
                dataOfContentType: .html,
                contentSize: CGSize(width: 600, height: 800)
            ) { _ in
                return html.data(using: .utf8)!
            }

            // 9. Optionally set a title for the preview window's title bar.
            reply.title = document.title

            handler(reply, nil)
        } catch {
            handler(nil, error)
        }
    }
}
```

### PDF-Based Preview

```swift
import QuickLook
import QuickLookUI
import PDFKit

class PreviewProvider: QLPreviewProvider {

    override func providePreview(for request: QLFilePreviewRequest,
                                  _ handler: @escaping (QLPreviewReply?, Error?) -> Void) {
        do {
            let data = try Data(contentsOf: request.fileURL)
            let document = try CustomDocument(data: data)

            let pageSize = CGSize(width: 612, height: 792) // US Letter

            // 10. Create a PDF-based reply. The closure receives a CGContext
            //     configured for PDF drawing.
            let reply = QLPreviewReply(forPDFWithPageSize: pageSize) {
                (pdfContext: CGContext) -> Void in

                // 11. Begin a PDF page and draw document content.
                pdfContext.beginPDFPage(nil)

                // Draw title
                let titleAttributes: [NSAttributedString.Key: Any] = [
                    .font: UIFont.boldSystemFont(ofSize: 24),
                    .foregroundColor: UIColor.black
                ]
                let title = document.title as NSString
                title.draw(at: CGPoint(x: 36, y: pageSize.height - 60),
                          withAttributes: titleAttributes)

                // 12. Draw body content
                let bodyAttributes: [NSAttributedString.Key: Any] = [
                    .font: UIFont.systemFont(ofSize: 12),
                    .foregroundColor: UIColor.darkGray
                ]
                let body = document.bodyText as NSString
                let bodyRect = CGRect(x: 36, y: 36,
                                      width: pageSize.width - 72,
                                      height: pageSize.height - 120)
                body.draw(in: bodyRect, withAttributes: bodyAttributes)

                pdfContext.endPDFPage()
            }

            handler(reply, nil)
        } catch {
            handler(nil, error)
        }
    }
}
```

## Usage

- Create: `bun create target quicklook-preview`
- Edit: `targets/quicklook-preview/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| iOS | 13.0+ (view controller), 15.0+ (data-based) | View-controller previews via `QLPreviewingController`. Data-based via `QLPreviewProvider` requires iOS 15. |
| iPadOS | 13.0+ (view controller), 15.0+ (data-based) | Same as iOS. |
| macOS | 10.15+ (view controller), 12.0+ (data-based) | Space-bar Quick Look in Finder. Data-based previews via `QLPreviewProvider` require macOS 12. |
| visionOS | 1.0+ | Supported in the Files app. |
| tvOS | -- | Not supported. |
| watchOS | -- | Not supported. |

## Gotchas

- **You must declare supported UTIs in Info.plist.** Add your UTIs to the `QLSupportedContentTypes` array in the extension's Info.plist. Parent UTIs do not automatically match child types -- list each specific UTI you support.
- **The default template uses the view-controller approach.** The `@bacons/apple-targets` template generates a `QLPreviewingController`-based view controller. If you want the newer data-based `QLPreviewProvider` API, replace the generated files with a `QLPreviewProvider` subclass and update the Info.plist `NSExtensionPrincipalClass` accordingly.
- **`QLPreviewProvider` and `QLPreviewingController` are mutually exclusive.** An extension uses one approach or the other, not both. The choice is determined by the `NSExtensionPrincipalClass` in Info.plist.
- **HTML previews have limited JavaScript support.** When using `QLPreviewReply(dataOfContentType: .html, ...)`, the system renders the HTML in a constrained web view. Complex JavaScript, external network requests, and some CSS features may not work. Keep the HTML self-contained.
- **Preview extensions have a short timeout.** If your extension takes too long to generate a preview, the system cancels the request and shows "No Preview Available." Avoid heavy computation or network I/O. Pre-process data if possible.
- **The `ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES` build setting is required.** This extension type needs embedded Swift libraries. The `@bacons/apple-targets` plugin sets `needsEmbeddedSwift: true` automatically.
- **Test with `qlmanage -p` on macOS.** Run `qlmanage -p /path/to/your/file.custom` from Terminal to trigger a Quick Look preview and debug your extension. Use Xcode's Debug > Attach to Process to set breakpoints.
- **On macOS, reset the Quick Look cache with `qlmanage -r`.** During development, cached previews may persist even after rebuilding your extension. Run `qlmanage -r` and `qlmanage -r cache` to clear both the generator and cache databases.
- **Spotlight integration is optional but valuable.** Implementing `preparePreviewOfSearchableItem(identifier:queryString:completionHandler:)` lets your extension provide previews for Spotlight search results, not just file browsing.
- **File access is read-only.** The extension receives a URL to the file but cannot modify it. If your preview requires transforming the file (e.g., decompressing), write temporary files and clean them up in your extension's dealloc or invalidation.
