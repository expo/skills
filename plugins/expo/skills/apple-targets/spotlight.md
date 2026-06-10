---
title: Spotlight Import Extension
description: Provides Spotlight search metadata for custom file types by extracting searchable attributes when files are indexed on disk.
version: iOS 15.0+, macOS 12.0+
---

# Spotlight Import Extension (`spotlight`)

A Spotlight import extension extracts metadata from custom file types so they appear in Spotlight search results. When the system indexes a file matching your declared UTI (Uniform Type Identifier), it loads your extension and calls `update(_:forFileAt:)`, where you populate a `CSSearchableItemAttributeSet` with properties like title, content description, author, and keywords. This is the modern replacement for the legacy `mdimporter` plug-in architecture, using Core Spotlight's `CSImportExtension` base class.

## Apple Documentation

- [CSImportExtension](https://developer.apple.com/documentation/corespotlight/csimportextension)
- [CSSearchableItemAttributeSet](https://developer.apple.com/documentation/corespotlight/cssearchableitemattributeset)
- [Core Spotlight Framework Overview](https://developer.apple.com/documentation/corespotlight)
- [Spotlight Importer Programming Guide (Archive)](https://developer.apple.com/library/archive/documentation/Carbon/Conceptual/MDImporters/MDImporters.html)
- [Writing a Spotlight Importer (Archive)](https://developer.apple.com/library/archive/documentation/Carbon/Conceptual/MDImporters/Concepts/WritingAnImp.html)

## WWDC History

- **[WWDC 2015, Session 709 -- Introducing Search APIs](https://developer.apple.com/videos/play/wwdc2015/709/)** -- Introduced Core Spotlight on iOS, covering `CSSearchableItem`, `CSSearchableIndex`, and the ability to index app content for Spotlight search.
- **[WWDC 2017, Session 231 -- What's New in Core Spotlight for iOS and macOS](https://developer.apple.com/videos/play/wwdc2017/231/)** -- Extended Core Spotlight to macOS, discussed the Spotlight import extension architecture, and covered index delegates and Drag-and-Drop support.
- **[WWDC 2024, Session 10131 -- Support Semantic Search with Core Spotlight](https://developer.apple.com/videos/play/wwdc2024/10131/)** -- Added semantic search capabilities to Core Spotlight, improving relevance for text, image, and video content through related terms and synonyms.

## What It Does

1. **System detects a matching file.** When a file with your declared UTI appears on disk (created, modified, or restored from backup), the system's `mdworker` process identifies it for indexing.
2. **Extension is loaded.** The system instantiates your `CSImportExtension` subclass in a sandboxed process.
3. **`update(_:forFileAt:)` is called.** You receive a pre-allocated `CSSearchableItemAttributeSet` and the file's URL. Read the file, extract metadata, and set properties on the attribute set.
4. **Metadata enters the Spotlight index.** The system stores the attributes and associates them with the file. Spotlight queries matching your metadata will surface the file in results.
5. **User taps a result.** When the user selects the file in Spotlight, the system opens it with the registered default app.

## Use Cases

### Custom document formats
A design app saves projects as `.mydesign` files. The Spotlight import extension reads each file's header to extract the project name, canvas dimensions, color palette names, and layer count, making them searchable by project name or content keywords.

### Scientific data files
A research tool stores experiment results in a custom binary format. The importer parses the file header to extract the experiment date, researcher name, instrument type, and summary statistics, so scientists can find datasets by searching for experiment parameters.

### Configuration and recipe files
A cooking app exports recipes as `.recipe` files. The extension parses each file to extract the recipe title, ingredients list, cuisine type, and cook time, enabling Spotlight searches like "chicken tikka 30 minutes."

## Key Classes

| Class / Protocol | Role |
|------------------|------|
| `CSImportExtension` | Abstract base class you subclass. Override `update(_:forFileAt:)` to extract metadata from files. |
| `CSSearchableItemAttributeSet` | A container for metadata attributes. Set properties like `title`, `contentDescription`, `keywords`, `creator`, and `contentType`. |
| `UTType` | Uniform Type Identifier describing your custom file type. Declare in your app's Info.plist under `UTExportedTypeDeclarations`. |

## Implementation

```swift
import CoreSpotlight
import UniformTypeIdentifiers

// 1. Subclass CSImportExtension as the extension's principal class.
class ImportExtension: CSImportExtension {

    // 2. Override update(_:forFileAt:) to populate metadata for each indexed file.
    override func update(
        _ attributes: CSSearchableItemAttributeSet,
        forFileAt contentURL: URL
    ) throws {
        // 3. Read the file contents. The extension is sandboxed but has
        //    read access to the specific file URL provided.
        let data = try Data(contentsOf: contentURL)

        // 4. Parse your custom format to extract searchable metadata.
        let document = try MyDocumentParser.parse(data)

        // 5. Populate the attribute set with searchable properties.
        attributes.title = document.title
        attributes.contentDescription = document.summary
        attributes.keywords = document.tags
        attributes.creator = document.authorName
        attributes.contentCreationDate = document.createdAt
        attributes.contentModificationDate = document.modifiedAt

        // 6. Set a thumbnail if available.
        if let thumbnailData = document.thumbnail {
            attributes.thumbnailData = thumbnailData
        }

        // 7. Add domain-specific attributes for richer search results.
        attributes.numberOfPages = document.pageCount as NSNumber
        attributes.subject = document.category
    }
}
```

## Usage

- Create: `bun create target spotlight`
- Edit: `targets/spotlight/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| iOS | 15.0+ | Supported via Core Spotlight. |
| iPadOS | 15.0+ | Supported via Core Spotlight. |
| macOS | 12.0+ (declared) | Historically non-functional. First reports of working on macOS 15.5+. Legacy `mdimporter` plug-ins remain the reliable alternative on macOS. |
| watchOS | -- | Not supported. |
| tvOS | -- | Not supported. |
| visionOS | -- | Not supported. |

## Gotchas

- **macOS support has been broken for years.** Despite Apple's documentation listing macOS 12.0+ as supported, `CSImportExtension` did not function on macOS until at least macOS 15.5 (Sequoia). Apple DTS has acknowledged the issue. If you need macOS Spotlight indexing, use the legacy MDImporter/CFPlugIn architecture instead.
- **Sandbox restricts bundle access on macOS.** Even on macOS 15.5 where the extension loads, accessing files inside document bundles (packages) fails with a permission error. `NSFileWrapper(url:)` cannot read into the bundle's subdirectories. Only flat files work reliably.
- **`CSSupportedContentTypes` must match your UTI exactly.** The `CSSupportedContentTypes` array in your extension's Info.plist must contain the exact UTI string for your custom file type. If it does not match, the system will never invoke your extension for those files.
- **Declare your UTI in the main app.** The custom UTI must be declared under `UTExportedTypeDeclarations` (or `UTImportedTypeDeclarations`) in your main app's Info.plist, not just the extension's. The system discovers UTIs from the app bundle.
- **The extension is stateless.** Each invocation of `update(_:forFileAt:)` is independent. The extension may be launched and terminated for each file. Do not store data in instance variables and expect it to persist.
- **Verify with `mdimport`.** On macOS, use `mdimport -L` to list installed importers and `mdimport -d2 /path/to/file` to test your importer. On iOS, there is no equivalent diagnostic tool.
- **No network access.** The extension is sandboxed without network entitlements. All metadata must be extractable from the file itself.
