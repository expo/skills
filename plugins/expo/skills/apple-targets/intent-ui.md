---
title: Siri Intent UI Extension
description: Displays custom UI inline within Siri, Shortcuts, or Maps when a SiriKit intent is being confirmed or handled, replacing the default system-provided snippet with your own branded view controller.
version: iOS 10.0+
---

# Siri Intent UI Extension (`intent-ui`)

An Intents UI extension lets you inject a custom view controller into the Siri transcript, the Shortcuts results card, or the Maps action sheet whenever the system processes one of your supported intents. Instead of the generic Siri snippet, users see your app's branded interface -- showing richer data, custom layouts, or confirmation details -- while the intent is being resolved, confirmed, or handled. The extension is a UIViewController subclass conforming to INUIHostedViewControlling, and it runs in a separate process alongside your Intents extension. It receives the same INInteraction object that your intent handler works with, so it can display contextual information about the ongoing request.

## Apple Documentation

- [Creating an Intents UI Extension](https://developer.apple.com/documentation/sirikit/creating-an-intents-ui-extension)
- [INUIHostedViewControlling](https://developer.apple.com/documentation/intentsui/inuihostedviewcontrolling)
- [Configuring Your Intents UI App Extension Target](https://developer.apple.com/documentation/sirikit/configuring-your-intents-ui-app-extension-target)
- [configureView(for:of:interactiveBehavior:context:completion:)](https://developer.apple.com/documentation/intentsui/inuihostedviewcontrolling/configureview(for:of:interactivebehavior:context:completion:))
- [INUIHostedViewContext](https://developer.apple.com/documentation/intentsui/inuihostedviewcontext)
- [INUIInteractiveBehavior](https://developer.apple.com/documentation/intentsui/inuiinteractivebehavior)
- [IntentsUI Framework](https://developer.apple.com/documentation/intentsui)

## WWDC History

- **[WWDC 2016, Session 217 -- Introducing SiriKit](https://developer.apple.com/videos/play/wwdc2016/217/)** -- Launched SiriKit with two extension points: Intents and Intents UI. Demonstrated how the UI extension presents a "Siri snippet" -- a custom view controller embedded directly in the Siri conversation transcript.
- **[WWDC 2016, Session 225 -- Extending Your Apps with SiriKit](https://developer.apple.com/videos/play/wwdc2016/225/)** -- Walkthrough of building both an Intents extension and an Intents UI extension, including storyboard layout and the `configure(with:context:completion:)` method.
- **[WWDC 2017, Session 214 -- What's New in SiriKit](https://developer.apple.com/videos/play/wwdc2017/214/)** -- Introduced the more granular `configureView(for:of:interactiveBehavior:context:completion:)` API in iOS 11, enabling per-parameter UI replacement in the Siri snippet stack.
- **[WWDC 2018, Session 211 -- Introduction to Siri Shortcuts](https://developer.apple.com/videos/play/wwdc2018/211/)** -- Custom intents via IntentDefinition files can now surface in Shortcuts, where the Intents UI extension provides the result card.
- **[WWDC 2020, Session 10073 -- Empower Your Intents](https://developer.apple.com/videos/play/wwdc2020/10073/)** -- Added interactive behavior support, richer disambiguation with images, and in-app intent handling as an alternative to extension-based handling.

## What It Does

1. The user triggers an intent through Siri, the Shortcuts app, or Maps (e.g., "Send a message using MyApp").
2. The system launches the paired Intents extension to resolve, confirm, and handle the request.
3. At each phase where Siri would display a snippet (confirmation, handling result), the system also launches the Intents UI extension.
4. The system calls `configureView(for:of:interactiveBehavior:context:completion:)` on your `IntentViewController`, passing the current `INInteraction`, the set of `INParameter` values for the current row in the snippet stack, and an `INUIHostedViewContext` indicating whether the view appears in Siri, Maps, or Shortcuts.
5. Your view controller lays out its custom UI, calculates a `desiredSize`, and calls the completion handler with `(true, parameters, size)` to tell the system it will handle those parameters.
6. The system embeds your view controller's view into the Siri transcript, Maps card, or Shortcuts result in place of the default system UI.

## Use Cases

### Branded ride-booking confirmations
A ride-hailing app replaces the default Siri snippet with a map view showing driver location, estimated arrival time, and vehicle details in the app's visual style, giving users confidence they booked the right ride.

### Rich messaging previews
A messaging app displays the sent message in a styled chat bubble with the recipient's avatar and read receipts, matching the look of the main app rather than relying on Siri's plain text summary.

### Payment confirmation cards
A banking app shows a branded transaction summary with account balance, recipient info, and a confirmation checkmark, providing a more trustworthy visual than the generic Siri payment UI.

### Workout summary display
A fitness app presents a workout completion card with a chart of heart rate data, calories burned, and elapsed time when the user ends a workout through Siri.

## Key Classes

| Class / Protocol | Role |
|-----------------|------|
| `INUIHostedViewControlling` | Protocol your view controller conforms to. Provides `configureView(for:of:interactiveBehavior:context:completion:)` for per-parameter UI and the simpler `configure(with:context:completion:)` for full-snippet replacement. |
| `INUIHostedViewContext` | Enum passed to `configureView` indicating where the UI is displayed: `.siri`, `.maps`, or `.hostedInApp` (Shortcuts). Lets you adapt layout for each surface. |
| `INUIInteractiveBehavior` | Enum indicating whether the view can receive interactions: `.none`, `.launch`, `.genericAction`, `.nextView`. Most Siri contexts are `.none` (read-only). |
| `INInteraction` | Contains the `INIntent` and optional `INIntentResponse` for the current request. Extract parameters and results from this to populate your UI. |
| `INParameter` | Identifies a specific parameter in the intent (e.g., recipients, amount). Used with `configureView` to replace individual rows in the Siri snippet stack. |
| `INUIHostedViewSiriProviding` | Optional protocol to tell Siri your extension will handle displaying specific content (maps, messages, payment transactions), preventing duplicate information. |

## Implementation

```swift
import IntentsUI

// 1. Subclass UIViewController and conform to INUIHostedViewControlling.
//    This is the principal class declared in the extension's Info.plist.
class IntentViewController: UIViewController, INUIHostedViewControlling {

    // 2. Create outlets or subviews for your custom content.
    private let titleLabel = UILabel()
    private let detailLabel = UILabel()
    private let iconView = UIImageView()

    override func viewDidLoad() {
        super.viewDidLoad()

        // 3. Set up your view hierarchy. Use Auto Layout to handle
        //    varying widths across Siri, Maps, and Shortcuts surfaces.
        titleLabel.font = .boldSystemFont(ofSize: 17)
        detailLabel.font = .systemFont(ofSize: 14)
        detailLabel.textColor = .secondaryLabel
        detailLabel.numberOfLines = 0

        iconView.contentMode = .scaleAspectFit
        iconView.tintColor = .systemBlue

        let stack = UIStackView(arrangedSubviews: [iconView, titleLabel, detailLabel])
        stack.axis = .vertical
        stack.spacing = 8
        stack.alignment = .center
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)

        NSLayoutConstraint.activate([
            iconView.widthAnchor.constraint(equalToConstant: 40),
            iconView.heightAnchor.constraint(equalToConstant: 40),
            stack.topAnchor.constraint(equalTo: view.topAnchor, constant: 16),
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: view.bottomAnchor, constant: -16),
        ])
    }

    // 4. Implement configureView to handle per-parameter UI replacement.
    //    The system calls this once per parameter row in the Siri snippet stack.
    func configureView(
        for parameters: Set<INParameter>,
        of interaction: INInteraction,
        interactiveBehavior: INUIInteractiveBehavior,
        context: INUIHostedViewContext,
        completion: @escaping (Bool, Set<INParameter>, CGSize) -> Void
    ) {
        // 5. Check the context to adapt layout for Siri vs. Maps vs. Shortcuts.
        switch context {
        case .siri:
            view.backgroundColor = .systemBackground
        case .mapsCard:
            view.backgroundColor = .secondarySystemBackground
        default:
            view.backgroundColor = .systemBackground
        }

        // 6. Extract intent data from the interaction to populate the UI.
        if let sendIntent = interaction.intent as? INSendMessageIntent {
            titleLabel.text = "Message Sent"
            detailLabel.text = sendIntent.content ?? "No content"
            iconView.image = UIImage(systemName: "checkmark.circle.fill")
        }

        // 7. Calculate the desired size. Use the maximum allowed width
        //    and compute the height your content needs.
        let maxSize = self.extensionContext!.hostedViewMaximumAllowedSize
        let fittingSize = view.systemLayoutSizeFitting(
            CGSize(width: maxSize.width, height: UIView.layoutFittingCompressedSize.height),
            withHorizontalFittingPriority: .required,
            verticalFittingPriority: .fittingSizeLevel
        )

        // 8. Call completion with true to indicate you are handling these
        //    parameters, pass back the parameters you consumed, and your size.
        completion(true, parameters, CGSize(width: maxSize.width, height: fittingSize.height))
    }

    // 9. Fallback: the desiredSize property is used if configureView is not
    //    implemented. Return the maximum allowed size as a reasonable default.
    var desiredSize: CGSize {
        return self.extensionContext!.hostedViewMaximumAllowedSize
    }
}
```

## Usage

- Create: `bun create target intent-ui`
- Edit: `targets/intent-ui/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| iOS | 10.0+ | Full support. `configureView` per-parameter API available from iOS 11+. |
| iPadOS | 10.0+ | Full support. Wider snippet area gives more layout room. |
| macOS | 12.0+ | Supported for Shortcuts results. Siri on Mac uses the same extension. |
| watchOS | -- | Not supported. watchOS Siri uses a different UI mechanism (WKInterfaceController). |
| tvOS | -- | Not supported. |
| visionOS | 1.0+ | Supported via compatible iOS intents. |

## Gotchas

- **Must be paired with an Intents extension.** The Intents UI extension only provides the visual layer. You must also have a separate Intents extension (or in-app intent handling on iOS 14+) that actually resolves, confirms, and handles the intent. The UI extension alone does nothing.
- **INUIHostedViewContext tells you where you are.** Your view appears in Siri (`.siri`), Maps (`.mapsCard`), or Shortcuts (`.hostedInApp`), and each surface has different size constraints and visual expectations. Always check the context parameter and adapt your layout accordingly.
- **Views do not receive touch events in Siri.** When `interactiveBehavior` is `.none` (the default in the Siri transcript), your view is read-only. Buttons and gesture recognizers will not fire. Only when the behavior is `.launch` or `.genericAction` can the user interact, and even then the interaction typically just opens your app.
- **Limited vertical space.** The system enforces a maximum height via `hostedViewMaximumAllowedSize`. If your view exceeds this, it will be clipped without warning. Always calculate your `desiredSize` within bounds and test on smaller devices.
- **IntentsSupported must be declared in both extensions.** The Info.plist for the Intents UI extension must list every intent class name it handles in the `IntentsSupported` array, just like the Intents extension. If an intent is missing from the UI extension's list, the system silently falls back to the default Siri snippet.
- **The extension is legacy for new projects.** Apple recommends the App Intents framework (iOS 16+) with `ShowsSnippetView` for new custom intent UI work. The Intents UI extension remains necessary only for built-in SiriKit domains (messaging, payments, ride booking) that have not migrated to App Intents.
- **Siri override control is limited to three content types.** If you implement `INUIHostedViewSiriProviding` to suppress duplicate system UI, only maps, message content, and payment transactions can be overridden. Other content types will still show the system default alongside your custom view.
- **iOS 13 Shortcuts regression.** On iOS 13, Siri sometimes redirects custom intent invocations to the Shortcuts app instead of displaying the intent UI inline. This was largely resolved in iOS 14 but may still affect users on older OS versions.
