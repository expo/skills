---
title: File Provider UI Extension
description: Presents custom user interface for file provider actions and authentication errors within the Files app.
version: iOS 11.0+
---

# File Provider UI Extension (`file-provider-ui`)

A File Provider UI extension displays custom view controllers inside the Files app when a user triggers a provider-specific action or when the file provider reports an authentication error. It is a companion to the File Provider extension (`file-provider`), which handles file operations but has no UI. The UI extension subclasses `FPUIActionExtensionViewController` from the FileProviderUI framework, and the system presents it modally. Typical uses include sign-in flows, two-factor authentication prompts, server-specific sharing dialogs, and conflict resolution interfaces.

## Apple Documentation

- [FileProviderUI Framework](https://developer.apple.com/documentation/fileproviderui)
- [FPUIActionExtensionViewController](https://developer.apple.com/documentation/fileproviderui/fpuiactionextensionviewcontroller)
- [FPUIActionExtensionContext](https://developer.apple.com/documentation/fileproviderui/fpuiactionextensioncontext)
- [FPUIExtensionErrorCode](https://developer.apple.com/documentation/fileproviderui/fpuiextensionerrorcode)
- [NSFileProviderItem](https://developer.apple.com/documentation/fileprovider/nsfileprovideritem)

## WWDC History

- **[WWDC 2017, Session 243 -- File Provider Enhancements](https://developer.apple.com/videos/play/wwdc2017/243/)** -- Introduced the File Provider UI extension alongside the non-UI file provider. Covered how to declare custom actions in Info.plist and present authentication flows.
- **[WWDC 2021, Session 10182 -- Sync Files to the Cloud with FileProvider on macOS](https://developer.apple.com/videos/play/wwdc2021/10182/)** -- Updated guidance on pairing the UI extension with the replicated file provider model for authentication and error handling.

## What It Does

1. **Custom actions.** You declare named actions in your file provider's Info.plist under `NSExtensionFileProviderActions`. Each action has an identifier and a localized title. When the user selects items and picks your action from the context menu, the system launches your UI extension and calls `prepare(forAction:itemIdentifiers:)`.
2. **Authentication errors.** When your file provider extension throws an `NSFileProviderError` with code `.notAuthenticated`, the Files app shows a system "Sign In" button. Tapping it launches your UI extension and calls `prepare(forError:)`, giving you the opportunity to present a login screen.
3. **Completion.** When the user finishes the action (or cancels), you call `extensionContext.completeRequest()` or `extensionContext.cancelRequest(withError:)`. The system dismisses the view controller and, if needed, re-enumerates the affected items.

## Use Cases

### Sign-in and re-authentication

When a user's OAuth token expires, the file provider throws `.notAuthenticated`. The Files app presents a sign-in prompt, and your UI extension shows a web view or native login form. On success, you store the new token in the shared App Group keychain and call `completeRequest()`.

### Two-factor authentication

Some enterprise storage requires a second factor when accessing sensitive folders. The file provider throws a custom authentication error, and the UI extension presents a code-entry screen. Once verified, it writes the session to shared storage and completes.

### Server-specific sharing

A cloud provider offers advanced sharing options (password-protected links, expiration dates, permissions). The UI extension presents a sharing configuration sheet when the user invokes the custom "Share Link" action on selected files.

### Conflict resolution

When the file provider detects a version conflict during sync, the UI extension can present a side-by-side diff or a "keep local / keep remote / keep both" dialog, then signal which resolution path to take.

## Key Classes

| Class / Protocol | Role |
|------------------|------|
| `FPUIActionExtensionViewController` | Subclass this. Your principal class for the extension. Receives action and error preparation callbacks. |
| `FPUIActionExtensionContext` | The extension context. Call `completeRequest()` to finish or `cancelRequest(withError:)` to abort. Accessed via `extensionContext`. |
| `FPUIExtensionErrorCode` | Error codes for cancellation (`.userCancelled`) and failure (`.failed`). |
| `NSFileProviderItemIdentifier` | Identifiers of the items the user selected when invoking the action. Passed to `prepare(forAction:itemIdentifiers:)`. |

## Implementation

### Authentication and Custom Action Handler

```swift
import UIKit
import FileProviderUI
import FileProvider

// 1. Subclass FPUIActionExtensionViewController. This is the principal class
//    declared in your extension's Info.plist.
class FileProviderUIController: FPUIActionExtensionViewController {

    private var currentAction: String?
    private var selectedItems: [NSFileProviderItemIdentifier] = []

    // 2. Called when the user triggers a custom action declared in Info.plist.
    //    The actionIdentifier matches your NSExtensionFileProviderActions entry.
    override func prepare(forAction actionIdentifier: String,
                          itemIdentifiers: [NSFileProviderItemIdentifier]) {
        currentAction = actionIdentifier
        selectedItems = itemIdentifiers

        switch actionIdentifier {
        case "com.example.myapp.share-link":
            // 3. Present a sharing configuration UI for the selected items.
            let shareVC = ShareLinkViewController(itemIdentifiers: itemIdentifiers)
            shareVC.onComplete = { [weak self] in
                self?.extensionContext.completeRequest()
            }
            addChild(shareVC)
            view.addSubview(shareVC.view)
            shareVC.view.frame = view.bounds
            shareVC.didMove(toParent: self)

        case "com.example.myapp.move-to-team":
            // 4. Handle a "Move to Team Folder" action.
            let moveVC = MoveToTeamViewController(itemIdentifiers: itemIdentifiers)
            moveVC.onComplete = { [weak self] in
                self?.extensionContext.completeRequest()
            }
            moveVC.onCancel = { [weak self] in
                self?.cancelWithUserCancelled()
            }
            present(moveVC, animated: true)

        default:
            // 5. Unknown action -- cancel gracefully.
            cancelWithUserCancelled()
        }
    }

    // 6. Called when the file provider throws a .notAuthenticated error.
    //    Present your sign-in flow here.
    override func prepare(forError error: Error) {
        let loginVC = LoginViewController()
        loginVC.onAuthenticated = { [weak self] token in
            // 7. Store the new token in the shared App Group keychain
            //    so the file provider extension can read it.
            SharedKeychain.store(token: token)
            self?.extensionContext.completeRequest()
        }
        loginVC.onCancel = { [weak self] in
            self?.cancelWithUserCancelled()
        }
        present(loginVC, animated: true)
    }

    // 8. Helper to cancel with the standard user-cancelled error code.
    private func cancelWithUserCancelled() {
        extensionContext.cancelRequest(
            withError: NSError(
                domain: FPUIErrorDomain,
                code: Int(FPUIExtensionErrorCode.userCancelled.rawValue)
            )
        )
    }

    // 9. Wire up navigation bar buttons for simple cases.
    @IBAction func doneButtonTapped(_ sender: Any) {
        extensionContext.completeRequest()
    }

    @IBAction func cancelButtonTapped(_ sender: Any) {
        cancelWithUserCancelled()
    }
}
```

### Info.plist Action Declaration

Custom actions must be declared in the **file provider extension's** (not the UI extension's) Info.plist. The system reads these to build context menu entries:

```xml
<!-- Inside the file provider extension's Info.plist -->
<key>NSExtension</key>
<dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.fileprovider-nonui</string>
    <key>NSExtensionFileProviderActions</key>
    <array>
        <dict>
            <!-- 10. Each action needs an identifier, title, and the
                 bundle ID of the UI extension that handles it. -->
            <key>NSExtensionFileProviderActionIdentifier</key>
            <string>com.example.myapp.share-link</string>
            <key>NSExtensionFileProviderActionName</key>
            <string>Create Share Link</string>
            <key>NSExtensionFileProviderActionActivationRule</key>
            <string>TRUEPREDICATE</string>
        </dict>
    </array>
</dict>
```

## Usage

- Create: `bun create target file-provider-ui`
- Edit: `targets/file-provider-ui/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| iOS | 11.0+ | Presented modally inside the Files app. |
| iPadOS | 11.0+ | Full support. Displayed as a sheet in the Files app. |
| macOS | 11.0+ | Presented as a sheet in Finder when a File Provider action is invoked. |
| visionOS | 1.0+ | Supported alongside the Files app. |
| tvOS | -- | Not supported. No Files app on tvOS. |
| watchOS | -- | Not supported. |

## Gotchas

- **This extension only provides UI -- it cannot perform file operations.** All file manipulation (download, upload, delete) must happen in the companion `file-provider` extension. The UI extension's sole job is to collect user input and communicate it back via shared storage (App Group UserDefaults, keychain, or a database).
- **Actions are declared in the file provider's Info.plist, not the UI extension's.** A common mistake is adding `NSExtensionFileProviderActions` to the wrong target. The system reads action declarations from the non-UI file provider extension and routes them to the UI extension by convention (same app bundle).
- **`prepare(forError:)` is only called for `.notAuthenticated` errors.** Other file provider errors are handled by the system's default UI. You cannot present custom UI for arbitrary errors -- only authentication failures trigger the UI extension.
- **The extension context must be completed or cancelled.** If you forget to call `completeRequest()` or `cancelRequest(withError:)`, the extension hangs indefinitely and the Files app becomes unresponsive for that provider. Always call one of these in every code path, including error handlers.
- **No access to the file provider's database directly.** The UI extension runs in a separate process. Use a shared App Group container or keychain to pass authentication tokens and action results between the UI extension and the file provider extension.
- **View controller lifecycle is standard UIKit.** Despite running inside Files, the extension view controller follows normal UIKit lifecycle rules. You can use Auto Layout, child view controllers, and navigation controllers. However, the view size is constrained by the modal presentation style the system chooses.
- **Pair with a file-provider target.** This extension type is useless without a companion `file-provider` extension in the same app. Always create both targets together.
