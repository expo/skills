---
title: Smart Card Extension
description: CryptoTokenKit-based app extension that acts as a driver for physical smart cards (PIV, CAC) and USB/NFC cryptographic tokens. Makes certificates and keys stored on hardware tokens available system-wide through the keychain and SecKey APIs.
version: iOS 16.0+, macOS 10.12+
---

# Smart Card Extension (`smart-card`)

## Apple Documentation

- [CryptoTokenKit Framework](https://developer.apple.com/documentation/cryptotokenkit)
- [Authenticating Users with a Cryptographic Token](https://developer.apple.com/documentation/cryptotokenkit/authenticating-users-with-a-cryptographic-token)
- [Using Cryptographic Assets Stored on a Smart Card](https://developer.apple.com/documentation/cryptotokenkit/using-cryptographic-assets-stored-on-a-smart-card)
- [Configuring Smart Card Authentication](https://developer.apple.com/documentation/cryptotokenkit/configuring-smart-card-authentication)
- [TKSmartCardTokenDriver](https://developer.apple.com/documentation/cryptotokenkit/tksmartcardtokendriver)
- [TKSmartCardToken](https://developer.apple.com/documentation/cryptotokenkit/tksmartcardtoken)
- [TKSmartCardTokenSession](https://developer.apple.com/documentation/cryptotokenkit/tksmartcardtokensession)
- [Apple Deployment Guide: Smart Card Integration](https://support.apple.com/guide/deployment/depd0b888248/web)
- [Supported Smart Card Functions on Mac](https://support.apple.com/guide/deployment/depc47f60521/web)

## WWDC History

- **WWDC 2014** -- CryptoTokenKit framework introduced alongside OS X Yosemite (10.10). Low-level smart card communication APIs (`TKSmartCard`, `TKSmartCardSlotManager`) shipped first.
- **WWDC 2016, Session 706 -- What's New in Security** -- The CryptoTokenKit _extension_ mechanism was announced with macOS Sierra (10.12), replacing the deprecated `tokend` system from OS X Lion. This session described it as "system support for cryptographic devices so that smart cards you might be using to prove your identity... we now have out of the box integration." ([transcript](https://asciiwwdc.com/2016/sessions/706))
- **WWDC 2019, Session 709 -- Cryptography and Your Apps** -- Covered SecKey API improvements relevant to token-backed keys.
- **iOS 16 / WWDC 2022** -- CryptoTokenKit gained iOS support, enabling PIV smart card extensions on iPhone and iPad for the first time.

## What It Does

A smart card extension is a CryptoTokenKit "persistent token" driver. When a compatible smart card is inserted (via USB CCID reader or NFC on iOS), the system loads your extension to:

1. **Enumerate objects** -- Read certificates, public keys, and key references from the card.
2. **Expose to keychain** -- Make discovered certificates and identities available in the system keychain so any app using SecItem/SecKey APIs can find them.
3. **Perform crypto operations** -- Sign, decrypt, and authenticate using the private keys that never leave the hardware token.

The extension runs sandboxed in its own process and communicates with the card through APDU commands via `TKSmartCardTokenSession`.

## Use Cases

### Enterprise / Government Authentication
The most common use case. Organizations using PIV (Personal Identity Verification) or CAC (Common Access Card) smart cards deploy CryptoTokenKit extensions to enable:

- **macOS login** with smart card + PIN (two-factor authentication)
- **Screensaver unlock** requiring card presence
- **TLS client authentication** in Safari, Chrome, and other browsers
- **VPN authentication** using certificate-based credentials
- **Kerberos SSO (PKINIT)** for single sign-on to enterprise services
- **S/MIME email** signing and encryption in Mail.app
- **Sudo escalation** backed by smart card credentials

### Hardware Security Key Support (iOS)
Since iOS 16, apps like YubiKey Authenticator use CryptoTokenKit extensions to expose PIV credentials from NFC/Lightning/USB-C security keys to Safari and system services.

### Custom Token Drivers
Organizations with proprietary or non-PIV smart cards build custom drivers to bridge their card's APDU protocol to CryptoTokenKit.

## PIV Slot Reference

Smart cards following the PIV standard use these certificate slots:

| Slot | Name | Purpose |
|------|------|---------|
| 9a | PIV Authentication | Login, TLS client auth |
| 9c | Digital Signing | Email/document signing |
| 9d | Key Management | Encryption/decryption |
| 9e | Card Authentication | Physical access (no PIN required) |

## Key Classes

| Class | Role |
|-------|------|
| `TKSmartCardTokenDriver` | Entry point. Subclass this as your extension's principal class. Receives `createToken(smartCard:aid:reply:)` when a card matching your AID is inserted. |
| `TKSmartCardToken` | Represents the token. Initialize with the card's discovered certificates and keys via `TKTokenKeychainContents`. |
| `TKSmartCardTokenSession` | Handles crypto operations. Override `beginAuthentication(operation:)`, `sign(_:keyObjectID:algorithm:)`, and `decrypt(_:keyObjectID:algorithm:)`. |
| `TKSmartCard` | Low-level card communication. Send/receive APDUs. Available via `session.smartCard`. |

## Extension Info.plist

The extension's `Info.plist` must declare:

```xml
<key>NSExtension</key>
<dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.ctk-tokens</string>
    <key>NSExtensionPrincipalClass</key>
    <string>$(PRODUCT_MODULE_NAME).TokenExtension</string>
    <key>NSExtensionAttributes</key>
    <dict>
        <key>com.apple.ctk.token-type</key>
        <string>smartcard</string>
        <key>com.apple.ctk.aid</key>
        <array>
            <!-- Application Identifier(s) your card responds to -->
            <string>A000000308000010000100</string>
        </array>
    </dict>
</dict>
```

The `com.apple.ctk.aid` array tells the system which smart card Application Identifiers (AIDs) this extension handles. The system selects your extension when a card with a matching AID is inserted.

## Implementation

### Minimal Driver (Template)

This is what `create-target` scaffolds:

```swift
import CryptoTokenKit

class TokenExtension: TKSmartCardTokenDriver {

}
```

### Full Implementation Pattern

A real-world smart card extension typically has three files:

**TokenDriver.swift** -- Entry point that creates a token when a card is detected:

```swift
import CryptoTokenKit

class TokenDriver: TKSmartCardTokenDriver, TKSmartCardTokenDriverDelegate {
    func tokenDriver(
        _ driver: TKSmartCardTokenDriver,
        createTokenFor smartCard: TKSmartCard,
        aid AID: Data,
        reply: @escaping (TKSmartCardToken?, Error?) -> Void
    ) {
        // Select the PIV applet on the card
        smartCard.send(
            ins: 0xA4, p1: 0x04, p2: 0x00, data: AID
        ) { response, sw1, sw2, error in
            guard error == nil, sw1 == 0x90, sw2 == 0x00 else {
                reply(nil, error)
                return
            }

            // Read certificates from standard PIV slots
            let token = MySmartCardToken(
                smartCard: smartCard,
                aid: AID,
                instanceID: smartCard.slot.name // unique per reader
            )
            reply(token, nil)
        }
    }
}
```

**Token.swift** -- Enumerates keys and certificates on the card:

```swift
import CryptoTokenKit

class MySmartCardToken: TKSmartCardToken {
    init(smartCard: TKSmartCard, aid: Data, instanceID: String) {
        super.init(
            smartCard: smartCard,
            aid: aid,
            instanceID: instanceID,
            tokenDriver: TokenDriver()
        )

        // Populate keychain contents with certificates found on card
        guard let keychainContents = self.keychainContents else { return }

        // Example: add a certificate from PIV slot 9a
        let certItem = TKTokenKeychainCertificate(
            certificate: pivCertificate,  // SecCertificate from card
            objectID: "slot-9a-cert"
        )
        let keyItem = TKTokenKeychainKey(
            certificate: pivCertificate,
            objectID: "slot-9a-key"
        )
        keyItem.canSign = true
        keyItem.canDecrypt = false

        keychainContents.fill(with: [certItem, keyItem])
    }
}
```

**TokenSession.swift** -- Handles signing and decryption requests:

```swift
import CryptoTokenKit

class MyTokenSession: TKSmartCardTokenSession {
    override func beginAuthentication(
        operation: TKTokenOperation,
        constraint: Any
    ) throws -> TKTokenAuthOperation {
        // Return a PIN-based auth operation
        let pinAuth = TKTokenSmartCardPINAuthOperation()
        pinAuth.pinFormat = .fixedLength(8)
        pinAuth.smartCard = self.smartCard
        return pinAuth
    }

    override func sign(
        _ dataToSign: Data,
        keyObjectID: Any,
        algorithm: TKTokenKeyAlgorithm
    ) throws -> Data {
        guard let smartCard = self.smartCard else {
            throw TKError(.corruptedData)
        }

        // Select the key on the card and perform signing via APDU
        let signedData = try smartCard.send(
            ins: 0x87, p1: 0x07, p2: 0x9A,
            data: buildSigningAPDU(dataToSign)
        )
        return signedData
    }
}
```

## Usage

- Create: `bun create target smart-card`
- Edit: `targets/smart-card/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| macOS | 10.10+ | Full support since Yosemite. Extension mechanism since Sierra 10.12. |
| iOS | 16.0+ | Requires USB-C or NFC reader. Lightning via MFi adapters. |
| iPadOS | 16.0+ | Same as iOS. |
| watchOS | -- | Not supported. |
| tvOS | -- | Not supported. |

## Entitlements

On macOS, the extension requires the `com.apple.security.smartcard` entitlement. On iOS, no special entitlement is needed beyond the standard app extension sandbox.

If you need to share data between the main app and the extension, enable App Groups.

## Debugging Tips

- **Enable smart card logging**: `sudo defaults write /Library/Preferences/com.apple.security.smartcard Logging -bool true`
- **Register manually**: `pluginkit -a /path/to/YourApp.app/Contents/PlugIns/YourExtension.appex`
- **List registered tokens**: `pluginkit -m -p com.apple.ctk-tokens`
- **Check system log**: `log stream --predicate 'subsystem == "com.apple.CryptoTokenKit"'`

## Open-Source References

- [OpenSCToken](https://github.com/frankmorgner/OpenSCToken) -- OpenSC smart card driver built as a CryptoTokenKit extension (Objective-C). Demonstrates macOS login, TLS auth, and keychain integration.
- [Yubico: How to Implement a CryptoTokenKit Extension on iOS](https://www.yubico.com/blog/how-to-implement-a-cryptotokenkit-extension-on-ios/) -- Detailed walkthrough of building a PIV-based CTK extension for iOS using YubiKey.

## Gotchas

- Apple's CryptoTokenKit documentation is widely regarded as sparse. Filing a DTS tech support incident is recommended for complex questions.
- `TKTokenKeychainContents` is `nil` unless your token inherits from `TKSmartCardToken` (not the base `TKToken`).
- The extension runs in a sandbox. Configuration files must be read from the appex bundle resources; writes go to the container's `Documents/` directory.
- On macOS, the built-in PIV token driver (`com.apple.CryptoTokenKit.pivtoken`) handles standard PIV cards automatically. You only need a custom extension for non-standard cards or cards requiring custom APDU sequences.
- Card communication is asynchronous. All `TKSmartCard.send()` calls use completion handlers or async/await (iOS 16+).
