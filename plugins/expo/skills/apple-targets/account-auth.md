---
title: Account Authentication Modification Extension
description: Lets password managers and apps offer one-tap upgrades from weak passwords to Sign in with Apple or strong auto-generated passwords, triggered from iCloud Keychain security recommendations and AutoFill prompts.
version: iOS 14.0+, macOS 11.0+
---

# Account Authentication Modification Extension (`account-auth`)

An extension that integrates with iCloud Keychain to offer users one-tap account security upgrades. When the system detects a weak, reused, or breached password for your app, it can present your extension to silently upgrade the credential to **Sign in with Apple** or a **strong auto-generated password** -- no manual password reset flow required.

## Apple Documentation

- [Upgrading Account Security With an Account Authentication Modification Extension](https://developer.apple.com/documentation/authenticationservices/upgrading-account-security-with-an-account-authentication-modification-extension)
- [ASAccountAuthenticationModificationViewController](https://developer.apple.com/documentation/authenticationservices/asaccountauthenticationmodificationviewcontroller)
- [ASAccountAuthenticationModificationExtensionContext](https://developer.apple.com/documentation/authenticationservices/asaccountauthenticationmodificationextensioncontext)
- [convertAccountToSignInWithAppleWithoutUserInteraction](https://developer.apple.com/documentation/authenticationservices/asaccountauthenticationmodificationviewcontroller/3650342-convertaccounttosigninwithapplew)
- [changePasswordWithoutUserInteraction](https://developer.apple.com/documentation/authenticationservices/asaccountauthenticationmodificationviewcontroller/changepasswordwithoutuserinteraction(for:existingcredential:newpassword:userinfo:))

## WWDC History

- **[WWDC 2020, Session 10666 -- One-Tap Account Security Upgrades](https://developer.apple.com/videos/play/wwdc2020/10666/)** -- Introduced the extension. The primary reference for implementation. Covers both upgrade paths, the non-interactive and interactive flows, and associated domain setup.
- **[WWDC 2020, Session 10173 -- Get the Most Out of Sign in with Apple](https://developer.apple.com/videos/play/wwdc2020/10173/)** -- Covers the Sign in with Apple upgrade path in the context of broader SIWA adoption.
- **[WWDC 2022, Session 10122 -- Enhance Your Sign in with Apple Experience](https://developer.apple.com/videos/play/wwdc2022/10122/)** -- Follow-up with refined guidance on offering upgrades to existing users.

## What It Does

The extension provides two upgrade paths:

1. **Upgrade to Sign in with Apple** -- Converts a password-based account to use Sign in with Apple. The system handles the SIWA authorization, your extension calls your backend to swap the credential, and the old password is deleted from iCloud Keychain.

2. **Upgrade to a strong password** -- Replaces a weak/reused password with a system-generated strong password. The system generates the password (respecting your app's password rules), your extension calls your backend to change it, and iCloud Keychain stores the new credential.

Users encounter these upgrades in three places:
- **Security Recommendations** in Settings > Passwords (flagged weak/breached passwords)
- **Password detail view** in the iCloud Keychain password manager
- **Automatic system prompts** when signing in with a weak password via AutoFill

## Use Cases

### Apps with password-based accounts
Any app that stores user credentials and wants to proactively upgrade users to stronger authentication. The system surfaces your extension when it detects the user's saved password is weak, reused, or appeared in a known data breach.

### Sign in with Apple migration
Apps adopting Sign in with Apple for existing users. Instead of building a manual migration flow, the extension lets users upgrade with a single tap from the password manager.

### Password manager integration
Third-party password managers can use this extension to offer automated credential upgrades when the system flags security issues.

## Prerequisites

Before the extension works, your app must be associated with your web domain:

1. Add an `apple-app-site-association` file to your server with a `webcredentials` entry:

```json
{
  "webcredentials": {
    "apps": ["TEAMID.com.example.myapp"]
  }
}
```

2. Add the Associated Domains capability to your app with `webcredentials:example.com`.

This association is how the system knows which saved passwords belong to your app.

## Key Classes

| Class | Role |
|-------|------|
| `ASAccountAuthenticationModificationViewController` | Principal view controller. Subclass this. The system calls your override methods to perform upgrades. Shows UI only when additional authentication is needed. |
| `ASAccountAuthenticationModificationExtensionContext` | The extension context. Use it to complete upgrades, request SIWA authorization, or cancel with errors. |
| `ASCredentialServiceIdentifier` | Identifies the service (domain) the credential belongs to. |
| `ASPasswordCredential` | The existing username + password being upgraded. |

## Implementation

### Sign in with Apple Upgrade (Non-Interactive)

The most common flow. The system calls this when it believes the upgrade can happen silently (user is already authenticated via biometrics to access the password manager).

```swift
import AuthenticationServices

class AccountAuthViewController: ASAccountAuthenticationModificationViewController {

    override func convertAccountToSignInWithAppleWithoutUserInteraction(
        for serviceIdentifier: ASCredentialServiceIdentifier,
        existingCredential: ASPasswordCredential,
        userInfo: [AnyHashable: Any]?
    ) {
        // 1. Validate the existing credential with your backend
        guard validateCredential(existingCredential) else {
            // If you need to show UI for 2FA or re-auth, request it:
            self.extensionContext.cancelRequest(
                withError: ASExtensionError(.userInteractionRequired)
            )
            return
        }

        // 2. Request Sign in with Apple authorization
        self.extensionContext.getSignInWithAppleUpgradeAuthorization(
            state: generateState(),
            nonce: generateNonce()
        ) { authorization, error in
            guard let authorization = authorization else {
                self.extensionContext.cancelRequest(
                    withError: ASExtensionError(.failed)
                )
                return
            }

            // 3. Send the SIWA credential to your backend to link accounts
            let appleIDCredential = authorization.credential
                as! ASAuthorizationAppleIDCredential

            self.upgradeAccountOnServer(
                existingCredential: existingCredential,
                appleIDCredential: appleIDCredential
            ) { success in
                if success {
                    // 4. Tell the system the upgrade succeeded.
                    //    The old password is deleted from iCloud Keychain.
                    self.extensionContext.completeUpgradeToSignInWithApple()
                } else {
                    self.extensionContext.cancelRequest(
                        withError: ASExtensionError(.failed)
                    )
                }
            }
        }
    }
}
```

### Strong Password Upgrade (Non-Interactive)

```swift
override func changePasswordWithoutUserInteraction(
    for serviceIdentifier: ASCredentialServiceIdentifier,
    existingCredential: ASPasswordCredential,
    newPassword: String,
    userInfo: [AnyHashable: Any]?
) {
    // 1. Validate existing credential
    guard validateCredential(existingCredential) else {
        self.extensionContext.cancelRequest(
            withError: ASExtensionError(.userInteractionRequired)
        )
        return
    }

    // 2. Change the password on your backend
    changePasswordOnServer(
        username: existingCredential.user,
        oldPassword: existingCredential.password,
        newPassword: newPassword
    ) { success in
        if success {
            // 3. Complete with the updated credential.
            //    iCloud Keychain stores the new strong password.
            let newCredential = ASPasswordCredential(
                user: existingCredential.user,
                password: newPassword
            )
            self.extensionContext.completeChangePasswordRequest(
                updatedCredential: newCredential
            )
        } else {
            self.extensionContext.cancelRequest(
                withError: ASExtensionError(.failed)
            )
        }
    }
}
```

### Interactive Flow (When Additional Auth Is Needed)

If you cancel with `.userInteractionRequired`, the system presents your view controller's UI. Override the `prepareInterface` methods to show a step-up authentication screen (e.g., SMS 2FA code entry):

```swift
override func prepareInterfaceToConvertAccountToSignInWithApple(
    for serviceIdentifier: ASCredentialServiceIdentifier,
    existingCredential: ASPasswordCredential,
    userInfo: [AnyHashable: Any]? = nil
) {
    // Show your 2FA or re-authentication UI here.
    // When the user completes it, call the same
    // getSignInWithAppleUpgradeAuthorization / completeUpgradeToSignInWithApple
    // flow from your action handler.
}

override func prepareInterfaceToChangePassword(
    for serviceIdentifier: ASCredentialServiceIdentifier,
    existingCredential: ASPasswordCredential,
    newPassword: String,
    userInfo: [AnyHashable: Any]? = nil
) {
    // Show your re-authentication UI here.
    // When complete, call completeChangePasswordRequest.
}
```

### In-App Upgrade Trigger

You can also trigger upgrades from within your app (not just from the password manager):

```swift
import AuthenticationServices

let controller = ASAccountAuthenticationModificationController()
controller.delegate = self
controller.presentationContextProvider = self

// Request a Sign in with Apple upgrade
let request = ASAccountAuthenticationModificationUpgradePasswordToStrongPasswordRequest(
    user: "username",
    serviceIdentifier: ASCredentialServiceIdentifier(
        identifier: "example.com",
        type: .domain
    )
)
controller.perform(request)
```

## Info.plist Configuration

The extension declares which upgrade types it supports:

| Key | Type | Description |
|-----|------|-------------|
| `ASAccountAuthenticationModificationSupportsUpgradeToSignInWithApple` | Boolean | Set `true` to offer Sign in with Apple upgrades. |
| `ASAccountAuthenticationModificationSupportsStrongPasswordChange` | Boolean | Set `true` to offer strong password upgrades. |

Both are enabled by default in the `@bacons/apple-targets` config plugin.

## Usage

- Create: `bun create target account-auth`
- Edit: `targets/account-auth/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| iOS | 14.0+ | Full support. |
| iPadOS | 14.0+ | Full support. |
| macOS | 11.0+ | Full support. |
| visionOS | 1.0+ | Supported. |
| watchOS | -- | Not supported. |
| tvOS | -- | Not supported. |

## Gotchas

- **Associated Domains are required.** The extension only activates for passwords saved against domains you own. Without a valid `apple-app-site-association` file and the `webcredentials` associated domain, the system will never surface your extension.
- **Prefer non-interactive flows.** Apple recommends completing upgrades without UI whenever possible. Only request `.userInteractionRequired` when you genuinely need a step-up authentication (2FA, re-auth). Unnecessary UI friction defeats the purpose of one-tap upgrades.
- **iOS 18 Passwords app limitation.** As of iOS 18, these extensions are not invoked from the new standalone Passwords app. They still work from AutoFill prompts and from within your own app. Apple has acknowledged this gap.
- **The old password is deleted on SIWA upgrade.** After `completeUpgradeToSignInWithApple()`, the system removes the password from iCloud Keychain. Make sure your backend has fully linked the Apple ID before completing.
- **No third-party tutorials exist.** This is a niche API. The WWDC 2020 session and Apple's documentation are the only substantive references available.
