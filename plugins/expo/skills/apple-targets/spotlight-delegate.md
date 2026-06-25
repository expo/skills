---
title: CoreSpotlight Delegate Extension
description: Allows the system to request re-indexing of your app's searchable content even when the app is not running, ensuring Spotlight results stay fresh after backups, restores, and index resets.
version: iOS 9.0+, macOS 10.13+
---

# CoreSpotlight Delegate Extension (`spotlight-delegate`)

A CoreSpotlight delegate extension runs when the system needs your app to re-index its searchable content -- after a device restore from backup, when indexed items are about to expire, or when the on-device Spotlight index is rebuilt. The extension subclasses `CSIndexExtensionRequestHandler` (which conforms to `CSSearchableIndexDelegate`) and overrides two methods: one for full re-indexing and one for re-indexing specific items by identifier. This ensures your app's Spotlight content remains current without requiring the user to open the app.

## Apple Documentation

- [CSSearchableIndexDelegate](https://developer.apple.com/documentation/corespotlight/cssearchableindexdelegate)
- [CSIndexExtensionRequestHandler](https://developer.apple.com/documentation/corespotlight/csindexextensionrequesthandler)
- [CSSearchableIndex](https://developer.apple.com/documentation/corespotlight/cssearchableindex)
- [CSSearchableItem](https://developer.apple.com/documentation/corespotlight/cssearchableitem)
- [CSSearchableItemAttributeSet](https://developer.apple.com/documentation/corespotlight/cssearchableitemattributeset)
- [Core Spotlight Framework Overview](https://developer.apple.com/documentation/corespotlight)

## WWDC History

- **[WWDC 2015, Session 709 -- Introducing Search APIs](https://developer.apple.com/videos/play/wwdc2015/709/)** -- Introduced Core Spotlight on iOS, covering `CSSearchableItem`, `CSSearchableIndex`, and the fundamentals of indexing app content for Spotlight.
- **[WWDC 2016, Session 223 -- Making the Most of Search APIs](https://developer.apple.com/videos/play/wwdc2016/223/)** -- Introduced `CSSearchableIndexDelegate` and the Core Spotlight extension for maintaining indexed content when the app is not running, including disaster recovery and re-indexing flows.
- **[WWDC 2017, Session 231 -- What's New in Core Spotlight for iOS and macOS](https://developer.apple.com/videos/play/wwdc2017/231/)** -- Extended Core Spotlight to macOS, added Drag-and-Drop support through the extension, and emphasized the importance of the delegate for keeping content fresh.
- **[WWDC 2024, Session 10131 -- Support Semantic Search with Core Spotlight](https://developer.apple.com/videos/play/wwdc2024/10131/)** -- Added semantic search capabilities to Core Spotlight, improving result relevance through contextual understanding of indexed content.

## What It Does

1. **System detects stale or missing index data.** This happens after a device restore from backup, when a Spotlight index rebuild occurs, or when previously indexed items are about to expire.
2. **Extension is launched.** The system instantiates your `CSIndexExtensionRequestHandler` subclass even if the app is not running.
3. **Full re-index requested.** The system calls `searchableIndex(_:reindexAllSearchableItemsWithAcknowledgementHandler:)` when the entire index needs rebuilding. Your extension fetches all indexable content and writes it to the provided `CSSearchableIndex`.
4. **Partial re-index requested.** The system calls `searchableIndex(_:reindexSearchableItemsWithIdentifiers:acknowledgementHandler:)` with specific item IDs when only certain items need refreshing (e.g., items about to expire or items that failed to index previously).
5. **Extension acknowledges completion.** After indexing, you call the `acknowledgementHandler()`. This tells the system the re-index is complete. If the extension crashes before acknowledging, the system will retry.
6. **User searches Spotlight.** Indexed items appear in Spotlight results. Tapping a result opens your app via `NSUserActivity` with the `CSSearchableItemActionType` activity type and the item's identifier in `userInfo`.

## Use Cases

### Notes and document apps
A note-taking app indexes thousands of notes for Spotlight search. When the user restores from an iCloud backup on a new device, the extension re-indexes all notes from the local database so they immediately appear in Spotlight, without waiting for the user to open the app.

### Recipe and reference apps
A recipe app indexes its full catalog with titles, ingredients, and cuisine tags. The extension ensures that after an iOS update or index reset, all recipes are re-indexed. Partial re-indexing handles individual recipe updates that were missed while the app was suspended.

### E-commerce and catalog apps
A shopping app indexes product listings for Spotlight. The extension handles periodic re-indexing to refresh prices and availability, and re-indexes specific product IDs when the system reports them as stale.

### Communication apps
A messaging app indexes conversation titles and recent messages. The extension re-indexes conversation metadata after a device restore, and the Drag-and-Drop support (WWDC 2017) allows users to drag conversation items from Spotlight into other apps.

## Key Classes

| Class / Protocol | Role |
|------------------|------|
| `CSIndexExtensionRequestHandler` | Base class for the extension. Conforms to `CSSearchableIndexDelegate` and `NSExtensionRequestHandling`. Subclass this and override the two re-index methods. |
| `CSSearchableIndexDelegate` | Protocol defining `reindexAllSearchableItems` and `reindexSearchableItemsWithIdentifiers` callbacks. |
| `CSSearchableIndex` | The on-device search index. Call `indexSearchableItems(_:completionHandler:)` on it to add or update items. |
| `CSSearchableItem` | Wraps a `CSSearchableItemAttributeSet` with a unique identifier and optional domain identifier for batch deletion. |
| `CSSearchableItemAttributeSet` | Metadata container with properties like `title`, `contentDescription`, `thumbnailData`, and `keywords`. |

## Implementation

```swift
import CoreSpotlight

// 1. Subclass CSIndexExtensionRequestHandler as the extension's principal class.
class IndexRequestHandler: CSIndexExtensionRequestHandler {

    // 2. Called when the system needs a complete re-index of all content.
    override func searchableIndex(
        _ searchableIndex: CSSearchableIndex,
        reindexAllSearchableItemsWithAcknowledgementHandler acknowledgementHandler: @escaping () -> Void
    ) {
        // 3. Fetch all indexable content from your data store.
        //    Use App Groups if your database is shared with the main app.
        let allItems = DataStore.shared.fetchAllItems()

        // 4. Convert each item into a CSSearchableItem.
        let searchableItems = allItems.map { item -> CSSearchableItem in
            let attributes = CSSearchableItemAttributeSet(contentType: .text)
            attributes.title = item.title
            attributes.contentDescription = item.body
            attributes.keywords = item.tags
            attributes.thumbnailData = item.thumbnailData
            attributes.contentCreationDate = item.createdAt

            return CSSearchableItem(
                uniqueIdentifier: item.id,
                domainIdentifier: "com.example.myapp.items",
                attributeSet: attributes
            )
        }

        // 5. Index all items, then acknowledge so the system knows we finished.
        searchableIndex.indexSearchableItems(searchableItems) { error in
            if let error {
                print("Re-index all failed: \(error)")
            }
            // 6. Always call the handler, even on error, so the system
            //    does not keep retrying indefinitely.
            acknowledgementHandler()
        }
    }

    // 7. Called when specific items need re-indexing (e.g., about to expire).
    override func searchableIndex(
        _ searchableIndex: CSSearchableIndex,
        reindexSearchableItemsWithIdentifiers identifiers: [String],
        acknowledgementHandler: @escaping () -> Void
    ) {
        // 8. Fetch only the items matching the given identifiers.
        let items = DataStore.shared.fetchItems(withIDs: identifiers)

        let searchableItems = items.map { item -> CSSearchableItem in
            let attributes = CSSearchableItemAttributeSet(contentType: .text)
            attributes.title = item.title
            attributes.contentDescription = item.body
            attributes.keywords = item.tags
            attributes.thumbnailData = item.thumbnailData
            attributes.contentCreationDate = item.createdAt

            return CSSearchableItem(
                uniqueIdentifier: item.id,
                domainIdentifier: "com.example.myapp.items",
                attributeSet: attributes
            )
        }

        // 9. Index the specific items and acknowledge completion.
        searchableIndex.indexSearchableItems(searchableItems) { error in
            if let error {
                print("Re-index items failed: \(error)")
            }
            acknowledgementHandler()
        }
    }
}
```

## Usage

- Create: `bun create target spotlight-delegate`
- Edit: `targets/spotlight-delegate/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| iOS | 9.0+ | Full support. The extension and in-app delegate share the same protocol. |
| iPadOS | 9.0+ | Full support. |
| macOS | 10.13+ (High Sierra) | Full support. Extension runs even when the app is not running. |
| watchOS | -- | Not supported. |
| tvOS | -- | Not supported. |
| visionOS | -- | Not supported. |

## Gotchas

- **Always call the acknowledgement handler.** If your extension crashes or returns without calling `acknowledgementHandler()`, the system will retry the re-index request. Call the handler even if indexing partially fails, or you risk an infinite retry loop consuming resources.
- **Share code between the app and extension.** The `CSSearchableIndexDelegate` protocol is the same whether implemented in your app's `AppDelegate` or in the extension. Factor your indexing logic into a shared framework so both targets use the same code. The extension handles re-indexing when the app is not running; the in-app delegate handles it while the app is active.
- **Use `fetchLastClientState` to resume interrupted work.** Call `searchableIndex.fetchLastClientState(completionHandler:)` to retrieve a `Data` blob you previously stored with `searchableIndex.updateClientState(_:completionHandler:)`. Use this to track your indexing progress and resume where you left off if the extension was terminated mid-operation.
- **Item expiration triggers partial re-indexing.** `CSSearchableItem` has an `expirationDate` property (defaults to 30 days). Before items expire, the system calls `reindexSearchableItemsWithIdentifiers` to give you a chance to refresh them. Set a reasonable expiration or use `.distantFuture` for content that does not change.
- **Extension is required for Drag-and-Drop from Spotlight.** On iOS 11+ and macOS, if a user long-presses a Spotlight result to initiate drag, the system calls your extension to provide the item data. Without the extension, Spotlight results from your app cannot participate in Drag-and-Drop.
- **The extension has limited runtime.** Keep indexing operations fast. If you have thousands of items, index them in batches and persist progress to disk so you can resume if the extension is terminated. Avoid blocking network calls in the extension.
- **Domain identifiers enable batch deletion.** Assign a `domainIdentifier` to related items (e.g., `"com.example.recipes"`). You can then call `CSSearchableIndex.deleteSearchableItems(withDomainIdentifiers:)` to remove an entire category at once, which is much faster than deleting by individual ID.
