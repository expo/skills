---
title: Matter Device Setup Extension
description: Provides a custom commissioning flow for pairing Matter smart home devices into your ecosystem, letting you customize network selection, credential validation, and room assignment.
version: iOS 16.1+
---

# Matter Device Setup Extension (`matter`)

A Matter device setup extension lets your smart home app customize the commissioning experience when users add Matter-compatible accessories. The system handles the Matter protocol handshake, QR code scanning, and network credential management, while your extension customizes the setup UX by validating device credentials, selecting Wi-Fi or Thread networks, commissioning the device onto your fabric, and configuring room assignments. The extension launches in response to `MatterAddDeviceRequest.perform()` called from your main app and runs as a separate process.

## Apple Documentation

- [MatterSupport Framework Overview](https://developer.apple.com/documentation/mattersupport/)
- [MatterAddDeviceExtensionRequestHandler](https://developer.apple.com/documentation/mattersupport/matteradddeviceextensionrequesthandler)
- [Adding Matter Support to Your Ecosystem](https://developer.apple.com/documentation/mattersupport/adding-matter-support-to-your-ecosystem)
- [MatterAddDeviceRequest](https://developer.apple.com/documentation/mattersupport/matteradddevicerequest)
- [Matter Framework (low-level)](https://developer.apple.com/documentation/matter)
- [Apple Home -- Matter](https://developer.apple.com/apple-home/matter/)

## WWDC History

- **[WWDC 2021, Session 10298 -- Add Support for Matter in Your Smart Home App](https://developer.apple.com/videos/play/wwdc2021/10298/)** -- Introduced Matter as a new industry standard for smart home accessories, covered the initial HomeKit + Matter integration, and explained how iOS handles accessory pairing, network provisioning, and multi-ecosystem support.

## What It Does

1. **Your app initiates pairing.** The main app creates a `MatterAddDeviceRequest` and calls `perform()`. iOS takes over and presents the pairing UI, including QR code scanning.
2. **System performs device discovery.** iOS scans the Matter setup code, discovers the device over BLE, and begins the PASE (Passcode Authenticated Session Establishment) handshake.
3. **Extension validates credentials.** The system calls `validateDeviceCredential(_:)` so your extension can perform additional attestation checks against your ecosystem's requirements.
4. **Extension selects network.** Depending on the device's capabilities, the system calls `selectWiFiNetwork(from:)` or `selectThreadNetwork(from:)`. Your extension can pick a specific network or return `.defaultSystemNetwork` to use the device's current network.
5. **Extension commissions the device.** The system calls `commissionDevice(in:onboardingPayload:commissioningID:)` with a payload your extension uses to commission the device onto your fabric via your Matter stack.
6. **Extension configures rooms.** The system calls `rooms(in:)` to get available rooms, then `configureDevice(named:in:)` once the user has named the device and assigned it to a room.

## Use Cases

### Smart home hub manufacturers
A company building a smart home ecosystem app uses the extension to commission Matter devices onto their proprietary fabric, ensuring the device is registered with their cloud backend and assigned to the correct home and room in their system.

### Lighting and appliance manufacturers
A lighting company ships a companion app that uses the Matter extension to pair their bulbs and switches. The extension validates that the device is a genuine product via `validateDeviceCredential(_:)` before commissioning, and selects the optimal Thread network based on signal strength.

### Multi-ecosystem pairing
A smart home platform uses the extension to add devices that are already paired with Apple Home or another ecosystem. Matter's multi-admin feature allows the same physical device to exist on multiple fabrics, and the extension handles the second-fabric commissioning flow.

## Key Classes

| Class / Protocol | Role |
|------------------|------|
| `MatterAddDeviceExtensionRequestHandler` | Abstract base class you subclass. Provides overridable methods for each step of the commissioning flow. |
| `MatterAddDeviceRequest` | Created by your main app to initiate pairing. Call `perform()` to launch the system UI and your extension. |
| `MatterAddDeviceRequest.Home` | Represents a home in your ecosystem. Passed to `commissionDevice(in:...)` and `rooms(in:)`. |
| `MatterAddDeviceRequest.Room` | Represents a room within a home. Return these from `rooms(in:)` for the user to choose from. |
| `MatterAddDeviceExtensionRequestHandler.DeviceCredential` | Contains attestation data for the device. Passed to `validateDeviceCredential(_:)`. |
| `MatterAddDeviceExtensionRequestHandler.WiFiScanResult` | A discovered Wi-Fi network with SSID and signal info. |
| `MatterAddDeviceExtensionRequestHandler.ThreadScanResult` | A discovered Thread network with network name and extended PAN ID. |
| `MatterAddDeviceExtensionRequestHandler.WiFiNetworkAssociation` | Return type for `selectWiFiNetwork(from:)`. Use `.defaultSystemNetwork` or `.network(wifi:)`. |
| `MatterAddDeviceExtensionRequestHandler.ThreadNetworkAssociation` | Return type for `selectThreadNetwork(from:)`. Use `.defaultSystemNetwork` or `.network(thread:)`. |

## Implementation

```swift
import MatterSupport

// 1. Subclass MatterAddDeviceExtensionRequestHandler as the principal class.
class RequestHandler: MatterAddDeviceExtensionRequestHandler {

    // 2. Validate the device's attestation certificate against your ecosystem.
    override func validateDeviceCredential(
        _ deviceCredential: MatterAddDeviceExtensionRequestHandler.DeviceCredential
    ) async throws {
        // Check the device's DAC (Device Attestation Certificate) against
        // your ecosystem's list of approved vendors.
        let isApproved = try await EcosystemAPI.shared.validateAttestation(
            dacCertificate: deviceCredential.certificationDeclaration
        )
        guard isApproved else {
            throw MatterAddDeviceError.attestationFailed
        }
    }

    // 3. Choose a Wi-Fi network for the device.
    override func selectWiFiNetwork(
        from wifiScanResults: [MatterAddDeviceExtensionRequestHandler.WiFiScanResult]
    ) async throws -> MatterAddDeviceExtensionRequestHandler.WiFiNetworkAssociation {
        // Return .defaultSystemNetwork to use the iPhone's current Wi-Fi,
        // or pick a specific network from the scan results.
        return .defaultSystemNetwork
    }

    // 4. Choose a Thread network for Thread-capable devices.
    override func selectThreadNetwork(
        from threadScanResults: [MatterAddDeviceExtensionRequestHandler.ThreadScanResult]
    ) async throws -> MatterAddDeviceExtensionRequestHandler.ThreadNetworkAssociation {
        // Use the system default Thread network unless your ecosystem
        // manages its own border routers.
        return .defaultSystemNetwork
    }

    // 5. Commission the device onto your fabric using the onboarding payload.
    override func commissionDevice(
        in home: MatterAddDeviceRequest.Home?,
        onboardingPayload: String,
        commissioningID: UUID
    ) async throws {
        // The system has already opened a commissioning window on the device.
        // Use the onboardingPayload to establish a CASE session and write
        // your fabric credentials.
        try await MatterStack.shared.commission(
            payload: onboardingPayload,
            commissioningID: commissioningID,
            homeID: home?.displayName
        )
    }

    // 6. Return the rooms in the selected home for the user to pick from.
    override func rooms(
        in home: MatterAddDeviceRequest.Home?
    ) async -> [MatterAddDeviceRequest.Room] {
        guard let home else { return [] }
        let rooms = await EcosystemAPI.shared.fetchRooms(for: home.displayName)
        return rooms.map { MatterAddDeviceRequest.Room(displayName: $0.name) }
    }

    // 7. Finalize configuration after the user names the device and picks a room.
    override func configureDevice(
        named name: String,
        in room: MatterAddDeviceRequest.Room?
    ) async {
        await EcosystemAPI.shared.registerDevice(
            name: name,
            room: room?.displayName
        )
    }
}
```

## Usage

- Create: `bun create target matter`
- Edit: `targets/matter/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| iOS | 16.1+ | Full MatterSupport framework with device setup extension. |
| iPadOS | 16.1+ | Supported. |
| macOS | -- | Not supported. Matter commissioning is iOS/iPadOS only. |
| watchOS | -- | Not supported. |
| tvOS | 16.1+ | HomePod and Apple TV act as Matter controllers but do not run extensions. |
| visionOS | -- | Not supported. |

## Gotchas

- **Entitlement required for distribution.** Development builds can use the "MatterSupport -- Development Only" entitlement enabled in Xcode. For App Store distribution, you must request the managed `com.apple.developer.matter.allow-setup-payload` entitlement from Apple.
- **Extension and app cannot share data bidirectionally.** You can read App Group data written by the main app inside the extension, but writing data from the extension back to the main app via App Groups is unreliable. Use `os_log` and Console.app for debugging the extension.
- **The system may abort the flow after first-fabric commissioning.** A known issue causes `HomeUIService` to stop the setup flow after commissioning to the first fabric, displaying `HMErrorDomain Code=2`. This can happen intermittently and is outside your control.
- **Thread device commissioning can fail with custom border routers.** If your ecosystem manages its own Thread border router rather than using the Apple Home infrastructure, selecting a custom Thread network in `selectThreadNetwork(from:)` may fail silently. Test thoroughly with your specific hardware.
- **`commissionDevice` is not called on re-pairing.** If a device was previously removed from a third-party ecosystem but its fabric entry remains in the iOS keychain, the system may skip calling `commissionDevice` entirely. The user may need to factory-reset the device.
- **The extension has no UI of its own.** The system manages the entire visual flow (QR scanning, home/room selection, progress). Your extension only provides data and logic via the handler overrides. You cannot present custom view controllers.
- **Matter protocol version matters.** Ensure your Matter stack supports the same specification version as the device. Mismatched versions can cause silent commissioning failures that surface as generic errors in the extension.
