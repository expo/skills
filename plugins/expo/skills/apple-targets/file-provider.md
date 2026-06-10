---
title: File Provider Extension
description: Integrates a cloud storage backend into the system Files app, enabling transparent file browsing, downloading, uploading, and syncing via NSFileProviderReplicatedExtension.
version: iOS 11.0+ (legacy), iOS 16.0+ (replicated)
---

# File Provider Extension (`file-provider`)

A File Provider extension surfaces your cloud storage service as a first-class location inside the Files app (iOS) and Finder (macOS). Users can browse, open, move, rename, and delete remote files as if they were local. The modern replicated extension model (iOS 16+/macOS 12.3+) uses `NSFileProviderReplicatedExtension` to maintain a bidirectional sync between a local replica and your remote server. The system manages the on-disk cache, evicts unused files, and calls your extension to materialize content on demand. This is one of the most complex extension types -- production implementations (Dropbox, Google Drive, OneDrive) typically require thousands of lines of sync logic, conflict resolution, and database management.

## Apple Documentation

- [File Provider Framework](https://developer.apple.com/documentation/fileprovider)
- [Replicated File Provider Extension](https://developer.apple.com/documentation/fileprovider/replicated-file-provider-extension)
- [NSFileProviderReplicatedExtension](https://developer.apple.com/documentation/fileprovider/nsfileproviderreplicatedextension)
- [NSFileProviderItem](https://developer.apple.com/documentation/fileprovider/nsfileprovideritem)
- [NSFileProviderEnumerator](https://developer.apple.com/documentation/fileprovider/nsfileproviderenumerator)
- [NSFileProviderManager](https://developer.apple.com/documentation/fileprovider/nsfileprovidermanager)
- [NSFileProviderDomain](https://developer.apple.com/documentation/fileprovider/nsfileproviderdomain)
- [item(for:request:completionHandler:)](https://developer.apple.com/documentation/fileprovider/nsfileproviderreplicatedextension/item(for:request:completionhandler:))
- [fetchContents(for:version:request:completionHandler:)](https://developer.apple.com/documentation/fileprovider/nsfileproviderreplicatedextension/3553303-fetchcontentsforitemwithidentifi)
- [createItem(basedOn:fields:contents:options:request:completionHandler:)](https://developer.apple.com/documentation/fileprovider/nsfileproviderreplicatedextension/createitem(basedon:fields:contents:options:request:completionhandler:))
- [deleteItem(identifier:baseVersion:options:request:completionHandler:)](https://developer.apple.com/documentation/fileprovider/nsfileproviderreplicatedextension/3656550-deleteitemwithidentifier)

## WWDC History

- **[WWDC 2017, Session 243 -- File Provider Enhancements](https://developer.apple.com/videos/play/wwdc2017/243/)** -- Introduced the File Provider framework alongside the Files app in iOS 11. Covered enumeration, thumbnails, and push-based change signaling.
- **[WWDC 2021, Session 10182 -- Sync Files to the Cloud with FileProvider on macOS](https://developer.apple.com/videos/play/wwdc2021/10182/)** -- Major rewrite: introduced `NSFileProviderReplicatedExtension` for macOS with bidirectional sync, icon decorations, Finder integration, and published sample code.
- **[WWDC 2022, Session 10045 -- What's New in File Provider](https://developer.apple.com/videos/play/wwdc2022/10045/)** -- Brought the replicated extension model to iOS 16. Covered progress reporting, eviction policies, and materialization.

## What It Does

1. **Domain registration.** Your main app registers an `NSFileProviderDomain` with `NSFileProviderManager.add(_:completionHandler:)`. This creates a visible location in the Files app sidebar.
2. **Enumeration.** When the user browses a folder, the system asks your extension for an `NSFileProviderEnumerator`. Your enumerator returns pages of `NSFileProviderItem` objects describing files and folders.
3. **Materialization (download).** When the user opens a file, the system calls `fetchContents(for:version:request:completionHandler:)`. Your extension downloads the file from your server and returns a local URL.
4. **Upload.** When the user creates or modifies a file, the system calls `createItem(basedOn:fields:contents:options:request:completionHandler:)` or `modifyItem(...)`. Your extension uploads the content to your server.
5. **Deletion.** The system calls `deleteItem(identifier:baseVersion:options:request:completionHandler:)` when a file is trashed or permanently removed.
6. **Change signaling.** Your app detects remote changes (via polling, push notifications, or websockets) and calls `NSFileProviderManager.signalEnumerator(for:)` to tell the system to re-enumerate and pick up new items.
7. **Eviction.** The system automatically evicts (removes local copies of) files that have not been accessed recently, keeping only metadata. Your extension re-downloads them on demand.

## Use Cases

### Cloud storage integration

Services like Dropbox, Google Drive, and OneDrive use File Provider extensions to appear as native locations in Files and Finder. Users drag and drop files, use Quick Look, and share directly from the cloud provider without opening a separate app.

### Enterprise document management

Corporate DMS platforms (SharePoint, Box) provide File Provider extensions so employees can access company documents directly from Pages, Keynote, or any document picker. IT admins benefit from the system-managed cache and on-demand downloads that minimize local storage use.

### Version-controlled repositories

A developer tool could expose a Git repository as a File Provider domain, letting users browse branches and files from Finder without cloning the entire repo locally.

### Encrypted vault access

Password-manager and encrypted-storage apps (Cryptomator, Boxcryptor) use File Provider extensions to decrypt files transparently when opened and re-encrypt on save, surfacing vaults as normal folders in Files.

## Key Classes

| Class / Protocol | Role |
|------------------|------|
| `NSFileProviderReplicatedExtension` | The main protocol you implement. Handles item metadata, downloads, uploads, deletions, and enumeration. |
| `NSFileProviderItem` | Protocol describing a single file or folder: identifier, parent, filename, content type, size, version, capabilities. |
| `NSFileProviderEnumerator` | Protocol for listing items in a container. Implements `enumerateItems(for:startingAt:)` and `enumerateChanges(for:from:)`. |
| `NSFileProviderManager` | System manager for a domain. Used to signal changes, get container URLs, add/remove domains, and evict items. |
| `NSFileProviderDomain` | Represents a distinct storage location (e.g., one per account). Registered from the main app. |
| `NSFileProviderItemIdentifier` | Opaque identifier for an item. Special values: `.rootContainer`, `.workingSet`, `.trashContainer`. |
| `NSFileProviderItemVersion` | Tracks the content version and metadata version of an item for conflict detection. |
| `NSFileProviderSyncAnchor` | Opaque token used by change enumeration to track the last known sync point. |

## Implementation

### Replicated File Provider with Remote Sync

```swift
import FileProvider
import UniformTypeIdentifiers

// 1. Implement the replicated extension protocol. The system instantiates one
//    per domain, potentially in separate processes for multi-account setups.
class FileProviderExtension: NSObject, NSFileProviderReplicatedExtension {

    let domain: NSFileProviderDomain
    let manager: NSFileProviderManager
    private let remoteClient: RemoteStorageClient

    // 2. The system passes the domain on init. Set up your database/network client here.
    required init(domain: NSFileProviderDomain) {
        self.domain = domain
        self.manager = NSFileProviderManager(for: domain)!
        self.remoteClient = RemoteStorageClient(accountID: domain.identifier.rawValue)
        super.init()
    }

    func invalidate() {
        // 3. Called before the extension process is terminated.
        //    Close database connections, cancel pending network requests.
        remoteClient.cancelAll()
    }

    // 4. Return metadata for a single item. The system calls this frequently
    //    to validate items, populate Finder columns, and resolve conflicts.
    func item(for identifier: NSFileProviderItemIdentifier,
              request: NSFileProviderRequest,
              completionHandler: @escaping (NSFileProviderItem?, Error?) -> Void) -> Progress {
        Task {
            do {
                let metadata = try await remoteClient.fetchMetadata(for: identifier.rawValue)
                completionHandler(FileProviderItem(remoteItem: metadata), nil)
            } catch {
                completionHandler(nil, error)
            }
        }
        return Progress()
    }

    // 5. Download file contents. Write the data to a temporary file and return its URL.
    func fetchContents(for itemIdentifier: NSFileProviderItemIdentifier,
                       version requestedVersion: NSFileProviderItemVersion?,
                       request: NSFileProviderRequest,
                       completionHandler: @escaping (URL?, NSFileProviderItem?, Error?) -> Void) -> Progress {
        let progress = Progress(totalUnitCount: 100)

        Task {
            do {
                let tempURL = FileManager.default.temporaryDirectory
                    .appendingPathComponent(UUID().uuidString)
                let metadata = try await remoteClient.download(
                    itemID: itemIdentifier.rawValue,
                    to: tempURL,
                    progress: progress
                )
                completionHandler(tempURL, FileProviderItem(remoteItem: metadata), nil)
            } catch {
                completionHandler(nil, nil, error)
            }
        }
        return progress
    }

    // 6. Upload a new item to the server.
    func createItem(basedOn itemTemplate: NSFileProviderItem,
                    fields: NSFileProviderItemFields,
                    contents url: URL?,
                    options: NSFileProviderCreateItemOptions = [],
                    request: NSFileProviderRequest,
                    completionHandler: @escaping (NSFileProviderItem?, NSFileProviderItemFields, Bool, Error?) -> Void) -> Progress {
        Task {
            do {
                let metadata = try await remoteClient.upload(
                    name: itemTemplate.filename,
                    parentID: itemTemplate.parentItemIdentifier.rawValue,
                    contentURL: url,
                    contentType: itemTemplate.contentType ?? .data
                )
                // 7. Return the server-created item. The third Bool indicates
                //    whether the item already existed (deduplication).
                completionHandler(FileProviderItem(remoteItem: metadata), [], false, nil)
            } catch {
                completionHandler(nil, [], false, error)
            }
        }
        return Progress()
    }

    // 8. Modify an existing item (rename, move, content change).
    func modifyItem(_ item: NSFileProviderItem,
                    baseVersion version: NSFileProviderItemVersion,
                    changedFields: NSFileProviderItemFields,
                    contents newContents: URL?,
                    options: NSFileProviderModifyItemOptions = [],
                    request: NSFileProviderRequest,
                    completionHandler: @escaping (NSFileProviderItem?, NSFileProviderItemFields, Bool, Error?) -> Void) -> Progress {
        Task {
            do {
                let metadata = try await remoteClient.modify(
                    itemID: item.itemIdentifier.rawValue,
                    fields: changedFields,
                    contentURL: newContents
                )
                completionHandler(FileProviderItem(remoteItem: metadata), [], false, nil)
            } catch {
                completionHandler(nil, [], false, error)
            }
        }
        return Progress()
    }

    // 9. Delete an item from the server.
    func deleteItem(identifier: NSFileProviderItemIdentifier,
                    baseVersion version: NSFileProviderItemVersion,
                    options: NSFileProviderDeleteItemOptions = [],
                    request: NSFileProviderRequest,
                    completionHandler: @escaping (Error?) -> Void) -> Progress {
        Task {
            do {
                try await remoteClient.delete(itemID: identifier.rawValue)
                completionHandler(nil)
            } catch {
                completionHandler(error)
            }
        }
        return Progress()
    }

    // 10. Return an enumerator for the given container (folder, root, or working set).
    func enumerator(for containerItemIdentifier: NSFileProviderItemIdentifier,
                    request: NSFileProviderRequest) throws -> NSFileProviderEnumerator {
        return FileProviderEnumerator(
            containerID: containerItemIdentifier,
            remoteClient: remoteClient
        )
    }
}
```

### Enumerator with Change Tracking

```swift
import FileProvider

// 11. The enumerator lists items in a container and reports incremental changes.
class FileProviderEnumerator: NSObject, NSFileProviderEnumerator {

    private let containerID: NSFileProviderItemIdentifier
    private let remoteClient: RemoteStorageClient

    init(containerID: NSFileProviderItemIdentifier, remoteClient: RemoteStorageClient) {
        self.containerID = containerID
        self.remoteClient = remoteClient
        super.init()
    }

    func invalidate() {}

    // 12. Full enumeration: return all items in the container, paginated.
    func enumerateItems(for observer: NSFileProviderEnumerationObserver,
                        startingAt page: NSFileProviderPage) {
        Task {
            do {
                let (items, nextPage) = try await remoteClient.listItems(
                    in: containerID.rawValue,
                    page: page
                )
                let providerItems = items.map { FileProviderItem(remoteItem: $0) }
                observer.didEnumerate(providerItems)
                observer.finishEnumerating(upTo: nextPage)
            } catch {
                observer.finishEnumeratingWithError(error)
            }
        }
    }

    // 13. Incremental change enumeration: return only items changed since the anchor.
    func enumerateChanges(for observer: NSFileProviderChangeObserver,
                          from anchor: NSFileProviderSyncAnchor) {
        Task {
            do {
                let (changed, deleted, newAnchor) = try await remoteClient.listChanges(
                    in: containerID.rawValue,
                    since: anchor
                )
                observer.didUpdate(changed.map { FileProviderItem(remoteItem: $0) })
                observer.didDeleteItems(withIdentifiers: deleted.map {
                    NSFileProviderItemIdentifier($0)
                })
                observer.finishEnumeratingChanges(upTo: newAnchor, moreComing: false)
            } catch {
                observer.finishEnumeratingWithError(error)
            }
        }
    }

    // 14. Return the current sync anchor so the system can track change state.
    func currentSyncAnchor(completionHandler: @escaping (NSFileProviderSyncAnchor?) -> Void) {
        Task {
            let anchor = try? await remoteClient.currentAnchor(for: containerID.rawValue)
            completionHandler(anchor)
        }
    }
}
```

### File Provider Item Model

```swift
import FileProvider
import UniformTypeIdentifiers

// 15. Map your remote data model to the NSFileProviderItem protocol.
class FileProviderItem: NSObject, NSFileProviderItem {

    private let remoteItem: RemoteItemMetadata

    init(remoteItem: RemoteItemMetadata) {
        self.remoteItem = remoteItem
    }

    var itemIdentifier: NSFileProviderItemIdentifier {
        NSFileProviderItemIdentifier(remoteItem.id)
    }

    var parentItemIdentifier: NSFileProviderItemIdentifier {
        NSFileProviderItemIdentifier(remoteItem.parentID)
    }

    var filename: String { remoteItem.name }

    var contentType: UTType {
        remoteItem.isFolder ? .folder : (UTType(filenameExtension: remoteItem.fileExtension) ?? .data)
    }

    var documentSize: NSNumber? {
        NSNumber(value: remoteItem.sizeBytes)
    }

    // 16. The item version is critical for conflict detection. Return separate
    //     content and metadata version hashes from your server.
    var itemVersion: NSFileProviderItemVersion {
        NSFileProviderItemVersion(
            contentVersion: remoteItem.contentHash.data(using: .utf8)!,
            metadataVersion: remoteItem.metadataHash.data(using: .utf8)!
        )
    }

    var capabilities: NSFileProviderItemCapabilities {
        [.allowsReading, .allowsWriting, .allowsRenaming,
         .allowsReparenting, .allowsTrashing, .allowsDeleting]
    }

    // 17. Return dates so Finder/Files can display them in list view.
    var creationDate: Date? { remoteItem.createdAt }
    var contentModificationDate: Date? { remoteItem.modifiedAt }
}
```

## Usage

- Create: `bun create target file-provider`
- Edit: `targets/file-provider/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| iOS | 11.0+ (legacy), 16.0+ (replicated) | Legacy `NSFileProviderExtension` API in iOS 11. Modern replicated model requires iOS 16. |
| iPadOS | 11.0+ (legacy), 16.0+ (replicated) | Same as iOS. Files app is the primary interaction surface. |
| macOS | 11.0+ (legacy), 12.3+ (replicated) | Replicated model introduced in macOS 12.3. Finder integration with icon decorations. |
| visionOS | 1.0+ | Supported. Files app available in visionOS. |
| tvOS | -- | Not supported. No Files app on tvOS. |
| watchOS | -- | Not supported. |

## Gotchas

- **Three-state reconciliation is mandatory.** You must track three independent states: the remote server, your local metadata database, and the system's on-disk replica. Conflicts arise when the user edits a file offline while another client modifies it on the server. Your extension must detect version mismatches and resolve them.
- **Each domain runs in a separate process.** If you support multiple accounts, each `NSFileProviderDomain` gets its own extension process. Your database or data store must handle concurrent access from multiple processes -- use SQLite with WAL mode or a shared App Group container with proper locking.
- **The extension has no UI.** File Provider extensions use the `com.apple.fileprovider-nonui` extension point. If you need to show authentication prompts or error dialogs, you must pair it with a File Provider UI extension (`file-provider-ui`).
- **`signalEnumerator` is your only way to push remote changes.** The system does not poll your extension. You must call `NSFileProviderManager.signalEnumerator(for:)` whenever remote changes occur. Set up push notifications, a websocket, or periodic polling in your main app or extension to detect changes.
- **Completion handlers, not async/await.** The core `NSFileProviderReplicatedExtension` protocol methods use old-style completion handlers, not Swift concurrency. You can bridge to async/await internally with `Task`, but the completion handler must be called exactly once.
- **App Group entitlement is required.** The extension and main app must share an App Group to exchange authentication tokens, database files, and configuration. The `@bacons/apple-targets` plugin configures this automatically when `appGroupsByDefault` is true.
- **50MB memory limit for extensions.** Like all app extensions, File Provider extensions run under a strict memory cap. Avoid loading entire files into memory -- stream large downloads and uploads using temporary files.
- **`NSFileProviderItemVersion` must be accurate.** If you return stale or incorrect version data, the system will skip uploading changes or will re-download unchanged files. Always derive versions from your server's actual content and metadata hashes.
- **The legacy API (`NSFileProviderExtension`) is effectively deprecated.** Apple strongly encourages migrating to `NSFileProviderReplicatedExtension`. The legacy API does not support eviction, progress reporting, or bidirectional change enumeration.
- **Debugging requires `qlmanage` or Finder/Files restarts.** Changes to your extension's enumeration logic may not appear immediately because the system caches metadata aggressively. Use `killall Finder` on macOS or restart the Files app on iOS to force re-enumeration during development.
