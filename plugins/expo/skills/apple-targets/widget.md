---
title: WidgetKit Home Screen Widget
description: Displays glanceable, read-only (or interactive on iOS 17+) views on the Home Screen, Lock Screen, StandBy, and Desktop, powered by timeline-based data and SwiftUI.
version: iOS 14.0+, macOS 11.0+
---

# WidgetKit Home Screen Widget (`widget`)

A widget extension renders small SwiftUI views directly on the Home Screen, Lock Screen, StandBy mode, and macOS Desktop. Widgets refresh on a system-managed timeline, and starting with iOS 17 they can contain interactive controls (buttons and toggles) via App Intents. The same extension can also power Live Activities on the Lock Screen and Dynamic Island, as well as Control Center controls (iOS 18+).

## Apple Documentation

- [WidgetKit Framework Overview](https://developer.apple.com/documentation/widgetkit)
- [Creating a Widget Extension](https://developer.apple.com/documentation/widgetkit/creating-a-widget-extension)
- [Widget Protocol (SwiftUI)](https://developer.apple.com/documentation/swiftui/widget)
- [TimelineProvider](https://developer.apple.com/documentation/widgetkit/timelineprovider)
- [AppIntentTimelineProvider](https://developer.apple.com/documentation/widgetkit/appintenttimelineprovider)
- [WidgetFamily](https://developer.apple.com/documentation/widgetkit/widgetfamily)
- [ActivityKit (Live Activities)](https://developer.apple.com/documentation/activitykit)
- [WidgetKit Widgets Overview (Apple landing page)](https://developer.apple.com/widgets/)
- [Keeping a Widget Up to Date](https://developer.apple.com/documentation/widgetkit/keeping-a-widget-up-to-date)

## WWDC History

- **[WWDC 2020, Session 10028 -- Meet WidgetKit](https://developer.apple.com/videos/play/wwdc2020/10028/)** -- Introduced WidgetKit with timeline providers, widget families (small/medium/large), and SwiftUI-only rendering.
- **[WWDC 2020, Session 10033 -- Build SwiftUI Views for Widgets](https://developer.apple.com/videos/play/wwdc2020/10033/)** -- Deep dive into SwiftUI view techniques specific to widgets.
- **[WWDC 2020, Sessions 10034-10036 -- Widgets Code-Along (Parts 1-3)](https://developer.apple.com/videos/play/wwdc2020/10034/)** -- Three-part hands-on series covering widget families, timelines, URL sessions, and widget bundles.
- **[WWDC 2021, Session 10048 -- Principles of Great Widgets](https://developer.apple.com/videos/play/wwdc2021/10048/)** -- Design guidance for effective widget experiences.
- **[WWDC 2022, Session 10050 -- Complications and Widgets: Reloaded](https://developer.apple.com/videos/play/wwdc2022/10050/)** -- Added Lock Screen widget families (`accessoryCircular`, `accessoryRectangular`, `accessoryInline`) and unified WidgetKit across iOS and watchOS.
- **[WWDC 2022, Session 10051 -- Go Further with Complications in WidgetKit](https://developer.apple.com/videos/play/wwdc2022/10051/)** -- watchOS-specific WidgetKit features and ClockKit migration.
- **[WWDC 2023, Session 10027 -- Bring Widgets to New Places](https://developer.apple.com/videos/play/wwdc2023/10027/)** -- Widgets on Mac Desktop, iPad Lock Screen, StandBy mode, and Apple Watch Smart Stack.
- **[WWDC 2023, Session 10028 -- Bring Widgets to Life](https://developer.apple.com/videos/play/wwdc2023/10028/)** -- Interactive widgets with App Intents (Button and Toggle), animated transitions.
- **[WWDC 2023, Session 10184 -- Meet ActivityKit](https://developer.apple.com/videos/play/wwdc2023/10184/)** -- Live Activities on Lock Screen and Dynamic Island using ActivityKit.
- **[WWDC 2024, Session 10157 -- Extend Your App's Controls Across the System](https://developer.apple.com/videos/play/wwdc2024/10157/)** -- Control Center controls built with WidgetKit (iOS 18+).
- **[WWDC 2025, Session 278 -- What's New in Widgets](https://developer.apple.com/videos/play/wwdc2025/278/)** -- Widget push updates, glass presentation on iOS 26, visionOS pinned widgets.

## What It Does

1. **System requests a timeline.** WidgetKit calls your `TimelineProvider.getTimeline(in:completion:)` (or the `AppIntentTimelineProvider` equivalent) to get an array of dated entries.
2. **Entries are rendered as SwiftUI views.** Each `TimelineEntry` is passed to your widget's `body` view closure. The system snapshots the SwiftUI tree into a static render (pre-iOS 17) or an interactive render (iOS 17+).
3. **The system manages refresh.** Based on your `TimelineReloadPolicy` (`.atEnd`, `.after(date)`, `.never`) the system schedules the next call to your provider. You get a limited daily budget of refreshes.
4. **In-app triggers.** Your main app can call `WidgetCenter.shared.reloadTimelines(ofKind:)` to force a reload after data changes.
5. **Push-driven updates.** A server can send a WidgetKit push notification via APNs to trigger a reload without the app running.
6. **Taps deep-link.** A tap on the widget opens the main app. You control the destination via `.widgetURL()` or `Link` views.
7. **Interactive controls (iOS 17+).** Buttons and Toggles bound to an `AppIntent` execute logic directly in the widget extension process -- no app launch required.

## Use Cases

### Weather and forecasts
A medium-sized widget showing current temperature, conditions, and a 5-hour forecast strip. The timeline provider generates entries at hourly intervals, with a network request in `getTimeline` to fetch fresh data.

### Task and habit trackers
An interactive widget with a checklist. Each row has a Toggle bound to a `ToggleTaskIntent` (AppIntent) so users can mark items complete directly from the Home Screen without opening the app.

### Sports scores and live events
A Live Activity on the Lock Screen and Dynamic Island showing the current score, game clock, and team logos. The app starts the activity at tip-off and updates it via APNs push or in-app `Activity.update()` calls.

### Music and media playback
A small widget showing the currently playing album art and track name. An interactive Play/Pause button uses an AppIntent to control playback via the shared audio session.

## Key Classes

| Class / Protocol | Role |
|------------------|------|
| `TimelineProvider` | Supplies the widget with a timeline of entries. Implement `placeholder`, `getSnapshot`, and `getTimeline`. |
| `AppIntentTimelineProvider` | iOS 17+ replacement that uses App Intents for user-configurable widgets (replaces `IntentTimelineProvider`). |
| `TimelineEntry` | A single dated data point. Must contain a `date` property; add any custom fields your view needs. |
| `WidgetConfiguration` | Declares the widget. Use `StaticConfiguration` (no config) or `AppIntentConfiguration` (user-configurable). |
| `WidgetFamily` | Enum of supported sizes: `.systemSmall`, `.systemMedium`, `.systemLarge`, `.systemExtraLarge`, `.accessoryCircular`, `.accessoryRectangular`, `.accessoryInline`. |
| `WidgetBundle` | Groups multiple widgets from the same extension into a single target. |
| `WidgetCenter` | Lets the main app reload timelines and query current widget configurations. |
| `ActivityAttributes` | Defines the static and dynamic data schema for a Live Activity. |
| `ActivityConfiguration` | Declares the Live Activity UI (Lock Screen banner + Dynamic Island). |
| `Activity<T>` | Manages the lifecycle of a Live Activity instance (request, update, end). |

## Implementation

### Timeline-Based Widget with Interactive Controls (iOS 17+)

```swift
import WidgetKit
import SwiftUI
import AppIntents

// 1. Define the data each timeline entry carries.
struct TaskEntry: TimelineEntry {
    let date: Date
    let tasks: [TaskItem]
}

struct TaskItem: Identifiable, Codable {
    let id: String
    var title: String
    var isComplete: Bool
}

// 2. Build a timeline provider that reads from shared storage.
struct TaskTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> TaskEntry {
        TaskEntry(date: .now, tasks: [
            TaskItem(id: "1", title: "Buy groceries", isComplete: false)
        ])
    }

    func getSnapshot(in context: Context, completion: @escaping (TaskEntry) -> Void) {
        completion(placeholder(in: context))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TaskEntry>) -> Void) {
        // 3. Read tasks from an App Group shared container.
        let tasks = loadTasksFromAppGroup()
        let entry = TaskEntry(date: .now, tasks: tasks)

        // 4. Reload at the top of the next hour, or rely on in-app triggers.
        let nextUpdate = Calendar.current.date(byAdding: .hour, value: 1, to: .now)!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }

    private func loadTasksFromAppGroup() -> [TaskItem] {
        guard let url = FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: "group.com.example.myapp")?
            .appendingPathComponent("tasks.json"),
              let data = try? Data(contentsOf: url),
              let tasks = try? JSONDecoder().decode([TaskItem].self, from: data)
        else { return [] }
        return tasks
    }
}

// 5. Define an App Intent for toggling a task (iOS 17+).
struct ToggleTaskIntent: AppIntent {
    static var title: LocalizedStringResource = "Toggle Task"

    @Parameter(title: "Task ID")
    var taskId: String

    init() {}
    init(taskId: String) { self.taskId = taskId }

    func perform() async throws -> some IntentResult {
        // 6. Mutate shared data and tell WidgetKit to refresh.
        var tasks = SharedTaskStore.load()
        if let idx = tasks.firstIndex(where: { $0.id == taskId }) {
            tasks[idx].isComplete.toggle()
            SharedTaskStore.save(tasks)
        }
        return .result()
    }
}

// 7. Build the SwiftUI view.
struct TaskWidgetEntryView: View {
    var entry: TaskEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .systemSmall:
            // Small: show count only
            VStack {
                Text("\(entry.tasks.filter { !$0.isComplete }.count)")
                    .font(.system(size: 48, weight: .bold))
                Text("tasks left")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .containerBackground(.fill.tertiary, for: .widget)

        case .systemMedium:
            // Medium: show interactive checklist
            VStack(alignment: .leading, spacing: 6) {
                ForEach(entry.tasks.prefix(4)) { task in
                    // 8. Toggle bound to an AppIntent -- executes without launching the app.
                    Toggle(isOn: task.isComplete, intent: ToggleTaskIntent(taskId: task.id)) {
                        Text(task.title)
                            .strikethrough(task.isComplete)
                    }
                    .toggleStyle(.checkbox)
                }
            }
            .padding()
            .containerBackground(.fill.tertiary, for: .widget)

        default:
            Text("Unsupported")
        }
    }
}

// 9. Declare the widget configuration.
struct TaskWidget: Widget {
    let kind = "TaskWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TaskTimelineProvider()) { entry in
            TaskWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Tasks")
        .description("Track your to-do list at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
```

### Live Activity (Delivery Tracker)

```swift
import ActivityKit
import WidgetKit
import SwiftUI

// 1. Define attributes: static data + dynamic ContentState.
struct DeliveryAttributes: ActivityAttributes {
    let orderNumber: String
    let restaurantName: String

    struct ContentState: Codable, Hashable {
        var status: String          // e.g. "Preparing", "On the way", "Delivered"
        var estimatedArrival: Date
        var driverName: String
    }
}

// 2. Build the Live Activity widget.
struct DeliveryLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: DeliveryAttributes.self) { context in
            // Lock Screen / banner presentation
            HStack {
                VStack(alignment: .leading) {
                    Text(context.state.status)
                        .font(.headline)
                    Text("ETA: \(context.state.estimatedArrival, style: .timer)")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "bicycle")
                    .font(.title)
            }
            .padding()
            .activityBackgroundTint(.cyan.opacity(0.2))
        } dynamicIsland: { context in
            // 3. Dynamic Island presentations.
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: "bicycle")
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.state.status)
                        .font(.headline)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.state.estimatedArrival, style: .timer)
                        .font(.caption)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text("Driver: \(context.state.driverName)")
                }
            } compactLeading: {
                Image(systemName: "bicycle")
            } compactTrailing: {
                Text(context.state.estimatedArrival, style: .timer)
            } minimal: {
                Image(systemName: "bicycle")
            }
        }
    }
}

// 4. Start, update, and end from the main app.
func startDeliveryActivity(orderNumber: String, restaurant: String) throws {
    let attributes = DeliveryAttributes(
        orderNumber: orderNumber,
        restaurantName: restaurant
    )
    let initialState = DeliveryAttributes.ContentState(
        status: "Preparing",
        estimatedArrival: Date().addingTimeInterval(30 * 60),
        driverName: "Alex"
    )
    let content = ActivityContent(state: initialState, staleDate: nil)
    let _ = try Activity<DeliveryAttributes>.request(
        attributes: attributes,
        content: content,
        pushType: .token   // enables APNs updates
    )
}

func updateDeliveryActivity(activity: Activity<DeliveryAttributes>, newStatus: String) async {
    let updatedState = DeliveryAttributes.ContentState(
        status: newStatus,
        estimatedArrival: Date().addingTimeInterval(10 * 60),
        driverName: "Alex"
    )
    await activity.update(ActivityContent(state: updatedState, staleDate: nil))
}

func endDeliveryActivity(activity: Activity<DeliveryAttributes>) async {
    let finalState = DeliveryAttributes.ContentState(
        status: "Delivered",
        estimatedArrival: .now,
        driverName: "Alex"
    )
    await activity.end(
        ActivityContent(state: finalState, staleDate: nil),
        dismissalPolicy: .after(.now.addingTimeInterval(4 * 3600))
    )
}
```

### Lock Screen Accessory Widget

```swift
import WidgetKit
import SwiftUI

// 1. Reuse the same provider; declare a separate widget for Lock Screen families.
struct TaskAccessoryWidget: Widget {
    let kind = "TaskAccessoryWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TaskTimelineProvider()) { entry in
            // 2. Accessory widgets use a monochrome, compact layout.
            let remaining = entry.tasks.filter { !$0.isComplete }.count
            ZStack {
                AccessoryWidgetBackground()
                VStack {
                    Image(systemName: "checklist")
                    Text("\(remaining)")
                        .font(.title2.bold())
                }
            }
            .widgetLabel("\(remaining) left")
        }
        .configurationDisplayName("Task Count")
        .description("Remaining tasks on your Lock Screen.")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}
```

### Control Center Control Widget (iOS 18+)

Control Center controls are declared using `ControlWidget` and backed by App Intents. They appear in the customizable Control Center grid, Lock Screen, and Action Button. Each control requires an SF Symbol for its icon.

```swift
import WidgetKit
import SwiftUI
import AppIntents

// 1. Define the App Intent that the control executes.
struct ToggleLightsIntent: SetValueIntent {
    static var title: LocalizedStringResource = "Toggle Lights"

    @Parameter(title: "Light State")
    var value: Bool

    func perform() async throws -> some IntentResult {
        LightManager.shared.setLights(on: value)
        return .result()
    }
}

// 2. Define a value provider that supplies the current state.
struct LightsValueProvider: ControlWidgetToggleValueProvider {
    func currentValue() async throws -> Bool {
        LightManager.shared.areLightsOn
    }

    // 3. Provide a preview value for the Control Center gallery.
    let previewValue: Bool = false
}

// 4. Declare the control widget with an SF Symbol icon.
struct LightsControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        ControlWidgetToggle(
            "Living Room",
            isOn: LightsValueProvider(),
            action: ToggleLightsIntent()
        ) { isOn in
            Label(isOn ? "On" : "Off", systemImage: isOn ? "lightbulb.fill" : "lightbulb")
        }
        .displayName("Living Room Lights")
        .description("Toggle your living room lights.")
    }
}

// 5. Button-style control (non-toggle).
struct CaffeinateControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        ControlWidgetButton(action: LogCaffeineIntent()) {
            // SF Symbol used as the control icon
            Label("Log Caffeine", systemImage: "cup.and.saucer.fill")
        }
        .displayName("Log Caffeine")
        .description("Quickly log a caffeine intake.")
    }
}
```

### Control Widget Deep Link (iOS 18+)

The most common control widget use case is opening a deep link or URL in the main app. Use `ControlConfigurationIntent` with `openAppWhenRun = true` and return an `OpenURLIntent` to navigate to a specific screen.

```swift
import WidgetKit
import SwiftUI
import AppIntents

// 1. Declare the control widget with a button that opens the app.
@available(iOS 18.0, *)
struct DeepLinkControl: ControlWidget {
    static let kind = "com.example.myapp.deeplink"

    var body: some ControlWidgetConfiguration {
        StaticControlConfiguration(kind: Self.kind) {
            ControlWidgetButton(action: OpenAppIntent()) {
                Label("Settings", systemImage: "gear")
            }
        }
        .displayName("Open Settings")
        .description("Jump straight to app settings.")
    }
}

// 2. Define the intent that opens a URL when the control is tapped.
//    IMPORTANT: This intent must be compiled into BOTH the widget extension
//    target AND the main app target when openAppWhenRun = true.
//    See: https://developer.apple.com/forums/thread/763851
@available(iOS 18.0, *)
struct OpenAppIntent: ControlConfigurationIntent {
    static let title: LocalizedStringResource = "Launch App"
    static let description = IntentDescription(stringLiteral: "Open the app to a specific screen.")
    static let isDiscoverable = false
    static let openAppWhenRun: Bool = true

    @MainActor
    func perform() async throws -> some IntentResult & OpensIntent {
        // 3. Return an OpenURLIntent with your deep link URL.
        //    This can be a universal link or a custom URL scheme.
        return .result(opensIntent: OpenURLIntent(URL(string: "myapp://settings")!))
    }
}
```

> **Key detail:** When `openAppWhenRun = true`, the intent struct must be compiled into both the widget extension target and the main app target. If it only exists in the extension, the app will not launch correctly.

### SF Symbols for Icons

Widgets, controls, and App Shortcuts use **SF Symbols** for their icons. SF Symbols is Apple's library of thousands of vector icons designed for system integration.

**Using built-in SF Symbols:**

```swift
// In widgets and controls
Image(systemName: "heart.fill")
Label("Favorites", systemImage: "star.fill")

// In App Shortcuts
AppShortcut(
    intent: MyIntent(),
    phrases: ["Open \(.applicationName)"],
    shortTitle: "Open",
    systemImageName: "arrow.up.right" // SF Symbol name
)
```

**Creating custom SF Symbols from SVG:**

Custom SF Symbols let you use your own icons that match the weight, scale, and design language of system symbols. Create one from an SVG file or URL:

```sh
bun create symbol <path/to/svg | https://url.svg>
```

Popular brands have SVGs on https://simpleicons.org, e.g. https://simpleicons.org/icons/ferrari.svg

This generates a `.symbol` file that can be used with `Image("customSymbolName")` instead of `Image(systemName:)`. Custom symbols automatically support all SF Symbol rendering modes (monochrome, hierarchical, palette, multicolor) and adapt to dynamic type sizes.

**Symbol rendering modes in widgets:**

```swift
// Monochrome (default) -- single color, respects tint
Image(systemName: "heart.fill")

// Hierarchical -- primary color with automatic opacity layers
Image(systemName: "heart.circle.fill")
    .symbolRenderingMode(.hierarchical)

// Palette -- explicit multi-color
Image(systemName: "heart.circle.fill")
    .symbolRenderingMode(.palette)
    .foregroundStyle(.red, .gray)

// Multicolor -- Apple's predefined colors (not all symbols support this)
Image(systemName: "heart.circle.fill")
    .symbolRenderingMode(.multicolor)
```

> **Note:** Lock Screen accessory widgets only support monochrome rendering. Control Center controls use monochrome by default and are tinted by the system.

## Usage

- Create: `bun create target widget`
- Edit: `targets/widget/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| iOS | 14.0+ | Home Screen widgets. Lock Screen in 16.0+. Interactive in 17.0+. Controls in 18.0+. |
| iPadOS | 14.0+ | Home Screen widgets. Lock Screen in 17.0+. |
| macOS | 11.0+ | Notification Center in 11.0+. Desktop in 14.0+. |
| watchOS | 9.0+ | Complications via WidgetKit (replaces ClockKit). Smart Stack in 10.0+. |
| visionOS | 1.0+ | Supported. Can be pinned to surfaces in visionOS 2.0+. |
| tvOS | -- | Not supported. |

## Gotchas

- **Timeline budget is limited.** The system grants approximately 40-70 reloads per day depending on how often the widget is viewed. Calling `reloadTimelines(ofKind:)` from your app is not rate-limited but still consumes from the same budget. Design your reload policy accordingly.
- **Views must be pure SwiftUI.** UIKit views, web views, maps, and cameras are not available in widget extensions. Use SwiftUI equivalents only.
- **Only Button and Toggle are interactive.** iOS 17 interactive widgets support only `Button` and `Toggle` initialized with an `AppIntent`. Text fields, sliders, pickers, and other controls are not supported.
- **App Group is required for shared data.** The widget extension runs in a separate process. You must use an App Group container (`FileManager.containerURL(forSecurityApplicationGroupIdentifier:)` or `UserDefaults(suiteName:)`) to share data between your app and the widget.
- **`containerBackground` is required on iOS 17+.** Starting in iOS 17, every widget view must include a `.containerBackground(for: .widget)` modifier. Without it, the system shows a default background and logs a warning.
- **Network requests in the provider run on a short timer.** If your `getTimeline` makes network requests, they must complete quickly (under ~30 seconds). For longer operations, use background URLSessions and trigger timeline reloads when data arrives.
- **Live Activities require Info.plist key.** You must add `NSSupportsLiveActivities = YES` in your app's (not the extension's) Info.plist, or Live Activities silently fail to start.
- **Live Activity size limit.** Each ActivityKit update payload must be under 4 KB. The Live Activity itself can remain on screen for up to 8 hours on the Dynamic Island and 12 hours on the Lock Screen.
- **Lock Screen widgets use a limited color palette.** Accessory family widgets render in three modes: `vibrant` (iOS), `accented` (watchOS), and `fullColor` (watchOS only). Do not rely on custom colors in accessory widgets on iOS -- they will be tinted by the system.
- **Widget previews require Xcode 15+.** The `#Preview` macro for widgets was introduced in Xcode 15. Older preview syntax using `PreviewProvider` is still supported but deprecated.
- **`systemExtraLarge` is iPad-only.** The `.systemExtraLarge` widget family is only available on iPadOS 15+ and is not offered on iPhone.
- **Control widgets require iOS 18+.** `ControlWidget`, `ControlWidgetToggle`, and `ControlWidgetButton` are only available on iOS 18+. They must be backed by App Intents (`SetValueIntent` for toggles, `AppIntent` for buttons) and require an SF Symbol for their icon -- custom images are not supported.
- **`openAppWhenRun` intents must be in both targets.** When a `ControlConfigurationIntent` has `openAppWhenRun = true`, the intent struct must be compiled into both the widget extension and the main app target. If it only exists in the extension, the app will not launch. Place shared intents in a framework or add the file to both targets.
- **Control widget icons must be SF Symbols.** The `Label` in a `ControlWidgetToggle` or `ControlWidgetButton` must use an SF Symbol -- either a built-in system symbol via `systemImage:` or a custom SF Symbol (`.symbol` file) created from an SVG. Standard asset catalog images, UIImage, and remote images are not supported in control widgets.
