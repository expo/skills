---
title: Background Asset Download Extension
description: Schedules large asset downloads that run in the background, including immediately after App Store install before the user first launches the app.
version: iOS 16.1+, macOS 13.0+
---

# Background Asset Download Extension (`bg-download`)

A background asset download extension lets your app schedule large file downloads that execute outside the app's lifecycle -- during installation, after updates, or periodically in the background. The system invokes your extension to determine what needs downloading, then manages the transfers automatically. Starting with iOS 16.4, downloads marked as "essential" block the app's first launch until they complete, integrating into the App Store installation progress bar. The extension communicates with the main app through App Groups shared storage.

## Apple Documentation

- [BackgroundAssets Framework Overview](https://developer.apple.com/documentation/backgroundassets)
- [BADownloaderExtension Protocol](https://developer.apple.com/documentation/backgroundassets/badownloaderextension-qwaw)
- [Downloading Essential Assets in the Background](https://developer.apple.com/documentation/backgroundassets/downloading-essential-assets-in-the-background)
- [BADownloadManager](https://developer.apple.com/documentation/backgroundassets/badownloadmanager)
- [BAURLDownload](https://developer.apple.com/documentation/backgroundassets/baurldownload)
- [BAContentRequest](https://developer.apple.com/documentation/backgroundassets/bacontentrequest)

## WWDC History

- **[WWDC 2022, Session 110403 -- Meet Background Assets](https://developer.apple.com/videos/play/wwdc2022/110403/)** -- Introduced the BackgroundAssets framework for scheduling large downloads outside the app lifecycle, covering the extension architecture, BADownloadManager, essential vs. non-essential downloads, and App Group requirements.
- **[WWDC 2023, Session 10108 -- What's New in Background Assets](https://developer.apple.com/videos/play/wwdc2023/10108/)** -- Added essential downloads that block app launch during installation, manifest URL pre-fetching, and improved extension lifecycle management.
- **[WWDC 2025, Session 325 -- Discover Apple-Hosted Background Assets](https://developer.apple.com/videos/play/wwdc2025/325/)** -- Introduced managed background assets with Apple-hosted CDN support, automatic compression, and versioning via App Store Connect.

## What It Does

1. **System triggers the extension.** After an app install, update, or on a periodic schedule, the system launches your extension and calls `downloads(for:manifestURL:extensionInfo:)`.
2. **Extension reads the manifest.** The system pre-downloads a manifest file (specified by `BAManifestURL` in your app's Info.plist) and passes its local path to the extension. Your code parses it to determine which assets are needed.
3. **Extension returns download descriptors.** You create `BAURLDownload` objects specifying the URL, file size, whether the download is essential, and the App Group identifier for storage. Return them as a `Set<BADownload>`.
4. **System manages transfers.** The framework downloads files in the background, handling retries, cellular vs. Wi-Fi policies, and power management.
5. **Extension receives completion callbacks.** When a download finishes, `backgroundDownload(_:finishedWithFileURL:)` is called. Move the file to a permanent location in the App Group container. On failure, `backgroundDownload(_:failedWithError:)` fires.
6. **Main app reads downloaded assets.** On launch, the app checks the shared App Group container for downloaded files and uses them directly.

## Use Cases

### Games with large asset packs
A mobile game ships a small binary through the App Store and uses essential background downloads to fetch texture packs, level data, and audio assets during installation. The player sees a single progress bar and can start playing immediately after install completes.

### Machine learning model delivery
An ML-powered app downloads updated CoreML models periodically in the background. When the extension fires on a periodic schedule, it checks the manifest for newer model versions and schedules non-essential downloads that complete while the device is idle.

### Media and podcast pre-caching
A streaming app schedules background downloads of new episodes or content catalogs. The extension checks the manifest during periodic runs and queues downloads for content the user is likely to want, reducing wait times on next launch.

### Map and navigation data
A navigation app downloads regional map tiles and routing databases as essential assets during install, ensuring the app is functional for offline use from the very first launch.

## Key Classes

| Class / Protocol | Role |
|------------------|------|
| `BADownloaderExtension` | Protocol your extension struct conforms to. Defines entry points for download scheduling and completion. |
| `BAContentRequest` | Enum indicating why the extension was invoked: `.install`, `.update`, or `.periodic`. |
| `BAAppExtensionInfo` | Metadata about the app including `applicationIdentifier`, `lastPeriodicCheckTime`, and `downloadSizeRestricted`. |
| `BAURLDownload` | A download descriptor specifying URL, file size, essential flag, App Group ID, and priority. |
| `BADownload` | Base class for download objects. `BAURLDownload` is the concrete subclass for URL-based downloads. |
| `BADownloadManager` | Singleton used by the main app (or extension) to schedule, cancel, and promote downloads. Foreground promotion is app-only. |

## Implementation

```swift
import BackgroundAssets

// 1. Declare the extension entry point with @main.
@main
struct DownloadHandler: BADownloaderExtension {

    // 2. System calls this to ask what downloads are needed.
    func downloads(
        for request: BAContentRequest,
        manifestURL: URL,
        extensionInfo: BAAppExtensionInfo
    ) -> Set<BADownload> {
        let appGroup = "group.com.example.myapp"

        // 3. Parse the pre-downloaded manifest to determine available assets.
        guard let manifestData = try? Data(contentsOf: manifestURL),
              let manifest = try? JSONDecoder().decode(AssetManifest.self, from: manifestData)
        else {
            return []
        }

        // 4. Compare manifest against already-downloaded files in the App Group.
        let downloaded = AlreadyDownloaded.load(appGroup: appGroup)
        let needed = manifest.assets.filter { !downloaded.contains($0.identifier) }

        var downloads: Set<BADownload> = []
        for asset in needed {
            let isEssential = (request == .install || request == .update) && asset.required
            // 5. Create BAURLDownload for each needed asset.
            let download = BAURLDownload(
                identifier: asset.identifier,
                request: URLRequest(url: asset.url),
                essential: isEssential,
                fileSize: asset.fileSize,
                applicationGroupIdentifier: appGroup,
                priority: isEssential ? .max : .default
            )
            downloads.insert(download)
        }
        return downloads
    }

    // 6. Called when a download completes successfully.
    func backgroundDownload(
        _ finishedDownload: BADownload,
        finishedWithFileURL fileURL: URL
    ) {
        // Move the file to Library/Caches in the App Group container
        // so the system can reclaim space if storage is critically low.
        guard let container = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: "group.com.example.myapp"
        ) else { return }

        let destination = container
            .appendingPathComponent("Library/Caches", isDirectory: true)
            .appendingPathComponent(finishedDownload.identifier)

        try? FileManager.default.createDirectory(
            at: destination.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try? FileManager.default.moveItem(at: fileURL, to: destination)
    }

    // 7. Called when a download fails. Optionally reschedule.
    func backgroundDownload(
        _ failedDownload: BADownload,
        failedWithError error: Error
    ) {
        // Log the failure. The system may retry automatically depending
        // on the error type. You can also reschedule via BADownloadManager.
    }

    // 8. Called shortly before the extension is terminated.
    func extensionWillTerminate() {
        // Serialize any in-memory state to disk immediately.
    }
}
```

## Usage

- Create: `bun create target bg-download`
- Edit: `targets/bg-download/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| iOS | 16.1+ | Full support. Essential downloads added in 16.4. |
| iPadOS | 16.1+ | Full support. Essential downloads added in 16.4. |
| macOS | 13.0+ (Ventura) | Extension runs even when the app is terminated. |
| watchOS | -- | Not supported. |
| tvOS | -- | Not supported (managed assets coming in tvOS 26). |
| visionOS | -- | Not supported (managed assets coming in visionOS 26). |

## Gotchas

- **App Groups are mandatory.** The extension runs in a separate process from your app. All downloaded files must be stored in a shared App Group container. Without a correctly configured App Group, the extension cannot write files the app can read.
- **Downloaded files are marked purgeable.** The system may delete files downloaded by the framework when the device is critically low on storage. Store files in `Library/Caches` and always verify their existence before use.
- **Low Power Mode and Background App Refresh disable the extension.** If the user has enabled Low Power Mode or disabled Background App Refresh (globally or per-app), the extension will never run for periodic requests. Essential downloads during install/update are not affected.
- **On iOS, the user must not have force-quit the app.** If the user swipes the app away from the app switcher, the extension will not receive periodic runtime. On macOS, the extension runs regardless of app termination state.
- **Extension runtime is strictly limited.** The system measures runtime from when a function is invoked to when it returns. Once your function exits scope, the extension may be suspended and terminated immediately. Do not rely on instance variables persisting between calls.
- **Essential downloads block app launch.** If a download marked `essential: true` fails or takes too long, the user cannot launch your app until the system times out. Keep essential downloads small and ensure your CDN is reliable.
- **The `BAManifestURL` Info.plist key is required.** The system downloads this URL before invoking your extension. If the key is missing or the URL is unreachable, the `manifestURL` parameter will point to an empty or missing file.
- **`BADownloadManager.delegate` in the app overrides the extension.** If your main app registers a delegate on `BADownloadManager`, the app receives download callbacks instead of the extension while the app is running. Design your code to handle both paths.
