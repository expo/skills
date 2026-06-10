---
title: Shield Configuration Extension
description: Customizes the appearance of the Screen Time shield overlay by providing titles, subtitles, icons, button labels, and colors for shielded apps and websites.
version: iOS 15.0+
---

# Shield Configuration Extension (`shield-config`)

A Shield Configuration extension controls the visual appearance of the Screen Time shield overlay. When `ManagedSettingsStore` shields an app, website, or activity category, the system asks this extension for a `ShieldConfiguration` describing the title, subtitle, icon, button labels, button colors, and background color to display. The extension subclasses `ShieldConfigurationDataSource` (not a view controller) and overrides `configuration(shielding:)` methods for applications, web domains, and their category variants. It is one of three extension types in Apple's Screen Time API suite (alongside Device Activity Monitor and Shield Action) and requires the Family Controls entitlement.

## Apple Documentation

- [ShieldConfigurationDataSource](https://developer.apple.com/documentation/managedsettingsui/shieldconfigurationdatasource)
- [ShieldConfiguration](https://developer.apple.com/documentation/managedsettingsui/shieldconfiguration)
- [ShieldConfiguration.Label](https://developer.apple.com/documentation/managedsettingsui/shieldconfiguration/label)
- [configuration(shielding:) -- Application](https://developer.apple.com/documentation/managedsettingsui/shieldconfigurationdatasource/configuration(shielding:)-5uqm1)
- [configuration(shielding:in:) -- Application in Category](https://developer.apple.com/documentation/managedsettingsui/shieldconfigurationdatasource/configuration(shielding:in:)-7mqr5)
- [configuration(shielding:) -- WebDomain](https://developer.apple.com/documentation/managedsettingsui/shieldconfigurationdatasource/configuration(shielding:)-98nkb)
- [configuration(shielding:in:) -- WebDomain in Category](https://developer.apple.com/documentation/managedsettingsui/shieldconfigurationdatasource/configuration(shielding:in:)-5moeh)
- [ManagedSettingsUI Framework](https://developer.apple.com/documentation/managedsettingsui)

## WWDC History

- **[WWDC 2021, Session 10123 -- Meet the Screen Time API](https://developer.apple.com/videos/play/wwdc2021/10123/)** -- Introduced the Screen Time API and the shield configuration provider (originally `ShieldConfigurationProvider`) for customizing the shield overlay's text, icon, and colors.
- **[WWDC 2022, Session 110336 -- What's New in Screen Time API](https://developer.apple.com/videos/play/wwdc2022/110336/)** -- Renamed `ShieldConfigurationProvider` to `ShieldConfigurationDataSource`. Added individual authorization. Clarified the extension architecture and data flow.

## What It Does

1. **Shield is about to appear.** When `ManagedSettingsStore` contains shield entries for applications or categories, the system prepares to display the shield overlay.
2. **System queries the extension.** The system launches the Shield Configuration extension and calls the appropriate `configuration(shielding:)` overload based on whether the shielded item is an individual application, a web domain, or a category member.
3. **Extension returns a `ShieldConfiguration`.** The configuration object includes optional properties: `title`, `subtitle`, `icon`, `primaryButtonLabel`, `primaryButtonBackgroundColor`, `secondaryButtonLabel`, `backgroundColor`, and `backgroundBlurStyle`.
4. **System renders the overlay.** The system uses the returned configuration to render a full-screen shield. Properties set to `nil` use system defaults (for `title` and `primaryButtonLabel`) or are hidden (for `secondaryButtonLabel` and `icon`).
5. **Button taps go to the Shield Action extension.** The labels defined here determine what the user sees, but the behavior when tapped is handled by the separate Shield Action extension.

## Use Cases

### Branded parental controls

A parental controls app customizes the shield to match its brand. The title says "Time's Up!", the subtitle shows the app name, the icon is the app's logo, the primary button reads "Close App", and the secondary button reads "Ask Parent". Colors match the app's theme.

### Motivational digital wellbeing

A focus app displays an encouraging message when a social media app is shielded. The title reads "Stay Focused", the subtitle shows how much focus time remains, and only a primary "Got It" button is shown (secondary label is nil to hide the second button).

### Context-aware messaging

The extension reads from App Group shared storage to display different messages depending on the time of day, the specific app being shielded, or how many times the user has hit the shield today. Since tokens are opaque, context is typically passed via shared UserDefaults rather than by identifying the app directly.

## Key Classes

| Class / Protocol | Role |
|------------------|------|
| `ShieldConfigurationDataSource` | Base class for the extension's principal class. Override `configuration(shielding:)` methods to customize shield appearance. Not a view controller. |
| `ShieldConfiguration` | Data object describing the shield's visual properties: title, subtitle, icon, button labels, colors, and blur style. |
| `ShieldConfiguration.Label` | A struct pairing a localized `text` string with an optional `color` (`UIColor`). Used for title, subtitle, and button labels. |
| `Application` | Represents a shielded application. Provided by the system to the `configuration(shielding:)` method. |
| `WebDomain` | Represents a shielded web domain. Provided by the system to the `configuration(shielding:)` method. |
| `ActivityCategory` | Represents an activity category. Provided to the `configuration(shielding:in:)` variant. |

## Implementation

```swift
import ManagedSettings
import ManagedSettingsUI
import UIKit

// 1. Subclass ShieldConfigurationDataSource (NOT a UIViewController).
//    The class name must match the NSExtensionPrincipalClass in Info.plist.
class ShieldConfigurationExtension: ShieldConfigurationDataSource {

    // 2. Customize the shield for an individually shielded application.
    override func configuration(
        shielding application: Application
    ) -> ShieldConfiguration {
        return ShieldConfiguration(
            // 3. Set the background color and blur style.
            backgroundBlurStyle: .systemMaterial,
            backgroundColor: UIColor.systemBackground,

            // 4. Provide a custom icon (use a bundled PNG, not a PDF).
            icon: UIImage(named: "ShieldIcon"),

            // 5. Set title and subtitle with text and color.
            title: ShieldConfiguration.Label(
                text: "Time's Up!",
                color: .label
            ),
            subtitle: ShieldConfiguration.Label(
                text: "You've reached your screen time limit.",
                color: .secondaryLabel
            ),

            // 6. Configure button labels. Setting secondaryButtonLabel
            //    to nil hides the secondary button entirely.
            primaryButtonLabel: ShieldConfiguration.Label(
                text: "Close App",
                color: .white
            ),
            primaryButtonBackgroundColor: .systemBlue,
            secondaryButtonLabel: ShieldConfiguration.Label(
                text: "Ask for More Time",
                color: .systemBlue
            )
        )
    }

    // 7. Customize the shield for an application shielded as part of a category.
    override func configuration(
        shielding application: Application,
        in category: ActivityCategory
    ) -> ShieldConfiguration {
        // 8. Read shared state to provide context-aware messaging.
        let defaults = UserDefaults(suiteName: "group.com.example.myapp")
        let dismissCount = defaults?.integer(forKey: "shieldDismissCount") ?? 0

        return ShieldConfiguration(
            backgroundBlurStyle: .systemThickMaterial,
            title: ShieldConfiguration.Label(
                text: "Stay Focused",
                color: .label
            ),
            subtitle: ShieldConfiguration.Label(
                text: dismissCount > 3
                    ? "You've tried to open this \(dismissCount) times today."
                    : "This app is restricted right now.",
                color: .secondaryLabel
            ),
            primaryButtonLabel: ShieldConfiguration.Label(
                text: "Got It",
                color: .white
            ),
            primaryButtonBackgroundColor: .systemIndigo
        )
    }

    // 9. Customize the shield for a web domain.
    override func configuration(
        shielding webDomain: WebDomain
    ) -> ShieldConfiguration {
        return ShieldConfiguration(
            title: ShieldConfiguration.Label(
                text: "Website Blocked",
                color: .label
            ),
            primaryButtonLabel: ShieldConfiguration.Label(
                text: "Go Back",
                color: .white
            ),
            primaryButtonBackgroundColor: .systemRed
        )
    }

    // 10. Customize the shield for a web domain within a category.
    override func configuration(
        shielding webDomain: WebDomain,
        in category: ActivityCategory
    ) -> ShieldConfiguration {
        return ShieldConfiguration()
    }
}
```

## Usage

- Create: `bun create target shield-config`
- Edit: `targets/shield-config/`
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

- **This is NOT a view controller.** `ShieldConfigurationDataSource` is a data source, not a `UIViewController`. You cannot present custom SwiftUI or UIKit views. You return a `ShieldConfiguration` struct and the system renders the shield. The customization options are intentionally limited to labels, colors, an icon, and a blur style.
- **Use PNG images, not PDFs.** Developers have reported that PDF images for the `icon` property cause the shield to render blank or with a missing icon. Convert assets to PNG format before bundling them in the extension.
- **`nil` properties behave differently.** Setting `primaryButtonLabel` to `nil` shows a system-default label ("OK"). Setting `secondaryButtonLabel` to `nil` hides the secondary button entirely. Setting `icon` to `nil` hides the icon area. Be intentional about which properties you leave nil.
- **The class was renamed in Xcode 14.** WWDC 2021 materials and early tutorials reference `ShieldConfigurationProvider`. This was renamed to `ShieldConfigurationDataSource` in iOS 16 / Xcode 14. Old code samples will not compile.
- **Four overloads to cover all cases.** There are four `configuration(shielding:)` methods: Application, Application-in-Category, WebDomain, and WebDomain-in-Category. If you only override the Application variant but shield by category, the category variant will use the default system appearance.
- **Token matching can be unreliable.** Some developers report that `Application` tokens passed to the Shield Configuration extension do not match tokens stored from `FamilyActivityPicker`, particularly after iOS updates. Avoid relying on token comparison for conditional logic; use App Group shared state instead.
- **Family Controls entitlement requires Apple approval.** The `com.apple.developer.family-controls` entitlement must be requested through Apple's developer portal. Without approval, development builds work but TestFlight and App Store distribution will be rejected.
- **Deployment target must match the main app.** Developers have found that setting a different iOS deployment target on the Shield Configuration extension than the main app causes customizations to silently fail. Ensure both targets have the same minimum deployment target.
- **App Group is required for dynamic content.** The extension runs in a separate sandboxed process. To display dynamic text (like usage counts or user names), read from `UserDefaults(suiteName:)` or a shared App Group file container.
- **Shield may cache configurations.** The system does not always call the extension for every shield presentation. Configurations may be cached. To force a refresh, toggle the shield off and on in `ManagedSettingsStore` or restart the shielded app.
