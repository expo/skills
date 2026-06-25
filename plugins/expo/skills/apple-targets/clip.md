---
title: App Clip
description: A lightweight, instantly launchable subset of your app triggered by NFC tags, QR codes, App Clip Codes, Safari banners, Maps, and Messages links.
version: iOS 14.0+
---

# App Clip (`clip`)

An App Clip is a small, focused part of your full app that users can discover and launch instantly without installing anything from the App Store. It uses the product type `com.apple.product-type.application.on-demand-install-capable` and is NOT an extension -- it is a fully functional application target with size constraints. App Clips are triggered by real-world invocations (NFC tags, QR codes, App Clip Codes) and digital invocations (Safari App Clip banners, Messages links, Maps place cards). The system downloads the App Clip on demand, runs it, and automatically removes it after a period of inactivity. App Clips share code and assets with the full app via shared targets, and transfer user data to the full app through App Groups and shared Keychain access groups.

## Apple Documentation

- [App Clips Framework Overview](https://developer.apple.com/documentation/appclip) -- top-level framework reference covering the App Clip lifecycle, invocation handling, and available APIs.
- [Creating an App Clip with Xcode](https://developer.apple.com/documentation/appclip/creating-an-app-clip-with-xcode) -- step-by-step guide for adding an App Clip target, sharing code with the full app, and configuring build settings.
- [Configuring App Clip Experiences](https://developer.apple.com/documentation/appclip/configuring-the-launch-experience-of-your-app-clip) -- how to register invocation URLs in App Store Connect, set up App Clip cards, and configure advanced and default experiences.
- [Choosing the Right Functionality for Your App Clip](https://developer.apple.com/documentation/appclip/choosing-the-right-functionality-for-your-app-clip) -- guidance on which frameworks are available, size budgets, and what makes a great App Clip experience.
- [Testing the Launch Experience of Your App Clip](https://developer.apple.com/documentation/appclip/testing-the-launch-experience-of-your-app-clip) -- how to use `_XCAppClipURL`, local experiences in Developer Settings, and TestFlight for testing invocations.
- [Enabling Notifications in App Clips](https://developer.apple.com/documentation/appclip/enabling-notifications-in-app-clips) -- ephemeral notification permissions and how to request them.

## WWDC History

- **[WWDC 2020, Session 10174 -- Explore App Clips](https://developer.apple.com/videos/play/wwdc2020/10174/)** -- introduced the App Clip concept, design principles for short and fast interactions, and discovery surfaces (NFC, QR, Safari banners, Maps).
- **[WWDC 2020, Session 10146 -- Configure and Link Your App Clips](https://developer.apple.com/videos/play/wwdc2020/10146/)** -- covered associated domains, invocation URL configuration in App Store Connect, App Clip Codes, and web banner integration.
- **[WWDC 2020, Session 10120 -- Streamline Your App Clip](https://developer.apple.com/videos/play/wwdc2020/10120/)** -- best practices for transaction flows, ephemeral notifications, one-time location confirmation, and migrating data to the full app.
- **[WWDC 2020, Session 10118 -- Create App Clips for Other Businesses](https://developer.apple.com/videos/play/wwdc2020/10118/)** -- advanced App Clip experiences on behalf of third-party businesses, multi-experience configuration, and per-business App Clip cards.
- **[WWDC 2021, Session 10012 -- What's New in App Clips](https://developer.apple.com/videos/play/wwdc2021/10012/)** -- App Clip Codes as AR anchors, local testing improvements, and Safari/SafariViewController App Clip card support.
- **[WWDC 2022, Session 10097 -- What's New in App Clips](https://developer.apple.com/videos/play/wwdc2022/10097/)** -- diagnostics tools, CloudKit public database read access, and size limit increase to 15 MB for physical invocations.
- **[WWDC 2023, Session 10178 -- What's New in App Clips](https://developer.apple.com/videos/play/wwdc2023/10178/)** -- default App Clip links (iOS 16.4+), 50 MB size limit for digital invocations (iOS 17+), and cross-app invocation.

## What It Does

1. **User encounters an invocation.** A person taps an NFC tag, scans a QR code or App Clip Code, taps a Safari App Clip banner, opens a Maps place card, or taps a link in Messages.
2. **System shows the App Clip card.** iOS displays a system-provided card with the App Clip name, icon, subtitle, and action button. The card is configured in App Store Connect under App Clip Experiences.
3. **App Clip downloads and launches.** The system downloads the App Clip binary (subject to size limits) and launches it, passing the invocation URL as an `NSUserActivity` with activity type `NSUserActivityTypeBrowsingWeb`.
4. **App Clip parses the URL.** The App Clip extracts path components and query parameters from the invocation URL to determine what experience to show (e.g., which restaurant, which parking meter).
5. **User completes a focused task.** The App Clip presents a streamlined flow -- ordering food, renting a scooter, paying for parking -- using Apple Pay, Sign in with Apple, and other quick-interaction APIs.
6. **Ephemeral notifications fire (optional).** If `NSAppClipRequestEphemeralUserNotification` is enabled and the user granted permission on the App Clip card, the App Clip can send push notifications for up to 8 hours after each launch without prompting.
7. **Location confirmation completes (optional).** If `NSAppClipRequestLocationConfirmation` is enabled, the system shows a one-time confirmation dialog verifying the user is at the expected physical location.
8. **Data migrates to the full app.** When the user installs the full app, shared App Group containers and shared Keychain items make all saved data (credentials, preferences, order history) immediately available.
9. **System removes the App Clip.** After a period of inactivity, iOS automatically deletes the App Clip and its non-shared data.

## Use Cases

### Restaurant Ordering
A diner scans an NFC tag embedded in the table. The App Clip launches showing that table's menu, allows the user to customize an order, and completes payment with Apple Pay -- all without installing the full app.

### Bike and Scooter Rental
A user scans a QR code on a rental scooter. The App Clip authenticates via Sign in with Apple, unlocks the scooter, and starts a ride timer. Ephemeral notifications alert the user about ride duration and cost.

### Parking Meter Payment
A driver taps an App Clip Code on a parking meter. The App Clip uses one-time location confirmation to verify the correct meter, then processes payment. A notification reminds the driver before time expires.

### Game Demo
A user taps a link in Messages. The App Clip downloads as a playable demo (up to 50 MB for digital invocations on iOS 17+). Progress and achievements transfer to the full game via shared App Group storage.

## Key Classes

| Class | Role |
|-------|------|
| `NSUserActivity` | Carries the invocation URL to the App Clip at launch. Activity type is `NSUserActivityTypeBrowsingWeb`. |
| `CLLocationManager` | Used for one-time location verification when `NSAppClipRequestLocationConfirmation` is enabled. |
| `ASAuthorizationController` | Provides Sign in with Apple for quick, privacy-preserving authentication. |
| `PKPaymentAuthorizationController` | Handles Apple Pay transactions for fast checkout flows. |
| `UNUserNotificationCenter` | Manages ephemeral and standard notification registration. |
| `SKOverlay` | Presents a system-provided banner recommending the full app for download. |
| `ASWebAuthenticationSession` | Handles OAuth/federated sign-in callbacks without registering custom URL schemes. |

## Implementation

### SwiftUI App Clip with Invocation URL Handling

```swift
import SwiftUI
import AppClip
import StoreKit

// 1. Define the main App Clip entry point using the SwiftUI App lifecycle.
@main
struct OrderingClipApp: App {
    @StateObject private var orderManager = OrderManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(orderManager)
                // 2. Handle the invocation URL when the App Clip launches or
                //    returns to foreground via a new invocation.
                .onContinueUserActivity(
                    NSUserActivityTypeBrowsingWeb,
                    perform: handleUserActivity
                )
        }
    }

    func handleUserActivity(_ userActivity: NSUserActivity) {
        // 3. Extract the invocation URL. In Xcode testing, this comes from
        //    the _XCAppClipURL environment variable.
        guard let incomingURL = userActivity.webpageURL,
              let components = URLComponents(url: incomingURL, resolvingAgainstBaseURL: true)
        else { return }

        // 4. Parse path and query parameters to determine the experience.
        //    e.g., https://example.com/order?restaurant=42&table=7
        if let restaurantId = components.queryItems?.first(where: {
            $0.name == "restaurant"
        })?.value {
            orderManager.loadRestaurant(id: restaurantId)
        }

        if let tableId = components.queryItems?.first(where: {
            $0.name == "table"
        })?.value {
            orderManager.setTable(id: tableId)
        }

        // 5. Optionally verify the user's location against the expected
        //    business location (requires NSAppClipRequestLocationConfirmation).
        verifyLocation(for: incomingURL)
    }

    func verifyLocation(for url: URL) {
        // 6. The system handles the location confirmation dialog automatically
        //    when the key is set in Info.plist. You can check the result:
        guard let payload = try? AppClipActivationPayload(url: url) else { return }

        let region = CLCircularRegion(
            center: CLLocationCoordinate2D(latitude: 37.7749, longitude: -122.4194),
            radius: 100,
            identifier: "restaurant-location"
        )

        Task {
            do {
                try await payload.confirmAcquired(in: region)
                orderManager.locationVerified = true
            } catch {
                orderManager.locationVerified = false
            }
        }
    }
}

// 7. The order manager stores state in an App Group so the full app
//    can access it after installation.
class OrderManager: ObservableObject {
    @Published var restaurantName: String = ""
    @Published var tableId: String = ""
    @Published var locationVerified = false
    @Published var items: [MenuItem] = []

    private let defaults = UserDefaults(
        suiteName: "group.com.example.ordering"
    )

    func loadRestaurant(id: String) {
        // Fetch restaurant details from your API.
        restaurantName = "Restaurant \(id)"
    }

    func setTable(id: String) {
        tableId = id
        // 8. Persist to shared App Group so the full app can read it.
        defaults?.set(id, forKey: "lastTableId")
    }

    func saveOrderHistory(_ order: Order) {
        // 9. Write order data to the shared container for migration.
        guard let url = FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: "group.com.example.ordering")?
            .appendingPathComponent("orders.json")
        else { return }

        let encoder = JSONEncoder()
        if let data = try? encoder.encode(order) {
            try? data.write(to: url, options: .atomic)
        }
    }
}

struct MenuItem: Identifiable, Codable {
    let id: String
    let name: String
    let price: Decimal
}

struct Order: Codable {
    let items: [MenuItem]
    let total: Decimal
    let date: Date
}

// 10. Main content view with menu, cart, and a banner prompting full app install.
struct ContentView: View {
    @EnvironmentObject var orderManager: OrderManager

    var body: some View {
        NavigationStack {
            VStack {
                if orderManager.restaurantName.isEmpty {
                    ProgressView("Loading...")
                } else {
                    Text(orderManager.restaurantName)
                        .font(.largeTitle.bold())
                    Text("Table \(orderManager.tableId)")
                        .font(.headline)
                        .foregroundStyle(.secondary)

                    List(orderManager.items) { item in
                        HStack {
                            Text(item.name)
                            Spacer()
                            Text(item.price, format: .currency(code: "USD"))
                        }
                    }

                    Button("Pay with Apple Pay") {
                        // 11. Integrate PKPaymentAuthorizationController here
                        //     for a fast, focused checkout.
                    }
                    .buttonStyle(.borderedProminent)
                    .padding()
                }
            }
            .toolbar {
                ToolbarItem(placement: .bottomBar) {
                    // 12. Show the App Store overlay to encourage full app install.
                    //     The overlay appears as a banner at the bottom of the screen.
                    AppStoreOverlayButton()
                }
            }
        }
    }
}

struct AppStoreOverlayButton: View {
    @State private var showOverlay = false

    var body: some View {
        Button("Get the Full App") {
            showOverlay = true
        }
        .appStoreOverlay(isPresented: $showOverlay) {
            // 13. Use your full app's Apple ID from App Store Connect.
            SKOverlay.AppClipConfiguration(position: .bottom)
        }
    }
}

// 14. Register for ephemeral notifications on launch.
//     Call this from your App's init or onAppear.
func requestEphemeralNotifications() {
    let center = UNUserNotificationCenter.current()
    center.getNotificationSettings { settings in
        // 15. If ephemeral is already granted (from the App Clip card),
        //     skip the prompt entirely.
        if settings.authorizationStatus == .ephemeral {
            print("Ephemeral notifications granted for 8 hours.")
            return
        }
        // 16. Otherwise, request standard authorization as a fallback.
        center.requestAuthorization(options: [.alert, .sound]) { granted, error in
            if granted {
                DispatchQueue.main.async {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
        }
    }
}
```

## Usage

- Create: `bun create target clip`
- Edit: `targets/clip/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| iOS | 14.0+ | Full App Clip support. Size limit: 10 MB (iOS 14-15), 15 MB for physical invocations (iOS 16+), 50 MB for digital invocations (iOS 17+). |
| iPadOS | 14.0+ | Supported. Same size limits as iOS. |
| macOS | -- | Not supported. App Clips are iOS/iPadOS only. |
| watchOS | -- | Not supported. |
| tvOS | -- | Not supported. |
| visionOS | -- | Not supported. |

## Gotchas

- **Size limits depend on invocation type and OS version.** Physical invocations (NFC, App Clip Codes) are capped at 15 MB (iOS 16+). Digital invocations (Safari, Messages, Maps) allow up to 50 MB but only on iOS 17+ with a deployment target of iOS 17. The size is measured as the uncompressed binary -- use `app-thinning-size-report.txt` from your App Store archive to verify.
- **App Clips cannot register URL schemes or Universal Links.** They receive invocation URLs through `NSUserActivity`, not through the standard `openURL` flow. Use `ASWebAuthenticationSession` for OAuth callbacks.
- **Ephemeral notifications expire after 8 hours per launch.** Each time the App Clip is opened, the 8-hour window resets. After that, notifications stop unless the user explicitly grants standard notification permission.
- **Data is deleted on inactivity.** The system removes the App Clip and its non-shared data after approximately 30 days of inactivity. Always store important data in a shared App Group container or Keychain access group so the full app can access it.
- **`_XCAppClipURL` does not work in UI tests.** The environment variable correctly passes the invocation URL when running the App Clip scheme normally, but `NSUserActivity` is not delivered during XCUITest execution. Use a separate test-only environment variable as a workaround.
- **Location confirmation is one-time per session.** The `confirmAcquired(in:)` call presents a system dialog once. If the user denies it or the location check fails, you cannot re-prompt in the same session.
- **CloudKit access is read-only.** Since iOS 16, App Clips can read from a CloudKit public database but cannot write to CloudKit or use cloud documents and key-value stores.
- **App Group container must match.** The App Clip's App Group identifier must exactly match the full app's identifier. Mismatches silently prevent data sharing. Configure this in the `expo-target.config.js` entitlements.
- **No background execution modes.** App Clips cannot register for most background modes (background fetch, background processing, etc.). They are designed for foreground-only, short-lived interactions.
- **Parent Application Identifiers entitlement is required.** The App Clip must include the `com.apple.developer.parent-application-identifiers` entitlement pointing to the full app's bundle identifier. The `@bacons/apple-targets` plugin configures this automatically.
