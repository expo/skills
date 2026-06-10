---
title: Custom Keyboard Extension
description: Replaces the system keyboard with a fully custom input interface available across all apps.
version: iOS 8.0+
---

# Custom Keyboard Extension (`keyboard`)

A custom keyboard extension replaces the standard system keyboard with your own input interface, available system-wide across all apps once the user enables it in Settings. The extension subclasses `UIInputViewController` and communicates with the active text field through a `textDocumentProxy` object, which allows inserting and deleting text without direct access to the text field itself. Keyboards run in a restrictive sandbox by default -- network access, pasteboard reading, and shared container access all require the user to grant "Allow Full Access" in Settings. Data sharing with the containing app uses App Groups.

## Apple Documentation

- [Creating a Custom Keyboard](https://developer.apple.com/documentation/uikit/creating-a-custom-keyboard)
- [UIInputViewController](https://developer.apple.com/documentation/uikit/uiinputviewcontroller)
- [Configuring a Custom Keyboard Interface](https://developer.apple.com/documentation/uikit/configuring-a-custom-keyboard-interface)
- [UITextDocumentProxy](https://developer.apple.com/documentation/uikit/uitextdocumentproxy)
- [App Extension Programming Guide: Custom Keyboard](https://developer.apple.com/library/archive/documentation/General/Conceptual/ExtensibilityPG/CustomKeyboard.html)
- [UILexicon](https://developer.apple.com/documentation/uikit/uilexicon)

## WWDC History

- **[WWDC 2014, Session 205 -- Creating Extensions for iOS and OS X, Part 1](https://developer.apple.com/videos/play/wwdc2014/205/)** -- Introduced the extension model in iOS 8, including custom keyboard extensions as a new extension point.
- **[WWDC 2014, Session 217 -- Creating Extensions for iOS and OS X, Part 2](https://developer.apple.com/videos/play/wwdc2014/217/)** -- Deeper implementation details for building extensions, covering keyboard lifecycle and sandboxing.
- **[WWDC 2017, Session 242 -- The Keys to a Better Text Input Experience](https://developer.apple.com/videos/play/wwdc2017/242/)** -- Best practices for text input, QuickType support, and upgrading a custom keyboard to a system-wide extension.

## What It Does

1. **User enables the keyboard.** The user goes to Settings > General > Keyboards > Add New Keyboard and selects your keyboard from the list of third-party keyboards.
2. **System instantiates UIInputViewController.** When the user switches to your keyboard (via the globe key), iOS loads your extension and calls `viewDidLoad()` on your `UIInputViewController` subclass.
3. **You build the UI.** Add buttons, labels, or host a SwiftUI view inside the controller's `inputView`. The keyboard draws within the bounds of this view.
4. **Text input goes through textDocumentProxy.** Call `textDocumentProxy.insertText(_:)` to type characters and `textDocumentProxy.deleteBackward()` to delete. You can read limited surrounding context via `documentContextBeforeInput` and `documentContextAfterInput`.
5. **Globe key switches keyboards.** Call `advanceToNextInputMode()` or use `handleInputModeList(from:with:)` to let the user switch to the next keyboard. The system manages keyboard order.
6. **Height is controlled via constraints.** Set a height constraint on `inputView` to change the keyboard height from the default.
7. **Full Access unlocks advanced features.** If `RequestsOpenAccess` is set to `true` in Info.plist and the user enables Full Access in Settings, the keyboard gains network access, pasteboard reading, shared container access via App Groups, and location services.

## Use Cases

### Custom layouts and languages
A keyboard that provides a layout not available on the standard system keyboard, such as Dvorak, Colemak, or a layout for a language Apple does not natively support. The extension renders the key grid in `viewDidLoad` and inserts characters via `textDocumentProxy.insertText(_:)`.

### GIF and sticker keyboards
A media keyboard that searches a GIF API and inserts images into the text field. Requires Full Access for network requests. Uses `textDocumentProxy.insertText(_:)` with a special pasteboard workaround, or relies on the host app supporting `UIPasteboard` for image input.

### Specialized input methods
A keyboard for entering mathematical notation, music symbols, or code snippets. The extension presents a domain-specific set of buttons and inserts the corresponding Unicode characters or formatted strings.

### Accessibility keyboards
A keyboard with enlarged keys, high-contrast colors, or simplified layouts designed for users with motor or visual impairments. Can also add haptic feedback via `UIFeedbackGenerator`.

## Key Classes

| Class / Protocol | Role |
|------------------|------|
| `UIInputViewController` | Primary view controller for the keyboard extension. Subclass this to build your keyboard UI. |
| `UITextDocumentProxy` | Proxy object for interacting with the current text field. Provides `insertText(_:)`, `deleteBackward()`, and context properties. |
| `UILexicon` | System-provided lexicon containing unpaired first names from Contacts and text shortcuts from Settings. Use for autocorrect suggestions. |
| `UIInputView` | The root view of the keyboard. Set `inputView` to a custom instance to control appearance and height. |
| `NSExtensionContext` | The extension context. Rarely used directly in keyboard extensions. |

## Implementation

```swift
import UIKit

// 1. Subclass UIInputViewController -- this is the entry point for any custom keyboard.
class KeyboardViewController: UIInputViewController {

    private var nextKeyboardButton: UIButton!
    private var keyboardStackView: UIStackView!

    override func viewDidLoad() {
        super.viewDidLoad()

        // 2. Build the keyboard layout using a vertical stack of horizontal rows.
        keyboardStackView = UIStackView()
        keyboardStackView.axis = .vertical
        keyboardStackView.spacing = 6
        keyboardStackView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(keyboardStackView)

        NSLayoutConstraint.activate([
            keyboardStackView.topAnchor.constraint(equalTo: view.topAnchor, constant: 8),
            keyboardStackView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 4),
            keyboardStackView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -4),
        ])

        let rows = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"]
        for row in rows {
            let rowStack = UIStackView()
            rowStack.axis = .horizontal
            rowStack.spacing = 4
            rowStack.distribution = .fillEqually
            for char in row {
                let key = UIButton(type: .system)
                key.setTitle(String(char), for: .normal)
                key.titleLabel?.font = .systemFont(ofSize: 22)
                key.backgroundColor = UIColor.systemBackground
                key.layer.cornerRadius = 5
                // 3. Each key inserts its character into the active text field via textDocumentProxy.
                key.addTarget(self, action: #selector(keyTapped(_:)), for: .touchUpInside)
                rowStack.addArrangedSubview(key)
            }
            keyboardStackView.addArrangedSubview(rowStack)
        }

        // 4. Build the bottom row with globe, space, backspace, and return keys.
        let bottomRow = UIStackView()
        bottomRow.axis = .horizontal
        bottomRow.spacing = 4
        bottomRow.distribution = .fill

        // 5. The globe button is REQUIRED when needsInputModeSwitchKey is true.
        //    Use handleInputModeList(from:with:) for the long-press keyboard picker.
        nextKeyboardButton = UIButton(type: .system)
        nextKeyboardButton.setImage(UIImage(systemName: "globe"), for: .normal)
        nextKeyboardButton.addTarget(self, action: #selector(handleInputModeList(from:with:)), for: .allTouchEvents)
        nextKeyboardButton.widthAnchor.constraint(equalToConstant: 44).isActive = true
        bottomRow.addArrangedSubview(nextKeyboardButton)

        let spaceButton = UIButton(type: .system)
        spaceButton.setTitle("space", for: .normal)
        spaceButton.backgroundColor = UIColor.systemBackground
        spaceButton.layer.cornerRadius = 5
        spaceButton.addTarget(self, action: #selector(spaceTapped), for: .touchUpInside)
        bottomRow.addArrangedSubview(spaceButton)

        let deleteButton = UIButton(type: .system)
        deleteButton.setImage(UIImage(systemName: "delete.left"), for: .normal)
        deleteButton.addTarget(self, action: #selector(deleteTapped), for: .touchUpInside)
        deleteButton.widthAnchor.constraint(equalToConstant: 44).isActive = true
        bottomRow.addArrangedSubview(deleteButton)

        let returnButton = UIButton(type: .system)
        returnButton.setTitle("return", for: .normal)
        returnButton.addTarget(self, action: #selector(returnTapped), for: .touchUpInside)
        returnButton.widthAnchor.constraint(equalToConstant: 72).isActive = true
        bottomRow.addArrangedSubview(returnButton)

        keyboardStackView.addArrangedSubview(bottomRow)

        // 6. Set a custom height for the keyboard. The default is ~216pt on iPhone.
        let heightConstraint = NSLayoutConstraint(
            item: view!, attribute: .height,
            relatedBy: .equal,
            toItem: nil, attribute: .notAnAttribute,
            multiplier: 1.0, constant: 260
        )
        heightConstraint.priority = .defaultHigh
        view.addConstraint(heightConstraint)
    }

    override func viewWillLayoutSubviews() {
        super.viewWillLayoutSubviews()
        // 7. Hide the globe button on devices that provide it natively (e.g. iPhone X+).
        nextKeyboardButton.isHidden = !needsInputModeSwitchKey
    }

    @objc func keyTapped(_ sender: UIButton) {
        guard let title = sender.title(for: .normal) else { return }
        // 8. Insert the character into the current text field.
        textDocumentProxy.insertText(title)
    }

    @objc func spaceTapped() {
        textDocumentProxy.insertText(" ")
    }

    @objc func deleteTapped() {
        // 9. Delete one character backward.
        textDocumentProxy.deleteBackward()
    }

    @objc func returnTapped() {
        textDocumentProxy.insertText("\n")
    }

    override func textDidChange(_ textInput: UITextInput?) {
        // 10. Adapt key colors to match the host app's keyboard appearance (light/dark).
        let isDark = textDocumentProxy.keyboardAppearance == .dark
        let textColor: UIColor = isDark ? .white : .black
        nextKeyboardButton.tintColor = textColor
    }
}
```

## Usage

- Create: `bun create target keyboard`
- Edit: `targets/keyboard/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| iOS | 8.0+ | Full custom keyboard support. Globe key provided by system on iPhone X+ (iOS 11+). |
| iPadOS | 8.0+ | Supports split-screen and floating keyboard contexts. |
| macOS | -- | Not supported. macOS uses Input Methods (IMKit), not keyboard extensions. |
| watchOS | -- | Not supported. |
| visionOS | -- | Not supported. |
| tvOS | -- | Not supported. |

## Gotchas

- **You must implement a globe/next-keyboard button or Apple will reject your app.** Check `needsInputModeSwitchKey` in `viewWillLayoutSubviews` and show or hide the button accordingly. On devices with a system-level globe key (iPhone X and later), `needsInputModeSwitchKey` returns `false` and your button should be hidden. On all other devices, omitting this button makes it impossible to switch keyboards and triggers an App Store rejection.
- **Keyboards are heavily sandboxed by default.** Without Full Access enabled, the extension cannot access the network, read the pasteboard, use shared containers, or access location services. Your keyboard must provide useful basic functionality without Full Access.
- **No camera or microphone access.** Keyboard extensions are explicitly prohibited from accessing the camera and microphone APIs, even with Full Access enabled. Dictation input is not available to third-party keyboards.
- **Secure text fields always use the system keyboard.** When the user taps a password field (`isSecureTextEntry = true`), iOS automatically switches to the system keyboard. Your extension has no control over this behavior.
- **Host apps can block custom keyboards entirely.** An app developer can return `false` from `application(_:shouldAllowExtensionPointIdentifier:)` to force the system keyboard in their app. Banking and healthcare apps commonly do this.
- **Height must be set via a constraint on inputView.** There is no `preferredContentSize` API for keyboards. Set a height constraint with `.defaultHigh` priority on `self.view` (the `inputView`). The default height is approximately 216 points on iPhone.
- **Autocorrect and predictive text must be self-implemented.** The system does not provide autocorrect, spell-checking, or predictive text to third-party keyboards. You can use `requestSupplementaryLexicon(completion:)` to get a `UILexicon` containing the user's text shortcuts and contact names, but building a full autocorrect engine is your responsibility.
- **Memory limit is strict (~40-50 MB).** iOS aggressively terminates keyboard extensions that exceed the memory budget. Avoid loading large assets, dictionaries, or ML models directly into the extension process. Consider lazy loading and memory-mapped files.
- **textDocumentProxy context is limited.** `documentContextBeforeInput` and `documentContextAfterInput` only return a limited window of surrounding text (often just the current paragraph or less). You cannot read the entire document or access text outside the visible context.
- **App Groups are required for sharing data with the containing app.** The keyboard extension runs in a separate process with its own container. Use `UserDefaults(suiteName:)` or `FileManager.containerURL(forSecurityApplicationGroupIdentifier:)` to share settings, learned words, or user preferences. The `@bacons/apple-targets` plugin syncs app groups automatically when `appGroupsByDefault` is set.
