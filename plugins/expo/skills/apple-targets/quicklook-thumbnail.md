---
title: Quick Look Thumbnail Provider
description: Generates system-wide thumbnail images for custom file types, displayed in Files, Finder, Spotlight, and document pickers.
version: iOS 13.0+, macOS 10.15+
---

# Quick Look Thumbnail Provider (`quicklook-thumbnail`)

A Quick Look Thumbnail extension generates thumbnail images for custom file types so they appear with rich previews throughout the system -- in the Files app, Finder, Spotlight results, document pickers, and any app that uses `QLThumbnailGenerator`. You subclass `QLThumbnailProvider` from the QuickLookThumbnailing framework and override `provideThumbnail(for:_:)` to draw or supply an image for each request. The system provides the file URL, maximum size, and scale factor; you return a `QLThumbnailReply` containing a rendered image, a drawing block, or a file URL.

## Apple Documentation

- [QuickLookThumbnailing Framework](https://developer.apple.com/documentation/quicklookthumbnailing)
- [QLThumbnailProvider](https://developer.apple.com/documentation/quicklookthumbnailing/qlthumbnailprovider)
- [provideThumbnail(for:_:)](https://developer.apple.com/documentation/quicklookthumbnailing/qlthumbnailprovider/providethumbnail(for:_:))
- [QLFileThumbnailRequest](https://developer.apple.com/documentation/quicklookthumbnailing/qlfilethumbnailrequest)
- [QLThumbnailReply](https://developer.apple.com/documentation/quicklookthumbnailing/qlthumbnailreply)
- [QLThumbnailGenerator](https://developer.apple.com/documentation/quicklookthumbnailing/qlthumbnailgenerator)
- [Creating Quick Look Thumbnails to Preview Files in Your App](https://developer.apple.com/documentation/quicklookthumbnailing/creating-quick-look-thumbnails-to-preview-files-in-your-app)
- [Providing Thumbnails of Your Custom File Types](https://developer.apple.com/documentation/quicklookthumbnailing/providing-thumbnails-of-your-custom-file-types)

## WWDC History

- **[WWDC 2019, Session 719 -- What's New in File Management and Quick Look](https://developer.apple.com/videos/play/wwdc2019/719/)** -- Introduced the QuickLookThumbnailing framework and the `QLThumbnailProvider` extension point. Covered the three reply modes (context drawing, Core Graphics drawing, image file URL) and cross-platform support for iOS and macOS.

## What It Does

1. **The system requests a thumbnail.** When a file with your declared UTI appears in Finder, Files, Spotlight, or a `QLThumbnailGenerator` request, the system launches your extension and calls `provideThumbnail(for:_:)`.
2. **You receive a `QLFileThumbnailRequest`.** This contains the file `url`, `maximumSize` (CGSize), `minimumDimension` (CGFloat), and `scale` (CGFloat). Your thumbnail should fit within these constraints.
3. **You create a `QLThumbnailReply`.** Three options: (a) draw into the current UIKit graphics context, (b) draw into a provided `CGContext`, or (c) return a URL to a pre-rendered image file.
4. **You call the completion handler.** Pass the reply and `nil` error on success, or `nil` reply and an error on failure.
5. **The system caches the thumbnail.** Thumbnails are cached by the system. Your extension is only called when the cache is cold or the file's modification date changes.

## Use Cases

### Custom document format

A design application (Sketch, Figma) registers a custom `.sketch` or `.fig` UTI. The thumbnail extension reads the file, extracts the first artboard, and renders a scaled-down preview so users can identify documents at a glance in Finder.

### 3D model files

A CAD or 3D modeling app registers UTIs for `.obj`, `.stl`, or custom formats. The thumbnail extension renders a simple wireframe or shaded preview of the model using SceneKit or Metal offline rendering.

### Source code and data files

A developer tool registers UTIs for custom config files (`.yml`, `.toml`, custom DSLs). The thumbnail extension renders syntax-highlighted text into a small image so files are visually distinguishable in Finder.

### Game save files

A game registers a custom save-file UTI. The thumbnail extension reads the save data and renders the player's character portrait or a minimap screenshot as the file icon.

## Key Classes

| Class / Protocol | Role |
|------------------|------|
| `QLThumbnailProvider` | Abstract base class. Subclass this and override `provideThumbnail(for:_:)`. |
| `QLFileThumbnailRequest` | The request object. Properties: `fileURL`, `maximumSize`, `minimumDimension`, `scale`. |
| `QLThumbnailReply` | The reply object. Initialize with one of three modes: `currentContextDrawing`, `drawing` (CGContext), or `imageFileURL`. |
| `QLThumbnailGenerator` | Client-side class for requesting thumbnails from any app. Not used in the extension itself, but useful for testing. |
| `QLThumbnailRepresentation` | The result type from `QLThumbnailGenerator`. Contains the generated `CGImage` or `UIImage`. |

## Implementation

### Custom Document Thumbnail with Core Graphics

```swift
import UIKit
import QuickLookThumbnailing

class ThumbnailProvider: QLThumbnailProvider {

    // 1. Override this single method. The system calls it for each thumbnail request.
    override func provideThumbnail(for request: QLFileThumbnailRequest,
                                   _ handler: @escaping (QLThumbnailReply?, Error?) -> Void) {

        // 2. Read enough of the file to generate a meaningful preview.
        //    Keep this fast -- the system expects thumbnails quickly.
        guard let documentData = try? Data(contentsOf: request.fileURL),
              let document = try? CustomDocument(data: documentData) else {
            handler(nil, NSError(domain: "com.example.thumbnail",
                                 code: -1,
                                 userInfo: [NSLocalizedDescriptionKey: "Unable to read document"]))
            return
        }

        // 3. Calculate the thumbnail size respecting the aspect ratio
        //    and the maximum size from the request.
        let aspectRatio = document.canvasWidth / document.canvasHeight
        let thumbnailSize: CGSize
        if aspectRatio > 1 {
            // Landscape
            thumbnailSize = CGSize(
                width: request.maximumSize.width,
                height: request.maximumSize.width / aspectRatio
            )
        } else {
            // Portrait or square
            thumbnailSize = CGSize(
                width: request.maximumSize.height * aspectRatio,
                height: request.maximumSize.height
            )
        }

        // 4. Use the CGContext drawing mode for full control over rendering.
        let reply = QLThumbnailReply(contextSize: thumbnailSize) { context -> Bool in

            // 5. Fill a white background.
            context.setFillColor(UIColor.white.cgColor)
            context.fill(CGRect(origin: .zero, size: thumbnailSize))

            // 6. Draw document content scaled to fit the thumbnail.
            //    This is where your file-format-specific rendering happens.
            let drawRect = CGRect(origin: .zero, size: thumbnailSize)
            for element in document.elements {
                element.draw(in: context, rect: drawRect)
            }

            // 7. Draw a subtle border so the thumbnail is distinguishable
            //    against white backgrounds in Finder.
            context.setStrokeColor(UIColor.separator.cgColor)
            context.setLineWidth(1.0 / request.scale)
            context.stroke(CGRect(origin: .zero, size: thumbnailSize))

            // 8. Return true to indicate success. Returning false discards the thumbnail.
            return true
        }

        handler(reply, nil)
    }
}
```

### Image-Based Thumbnail (Embedded Preview)

For file formats that embed a preview image (like many document formats), you can extract it to a temporary file:

```swift
import UIKit
import QuickLookThumbnailing

class ThumbnailProvider: QLThumbnailProvider {

    override func provideThumbnail(for request: QLFileThumbnailRequest,
                                   _ handler: @escaping (QLThumbnailReply?, Error?) -> Void) {

        // 1. Extract the embedded preview image from the file.
        guard let previewData = extractEmbeddedPreview(from: request.fileURL) else {
            handler(nil, NSError(domain: "com.example.thumbnail", code: -1))
            return
        }

        // 2. Write the preview to a temporary file.
        let tempURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathExtension("png")

        do {
            try previewData.write(to: tempURL)
            // 3. Return the file URL directly. The system reads and scales the image.
            handler(QLThumbnailReply(imageFileURL: tempURL), nil)
        } catch {
            handler(nil, error)
        }
    }

    private func extractEmbeddedPreview(from url: URL) -> Data? {
        // Parse your file format and extract the embedded preview image bytes.
        guard let fileData = try? Data(contentsOf: url) else { return nil }
        return CustomFileFormat.extractPreviewPNG(from: fileData)
    }
}
```

### UIKit Context Drawing (Simple Text Preview)

```swift
import UIKit
import QuickLookThumbnailing

class ThumbnailProvider: QLThumbnailProvider {

    override func provideThumbnail(for request: QLFileThumbnailRequest,
                                   _ handler: @escaping (QLThumbnailReply?, Error?) -> Void) {

        // 1. Read the first few lines of a text-based custom file.
        guard let content = try? String(contentsOf: request.fileURL, encoding: .utf8) else {
            handler(nil, NSError(domain: "com.example.thumbnail", code: -1))
            return
        }

        let previewText = content.prefix(500)
        let size = request.maximumSize

        // 2. Use the currentContextDrawing mode (UIKit coordinate system).
        let reply = QLThumbnailReply(contextSize: size, currentContextDrawing: { () -> Bool in

            // 3. Fill background
            UIColor.systemBackground.setFill()
            UIRectFill(CGRect(origin: .zero, size: size))

            // 4. Draw the text with a small monospaced font.
            let attributes: [NSAttributedString.Key: Any] = [
                .font: UIFont.monospacedSystemFont(ofSize: 6 * request.scale, weight: .regular),
                .foregroundColor: UIColor.label
            ]
            let textRect = CGRect(origin: .zero, size: size).insetBy(dx: 4, dy: 4)
            (previewText as NSString).draw(in: textRect, withAttributes: attributes)

            return true
        })

        handler(reply, nil)
    }
}
```

## Usage

- Create: `bun create target quicklook-thumbnail`
- Edit: `targets/quicklook-thumbnail/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| iOS | 13.0+ | Thumbnails appear in Files, document pickers, Spotlight, and any app using `QLThumbnailGenerator`. |
| iPadOS | 13.0+ | Same as iOS. |
| macOS | 10.15+ | Thumbnails appear in Finder, Spotlight, and Open/Save panels. Replaces the legacy QLThumbnailGenerator C API. |
| visionOS | 1.0+ | Supported in the Files app. |
| tvOS | -- | Not supported. |
| watchOS | -- | Not supported. |

## Gotchas

- **You must declare supported UTIs in Info.plist.** Add your custom UTIs to the `QLSupportedContentTypes` array in the extension's Info.plist. The system will only invoke your extension for file types listed here. Parent UTIs do not match -- you must list the exact UTI.
- **Thumbnails must be generated quickly.** The system imposes a short timeout (a few seconds). If your extension takes too long, the request is cancelled and the system falls back to a generic icon. Avoid heavy computation or network requests.
- **Memory limit applies.** Like all extensions, thumbnail providers run under a strict memory cap. For large files, read only the bytes needed for a preview -- do not load the entire file into memory.
- **The `scale` property matters.** On Retina displays, `request.scale` is 2.0 or 3.0. If you use the `imageFileURL` reply mode, provide an image at the appropriate pixel dimensions (`maximumSize * scale`). The context-based modes handle scaling automatically.
- **`currentContextDrawing` uses UIKit coordinates; `drawing` uses Core Graphics coordinates.** In the UIKit mode, the origin is at the top-left. In the Core Graphics mode, the origin is at the bottom-left. Mixing up coordinate systems produces upside-down thumbnails.
- **Thumbnails are cached aggressively.** During development, the system may continue showing a stale thumbnail even after you update your extension. On macOS, use `qlmanage -r` to reset the Quick Look cache. On iOS, deleting and reinstalling the app clears the cache.
- **Test with `qlmanage -t` on macOS.** Run `qlmanage -t -s 512 /path/to/your/file.custom` from Terminal to generate a thumbnail and verify your extension works. Attach the debugger in Xcode to your extension target for breakpoints.
- **`QLThumbnailMinimumDimension` is optional but recommended.** Set this key in your extension's Info.plist to specify the smallest useful thumbnail size. The system will not request thumbnails smaller than this dimension, avoiding wasted work for tiny icon views.
