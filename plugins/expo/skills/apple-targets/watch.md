---
title: watchOS App
description: A standalone watchOS application target that runs natively on Apple Watch with SwiftUI, supporting complications, workout sessions, and phone connectivity.
version: watchOS 7.0+
---

# watchOS App (`watch`)

A watchOS app target creates a fully independent application that runs on Apple Watch. It uses the product type `com.apple.product-type.application` -- the same as any standard app, not an extension. Since watchOS 7, apps use the SwiftUI `@main` App lifecycle, replacing the legacy WKExtension/WKInterfaceController pattern. Modern watchOS apps are SwiftUI-first: they use `NavigationStack` for hierarchical navigation, `TabView` for paged layouts, and `List` for scrollable content driven by the Digital Crown. The companion iOS app is optional -- watchOS apps can be distributed independently through the App Store and can make their own network requests, store data locally, and access HealthKit, CoreLocation, and other on-device frameworks.

## Apple Documentation

- [Building a watchOS App](https://developer.apple.com/documentation/watchos-apps/building_a_watchos_app) -- primary guide for setting up the app lifecycle, creating the user interface, and managing scenes with SwiftUI.
- [Creating a watchOS App (SwiftUI Tutorial)](https://developer.apple.com/tutorials/swiftui/creating-a-watchos-app) -- hands-on tutorial adapting the Landmarks sample app for watchOS.
- [TN3157: Updating Your watchOS Project for SwiftUI and WidgetKit](https://developer.apple.com/documentation/technotes/tn3157-updating-your-watchos-project-for-swiftui-and-widgetkit) -- tech note covering migration from WatchKit storyboards to SwiftUI and from ClockKit to WidgetKit.
- [WCSession (Watch Connectivity)](https://developer.apple.com/documentation/watchconnectivity/wcsession) -- the singleton session object for bidirectional communication between the iOS app and the watchOS app.
- [WCSessionDelegate](https://developer.apple.com/documentation/watchconnectivity/wcsessiondelegate) -- delegate protocol for receiving messages, application context, and file transfers.
- [WKApplicationRefreshBackgroundTask](https://developer.apple.com/documentation/watchkit/wkapplicationrefreshbackgroundtask) -- background task for scheduling periodic data refreshes on watchOS.
- [watchOS App Planning](https://developer.apple.com/watchos/planning/) -- Apple's overview of design and development considerations for watchOS apps.

## WWDC History

- **[WWDC 2019, Session 208 -- Creating Independent Watch Apps](https://developer.apple.com/videos/play/wwdc2019/208/)** -- introduced watchOS 6 independent apps that no longer require a companion iOS app, with their own App Store presence and direct network access.
- **[WWDC 2019, Session 219 -- SwiftUI on watchOS](https://asciiwwdc.com/2019/sessions/219)** -- first look at building watchOS interfaces with SwiftUI, replacing WKInterfaceController and storyboards.
- **[WWDC 2020, Session 10048 -- Build Complications in SwiftUI](https://developer.apple.com/videos/play/wwdc2020/10048/)** -- introduced SwiftUI-based ClockKit graphic complications for Meridian, Infograph, and other watch faces in watchOS 7.
- **[WWDC 2020, Session 10171 -- What's New in watchOS Design](https://developer.apple.com/videos/play/wwdc2020/10171/)** -- design principles for watchOS 7 apps, including the SwiftUI App lifecycle and notification handling.
- **[WWDC 2022, Session 10050 -- Complications and Widgets: Reloaded](https://developer.apple.com/videos/play/wwdc2022/10050/)** -- unified WidgetKit across iOS and watchOS 9, replacing ClockKit with four accessory widget families.
- **[WWDC 2022, Session 10051 -- Go Further with Complications in WidgetKit](https://developer.apple.com/videos/play/wwdc2022/10051/)** -- watchOS-specific WidgetKit features, rendering modes (full color, accented, vibrant), and migration from ClockKit.
- **[WWDC 2023, Session 10138 -- Design and Build Apps for watchOS 10](https://developer.apple.com/videos/play/wwdc2023/10138/)** -- major redesign of the watchOS UI paradigm with vertically pageable `TabView`, the Smart Stack, and new NavigationSplitView patterns.

## What It Does

1. **System launches the app.** When the user taps the app icon on the watch Home Screen or receives a complication tap, watchOS instantiates the `@main` App struct and renders the initial `WindowGroup` scene.
2. **SwiftUI drives the UI.** The app presents views using `NavigationStack`, `TabView`, and `List`. The Digital Crown controls scrolling. Haptic feedback is provided via `WKInterfaceDevice.current().play()`.
3. **Complications surface data.** The app's WidgetKit extension (watchOS 9+) or ClockKit data source (legacy) provides timeline entries that the system renders on watch faces as complications, giving users at-a-glance information.
4. **Watch Connectivity syncs with iPhone.** `WCSession` enables real-time messaging (`sendMessage`), background transfers (`transferUserInfo`, `transferFile`), and application context (`updateApplicationContext`) between the watch and the paired iPhone.
5. **Background refresh keeps data current.** The app schedules `WKApplicationRefreshBackgroundTask` to wake periodically (budget: approximately one task per hour for dock apps) and fetch updated data.
6. **Workout sessions track activity.** Using `HKWorkoutSession` and `HKLiveWorkoutBuilder`, the app starts, pauses, and ends workout sessions with real-time heart rate, calories, and distance data from HealthKit.
7. **Notifications arrive on the wrist.** The app registers for remote and local notifications. Custom notification views built with SwiftUI replace the default system presentation.

## Use Cases

### Fitness and Workout Tracking
A running app starts an `HKWorkoutSession`, displays real-time heart rate and pace via HealthKit queries, and uses extended runtime sessions to keep the screen active. A complication on the watch face shows the weekly distance goal progress.

### Messaging and Communication
A chat app uses `WCSession.sendMessage` for real-time message relay when the iPhone is reachable, and falls back to `transferUserInfo` for queued delivery. Quick replies use the system text input controller with dictation, scribble, and emoji.

### Smart Home Control
A home automation app presents a list of devices with toggle controls. Tapping a complication on the watch face immediately opens the "lights" scene. Background refresh updates device status every 15 minutes so complications always show current state.

### Travel and Navigation
A transit app shows the next departure time as a complication using a relative date text style. The app uses CoreLocation for turn-by-turn haptic directions and `WKInterfaceDevice` haptics for left/right turn signals.

## Key Classes

| Class | Role |
|-------|------|
| `App` (SwiftUI) | The `@main` entry point for the watchOS app, declaring scenes via `WindowGroup`. |
| `NavigationStack` | Manages hierarchical navigation with push/pop semantics driven by the Digital Crown back gesture. |
| `TabView` | Provides paged or vertically scrollable tab navigation (watchOS 10+ uses vertical pages). |
| `WCSession` | Singleton for Watch Connectivity. Handles `sendMessage`, `updateApplicationContext`, `transferUserInfo`, and `transferFile`. |
| `WCSessionDelegate` | Delegate receiving messages, context updates, and file transfers from the companion iOS app. |
| `HKWorkoutSession` | Manages a workout session lifecycle (start, pause, resume, end) with automatic sensor activation. |
| `HKLiveWorkoutBuilder` | Collects real-time workout samples (heart rate, distance, calories) during an active session. |
| `WKApplicationRefreshBackgroundTask` | A background task the system delivers to refresh app data. Limited to ~1 per hour for dock apps. |
| `WKExtendedRuntimeSession` | Extends app runtime beyond normal limits for workouts, mindfulness, and physical therapy sessions. |
| `WidgetKit` (TimelineProvider) | Powers watch face complications on watchOS 9+ using the same WidgetKit API as iOS. |
| `CLLocationManager` | Provides location updates and authorization on Apple Watch. |
| `UNUserNotificationCenter` | Registers for and handles local and remote notifications on the watch. |

## Implementation

### Full watchOS App with Connectivity and Workout Session

```swift
import SwiftUI
import HealthKit
import WatchConnectivity

// 1. Define the main app entry point using the SwiftUI App lifecycle.
//    This replaces the legacy WKExtensionDelegate/WKInterfaceController pattern.
@main
struct FitnessWatchApp: App {
    @StateObject private var connectivityManager = ConnectivityManager()
    @StateObject private var workoutManager = WorkoutManager()

    var body: some Scene {
        WindowGroup {
            // 2. Use TabView for top-level navigation. On watchOS 10+,
            //    this renders as vertically pageable sections.
            TabView {
                DashboardView()
                    .environmentObject(workoutManager)
                    .tag("dashboard")

                WorkoutView()
                    .environmentObject(workoutManager)
                    .tag("workout")

                SettingsView()
                    .environmentObject(connectivityManager)
                    .tag("settings")
            }
            .tabViewStyle(.verticalPage)
        }
    }
}

// 3. ConnectivityManager wraps WCSession for bidirectional phone<->watch
//    communication. It must conform to WCSessionDelegate.
class ConnectivityManager: NSObject, ObservableObject, WCSessionDelegate {
    @Published var lastReceivedMessage: String = ""
    @Published var isReachable = false

    private var session: WCSession?

    override init() {
        super.init()
        // 4. Check if Watch Connectivity is supported on this device.
        //    It is always supported on Apple Watch but only supported on
        //    iPhone when paired with a watch.
        if WCSession.isSupported() {
            session = WCSession.default
            session?.delegate = self
            session?.activate()
        }
    }

    // 5. Required delegate method: called when activation completes.
    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        DispatchQueue.main.async {
            self.isReachable = session.isReachable
        }
    }

    // 6. Receive real-time messages from the iPhone app.
    //    sendMessage only works when both apps are reachable.
    func session(
        _ session: WCSession,
        didReceiveMessage message: [String: Any]
    ) {
        DispatchQueue.main.async {
            if let text = message["text"] as? String {
                self.lastReceivedMessage = text
            }
        }
    }

    // 7. Receive application context updates. Unlike sendMessage,
    //    application context is delivered even if the counterpart
    //    app was not running -- the system caches the latest context.
    func session(
        _ session: WCSession,
        didReceiveApplicationContext applicationContext: [String: Any]
    ) {
        DispatchQueue.main.async {
            if let text = applicationContext["status"] as? String {
                self.lastReceivedMessage = text
            }
        }
    }

    // 8. Send a message to the iPhone. The reply handler runs on a
    //    background thread; dispatch to main for UI updates.
    func sendMessageToPhone(_ data: [String: Any]) {
        guard let session, session.isReachable else {
            // 9. Fallback: use transferUserInfo for queued delivery
            //    when the phone is not immediately reachable.
            session?.transferUserInfo(data)
            return
        }

        session.sendMessage(data, replyHandler: { reply in
            DispatchQueue.main.async {
                if let response = reply["response"] as? String {
                    self.lastReceivedMessage = response
                }
            }
        }, errorHandler: { error in
            print("Send failed: \(error.localizedDescription)")
        })
    }
}

// 10. WorkoutManager handles HealthKit workout sessions with real-time
//     heart rate, calorie, and distance tracking.
class WorkoutManager: NSObject, ObservableObject, HKWorkoutSessionDelegate,
    HKLiveWorkoutBuilderDelegate
{
    @Published var isWorkoutActive = false
    @Published var heartRate: Double = 0
    @Published var activeCalories: Double = 0
    @Published var distance: Double = 0
    @Published var elapsedTime: TimeInterval = 0

    private let healthStore = HKHealthStore()
    private var workoutSession: HKWorkoutSession?
    private var workoutBuilder: HKLiveWorkoutBuilder?

    // 11. Request HealthKit authorization for the data types we need.
    func requestAuthorization() {
        let typesToShare: Set<HKSampleType> = [
            HKQuantityType.workoutType()
        ]
        let typesToRead: Set<HKObjectType> = [
            HKQuantityType(.heartRate),
            HKQuantityType(.activeEnergyBurned),
            HKQuantityType(.distanceWalkingRunning)
        ]

        healthStore.requestAuthorization(
            toShare: typesToShare,
            read: typesToRead
        ) { success, error in
            if let error {
                print("HealthKit auth failed: \(error.localizedDescription)")
            }
        }
    }

    // 12. Start a workout session with a specific activity type.
    func startWorkout(activityType: HKWorkoutActivityType = .running) {
        let configuration = HKWorkoutConfiguration()
        configuration.activityType = activityType
        configuration.locationType = .outdoor

        do {
            workoutSession = try HKWorkoutSession(
                healthStore: healthStore,
                configuration: configuration
            )
            workoutBuilder = workoutSession?.associatedWorkoutBuilder()

            workoutSession?.delegate = self
            workoutBuilder?.delegate = self

            // 13. Set the data source to collect live samples from
            //     Apple Watch sensors automatically.
            workoutBuilder?.dataSource = HKLiveWorkoutDataSource(
                healthStore: healthStore,
                workoutConfiguration: configuration
            )

            let startDate = Date()
            workoutSession?.startActivity(with: startDate)
            workoutBuilder?.beginCollection(withStart: startDate) { _, _ in }

            DispatchQueue.main.async {
                self.isWorkoutActive = true
            }
        } catch {
            print("Failed to start workout: \(error.localizedDescription)")
        }
    }

    // 14. End the workout and save it to HealthKit.
    func endWorkout() {
        workoutSession?.end()
        DispatchQueue.main.async {
            self.isWorkoutActive = false
        }
    }

    // MARK: - HKWorkoutSessionDelegate

    func workoutSession(
        _ workoutSession: HKWorkoutSession,
        didChangeTo toState: HKWorkoutSessionState,
        from fromState: HKWorkoutSessionState,
        date: Date
    ) {
        if toState == .ended {
            // 15. Finalize and save the workout when the session ends.
            workoutBuilder?.endCollection(withEnd: date) { _, _ in
                self.workoutBuilder?.finishWorkout { workout, error in
                    if let error {
                        print("Failed to save workout: \(error.localizedDescription)")
                    }
                }
            }
        }
    }

    func workoutSession(
        _ workoutSession: HKWorkoutSession,
        didFailWithError error: Error
    ) {
        print("Workout session error: \(error.localizedDescription)")
    }

    // MARK: - HKLiveWorkoutBuilderDelegate

    func workoutBuilderDidCollectEvent(
        _ workoutBuilder: HKLiveWorkoutBuilder
    ) {}

    func workoutBuilder(
        _ workoutBuilder: HKLiveWorkoutBuilder,
        didCollectDataOf collectedTypes: Set<HKSampleType>
    ) {
        // 16. Update published properties with the latest workout statistics
        //     so SwiftUI views refresh automatically.
        for type in collectedTypes {
            guard let quantityType = type as? HKQuantityType,
                  let statistics = workoutBuilder.statistics(for: quantityType)
            else { continue }

            DispatchQueue.main.async {
                switch quantityType {
                case HKQuantityType(.heartRate):
                    let bpm = statistics.mostRecentQuantity()?
                        .doubleValue(for: .count().unitDivided(by: .minute()))
                    self.heartRate = bpm ?? 0

                case HKQuantityType(.activeEnergyBurned):
                    let cal = statistics.sumQuantity()?
                        .doubleValue(for: .kilocalorie())
                    self.activeCalories = cal ?? 0

                case HKQuantityType(.distanceWalkingRunning):
                    let meters = statistics.sumQuantity()?
                        .doubleValue(for: .meter())
                    self.distance = (meters ?? 0) / 1000.0  // Convert to km

                default:
                    break
                }
            }
        }
    }
}

// 17. Dashboard view showing connectivity status and recent data.
struct DashboardView: View {
    @EnvironmentObject var workoutManager: WorkoutManager

    var body: some View {
        NavigationStack {
            List {
                Section("Today") {
                    HStack {
                        Image(systemName: "flame.fill")
                            .foregroundStyle(.orange)
                        Text("\(Int(workoutManager.activeCalories)) kcal")
                    }
                    HStack {
                        Image(systemName: "figure.run")
                            .foregroundStyle(.green)
                        Text(String(format: "%.1f km", workoutManager.distance))
                    }
                }
            }
            .navigationTitle("Fitness")
        }
    }
}

// 18. Workout view with start/stop controls and live metrics.
struct WorkoutView: View {
    @EnvironmentObject var workoutManager: WorkoutManager

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                if workoutManager.isWorkoutActive {
                    // 19. Live workout metrics update in real time via
                    //     the @Published properties on WorkoutManager.
                    VStack(spacing: 12) {
                        MetricView(
                            icon: "heart.fill",
                            value: "\(Int(workoutManager.heartRate))",
                            unit: "BPM",
                            color: .red
                        )
                        MetricView(
                            icon: "flame.fill",
                            value: "\(Int(workoutManager.activeCalories))",
                            unit: "kcal",
                            color: .orange
                        )
                        MetricView(
                            icon: "figure.run",
                            value: String(format: "%.2f", workoutManager.distance),
                            unit: "km",
                            color: .green
                        )
                    }

                    Button("End Workout", role: .destructive) {
                        workoutManager.endWorkout()
                    }
                } else {
                    Button {
                        workoutManager.requestAuthorization()
                        workoutManager.startWorkout()
                    } label: {
                        Label("Start Run", systemImage: "figure.run")
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.green)
                }
            }
            .navigationTitle("Workout")
        }
    }
}

struct MetricView: View {
    let icon: String
    let value: String
    let unit: String
    let color: Color

    var body: some View {
        HStack {
            Image(systemName: icon)
                .foregroundStyle(color)
                .frame(width: 24)
            Text(value)
                .font(.title2.monospacedDigit().bold())
            Text(unit)
                .font(.caption)
                .foregroundStyle(.secondary)
            Spacer()
        }
    }
}

struct SettingsView: View {
    @EnvironmentObject var connectivityManager: ConnectivityManager

    var body: some View {
        NavigationStack {
            List {
                Section("Phone Connection") {
                    HStack {
                        Circle()
                            .fill(connectivityManager.isReachable ? .green : .red)
                            .frame(width: 8, height: 8)
                        Text(
                            connectivityManager.isReachable
                                ? "Connected" : "Not Reachable"
                        )
                    }
                }

                Section("Sync") {
                    Button("Send Status to Phone") {
                        connectivityManager.sendMessageToPhone([
                            "status": "active",
                            "heartRate": 72,
                        ])
                    }
                }
            }
            .navigationTitle("Settings")
        }
    }
}
```

## Usage

- Create: `bun create target watch`
- Edit: `targets/watch/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| watchOS | 7.0+ | SwiftUI App lifecycle (`@main`). Storyboards deprecated. Independent app distribution since watchOS 6. |
| watchOS | 9.0+ | WidgetKit complications replace ClockKit. Four accessory families: circular, rectangular, inline, corner. |
| watchOS | 10.0+ | Redesigned UI with vertical `TabView` paging, Smart Stack, and new NavigationSplitView patterns. |
| iOS | -- | The companion iOS app is optional. If present, use WatchConnectivity for data sync. |

## Gotchas

- **WatchKit storyboards are deprecated since watchOS 7.** All new watchOS apps must use the SwiftUI `@main` App lifecycle. The legacy `WKExtensionDelegate` and `WKInterfaceController` APIs still work but receive no new features.
- **WCSession requires both a delegate and activation.** Activating a `WCSession` without setting a delegate first is a programming error. Always set the delegate before calling `activate()`, and do so early in the app lifecycle.
- **`sendMessage` requires reachability.** Real-time messaging only works when both the watch and phone apps are active (the phone app can be woken in the background). Always check `session.isReachable` and fall back to `transferUserInfo` or `updateApplicationContext` for non-urgent data.
- **Background refresh budget is limited.** Dock apps get approximately one `WKApplicationRefreshBackgroundTask` per hour. Apps with an active complication on the watch face get a higher budget. Apps not in the dock or on a watch face receive no regular background time.
- **Background tasks have strict time limits.** A `WKApplicationRefreshBackgroundTask` gives your app 4 seconds of CPU time and 15 seconds of wall-clock time. Use `WKURLSessionRefreshBackgroundTask` with background `URLSession` download tasks for network requests -- the system suspends your app during the download and re-wakes it when data arrives.
- **File protection blocks background access.** Files created with the default complete protection level are inaccessible when the watch screen is locked. Background tasks run while locked, so any files you need to read or write during a background task must use `.noFileProtection` or `.completeUntilFirstUserAuthentication`.
- **HealthKit authorization is per-device.** The user must grant HealthKit permissions directly on the Apple Watch. You cannot request HealthKit authorization from the iPhone on behalf of the watch app.
- **ClockKit is fully replaced by WidgetKit on watchOS 9+.** New complications must use WidgetKit's `TimelineProvider` and accessory widget families. ClockKit complications still work on older watch faces but cannot be added to new faces.
- **Only `plist`-encodable types in WCSession messages.** The `[String: Any]` dictionaries sent via `sendMessage` and `transferUserInfo` only support property list types (String, Int, Double, Data, Array, Dictionary, Date, Bool). Encode custom types to `Data` before sending.
- **The watchOS Simulator does not support all sensors.** Heart rate, accelerometer, and gyroscope data are unavailable in the Simulator. Test workout and motion features on a physical Apple Watch.
- **Independent apps still need an iOS companion for some features.** While watchOS apps can be fully independent, features like `WCSession` communication, handoff, and some CloudKit sync patterns require the paired iPhone app to be installed.
