---
title: Single Sign-On Extension (Authentication Services)
description: Enterprise SSO extension that intercepts web authentication requests to your identity provider and handles them natively, eliminating browser-based login flows on managed devices.
version: iOS 13.0+, macOS 10.15+
---

# Single Sign-On Extension (`authentication-services`)

An Authentication Services SSO extension intercepts HTTP authentication requests destined for your identity provider (IdP) and handles them directly in the extension process rather than loading a web login page. When any app or Safari on a managed device makes a request to a URL matching your IdP's domain, the system routes the authentication challenge to your extension. The extension can authenticate silently using device credentials, present a native login UI, use Secure Enclave keys, or perform multi-factor authentication -- all without a browser redirect. This is the foundation of enterprise SSO on Apple platforms, used by Okta, Microsoft Entra ID (Azure AD), Jamf Connect, and Apple's own internal SSO infrastructure.

## Apple Documentation

- [ASAuthorizationProviderExtensionAuthorizationRequestHandler](https://developer.apple.com/documentation/authenticationservices/asauthorizationproviderextensionauthorizationrequesthandler) -- The protocol your extension implements to handle authorization requests.
- [ASAuthorizationProviderExtensionAuthorizationRequest](https://developer.apple.com/documentation/authenticationservices/asauthorizationproviderextensionauthorizationrequest) -- The request object passed to your handler, containing the URL, headers, and body.
- [Creating Extensions That Support Platform SSO](https://developer.apple.com/documentation/authenticationservices/creating-extensions-that-support-platform-sso) -- Guide for building extensions that integrate with macOS login.
- [ASAuthorizationProviderExtensionLoginManager](https://developer.apple.com/documentation/authenticationservices/asauthorizationproviderextensionloginmanager) -- Platform SSO login manager for macOS (macOS 13+).
- [AuthenticationServices Framework](https://developer.apple.com/documentation/authenticationservices)
- [Platform Single Sign-On for macOS (Deployment Guide)](https://support.apple.com/guide/deployment/platform-sso-for-macos-dep7bbb05313/web)

## WWDC History

- **[WWDC 2019 -- What's New in Managing Apple Devices](https://developer.apple.com/videos/play/wwdc2019/303/)** -- Introduced Extensible Enterprise SSO. Announced the `ASAuthorizationProviderExtensionAuthorizationRequestHandler` protocol and the requirement for MDM-managed configuration.
- **[Tech Talk 301 -- Introducing Extensible Enterprise SSO](https://developer.apple.com/videos/play/tech-talks/301/)** -- Dedicated deep-dive into the SSO extension architecture, including how the system intercepts HTTP requests, the difference between Redirect and Credential extension types, and the MDM profile keys.
- **[WWDC 2020 -- What's New in Managing Apple Devices](https://developer.apple.com/videos/play/wwdc2020/10639/)** -- Updates to SSO extension capabilities, including associated domains for extension discovery.
- **[WWDC 2022, Session 10045 -- What's New in Managing Apple Devices](https://developer.apple.com/videos/play/wwdc2022/10045/)** -- Introduced **Platform SSO** for macOS 13 Ventura. Ties the local user account to the IdP, enabling sign-in at the macOS login window with IdP credentials or Secure Enclave keys. Replaces Active Directory binding.
- **[WWDC 2023 -- Manage Devices with Apple Frameworks](https://developer.apple.com/videos/play/wwdc2023/10040/)** -- Platform SSO enhancements: device compliance integration, improved token handling.

## What It Does

1. **MDM deploys a configuration profile.** The enterprise MDM server pushes an Extensible SSO profile to the device. This profile specifies your extension's bundle identifier, the IdP URLs it handles, and whether it operates in **Redirect** mode (intercepts HTTP redirects to your IdP) or **Credential** mode (intercepts HTTP 401 challenges).
2. **App or Safari makes an HTTP request.** When any app on the device makes a request that matches the configured IdP URLs, the system intercepts it before the response reaches the app.
3. **System loads your extension.** The system calls `beginAuthorization(with:)` on your `ASAuthorizationProviderExtensionAuthorizationRequestHandler`, passing an `ASAuthorizationProviderExtensionAuthorizationRequest` containing the original URL, HTTP headers, and body.
4. **Extension authenticates.** Your extension can:
   - Complete silently by returning HTTP authorization headers (e.g., a cached token).
   - Present a native login UI via `request.presentAuthorizationViewController(completion:)`.
   - Perform device-bound authentication using Secure Enclave keys.
   - Call your IdP's token endpoint and return the result.
5. **Extension completes the request.** Call one of:
   - `request.complete(httpAuthorizationHeaders:)` -- inject auth headers into the original request.
   - `request.complete(httpResponse:httpBody:)` -- return a full HTTP response.
   - `request.complete(error:)` -- fail the authentication.
   - `request.doNotHandle()` -- pass through to the default web flow.
6. **App receives authenticated response.** The requesting app is unaware that an extension handled the auth. It receives the response as if the server returned it directly.

### Platform SSO (macOS 13+)

Platform SSO extends this mechanism to the macOS login window:

1. At the login screen, the user enters their IdP password (or uses Touch ID backed by a Secure Enclave key).
2. The system calls your extension's `ASAuthorizationProviderExtensionLoginManager` to authenticate with the IdP.
3. On success, the local macOS account is unlocked and the user is simultaneously authenticated to the IdP for all subsequent SSO requests.
4. This replaces Active Directory binding and mobile accounts.

## Use Cases

### Enterprise Identity Providers
Okta, Microsoft Entra ID (formerly Azure AD), Ping Identity, and OneLogin build SSO extensions so their customers' managed devices get native, seamless authentication across all apps and Safari. Employees sign in once and are silently authenticated everywhere.

### Government and Regulated Industries
Organizations in healthcare, finance, and government use SSO extensions combined with certificate-based authentication or smart cards. The extension can enforce compliance policies (device attestation, OS version checks) before issuing tokens.

### Education (Higher Ed)
Universities deploy SSO extensions via MDM so students and staff get seamless SAML/OIDC authentication across learning management systems, email, and internal portals without repeated browser-based login prompts.

### macOS Login with Cloud Identity (Platform SSO)
IT departments use Platform SSO to eliminate Active Directory binding. Employees log in to their Mac at the login window with their cloud IdP credentials. Jamf Connect and Microsoft Entra ID are the primary Platform SSO providers as of 2025.

## Key Classes

| Class / Protocol | Role |
|------------------|------|
| `ASAuthorizationProviderExtensionAuthorizationRequestHandler` | Protocol your extension's principal class conforms to. Implement `beginAuthorization(with:)` to handle incoming auth requests. |
| `ASAuthorizationProviderExtensionAuthorizationRequest` | The request object. Contains `url`, `httpHeaders`, `httpBody`, `realm`, `requestedOperation`, `callerBundleIdentifier`. Call `complete(...)` or `doNotHandle()` when finished. |
| `ASAuthorizationProviderExtensionLoginManager` | macOS 13+ Platform SSO manager. Handles login window authentication, user registration, device registration, and token management. |
| `ASAuthorizationSingleSignOnProvider` | Used by client apps to explicitly trigger the SSO extension (less common -- most usage is automatic via HTTP interception). |
| `ASAuthorizationSingleSignOnCredential` | The credential returned to client apps after successful SSO authentication. |

## Implementation

### Redirect-Type SSO Extension

```swift
import AuthenticationServices

// 1. Conform to the SSO request handler protocol.
//    This class is declared as NSExtensionPrincipalClass in Info.plist.
class AuthenticationExtension: NSObject,
    ASAuthorizationProviderExtensionAuthorizationRequestHandler {

    private var currentRequest: ASAuthorizationProviderExtensionAuthorizationRequest?

    // 2. Called when the system intercepts an HTTP request matching
    //    your IdP's configured URLs.
    func beginAuthorization(
        with request: ASAuthorizationProviderExtensionAuthorizationRequest
    ) {
        self.currentRequest = request

        // 3. Check if we have a cached token that is still valid.
        if let cachedToken = TokenCache.shared.validToken(for: request.url) {
            // 4. Complete silently by injecting the auth header.
            //    The requesting app never sees a login prompt.
            request.complete(
                httpAuthorizationHeaders: [
                    "Authorization": "Bearer \(cachedToken)"
                ]
            )
            return
        }

        // 5. No valid cached token -- authenticate with the IdP.
        //    For a Redirect-type extension, exchange the intercepted
        //    URL for tokens using your IdP's token endpoint.
        authenticateWithIdP(request: request)
    }

    private func authenticateWithIdP(
        request: ASAuthorizationProviderExtensionAuthorizationRequest
    ) {
        // 6. Build a token request to your IdP.
        let tokenURL = URL(string: "https://idp.example.com/oauth2/token")!
        var tokenRequest = URLRequest(url: tokenURL)
        tokenRequest.httpMethod = "POST"
        tokenRequest.setValue(
            "application/x-www-form-urlencoded",
            forHTTPHeaderField: "Content-Type"
        )

        // 7. Include device attestation or client certificate for
        //    strong device identity.
        let body = "grant_type=device_code&client_id=myapp&device_id=\(deviceId())"
        tokenRequest.httpBody = body.data(using: .utf8)

        URLSession.shared.dataTask(with: tokenRequest) { data, response, error in
            guard let data = data,
                  let httpResponse = response as? HTTPURLResponse,
                  error == nil else {
                // 8. If IdP is unreachable, fall back to web login.
                request.doNotHandle()
                return
            }

            if httpResponse.statusCode == 200 {
                // 9. Parse the token and cache it.
                if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let accessToken = json["access_token"] as? String {
                    TokenCache.shared.store(token: accessToken, for: request.url)

                    // 10. Complete the request with the authorization header.
                    request.complete(
                        httpAuthorizationHeaders: [
                            "Authorization": "Bearer \(accessToken)"
                        ]
                    )
                } else {
                    request.complete(error: SSOError.invalidResponse)
                }
            } else {
                // 11. Token request failed -- present native login UI.
                request.presentAuthorizationViewController(completion: { success, error in
                    if !success {
                        request.complete(
                            error: error ?? SSOError.userCancelled
                        )
                    }
                    // The view controller handles completion via
                    // request.complete(httpAuthorizationHeaders:).
                })
            }
        }.resume()
    }

    private func deviceId() -> String {
        // Return a stable device identifier for your IdP.
        return UIDevice.current.identifierForVendor?.uuidString ?? "unknown"
    }
}

enum SSOError: Error {
    case invalidResponse
    case userCancelled
}
```

### Minimal Extension (Template)

The `create-target` scaffold produces this minimal starting point:

```swift
import AuthenticationServices

class AuthenticationExtension: NSObject,
    ASAuthorizationProviderExtensionAuthorizationRequestHandler {

    func beginAuthorization(
        with request: ASAuthorizationProviderExtensionAuthorizationRequest
    ) {
        // Pass through to default web login until implementation is ready.
        request.doNotHandle()
    }
}
```

## Usage

- Create: `bun create target authentication-services`
- Edit: `targets/authentication-services/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| iOS | 13.0+ | Redirect and Credential SSO extension types. Requires MDM configuration profile. |
| iPadOS | 13.0+ | Same as iOS. Shared iPad also supported. |
| macOS | 10.15+ | SSO extensions. Platform SSO (login window integration) requires macOS 13.0+. Simplified Setup in macOS 26+. |
| watchOS | -- | Not supported. |
| tvOS | -- | Not supported. tvOS has no SSO extension mechanism. |
| visionOS | 1.0+ | SSO extensions are supported on managed devices. |

## Gotchas

- **MDM is absolutely required.** The SSO extension does nothing without a configuration profile deployed via MDM (Jamf, Intune, Kandji, Mosyle, etc.). The profile maps your IdP's URLs to your extension's bundle identifier. Without it, the system never loads your extension. There is no way for a user to manually enable an SSO extension.
- **Two extension types: Redirect vs. Credential.** A **Redirect** extension intercepts HTTP 302 redirects to your IdP and handles the login flow. A **Credential** extension intercepts HTTP 401 challenges and provides credentials directly. Choose based on your IdP's flow. If you need to provide headers, use a Credential extension -- Redirect extensions are for handling full request/response flows.
- **Associated Domains are required for URL matching.** Your app must declare associated domains (`authsrv:` prefix) matching your IdP's URLs, or the URL list must be provided via the MDM profile. Without this, the system cannot determine which requests to route to your extension.
- **Testing requires a managed device.** You cannot test SSO extensions on the iOS Simulator or on unmanaged devices. You need either a real device enrolled in MDM or Apple Configurator 2 to push a configuration profile.
- **`doNotHandle()` is your escape hatch.** If your extension encounters a request it cannot handle, call `request.doNotHandle()` to let the system fall back to the default web-based login. Never leave a request hanging without calling a completion method.
- **Platform SSO requires macOS 13+ and IdP support.** Platform SSO is not a drop-in feature. Your IdP must implement the protocol, including device registration, token exchange, and key attestation endpoints. As of 2025, only Microsoft Entra ID, Okta, and Jamf Connect have production Platform SSO implementations.
- **Extension runs in a separate process with limited memory.** Keep your extension lightweight. Heavy operations (large token caches, complex UI) can cause the system to terminate your extension.
- **Apple uses this internally.** Apple has its own SSO extension for corporate authentication, which is how Apple employees get single sign-on across internal tools. This is evidence the API is production-hardened but also means Apple prioritizes enterprise use cases.
- **The Kerberos SSO extension is built in.** Apple ships a built-in Kerberos SSO extension (`com.apple.AppSSOKerberos.KerberosExtension`) that handles Active Directory/Kerberos authentication automatically when configured via MDM. You only need a custom extension for SAML, OIDC, or proprietary auth protocols.
