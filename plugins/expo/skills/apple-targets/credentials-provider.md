---
title: AutoFill Credential Provider Extension
description: Integrates a password manager with the system AutoFill UI to provide passwords, passkeys, and verification codes.
version: iOS 12.0+
---

# AutoFill Credential Provider Extension (`credentials-provider`)

A credential provider extension integrates your password manager or authentication app with the system-wide AutoFill UI, allowing users to fill passwords, passkeys, and one-time codes directly from the QuickType bar or the full credential list during sign-in flows in any app or Safari. The extension subclasses `ASCredentialProviderViewController` from the AuthenticationServices framework and implements methods to present a credential list, provide credentials without user interaction (for QuickType bar autofill), and handle user authentication before releasing sensitive data. Starting with iOS 17, extensions can also create and authenticate with passkeys and supply one-time verification codes, making this the primary integration point for full-featured credential managers on Apple platforms.

## Apple Documentation

- [ASCredentialProviderViewController](https://developer.apple.com/documentation/authenticationservices/ascredentialproviderviewcontroller)
- [AutoFill Credential Provider Entitlement](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.authentication-services.autofill-credential-provider)
- [ASCredentialIdentityStore](https://developer.apple.com/documentation/authenticationservices/ascredentialidentitystore)
- [ASCredentialProviderExtensionContext](https://developer.apple.com/documentation/authenticationservices/ascredentialproviderextensioncontext)
- [ASPasswordCredential](https://developer.apple.com/documentation/authenticationservices/aspasswordcredential)
- [ASPasskeyCredentialRequest](https://developer.apple.com/documentation/authenticationservices/aspasskeycredentialrequest)
- [ASCredentialProviderExtensionCapabilities (Info.plist)](https://developer.apple.com/documentation/bundleresources/information_property_list/nsextension/nsextensionattributes/ascredentialproviderextensioncapabilities)
- [Credential Provider Extensions -- Apple Platform Security](https://support.apple.com/guide/security/credential-provider-extensions-sec6319ac7b9/web)

## WWDC History

- **[WWDC 2018, Session 721 -- Implementing AutoFill Credential Provider Extensions](https://developer.apple.com/videos/play/wwdc2018/721/)** -- Introduced the credential provider extension point in iOS 12. Covered `ASCredentialProviderViewController`, the `ASCredentialIdentityStore` for QuickType bar population, and the three-method lifecycle (credential list, no-UI provision, interactive provision).
- **[WWDC 2018, Session 204 -- Automatic Strong Passwords and Security Code AutoFill](https://developer.apple.com/videos/play/wwdc2018/204/)** -- Broader session on Password AutoFill in iOS 12, including how third-party credential providers integrate alongside iCloud Keychain.
- **[WWDC 2021, Session 10106 -- Move Beyond Passwords](https://developer.apple.com/videos/play/wwdc2021/10106/)** -- Introduced passkeys as a concept, laying groundwork for credential provider passkey support.
- **[WWDC 2023, Session 10263 -- Deploy Passkeys at Work](https://developer.apple.com/videos/play/wwdc2023/10263/)** -- Expanded the credential provider API to support passkeys for third-party password managers in iOS 17. Covered `ProvidesPasskeys` capability, managed Apple IDs with iCloud Keychain, and enterprise attestation.
- **[WWDC 2024, Session 10125 -- Streamline Sign-In with Passkey Upgrades and Credential Managers](https://developer.apple.com/videos/play/wwdc2024/10125/)** -- Added automatic passkey upgrades, one-time code filling, and the ability to fill credentials into any text field.

## What It Does

1. **User selects your provider in Settings.** The user goes to Settings > Passwords > Password Options (iOS 18+) or Settings > Passwords & Accounts > AutoFill Passwords (earlier iOS) and enables your app as a credential provider alongside or instead of iCloud Keychain.
2. **QuickType bar shows suggestions.** When the user taps a username or password field, iOS checks the `ASCredentialIdentityStore` for identities your extension previously registered. Matching credentials appear on the QuickType bar.
3. **No-UI provision for QuickType.** If the user taps a QuickType suggestion, iOS calls `provideCredentialWithoutUserInteraction(for:)`. If your credential store is unlocked, return the credential immediately. If it requires authentication, throw `ASExtensionError.userInteractionRequired`.
4. **Interactive credential list.** If the user taps the key icon or your extension requires authentication, iOS presents your view controller. Override `prepareCredentialList(for:)` to show a searchable list of credentials filtered by the requesting service identifiers.
5. **User selects a credential.** After optional authentication (biometrics, master password), call `extensionContext.completeRequest(withSelectedCredential:completionHandler:)` with the `ASPasswordCredential`.
6. **Passkey flows (iOS 17+).** For passkey authentication, override `provideCredentialWithoutUserInteraction(for:)` accepting `ASPasskeyCredentialRequest`, perform the WebAuthn assertion, and return an `ASPasskeyAssertionCredential`. For passkey registration, override `prepareInterface(forPasskeyRegistration:)`.
7. **Identity store keeps QuickType current.** Call `ASCredentialIdentityStore.shared.saveCredentialIdentities(_:)` whenever your credential database changes, so the QuickType bar always reflects the latest saved logins.

## Use Cases

### Third-party password manager
A password manager app (like 1Password or Bitwarden) registers all stored credentials in the `ASCredentialIdentityStore` so they appear in the QuickType bar. The extension authenticates the user with biometrics or a master password before releasing credentials.

### Enterprise single sign-on
A corporate identity provider extension that integrates with an organization's identity service. When employees sign in to internal apps, the extension provides credentials from the enterprise directory, enforcing company security policies before filling.

### Passkey manager
A cross-platform credential manager that stores passkeys alongside passwords. On iOS 17+, the extension creates passkeys during registration flows and performs WebAuthn assertions during sign-in, enabling passwordless authentication across all apps and Safari.

### One-time code provider
Starting with iOS 18, a credential manager can provide time-based one-time passwords (TOTP codes) during two-factor authentication flows. The extension surfaces the current code in the QuickType bar without the user needing to open the authenticator app.

## Key Classes

| Class / Protocol | Role |
|------------------|------|
| `ASCredentialProviderViewController` | The view controller subclass your extension provides. Override its lifecycle methods to present UI and return credentials. |
| `ASCredentialIdentityStore` | Singleton store where you register `ASPasswordCredentialIdentity` and `ASPasskeyCredentialIdentity` objects. These populate the QuickType bar. |
| `ASPasswordCredentialIdentity` | Describes a stored password credential (service identifier, user, record identifier). Registered in the identity store. |
| `ASPasswordCredential` | The actual username + password pair returned to the system when the user selects a credential. |
| `ASPasskeyCredentialRequest` | (iOS 17+) Describes a passkey assertion request, including the relying party and challenge. |
| `ASPasskeyAssertionCredential` | (iOS 17+) The signed WebAuthn assertion response returned to the system for passkey authentication. |
| `ASCredentialServiceIdentifier` | Identifies the service (domain or bundle ID) the user is signing in to. Passed to your extension for filtering. |
| `ASCredentialProviderExtensionContext` | The extension context. Use `completeRequest(withSelectedCredential:)` to return credentials or `cancelRequest(withError:)` to abort. |

## Implementation

```swift
import AuthenticationServices

// 1. Subclass ASCredentialProviderViewController -- the system instantiates this
//    when the user interacts with AutoFill and selects your provider.
class CredentialProviderViewController: ASCredentialProviderViewController {

    // 2. Called when the user taps a QuickType bar suggestion.
    //    Provide the credential immediately if the store is unlocked,
    //    otherwise signal that user interaction is required.
    override func provideCredentialWithoutUserInteraction(
        for credentialIdentity: ASPasswordCredentialIdentity
    ) {
        guard let store = CredentialStore.shared.unlocked else {
            // 3. Store is locked -- tell the system we need to show UI.
            self.extensionContext.cancelRequest(
                withError: NSError(
                    domain: ASExtensionErrorDomain,
                    code: ASExtensionError.userInteractionRequired.rawValue
                )
            )
            return
        }

        // 4. Look up the credential by its record identifier.
        guard let entry = store.findEntry(
            byRecordIdentifier: credentialIdentity.recordIdentifier ?? ""
        ) else {
            self.extensionContext.cancelRequest(
                withError: NSError(
                    domain: ASExtensionErrorDomain,
                    code: ASExtensionError.credentialIdentityNotFound.rawValue
                )
            )
            return
        }

        // 5. Return the credential to AutoFill.
        let credential = ASPasswordCredential(user: entry.username, password: entry.password)
        self.extensionContext.completeRequest(
            withSelectedCredential: credential,
            completionHandler: nil
        )
    }

    // 6. Called when the system presents your full credential list UI.
    //    The serviceIdentifiers describe the app or website the user is signing in to.
    override func prepareCredentialList(
        for serviceIdentifiers: [ASCredentialServiceIdentifier]
    ) {
        // 7. Build your credential list UI. Filter and sort credentials
        //    by matching against the service identifiers.
        let matchingCredentials = CredentialStore.shared.credentials(
            matching: serviceIdentifiers
        )

        // 8. Present a table/list view. When the user selects a credential
        //    (after optional biometric/master password auth), complete the request.
        let listVC = CredentialListViewController(
            credentials: matchingCredentials,
            onSelect: { [weak self] entry in
                let credential = ASPasswordCredential(
                    user: entry.username,
                    password: entry.password
                )
                self?.extensionContext.completeRequest(
                    withSelectedCredential: credential,
                    completionHandler: nil
                )
            },
            onCancel: { [weak self] in
                self?.extensionContext.cancelRequest(
                    withError: NSError(
                        domain: ASExtensionErrorDomain,
                        code: ASExtensionError.userCanceled.rawValue
                    )
                )
            }
        )
        // 9. Push or present your list view controller.
        self.addChild(listVC)
        self.view.addSubview(listVC.view)
        listVC.view.frame = self.view.bounds
        listVC.didMove(toParent: self)
    }

    // 10. Called when provideCredentialWithoutUserInteraction fails with
    //     userInteractionRequired. Show authentication UI, then provide the credential.
    override func prepareInterfaceToProvideCredential(
        for credentialIdentity: ASPasswordCredentialIdentity
    ) {
        // Show biometric prompt or master password entry.
        // On success, look up the credential and call completeRequest.
    }
}

// 11. Populate the identity store so credentials appear in the QuickType bar.
//     Call this from your containing app whenever the credential database changes.
func updateCredentialIdentityStore(entries: [CredentialEntry]) {
    let identities = entries.map { entry in
        ASPasswordCredentialIdentity(
            serviceIdentifier: ASCredentialServiceIdentifier(
                identifier: entry.domain,
                type: .domain
            ),
            user: entry.username,
            recordIdentifier: entry.id
        )
    }

    // 12. Replace all identities in the store with the current set.
    ASCredentialIdentityStore.shared.replaceCredentialIdentities(
        with: identities
    ) { success, error in
        if let error = error {
            print("Failed to update identity store: \(error)")
        }
    }
}
```

## Usage

- Create: `bun create target credentials-provider`
- Edit: `targets/credentials-provider/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| iOS | 12.0+ | Password AutoFill. Passkeys in 17.0+. One-time codes in 18.0+. |
| iPadOS | 12.0+ | Same as iOS. |
| macOS | 11.0+ | Supported via AuthenticationServices. Some developers report code-signing entitlement issues on macOS. |
| watchOS | -- | Not supported. |
| visionOS | 1.0+ | Supported for password and passkey AutoFill. |
| tvOS | -- | Not supported. |

## Gotchas

- **AutoFill Credential Provider entitlement is required.** Both the extension and the containing app must include the `com.apple.developer.authentication-services.autofill-credential-provider` entitlement. Without it, the extension will not appear in Settings and AutoFill will not invoke it.
- **User must explicitly enable your provider in Settings.** Your extension is disabled by default. The user must go to Settings > Passwords > Password Options and enable your app. Guide the user to this screen from your containing app, as there is no API to deep-link directly to it.
- **Data sharing requires App Groups or Shared Keychain.** The extension runs in a separate process. Use App Groups (`UserDefaults(suiteName:)` or shared file containers) or Shared Keychain Access Groups to share the credential database between the app and extension.
- **provideCredentialWithoutUserInteraction must be fast.** This method is called inline during the QuickType bar flow. If it takes too long or shows UI, the system cancels the request. Return the credential immediately or throw `userInteractionRequired` to fall back to the interactive flow.
- **Identity store must be kept in sync.** The QuickType bar only shows credentials that have been registered in `ASCredentialIdentityStore`. If the user adds or deletes credentials in your app, you must update the store immediately. Stale identities lead to a broken user experience where tapping a QuickType suggestion fails to find the credential.
- **Passkey support requires Info.plist capabilities (iOS 17+).** To provide passkeys, add `ASCredentialProviderExtensionCapabilities` to your extension's Info.plist with `ProvidesPasskeys` set to `true`. Without this key, passkey requests are never routed to your extension.
- **One-time code support requires additional capability (iOS 18+).** To provide TOTP codes, add `ProvidesOneTimeCodes` to `ASCredentialProviderExtensionCapabilities`. This feature was introduced in iOS 18.
- **No direct biometric API in the extension.** While you can use `LAContext` for Local Authentication within the extension, the UI presentation context can be tricky. Test biometric prompts thoroughly on real devices, as Simulator behavior differs.
- **Extension has limited memory and runtime.** Like all app extensions, credential providers run with constrained resources. Avoid loading the entire credential database into memory. Use efficient queries against your encrypted store.
- **iCloud Keychain is always an option alongside your provider.** Users can enable multiple credential providers simultaneously. Your extension competes with iCloud Keychain and other providers for QuickType bar space. Ensure your identities have accurate service identifiers to rank well.
