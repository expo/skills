---
title: CallKit Call Directory Extension
description: Provides caller identification labels and call-blocking entries to the native Phone app via a database of phone numbers.
version: iOS 10.0+
---

# CallKit Call Directory Extension (`call-directory`)

A Call Directory extension lets your app supply the system with a database of phone numbers to block or identify. When an incoming call arrives, iOS looks up the number against all enabled Call Directory extensions and displays your label (e.g. "Likely Spam") on the incoming call screen or silently blocks the call. The extension itself never sees live call data -- it simply pre-populates a system-managed database. Users must explicitly enable the extension in Settings > Phone > Call Blocking & Identification before it takes effect.

## Apple Documentation

- [CXCallDirectoryProvider](https://developer.apple.com/documentation/callkit/cxcalldirectoryprovider)
- [CXCallDirectoryExtensionContext](https://developer.apple.com/documentation/callkit/cxcalldirectoryextensioncontext)
- [CXCallDirectoryManager](https://developer.apple.com/documentation/callkit/cxcalldirectorymanager)
- [beginRequest(with:)](https://developer.apple.com/documentation/callkit/cxcalldirectoryprovider/1779582-beginrequest)
- [CallKit Framework Overview](https://developer.apple.com/documentation/callkit)

## WWDC History

- **[WWDC 2016, Session 230 -- Enhancing VoIP Apps with CallKit](https://developer.apple.com/videos/play/wwdc2016/230/)** -- Introduced CallKit, including the Call Directory extension for caller identification and call blocking.

## What It Does

1. **System triggers a reload.** When the user enables the extension, or your app calls `CXCallDirectoryManager.sharedInstance.reloadExtension(withIdentifier:)`, the system launches the extension in the background.
2. **Extension provides phone numbers.** Your `CXCallDirectoryProvider` subclass receives a `beginRequest(with:)` callback. You add blocking entries via `context.addBlockingEntry(withNextSequentialPhoneNumber:)` and identification entries via `context.addIdentificationEntry(withNextSequentialPhoneNumber:label:)`.
3. **Numbers must be strictly ascending.** Every phone number is an `Int64` in E.164 format (country code + number, no punctuation). Each call to `addBlockingEntry` or `addIdentificationEntry` must supply a number greater than the previous one. Violating this causes the entire load to fail silently.
4. **Database is consulted at call time.** When a call arrives from an unknown number, iOS checks the blocking database first (blocking takes priority) and then the identification database. If a match is found, the label is shown on the call screen.
5. **Incremental loading (iOS 11+).** On subsequent reloads, `context.isIncremental` may be `true`. In that case, provide only additions and removals since the last full load, dramatically reducing reload time for large databases.

## Use Cases

### Spam and robocall blocking

A crowd-sourced spam database app downloads known spam numbers from a server and loads them as blocking entries. The main app periodically triggers `reloadExtension` after syncing new data via App Groups shared storage.

### Business caller identification

An enterprise communication app labels incoming calls from known company contacts (e.g. "IT Help Desk", "HR Department") so employees can see who is calling before answering, even if the number is not in their personal contacts.

### Regional telemarketer identification

A consumer protection app provides caller ID labels for known telemarketing companies in the user's region, showing labels like "Telemarketer" or "Survey" on the incoming call screen.

## Key Classes

| Class / Protocol | Role |
|------------------|------|
| `CXCallDirectoryProvider` | Abstract base class for the extension. Subclass this and override `beginRequest(with:)`. |
| `CXCallDirectoryExtensionContext` | Passed to `beginRequest`. Use it to add blocking and identification entries, check `isIncremental`, and call `completeRequest()`. |
| `CXCallDirectoryExtensionContextDelegate` | Delegate protocol for handling errors during the request (e.g. out-of-order numbers). |
| `CXCallDirectoryManager` | Used from the main app to reload the extension, check its enabled status, and open Settings. |
| `CXCallDirectoryPhoneNumber` | Type alias for `Int64`. Represents a phone number in E.164 format. |

## Implementation

```swift
import Foundation
import CallKit

// 1. Subclass CXCallDirectoryProvider -- the system instantiates this class
//    when a reload is triggered.
class CallDirectoryHandler: CXCallDirectoryProvider {

    override func beginRequest(with context: CXCallDirectoryExtensionContext) {
        context.delegate = self

        // 2. Check whether the system is asking for a full load or an
        //    incremental update (iOS 11+).
        if context.isIncremental {
            addOrRemoveIncrementalBlockingPhoneNumbers(to: context)
            addOrRemoveIncrementalIdentificationPhoneNumbers(to: context)
        } else {
            addAllBlockingPhoneNumbers(to: context)
            addAllIdentificationPhoneNumbers(to: context)
        }

        // 3. Always call completeRequest() when finished. Failing to call
        //    this will cause the extension to be terminated.
        context.completeRequest()
    }

    private func addAllBlockingPhoneNumbers(to context: CXCallDirectoryExtensionContext) {
        // 4. Load phone numbers from your shared data store (App Group).
        //    Numbers MUST be sorted in strictly ascending order (E.164 Int64).
        let blockedNumbers: [CXCallDirectoryPhoneNumber] = [
            1_408_555_1234,
            1_800_555_5678,
            1_888_555_9012,
        ]

        // 5. For large datasets, use autoreleasepool batches to keep memory
        //    within the extension's ~6 MB limit.
        for number in blockedNumbers {
            context.addBlockingEntry(withNextSequentialPhoneNumber: number)
        }
    }

    private func addAllIdentificationPhoneNumbers(to context: CXCallDirectoryExtensionContext) {
        // 6. Identification entries associate a label with a phone number.
        //    Again, numbers must be in ascending order.
        let phoneNumbers: [CXCallDirectoryPhoneNumber] = [
            1_877_555_1111,
            1_888_555_2222,
        ]
        let labels = ["Known Telemarketer", "Local Business"]

        for (number, label) in zip(phoneNumbers, labels) {
            context.addIdentificationEntry(
                withNextSequentialPhoneNumber: number,
                label: label
            )
        }
    }

    private func addOrRemoveIncrementalBlockingPhoneNumbers(to context: CXCallDirectoryExtensionContext) {
        // 7. For incremental updates, add new entries and remove stale ones.
        //    Removals: context.removeBlockingEntry(withPhoneNumber:)
        //    Additions: context.addBlockingEntry(withNextSequentialPhoneNumber:)
        //    Track changes using a timestamp in UserDefaults (App Group).
    }

    private func addOrRemoveIncrementalIdentificationPhoneNumbers(to context: CXCallDirectoryExtensionContext) {
        // 8. Same pattern for identification entries.
        //    context.removeIdentificationEntry(withPhoneNumber:)
        //    context.addIdentificationEntry(withNextSequentialPhoneNumber:label:)
    }
}

// 9. Implement the delegate to handle errors during loading.
extension CallDirectoryHandler: CXCallDirectoryExtensionContextDelegate {
    func requestFailed(for extensionContext: CXCallDirectoryExtensionContext, withError error: Error) {
        // 10. Check CXErrorCodeCallDirectoryManagerError for specific codes:
        //     .entriesOutOfOrder, .duplicateEntries, .unexpectedIncrementalRemoval, etc.
        if let cxError = error as? CXErrorCodeCallDirectoryManagerError {
            print("Call Directory request failed: \(cxError.code)")
        }
    }
}
```

## Usage

- Create: `bun create target call-directory`
- Edit: `targets/call-directory/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| iOS | 10.0+ | Full support. Incremental loading added in iOS 11. |
| iPadOS | -- | Not applicable (no Phone app on iPad). |
| macOS | -- | Not supported. |
| watchOS | -- | Not supported. |
| visionOS | -- | Not supported. |
| tvOS | -- | Not supported. |

## Gotchas

- **Phone numbers must be in strictly ascending order.** Every call to `addBlockingEntry` or `addIdentificationEntry` must supply a number numerically greater than the previous one. Out-of-order entries cause the entire reload to fail with `CXErrorCodeCallDirectoryManagerError.entriesOutOfOrder`, and no error UI is shown to the user.
- **Extension memory limit is approximately 6 MB.** For large databases (hundreds of thousands of numbers), load entries in batches wrapped in `autoreleasepool` blocks. Memory-mapped files are recommended over loading everything into an array.
- **User must manually enable the extension.** Installing the app does not activate the Call Directory extension. The user must go to Settings > Phone > Call Blocking & Identification and toggle your extension on. Use `CXCallDirectoryManager.sharedInstance.getEnabledStatusForExtension` to check and prompt the user.
- **Contacts always take priority over your labels.** If the incoming number matches a contact in the user's address book, the contact name is displayed instead of your identification label. Your blocking entries still apply even if the number is in contacts.
- **Killing the app during reload can cause a stuck state.** If the containing app is terminated while the extension is reloading, the extension can get stuck in a perpetual "loading" state. Subsequent calls to `reloadExtension` return `CXErrorCodeCallDirectoryManagerError.currentlyLoading`. The only recovery is waiting or, in severe cases, the user resetting all settings.
- **Incremental removal requires `isIncremental` check.** Calling `removeBlockingEntry(withPhoneNumber:)` or `removeIdentificationEntry(withPhoneNumber:)` when `context.isIncremental` is `false` causes an `unexpectedIncrementalRemoval` error. Always check the flag before removing entries.
- **App Group is required for data sharing.** The extension runs in a separate process and cannot access the main app's sandbox. Use an App Group container (`UserDefaults(suiteName:)` or shared file container) to pass phone number data from the app to the extension.
- **No real-time call interception.** The extension never receives the actual incoming phone number at call time. It pre-populates a database that the system consults. You cannot implement dynamic, per-call logic.
