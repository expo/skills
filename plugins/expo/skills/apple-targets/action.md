---
title: Action Extension
description: Transforms or processes content in-place from the system share sheet, optionally with a UI or as a headless background operation.
version: iOS 8.0+
---

# Action Extension (`action`)

An Action Extension appears alongside Share Extensions in the system share sheet but serves a different purpose: instead of sending content to another app, it transforms or processes content and optionally returns modified data back to the host app. Action Extensions come in two flavors -- UI-based (presents a view controller for user interaction) and headless (no UI, runs entirely in the background via `NSExtensionRequestHandling`). A powerful pattern pairs the headless Swift handler with a JavaScript preprocessing file that can read and modify the current webpage in Safari, creating a bridge between native code and web content. Content flows through `NSExtensionContext` using `NSExtensionItem` and `NSItemProvider`, the same mechanism as Share Extensions, but Action Extensions can return results via `completeRequest(returningItems:)`.

## Apple Documentation

- [App Extension Programming Guide: Action](https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/Action.html)
- [NSExtensionContext](https://developer.apple.com/documentation/foundation/nsextensioncontext)
- [NSItemProvider](https://developer.apple.com/documentation/foundation/nsitemprovider)
- [NSExtensionItem](https://developer.apple.com/documentation/foundation/nsextensionitem)
- [NSExtensionActivationRule](https://developer.apple.com/documentation/bundleresources/information-property-list/nsextension/nsextensionattributes/nsextensionactivationrule)
- [NSExtensionRequestHandling](https://developer.apple.com/documentation/foundation/nsextensionrequesthandling)
- [App Extension Keys Reference](https://developer.apple.com/library/archive/documentation/General/Reference/InfoPlistKeyReference/Articles/AppExtensionKeys.html)

## WWDC History

- **[WWDC 2014, Session 205 -- Creating Extensions for iOS and OS X, Part 1](https://developer.apple.com/videos/play/wwdc2014/205/)** -- Introduced the app extension model including Action Extensions. Covered the extension lifecycle, `NSExtensionContext`, and data flow between host app and extension.
- **[WWDC 2014, Session 217 -- Creating Extensions for iOS and OS X, Part 2](https://developer.apple.com/videos/play/wwdc2014/217/)** -- Deep dive into Action Extensions specifically. Demonstrated returning modified data back to the host app, Safari JavaScript preprocessing, and the `run()`/`finalize()` pattern for web page manipulation.
- **[WWDC 2015, Session 224 -- App Extension Best Practices](https://developer.apple.com/videos/play/wwdc2015/224/)** -- Covered activation rules, memory management, and the distinction between Action Extensions ("change content in place") and Share Extensions ("move content to another app").

## What It Does

1. **User selects content and opens the share sheet.** The system evaluates your `NSExtensionActivationRule` against the available content. If it matches, your Action Extension appears in the action row of the activity view controller.
2. **For headless extensions:** The system calls `beginRequest(with:)` on your `NSExtensionRequestHandling` conforming class. No UI is presented.
3. **For UI-based extensions:** The system instantiates your principal view controller and presents it modally.
4. **Content arrives via `NSExtensionContext`.** Input items are `NSExtensionItem` objects with `NSItemProvider` attachments, identical to Share Extensions.
5. **JavaScript preprocessing (Safari).** If the extension declares an `NSExtensionJavaScriptPreprocessingFile`, Safari runs the file's `run()` function before launching the extension. The JavaScript can extract page data (title, URL, DOM content) and pass it to the native side as a property list dictionary via the `completionFunction` callback.
6. **Extension processes content.** Your native code receives the preprocessed data, performs transformations (translate text, apply image filter, extract metadata), and prepares results.
7. **Results flow back.** The extension creates a new `NSExtensionItem` with `NSItemProvider` attachments containing the modified data and calls `extensionContext.completeRequest(returningItems:)`. For Safari extensions, the results are passed to the JavaScript file's `finalize()` function, which can apply changes to the webpage DOM.

## Use Cases

### Webpage background color changer
A headless Action Extension paired with a JavaScript file. The JS `run()` reads the current `document.body.style.backgroundColor` and passes it to Swift. The Swift handler decides on a new color and returns it. The JS `finalize()` applies the new background color to the page. No UI required.

### Text translation
A UI-based Action Extension that receives selected text from any app. The extension presents a view showing the original text and a translated version using a local ML model or API call. The user confirms, and the translated text is returned to the host app to replace the selection.

### Image markup and annotation
A UI-based extension that receives an image attachment. The user draws annotations, adds text overlays, or applies filters. The modified image is returned to the host app via `completeRequest(returningItems:)`.

### Save to reading list
A headless Action Extension that extracts the current page URL from Safari via JavaScript preprocessing and saves it to the app's shared data store. A brief system notification confirms the save without interrupting the user's browsing.

## Key Classes

| Class / Protocol | Role |
|------------------|------|
| `NSExtensionRequestHandling` | Protocol for headless (no-UI) Action Extensions. Implement `beginRequest(with:)` to receive the extension context. |
| `NSExtensionContext` | Provides `inputItems` from the host app and the `completeRequest(returningItems:completionHandler:)` method to return results. |
| `NSExtensionItem` | Wraps one logical item from the host. Contains `attachments` (array of `NSItemProvider`), plus optional `attributedTitle` and `attributedContentText`. |
| `NSItemProvider` | Represents a single attachment. Use `hasItemConformingToTypeIdentifier(_:)` to probe, then `loadItem(forTypeIdentifier:options:)` to retrieve data asynchronously. |
| `UIViewController` | For UI-based Action Extensions. Set as `NSExtensionPrincipalClass` and present your custom interface. Access input via `extensionContext`. |
| `NSExtensionJavaScriptPreprocessingResultsKey` | Dictionary key used to extract the results from the JavaScript `run()` function in the loaded property list. |
| `NSExtensionJavaScriptFinalizeArgumentKey` | Dictionary key for the data you pass back to the JavaScript `finalize()` function from your native handler. |

## Implementation

```swift
import UIKit
import UniformTypeIdentifiers

// 1. Conform to NSExtensionRequestHandling for a headless (no-UI) Action Extension.
class ActionRequestHandler: NSObject, NSExtensionRequestHandling {

    var extensionContext: NSExtensionContext?

    func beginRequest(with context: NSExtensionContext) {
        // 2. Store the context; do not call super for headless extensions.
        self.extensionContext = context

        var found = false

        // 3. Iterate input items to find JavaScript preprocessing results.
        outer:
        for item in context.inputItems as! [NSExtensionItem] {
            if let attachments = item.attachments {
                for provider in attachments {
                    if provider.hasItemConformingToTypeIdentifier(UTType.propertyList.identifier) {
                        provider.loadItem(
                            forTypeIdentifier: UTType.propertyList.identifier,
                            options: nil
                        ) { (item, error) in
                            let dictionary = item as! [String: Any]
                            let results = dictionary[
                                NSExtensionJavaScriptPreprocessingResultsKey
                            ] as? [String: Any] ?? [:]
                            // 4. Process the JavaScript results on the main queue.
                            OperationQueue.main.addOperation {
                                self.processResults(results)
                            }
                        }
                        found = true
                        break outer
                    }
                }
            }
        }

        if !found {
            // 5. No JavaScript results found; complete immediately.
            done(with: nil)
        }
    }

    func processResults(_ jsResults: [String: Any]) {
        // 6. Read the page title extracted by the JavaScript run() function.
        let pageTitle = jsResults["pageTitle"] as? String ?? "Untitled"

        // 7. Prepare data to send back to the JavaScript finalize() function.
        let responseData: [String: Any] = [
            "processedTitle": pageTitle.uppercased(),
            "timestamp": ISO8601DateFormatter().string(from: Date())
        ]
        done(with: responseData)
    }

    func done(with resultsForJS: [String: Any]?) {
        if let results = resultsForJS {
            // 8. Wrap the results in an NSExtensionItem for the JS finalize() callback.
            let resultsDictionary = [NSExtensionJavaScriptFinalizeArgumentKey: results]
            let provider = NSItemProvider(
                item: resultsDictionary as NSDictionary,
                typeIdentifier: UTType.propertyList.identifier
            )
            let outputItem = NSExtensionItem()
            outputItem.attachments = [provider]
            extensionContext?.completeRequest(returningItems: [outputItem], completionHandler: nil)
        } else {
            // 9. Nothing to return; still must signal completion.
            extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
        }
        extensionContext = nil
    }
}
```

The companion JavaScript file (`assets/index.js`) bridges the native handler and the webpage:

```javascript
// assets/index.js -- loaded by Safari before the native extension runs.
class Action {
  // 10. run() executes in the webpage context before the native handler launches.
  run({ extensionName, completionFunction }) {
    completionFunction({
      pageTitle: document.title,
      currentURL: window.location.href,
      selectedText: window.getSelection()?.toString() || "",
    });
  }

  // 11. finalize() executes after the native handler returns results.
  finalize(args) {
    if (args.processedTitle) {
      document.title = args.processedTitle;
    }
  }
}

// 12. Must assign to window.ExtensionPreprocessingJS for Safari to find it.
window.ExtensionPreprocessingJS = new Action();
```

## Usage

- Create: `bun create target action`
- Edit: `targets/action/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| iOS | 8.0+ | Full support. Appears in the share sheet action row. |
| iPadOS | 8.0+ | Full support. Share sheet appears as a popover. |
| macOS | 10.10+ | Supported via `NSViewController`. Finder integration via `NSExtensionServiceAllowsFinderPreviewItem`. |
| Mac Catalyst | 13.1+ | Uses iOS extension APIs. |
| watchOS | -- | Not supported. |
| tvOS | -- | Not supported. |
| visionOS | 1.0+ | Share sheet supported. |

## Gotchas

- **`TRUEPREDICATE` will get your app rejected.** The default `NSExtensionActivationRule` is `TRUEPREDICATE`, which makes the extension appear for all content. Apple rejects App Store submissions containing this value. Replace it with specific keys (`NSExtensionActivationSupportsWebURLWithMaxCount`, `NSExtensionActivationSupportsText`, etc.) or a custom predicate string.
- **Activation rule dictionary version matters.** `NSExtensionActivationDictionaryVersion` defaults to 1, which requires the extension to handle ALL offered content types. Set it to 2 if you want "at least one matching type" semantics. Getting this wrong means your extension either never appears or appears when it should not.
- **Headless extensions have no UI lifecycle.** There is no `viewDidLoad` or `viewDidAppear`. All work happens in `beginRequest(with:)`. You must call `completeRequest(returningItems:)` when finished or the system will eventually kill the extension.
- **JavaScript file must use `window.ExtensionPreprocessingJS`.** Safari looks for this specific global variable. If the class is not assigned to `window.ExtensionPreprocessingJS`, the preprocessing step silently fails and the native handler receives no data.
- **Same 120 MB memory limit as other extensions.** Action Extensions are subject to the same ~120 MB memory cap. Image processing or heavy computation should be done incrementally and with downsampled inputs.
- **Return data type must match what the host expects.** Not all host apps handle returned items. Safari expects property list data keyed with `NSExtensionJavaScriptFinalizeArgumentKey`. Other host apps may ignore returned items entirely. Test with multiple host apps.
- **`NSExtensionServiceAllowsFinderPreviewItem` is macOS-only.** The Finder-specific and Touch Bar-specific keys in the default template Info.plist have no effect on iOS. They are included for cross-platform extensions that also target macOS.
- **Action and Share share the same sheet but different rows.** Action Extensions appear in the bottom row of the share sheet (the "action" row), while Share Extensions appear in the top row. Users can reorder and hide individual extensions, so do not assume your extension is visible by default.
- **No background execution after completion.** Unlike Share Extensions which can use background URL sessions for uploads, headless Action Extensions have no mechanism for continued background work. All processing must complete before calling `completeRequest`.
