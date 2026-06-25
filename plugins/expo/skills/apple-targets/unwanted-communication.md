---
title: Unwanted Communication Reporting Extension
description: IdentityLookup-based extension that lets users report spam SMS messages and phone calls as junk directly from the Messages and Phone apps.
version: iOS 12.0+
---

# Unwanted Communication Reporting Extension (`unwanted-communication`)

An app extension that provides a UI for users to report unwanted SMS messages and phone calls as spam. When a user long-presses a message or taps "Report Junk" on a recent call, iOS presents your extension's view controller so the user can classify and submit the report.

## Apple Documentation

- [SMS and Call Reporting (IdentityLookup)](https://developer.apple.com/documentation/identitylookup)
- [SMS and Call Spam Reporting](https://developer.apple.com/documentation/IdentityLookup/sms-and-call-spam-reporting)
- [ILClassificationUIExtensionViewController](https://developer.apple.com/documentation/sms_and_call_reporting/ilclassificationuiextensionviewcontroller)
- [ILClassificationRequest](https://developer.apple.com/documentation/identitylookup/ilclassificationrequest)
- [ILClassificationResponse](https://developer.apple.com/documentation/identitylookup/ilclassificationresponse)
- [Creating a Message Filter App Extension](https://developer.apple.com/documentation/identitylookup/creating-a-message-filter-app-extension)
- [Getting Up-to-Date Calling and Blocking Information](https://developer.apple.com/documentation/identitylookup/getting-up-to-date-calling-and-blocking-information-for-your-app)

## WWDC History

- **WWDC 2017, Session 249 -- [Filtering Unwanted Messages with Identity Lookup](https://developer.apple.com/videos/play/wwdc2017/249/)** -- The `IdentityLookup` framework was introduced with iOS 11 for SMS message filtering extensions. This was the foundation that the unwanted communication extension builds on.
- **WWDC 2018 (iOS 12)** -- Apple introduced the **Unwanted Communication Reporting** extension type, allowing users to report spam calls and SMS messages to third-party apps. This added the `ILClassificationUIExtensionViewController` and network reporting APIs.
- **WWDC 2022, Session 110341 -- [Explore SMS Message Filters](https://developer.apple.com/videos/play/wwdc2022/110341/)** -- Updated SMS filtering APIs for iOS 16 with sub-classification support and improved filtering capabilities.

## What It Does

The Unwanted Communication Reporting extension presents a custom UI when a user reports a message or call as junk. The flow is:

1. User selects a message in Messages.app or a call in Recents and taps **Report Junk**.
2. iOS presents your extension's `ILClassificationUIExtensionViewController`.
3. Your extension displays a UI for the user to classify the communication (spam, scam, etc.).
4. The user taps **Done** and your extension returns an `ILClassificationResponse`.
5. iOS delivers the report to your server via the configured network endpoint.

The extension receives:
- **For SMS**: Full message text, sender information, and content.
- **For calls**: Caller's phone number and the date/time of the call.

## Use Cases

### Spam/Robocall Reporting Apps
The primary use case. Apps like Truecaller, Hiya, RoboKiller, and similar services use this extension to let users report spam directly from the native Messages and Phone apps.

### Enterprise Communication Security
Organizations deploy reporting extensions to collect data about phishing SMS campaigns and scam calls targeting employees.

### Telecom Carrier Apps
Mobile carriers ship unwanted communication extensions so subscribers can report spam, feeding the carrier's spam detection systems.

## Key Classes

| Class | Role |
|-------|------|
| `ILClassificationUIExtensionViewController` | Principal view controller. Subclass this to present your reporting UI. |
| `ILClassificationRequest` | Contains the communication details (message text, sender, call info) to classify. |
| `ILClassificationResponse` | Your extension's response with the chosen classification action. |
| `ILClassificationAction` | Enum of possible actions: `.none`, `.reportJunk`, `.reportNotJunk`, `.reportJunkAndBlockSender`. |

## Classification Actions

| Action | Description |
|--------|-------------|
| `.none` | User cancelled or chose not to classify. |
| `.reportJunk` | Report the communication as junk/spam. |
| `.reportNotJunk` | Mark as not junk (false positive correction). |
| `.reportJunkAndBlockSender` | Report as junk and block the sender. |

## Extension Info.plist

The extension's `Info.plist` must declare the extension point and, optionally, a network reporting destination:

```xml
<key>NSExtension</key>
<dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.identitylookup.classification-ui</string>
    <key>NSExtensionPrincipalClass</key>
    <string>$(PRODUCT_MODULE_NAME).ClassificationViewController</string>
    <key>NSExtensionAttributes</key>
    <dict>
        <key>ILClassificationExtensionNetworkReportDestination</key>
        <string>https://api.example.com/reports/unwanted</string>
    </dict>
</dict>
```

## Implementation

### Minimal Extension (Template)

This is what `create-target` scaffolds:

```swift
import IdentityLookupUI

class ClassificationViewController: ILClassificationUIExtensionViewController {

    override func viewDidLoad() {
        super.viewDidLoad()
    }

    override func prepare(for classificationRequest: ILClassificationRequest) {
        // Configure the view for the classification request
    }

    override func classificationResponse(
        for request: ILClassificationRequest
    ) -> ILClassificationResponse {
        return ILClassificationResponse(action: .none)
    }
}
```

### Full Implementation Pattern

A production extension with UI and network reporting:

```swift
import UIKit
import IdentityLookup
import IdentityLookupUI

class ClassificationViewController: ILClassificationUIExtensionViewController {

    private var selectedAction: ILClassificationAction = .none

    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        // IMPORTANT: Enable the Done button. Without this, the user
        // cannot submit the report.
        self.extensionContext.isReadyForClassificationResponse = true
    }

    override func prepare(for classificationRequest: ILClassificationRequest) {
        // Read the communication details and populate your UI.
        //
        // For SMS: classificationRequest contains message text and sender.
        // For calls: classificationRequest contains caller number and date.
        //
        // Example: display the sender info in a label
        if let comms = classificationRequest.communicationIdentifiers.first {
            senderLabel.text = "From: \(comms)"
        }
    }

    override func classificationResponse(
        for request: ILClassificationRequest
    ) -> ILClassificationResponse {
        // Return the user's chosen classification.
        // The system sends this to your network endpoint automatically.
        return ILClassificationResponse(action: selectedAction)
    }

    // MARK: - UI

    private lazy var senderLabel = UILabel()

    private func setupUI() {
        let stack = UIStackView()
        stack.axis = .vertical
        stack.spacing = 16
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            stack.centerYAnchor.constraint(equalTo: view.centerYAnchor),
        ])

        senderLabel.font = .preferredFont(forTextStyle: .headline)
        stack.addArrangedSubview(senderLabel)

        let spamButton = makeButton(title: "Report as Spam", action: .reportJunk)
        let blockButton = makeButton(title: "Report & Block", action: .reportJunkAndBlockSender)
        let notJunkButton = makeButton(title: "Not Junk", action: .reportNotJunk)

        stack.addArrangedSubview(spamButton)
        stack.addArrangedSubview(blockButton)
        stack.addArrangedSubview(notJunkButton)
    }

    private func makeButton(
        title: String,
        action: ILClassificationAction
    ) -> UIButton {
        let button = UIButton(type: .system)
        button.setTitle(title, for: .normal)
        button.tag = action.rawValue
        button.addTarget(self, action: #selector(didTapAction(_:)), for: .touchUpInside)
        return button
    }

    @objc private func didTapAction(_ sender: UIButton) {
        selectedAction = ILClassificationAction(rawValue: sender.tag) ?? .none
    }
}
```

### Network Reporting Server Setup

When the user submits a report, iOS sends it to your server automatically. You need:

**1. Associated Domains entitlement on the extension:**

Add the `classificationreport:` service to your associated domains:

```
classificationreport:api.example.com
```

**2. Apple App Site Association (AASA) file on your server:**

Host at `https://api.example.com/.well-known/apple-app-site-association`:

```json
{
  "classificationreport": {
    "apps": [
      "TEAMID.com.example.myapp",
      "TEAMID.com.example.myapp.unwanted-communication"
    ]
  }
}
```

**3. HTTPS endpoint:**

The URL specified in `ILClassificationExtensionNetworkReportDestination` receives a POST with the classification data. Must be HTTPS with a valid certificate (no ATS overrides allowed).

## User Activation

Users must manually enable the extension:

1. Go to **Settings > Phone > SMS/Call Reporting** (or **Settings > Messages > SMS/Call Reporting**).
2. Select your app's extension.

Only **one** Unwanted Communication Reporting extension can be active at a time.

## Usage

- Create: `bun create target unwanted-communication`
- Edit: `targets/unwanted-communication/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| iOS | 12.0+ | Full support for SMS and call reporting. |
| iPadOS | -- | Not supported (no Phone or SMS on iPad). |
| macOS | -- | Not supported. |
| watchOS | -- | Not supported. |
| tvOS | -- | Not supported. |

## Privacy Model

Apple enforces strict privacy constraints:

- The extension's container is **deleted after every use**. You cannot persist data between invocations.
- The extension **cannot access the network directly**. All report delivery is handled by the system via the configured `ILClassificationExtensionNetworkReportDestination`.
- Shared `UserDefaults` via App Groups do **not** work reliably from this extension type due to sandbox restrictions.
- Any cookies the server attempts to set are ignored.

## Gotchas

- **Done button stays disabled** unless you set `self.extensionContext.isReadyForClassificationResponse = true` in `viewDidAppear`. This is not set automatically.
- **Network reports fire only once** after install in some iOS versions. Force-quitting the Messages app is a known workaround. This appears to be an iOS bug that has persisted across multiple versions.
- **No UITextField/UITextView** -- Adding text input fields inside the extension view controller may cause crashes related to the dictation feature. Use buttons or segmented controls instead.
- **Associated domains must match exactly** -- Both the containing app and the extension bundle IDs must be listed in the AASA file under `classificationreport`. Missing either one causes "unauthorized to defer" errors.
- **Only one extension active at a time** -- If another app's extension is already enabled, yours will replace it. Users must manually switch in Settings.
- **SMS filtering regional availability** -- SMS filtering (the separate `message-filter` extension type) may only work in certain countries. The unwanted communication reporting extension itself is available globally, but the underlying SMS/call features depend on the device's carrier and region.
