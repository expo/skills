---
title: App Intents Extension
description: Provides app actions to Siri, Shortcuts, Spotlight, interactive widgets, Focus filters, and Control Center controls using the modern pure-Swift App Intents framework via an ExtensionKit-based extension.
version: iOS 16.0+
---

# App Intents Extension (`app-intent`)

An App Intents extension is a lightweight ExtensionKit-based process that exposes your app's actions and entities to the system without launching your main app. Unlike legacy SiriKit Intents that required IntentDefinition files and Objective-C code generation, App Intents are declared entirely in Swift using structs conforming to the `AppIntent` protocol with `@Parameter` property wrappers. The framework powers Siri voice commands, Shortcuts automations, Spotlight suggestions, interactive widget buttons, Focus filters, the Action Button, Apple Pencil Pro squeeze, and -- starting with iOS 18 -- Control Center controls. Running intents in a dedicated extension keeps your app's startup cost out of the critical path, so Siri and Shortcuts respond faster.

## Apple Documentation

- [App Intents Framework](https://developer.apple.com/documentation/appintents)
- [AppIntent Protocol](https://developer.apple.com/documentation/appintents/appintent)
- [Creating Your First App Intent](https://developer.apple.com/documentation/appintents/creating-your-first-app-intent)
- [AppShortcutsProvider](https://developer.apple.com/documentation/appintents/appshortcutsprovider)
- [EntityQuery](https://developer.apple.com/documentation/appintents/entityquery)
- [AppIntentsExtension](https://developer.apple.com/documentation/appintents/appintentsextension)
- [Accelerating App Interactions with App Intents](https://developer.apple.com/documentation/appintents/acceleratingappinteractionswithappintents)
- [ExtensionKit Framework](https://developer.apple.com/documentation/extensionkit)

## WWDC History

- **[WWDC 2022, Session 10032 -- Dive into App Intents](https://developer.apple.com/videos/play/wwdc2022/10032/)** -- Introduced the App Intents framework as a pure-Swift replacement for SiriKit custom intents. Covered `AppIntent`, `AppEntity`, `EntityQuery`, and `AppShortcutsProvider` for zero-setup Siri phrases.
- **[WWDC 2022, Session 10170 -- Implement App Shortcuts with App Intents](https://developer.apple.com/videos/play/wwdc2022/10170/)** -- Detailed walkthrough of building App Shortcuts with parameterized phrases, including entity resolution and Siri dialog.
- **[WWDC 2022, Session 10169 -- Design App Shortcuts](https://developer.apple.com/videos/play/wwdc2022/10169/)** -- Design guidance for creating discoverable, natural-sounding App Shortcuts.
- **[WWDC 2023, Session 10103 -- Explore Enhancements to App Intents](https://developer.apple.com/videos/play/wwdc2023/10103/)** -- iOS 17 updates: App Intents in frameworks via `AppIntentsPackage`, Shortcuts integration improvements, and Spotlight entity indexing.
- **[WWDC 2024, Session 10134 -- What's New in App Intents](https://developer.apple.com/videos/play/wwdc2024/10134/)** -- Universal Links for entities, Transferable support, IntentFile APIs, union values, and the guidance shift to "every feature should be an App Intent."
- **[WWDC 2024, Session 10210 -- Bring Your App's Core Features to Users with App Intents](https://developer.apple.com/videos/play/wwdc2024/10210/)** -- End-to-end guide for surfacing app features through Siri, Spotlight, widgets, the Action Button, and Control Center controls in iOS 18.
- **[WWDC 2025, Session 244 -- Get to Know App Intents](https://developer.apple.com/videos/play/wwdc2025/244/)** -- The new `@AppIntent` macro, `ComputedProperty` and `DeferredProperty` macros, `UnionValue` for mixed entity queries, and Swift Package support for App Intents code.

## What It Does

1. You declare Swift structs conforming to `AppIntent` with a `title`, `@Parameter` properties, and a `perform()` method.
2. The system's metadata extractor discovers your intents at build time (no runtime registration needed).
3. When a user triggers the intent -- through Siri, Shortcuts, Spotlight, a widget button, or Control Center -- the system launches your App Intents extension process.
4. The extension calls your `perform() async throws -> some IntentResult` method.
5. The method executes the action, optionally returning a dialog string, a SwiftUI snippet view, or an `IntentResultValue` for downstream Shortcuts actions.
6. For Siri voice activation without user setup, you register phrases in an `AppShortcutsProvider` so the system knows which spoken commands map to which intents.

## Use Cases

### Voice-activated app actions
A task manager lets users say "Add a task in TaskApp" to create a new item. The `AppShortcutsProvider` registers the phrase, and the intent's `perform()` method creates the task in the shared data store and returns a confirmation dialog.

### Shortcuts automations
A home automation app exposes "Set thermostat to X degrees" as a parameterized intent. Users build Shortcuts automations that trigger the intent at specific times or locations without opening the app.

### Spotlight quick actions
A recipe app conforms its recipes to `AppEntity` with a `StringSearchableEntityQuery`. When the user searches in Spotlight, matching recipes appear as actionable results that open directly to the recipe detail view.

### Interactive widget buttons
A media player widget includes play/pause buttons backed by App Intents. Tapping the button executes the intent in the extension, toggling playback without launching the full app.

### Control Center controls (iOS 18+)
A smart-home app registers a `ControlWidget` backed by an App Intent to toggle lights. The control appears in the customizable Control Center grid and executes entirely in the extension.

### Focus filters
A communication app uses `SetFocusFilterIntent` to configure which accounts are visible during a Focus mode, filtering notifications and content to match the user's current context.

## Key Classes

| Class / Protocol | Role |
|-----------------|------|
| `AppIntent` | Core protocol. Declare a `static var title`, `@Parameter` properties, and `perform() async throws -> some IntentResult`. |
| `AppIntentsExtension` | Marker protocol for the `@main` entry point struct of an App Intents extension. |
| `IntentResult` | Return type from `perform()`. Compose with `ProvidesDialog`, `ShowsSnippetView`, or `ReturnsValue` for richer results. |
| `AppEntity` | Protocol for exposing your data model to the system. Requires `id`, `displayRepresentation`, and a `defaultQuery`. |
| `EntityQuery` | Retrieves entities by identifier (`entities(for:)`) and provides suggestions (`suggestedEntities()`). Subtypes include `EnumerableEntityQuery` and `EntityStringQuery`. |
| `AppShortcutsProvider` | Declares `appShortcuts` array of `AppShortcut` with trigger phrases containing `.applicationName`. Enables Siri voice activation with zero user setup. |
| `@Parameter` | Property wrapper that declares a typed intent parameter. Supports default values, `title`, `description`, and `requestValueDialog`. |
| `AppIntentsPackage` | Protocol for re-exporting intents from frameworks and Swift packages. Use `includedPackages` to compose modular intent libraries. |
| `AppEnum` | Protocol for exposing a Swift enum as an intent parameter with localized display names for each case. |

## Implementation

```swift
import AppIntents

// 1. Mark the entry point with @main. AppIntentsExtension is the
//    required conformance for an App Intents extension target.
@main
struct MyAppIntentsExtension: AppIntentsExtension {
}

// 2. Define an entity that represents your app's data model.
//    The system uses the defaultQuery to look up entities by ID.
struct TaskEntity: AppEntity {
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Task"
    static var defaultQuery = TaskEntityQuery()

    var id: UUID
    var name: String
    var isComplete: Bool

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(name)")
    }
}

// 3. Implement an EntityQuery so Siri and Shortcuts can resolve
//    task parameters by identifier or by search string.
struct TaskEntityQuery: EntityQuery {
    func entities(for identifiers: [UUID]) async throws -> [TaskEntity] {
        TaskStore.shared.tasks.filter { identifiers.contains($0.id) }
    }

    func suggestedEntities() async throws -> [TaskEntity] {
        TaskStore.shared.tasks.filter { !$0.isComplete }
    }
}

// 4. Declare the intent with @Parameter properties and a perform method.
//    The title appears in Shortcuts and Spotlight as the action name.
struct CompleteTaskIntent: AppIntent {
    static var title: LocalizedStringResource = "Complete Task"
    static var description: IntentDescription = "Marks a task as done."

    // 5. @Parameter exposes typed inputs. The system uses the entity's
    //    defaultQuery to present a picker when the user taps this parameter.
    @Parameter(title: "Task")
    var task: TaskEntity

    // 6. perform() is called when the intent executes. Return a dialog
    //    string so Siri speaks confirmation, and a value for Shortcuts chaining.
    func perform() async throws -> some IntentResult & ProvidesDialog & ReturnsValue<Bool> {
        TaskStore.shared.markComplete(task.id)
        return .result(value: true, dialog: "Done! \(task.name) is complete.")
    }
}

// 7. Register App Shortcuts for voice activation. Each phrase must
//    include .applicationName so Siri knows which app to route to.
struct MyAppShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: CompleteTaskIntent(),
            phrases: [
                "Mark a task done in \(.applicationName)",
                "Complete a task in \(.applicationName)"
            ],
            shortTitle: "Complete Task",
            systemImageName: "checkmark.circle"
        )
    }
}
```

## Usage

- Create: `bun create target app-intent`
- Edit: `targets/app-intent/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| iOS | 16.0+ | Full support. Control Center controls require iOS 18+. |
| iPadOS | 16.0+ | Full support. |
| macOS | 13.0+ | Full support. App Intents power Shortcuts and Spotlight on Mac. |
| watchOS | 9.0+ | Supported. Intents can run in a watchOS App Intents extension. |
| tvOS | -- | Not supported. |
| visionOS | 1.0+ | Full support via compatible iOS intents. |

## Gotchas

- **Extension uses ExtensionKit, not NSExtension.** The App Intents extension uses the `EXAppExtensionAttributes` Info.plist key with `EXExtensionPointIdentifier` set to `com.apple.appintents-extension`, and its product type is `com.apple.product-type.extensionkit-extension`. It installs into the `Extensions/` directory, not `PlugIns/`. Mixing these up causes silent validation failures.
- **Metadata is extracted at build time.** The system discovers your intents by scanning compiled metadata, not by runtime registration. If your intent struct is not compiled into the extension target (or a framework linked to it), it will not appear in Shortcuts or Siri. There is no runtime error -- the intent simply does not exist.
- **AppShortcutsProvider phrases must include `.applicationName`.** Every phrase string in your `AppShortcut` must contain the `.applicationName` interpolation token. Without it, the phrase will not compile, and Siri cannot route the voice command to your app.
- **Extension and main app share intents via frameworks.** If you need the same intents available in both the extension and the main app, compile them into a shared framework and use `AppIntentsPackage` with `includedPackages` to re-export the metadata. Duplicating intent code across targets causes conflicts.
- **No UI by default.** Unlike legacy Intents UI extensions, App Intents do not show custom UI unless you explicitly return `ShowsSnippetView` from `perform()` with an attached SwiftUI view. The default result is a text dialog.
- **perform() runs on an arbitrary queue.** If your intent needs main-thread access (e.g., UIKit operations), annotate `perform()` with `@MainActor`. Accessing main-thread-only APIs without this annotation causes undefined behavior.
- **Entity IDs must be stable.** The system persists entity identifiers across Shortcuts runs and Siri sessions. If your entity IDs change between app launches (e.g., using array indices), saved Shortcuts will break silently with "entity not found" errors.
- **Older OS versions ignore newer intent features.** Features like Control Center controls (iOS 18), `@AppIntent` macro (iOS 26), and `UnionValue` (iOS 26) are not available on earlier OS versions. Use `@available` checks and provide fallback intents for broader compatibility.
- **App Intents extensions cannot show UI on launch.** The extension runs headlessly. If your action requires user interaction (login, confirmation), return `.result()` with a `needsContinueInForegroundError` or use `openAppWhenRun = true` to hand off to the main app.
