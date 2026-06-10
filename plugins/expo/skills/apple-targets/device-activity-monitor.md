---
title: Device Activity Monitor Extension
description: Runs code in response to device activity schedule intervals starting or ending and usage thresholds being reached, enabling parental controls and digital wellbeing features without a visible UI.
version: iOS 15.0+
---

# Device Activity Monitor Extension (`device-activity-monitor`)

A Device Activity Monitor extension executes code when a `DeviceActivitySchedule` interval starts or ends, or when a monitored app or category reaches a usage threshold. It is one of three extension types in Apple's Screen Time API suite (alongside Shield Action and Shield Configuration) and requires the Family Controls entitlement. The extension runs entirely in the background with no user interface -- it typically responds to events by updating `ManagedSettingsStore` shields, writing to shared storage via App Groups, or triggering notifications. The host app schedules monitoring via `DeviceActivityCenter`, and the system invokes the extension's callbacks even when the app is not running.

## Apple Documentation

- [DeviceActivity Framework Overview](https://developer.apple.com/documentation/deviceactivity)
- [DeviceActivityMonitor](https://developer.apple.com/documentation/deviceactivity/deviceactivitymonitor)
- [DeviceActivityCenter](https://developer.apple.com/documentation/deviceactivity/deviceactivitycenter)
- [DeviceActivitySchedule](https://developer.apple.com/documentation/deviceactivity/deviceactivityschedule)
- [DeviceActivityEvent](https://developer.apple.com/documentation/deviceactivity/deviceactivityevent)
- [FamilyControls Framework](https://developer.apple.com/documentation/familycontrols)
- [ManagedSettings Framework](https://developer.apple.com/documentation/managedsettings)

## WWDC History

- **[WWDC 2021, Session 10123 -- Meet the Screen Time API](https://developer.apple.com/videos/play/wwdc2021/10123/)** -- Introduced the three Screen Time frameworks (FamilyControls, ManagedSettings, DeviceActivity) and the Device Activity Monitor extension for schedule-based and threshold-based callbacks.
- **[WWDC 2022, Session 110336 -- What's New in Screen Time API](https://developer.apple.com/videos/play/wwdc2022/110336/)** -- Added individual (non-child) authorization via `AuthorizationCenter.shared.requestAuthorization(for: .individual)`, enabling digital wellbeing apps for adults. Renamed `ShieldConfigurationProvider` to `ShieldConfigurationDataSource` and `ShieldActionHandler` to `ShieldActionDelegate`.

## What It Does

1. **Host app schedules monitoring.** Your app calls `DeviceActivityCenter().startMonitoring(_:during:events:)` with a named activity, a `DeviceActivitySchedule` defining the time window, and optional `DeviceActivityEvent` entries that specify usage thresholds for specific apps or categories.
2. **System launches the extension.** When the schedule interval begins, the system launches your extension process and calls `intervalDidStart(for:)`.
3. **Threshold callbacks fire.** If a monitored app or category accumulates usage that hits an event threshold, the system calls `eventDidReachThreshold(_:activity:)`.
4. **Interval ends.** When the schedule's end time arrives, the system calls `intervalDidEnd(for:)`.
5. **Warning callbacks (optional).** If the schedule includes a `warningTime`, the system calls `intervalWillStartWarning(for:)` or `intervalWillEndWarning(for:)` shortly before the boundary. Similarly, `eventWillReachThresholdWarning` fires before a threshold is hit.
6. **Extension responds.** The extension typically updates a `ManagedSettingsStore` to apply or remove shields, writes state to App Group shared storage, or posts a local notification.

## Use Cases

### Parental controls

A guardian authorizes the app via `AuthorizationCenter.shared.requestAuthorization(for: .child)`. The app lets the guardian pick apps and time limits using `FamilyActivityPicker`. A schedule is set for school hours, and when the interval starts the extension shields the selected apps via `ManagedSettingsStore`. When the interval ends, the extension clears the shields.

### Digital wellbeing for adults

Using individual authorization (iOS 16+), a user sets their own focus schedule. The extension monitors social media usage and applies a shield when cumulative usage crosses a 30-minute threshold, encouraging the user to take a break.

### Enterprise device management

A corporate MDM companion app schedules work-hour monitoring. During work hours the extension shields entertainment apps. Outside work hours, shields are lifted automatically via `intervalDidEnd`.

## Key Classes

| Class / Protocol | Role |
|------------------|------|
| `DeviceActivityMonitor` | Base class for the extension's principal class. Override its callback methods to respond to schedule and threshold events. |
| `DeviceActivityCenter` | Used by the host app to start and stop monitoring named activities. |
| `DeviceActivitySchedule` | Defines a repeating time window (start `DateComponents`, end `DateComponents`, optional `warningTime`). |
| `DeviceActivityEvent` | Pairs an `FamilyActivitySelection` (apps/categories) with a usage threshold `DateComponents`. |
| `DeviceActivityName` | A `RawRepresentable<String>` that uniquely identifies a monitored activity. |
| `DeviceActivityEvent.Name` | Identifies a specific threshold event within an activity. |
| `ManagedSettingsStore` | Reads and writes managed settings (shields, restrictions). Used inside the extension to apply or clear shields. |
| `AuthorizationCenter` | Requests Family Controls authorization (`.child` or `.individual`). |

## Implementation

```swift
import DeviceActivity
import ManagedSettings

// 1. Subclass DeviceActivityMonitor. The class name must match the
//    NSExtensionPrincipalClass value in Info.plist.
class DeviceActivityMonitorExtension: DeviceActivityMonitor {

    let store = ManagedSettingsStore()

    // 2. Called when the scheduled interval begins (e.g., "school hours start").
    //    Apply shields to the apps the guardian selected.
    override func intervalDidStart(for activity: DeviceActivityName) {
        super.intervalDidStart(for: activity)

        let selection = SharedDataStore.loadSelection()
        let appTokens = selection.applicationTokens
        let categoryTokens = selection.categoryTokens

        store.shield.applications = appTokens.isEmpty ? nil : appTokens
        store.shield.applicationCategories = categoryTokens.isEmpty
            ? nil
            : .specific(categoryTokens)
    }

    // 3. Called when the scheduled interval ends. Remove all shields.
    override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity)

        store.shield.applications = nil
        store.shield.applicationCategories = nil
        store.clearAllSettings()
    }

    // 4. Called when cumulative usage for a monitored event crosses its threshold.
    //    For example, "30 minutes of social media" reached.
    override func eventDidReachThreshold(
        _ event: DeviceActivityEvent.Name,
        activity: DeviceActivityName
    ) {
        super.eventDidReachThreshold(event, activity: activity)

        // Apply shields to all apps in the selection when the threshold hits.
        let selection = SharedDataStore.loadSelection()
        store.shield.applications = selection.applicationTokens.isEmpty
            ? nil
            : selection.applicationTokens
    }

    // 5. Optional: warn the user a few minutes before the interval ends.
    override func intervalWillEndWarning(for activity: DeviceActivityName) {
        super.intervalWillEndWarning(for: activity)
        // Post a local notification, update shared state, etc.
    }

    // 6. Optional: warn before a threshold is reached.
    override func eventWillReachThresholdWarning(
        _ event: DeviceActivityEvent.Name,
        activity: DeviceActivityName
    ) {
        super.eventWillReachThresholdWarning(event, activity: activity)
    }
}
```

## Usage

- Create: `bun create target device-activity-monitor`
- Edit: `targets/device-activity-monitor/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| iOS | 15.0+ | Full support. Individual authorization added in 16.0+. |
| iPadOS | 15.0+ | Same as iOS. |
| macOS | -- | Not supported. Screen Time API is iOS/iPadOS only. |
| watchOS | -- | Not supported. |
| visionOS | -- | Not supported. |
| tvOS | -- | Not supported. |

## Gotchas

- **Hard 6 MB memory limit.** The extension process is capped at approximately 5-6 MB of memory. Exceeding this causes immediate termination (Jetsam crash). Avoid loading images, large data structures, or heavyweight frameworks. Keep work minimal and write results to disk.
- **No UI of any kind.** The extension cannot present views, alerts, or SwiftUI content. It runs headless. If you need to show UI in response to an event, update `ManagedSettingsStore` shields (which the system renders) or write data that a Shield Configuration extension reads.
- **Minimum 15-minute schedule intervals.** The `DeviceActivitySchedule` requires at least 15 minutes between start and end. Shorter intervals are silently ignored. This makes rapid iteration during development tedious.
- **Must test on a physical device.** The iOS Simulator does not track device activity or fire schedule callbacks. You need a real device with a valid Apple ID.
- **`print()` and breakpoints do not work by default.** The extension runs in a separate process. To debug, attach to the extension process explicitly in Xcode (Debug > Attach to Process) and check the Console app for log output.
- **App Group is required for shared data.** The extension and host app run in different sandboxes. Use `UserDefaults(suiteName:)` or a shared App Group container to exchange data such as `FamilyActivitySelection` tokens.
- **Family Controls entitlement requires Apple approval.** You must request the `com.apple.developer.family-controls` entitlement through Apple's developer portal. Without approval, the entitlement works only in development builds and cannot be distributed via TestFlight or the App Store.
- **`intervalDidEnd` is not guaranteed to fire on time.** If the device is locked, in standby, or powered off, the callback fires when the device wakes. Do not rely on exact timing for critical logic.
- **Tokens are opaque and process-bound.** `ApplicationToken` and `ActivityCategoryToken` values from `FamilyActivitySelection` are opaque. They cannot be serialized into human-readable app names. Share them between app and extension via `Codable` in App Group storage.
- **Only one schedule per `DeviceActivityName`.** Calling `startMonitoring` with the same name replaces the previous schedule. Use distinct names if you need concurrent schedules (e.g., `"school-hours"` and `"bedtime"`).
