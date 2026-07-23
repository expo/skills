# Worked Example: Full Module Migration

This walks a single small module from the 1.0 DSL through mixed mode to a fully migrated 2.0 form. Every per-member rule lives in `migration-map.md`; this shows how they compose and how mixed mode is an intermediate state, not a failure.

The module below is representative: a name, a sync function, two async functions (one that suspends, one that blocks), a settable property, a constant, an event with observing hooks, and a record.

## Starting point: 1.0 DSL

```swift
import ExpoModulesCore

@Record
struct DownloadOptions {
  var url: URL              // required
  var retries: Int = 3      // omittable, default 3
  var label: String?        // omittable and nullable
}

public final class DownloaderModule: Module {
  private var volume: Double = 1

  public func definition() -> ModuleDefinition {
    Name("Downloader")

    Events("onProgress")

    OnStartObserving {
      self.beginProgressUpdates()
    }

    OnStopObserving {
      self.stopProgressUpdates()
    }

    Constant("buildInfo") { computeBuildInfo() }

    Function("clamp") { (value: Double) -> Double in
      return min(max(value, 0), 1)
    }

    Property("volume") { self.volume }
      .set { self.volume = $0 }

    AsyncFunction("download") { (options: DownloadOptions) -> String in
      return try await self.performDownload(options)
    }

    AsyncFunction("clearCache") {
      try FileManager.default.removeItem(at: self.cacheDirectory)
    }
  }

  private func report(percent: Double) {
    sendEvent("onProgress", ["percent": percent])
  }
}
```

The observable contract to preserve:

| Member | JS name | Contract |
| --- | --- | --- |
| Module | `Downloader` | `requireNativeModule("Downloader")` |
| `clamp` | `clamp` | sync, 1 arg, returns number |
| `volume` | `volume` | read/write number |
| `buildInfo` | `buildInfo` | read-only constant |
| `download` | `download` | async, 1 record arg, returns string |
| `clearCache` | `clearCache` | async, no args, blocking work runs off the JS thread |
| `onProgress` | `onProgress` | event, payload `{ percent }` |
| observing hooks | n/a | progress updates start/stop with the listener count |
| `DownloadOptions` | n/a | `url` required; `retries` default 3; `label` nullable |

## Intermediate: mixed mode

Suppose the checked-out core supports everything used above: `@ExpoModule`, `@JS` functions/properties/constants, async `@JavaScriptActor`, `@Record`, default async `@Event`, and the module lifecycle hooks. One member is still blocked, by semantics rather than support: `clearCache` has a body that blocks and never suspends, and a 1.0 `AsyncFunction` runs it on a background queue automatically, while a 2.0 async member starts on the JS actor. Migrating it as-is would move blocking I/O onto the JS thread, so it stays in the DSL.

The record migrates first because it is a pure data type and the function that consumes it depends on it. Its shape is already correct, so migration is just verifying each field decodes: `url`, `retries`, `label` all map cleanly, so `@Record` stays as-is (it was already using the macro here).

```swift
import ExpoModulesCore

@Record
struct DownloadOptions {
  var url: URL
  var retries: Int = 3
  var label: String?
}

@ExpoModule("Downloader")
public final class DownloaderModule: Module {
  // Explicit wire name: default @Event would strip "on" and emit "progress".
  @Event("onProgress")
  var onProgress: (ProgressEvent) -> Void

  @JS("clamp")
  func clamp(value: Double) -> Double {
    return min(max(value, 0), 1)
  }

  // Stored var -> JS getter + setter, matching the 1.0 get/set pair.
  @JS
  var volume: Double = 1

  // A let is a natural constant: read-only from JS.
  @JS
  let buildInfo = computeBuildInfo()

  @JS
  func download(options: DownloadOptions) async throws -> String {
    return try await performDownload(options)
  }

  // override: the hooks are inherited from the Module base class.
  override func didStartListening(event: String) {
    beginProgressUpdates()
  }

  override func didStopListening(event: String) {
    stopProgressUpdates()
  }

  // Kept on the DSL: the body blocks without suspending, and a 2.0 async
  // member would start it on the JS actor instead of a background queue.
  public func definition() -> ModuleDefinition {
    AsyncFunction("clearCache") {
      try FileManager.default.removeItem(at: self.cacheDirectory)
    }
  }

  private func report(percent: Double) {
    onProgress(ProgressEvent(percent: percent))
  }
}

@Record
struct ProgressEvent {
  var percent: Double
}
```

Notes on the choices, each traceable to `migration-map.md`:

- `Name("Downloader")` moved into `@ExpoModule("Downloader")`; the custom name is carried explicitly, never dropped.
- `@Event("onProgress")` uses the explicit wire name to avoid the `on`-stripping default; the untyped dictionary became a typed `ProgressEvent`.
- The duplicate `private var volume` field was removed once `@JS var volume` became the single source of truth. Watch for this: a 1.0 backing field plus a migrated `@JS var` of the same name is a double-declaration.
- `Constant("buildInfo")` became `@JS let buildInfo`. Evaluation moves from the lazy 1.0 closure to module initialization, acceptable here because `computeBuildInfo()` is cheap; an expensive value would keep lazy storage behind a getter-only computed `@JS var`.
- `OnStartObserving`/`OnStopObserving` became the `didStartListening(event:)`/`didStopListening(event:)` hooks, with `override` because the class inherits `Module`. The 1.0 hooks were module-wide, so the event argument is ignored.
- `definition()` remains but now holds only the queue-sensitive `clearCache`. It is not deleted because it is non-empty.

## Fully migrated (after explicitly moving the blocking work off the JS actor)

The DSL entry for `clearCache` was the semantics-preserving default. To finish the migration, replace the implicit background queue with an explicit hop so the blocking work still never runs on the JS thread, then delete the empty `definition()`.

```swift
import ExpoModulesCore

@Record
struct DownloadOptions {
  var url: URL
  var retries: Int = 3
  var label: String?
}

@Record
struct ProgressEvent {
  var percent: Double
}

@ExpoModule("Downloader")
public final class DownloaderModule: Module {
  @Event("onProgress")
  var onProgress: (ProgressEvent) -> Void

  @JS("clamp")
  func clamp(value: Double) -> Double {
    return min(max(value, 0), 1)
  }

  @JS
  var volume: Double = 1

  @JS
  let buildInfo = computeBuildInfo()

  @JS
  func download(options: DownloadOptions) async throws -> String {
    return try await performDownload(options)
  }

  @JS
  func clearCache() async throws {
    // Explicit hop: the body blocks, so it must not run on the JS actor.
    try await Task.detached {
      try FileManager.default.removeItem(at: self.cacheDirectory)
    }.value
  }

  override func didStartListening(event: String) {
    beginProgressUpdates()
  }

  override func didStopListening(event: String) {
    stopProgressUpdates()
  }

  private func report(percent: Double) {
    onProgress(ProgressEvent(percent: percent))
  }
}
```

`definition()` is gone only because it was empty and `@ExpoModule("Downloader")` preserves the resolved name. If any member had stayed blocked or unverified, the mixed-mode form above is the correct place to stop, not a broken end state.
