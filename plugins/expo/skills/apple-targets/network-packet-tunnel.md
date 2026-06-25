---
title: Packet Tunnel Provider
description: Implements a custom VPN client that captures all device network traffic at the IP layer, tunneling it through your VPN server.
version: iOS 9.0+, macOS 10.11+
---

# Packet Tunnel Provider (`network-packet-tunnel`)

A network extension that implements the client side of a custom VPN tunneling protocol. The system routes all device IP traffic through your extension, which reads and writes raw IP packets via a virtual network interface and forwards them to your VPN server over an encrypted connection.

## Apple Documentation

- [Packet Tunnel Provider](https://developer.apple.com/documentation/networkextension/packet-tunnel-provider) -- overview guide for implementing a VPN client
- [NEPacketTunnelProvider](https://developer.apple.com/documentation/networkextension/nepackettunnelprovider) -- principal class to subclass
- [NEPacketTunnelNetworkSettings](https://developer.apple.com/documentation/networkextension/nepackettunnelnetworksettings) -- virtual interface configuration (DNS, routes, MTU)
- [NEPacketTunnelFlow](https://developer.apple.com/documentation/networkextension/nepackettunnelflow) -- read/write IP packets from the tunnel's virtual interface
- [NETunnelProviderManager](https://developer.apple.com/documentation/networkextension/netunnelprovidermanager) -- configure and control the tunnel from the containing app
- [TN3120: Expected use cases for Network Extension packet tunnel providers](https://developer.apple.com/documentation/technotes/tn3120-expected-use-cases-for-network-extension-packet-tunnel-providers) -- Apple's guidance on approved use cases

## WWDC History

- **[WWDC 2015, Session 717 -- What's New in Network Extension and VPN](https://developer.apple.com/videos/play/wwdc2015/717/)** -- Introduced NEPacketTunnelProvider alongside the NETunnelProvider family of APIs for custom VPN protocols on iOS 9 and OS X 10.11.
- **[WWDC 2017, Session 707 -- Advances in Networking, Part 1](https://developer.apple.com/videos/play/wwdc2017/707/)** -- Covered Network Extension framework updates including improvements to tunnel providers.
- **[WWDC 2019, Session 714 -- Network Extensions for the Modern Mac](https://developer.apple.com/videos/play/wwdc2019/714/)** -- Introduced System Extensions on macOS Catalina, allowing packet tunnel providers to run as system extensions instead of kernel extensions.

## What It Does

1. The user enables the VPN from Settings or your app calls `NETunnelProviderManager.loadAllFromPreferences()` and starts the connection.
2. The system launches your extension and calls `startTunnel(options:completionHandler:)`.
3. Your extension establishes a connection to the VPN server (TLS, UDP, custom protocol).
4. You configure the virtual interface by calling `setTunnelNetworkSettings(_:completionHandler:)` with DNS servers, IP routes, MTU, and proxy settings.
5. The system begins routing device traffic to the tunnel's virtual interface.
6. Your extension reads outbound IP packets from `packetFlow.readPackets(completionHandler:)`, encrypts them, and sends them to the server.
7. Your extension receives encrypted packets from the server, decrypts them, and writes them back via `packetFlow.writePackets(_:withProtocols:)`.
8. When the user disconnects, the system calls `stopTunnel(with:completionHandler:)`.

## Use Cases

### Custom VPN Client
Apps like WireGuard and OpenVPN that implement non-standard VPN protocols. The packet tunnel provider gives you raw IP packets so you can wrap them in any tunneling protocol your server supports.

### Enterprise Network Security
Corporate VPN solutions that route all employee device traffic through a secure gateway for compliance, data loss prevention, and access to internal resources behind a firewall.

### Privacy-Focused Networking
Consumer VPN apps that encrypt all device traffic to protect users on untrusted networks (public Wi-Fi, hotel networks) by tunneling everything to a trusted exit node.

## Key Classes

| Class | Role |
|-------|------|
| `NEPacketTunnelProvider` | Subclass this. The system calls `startTunnel` and `stopTunnel` on it. Read/write IP packets via `packetFlow`. |
| `NEPacketTunnelNetworkSettings` | Configures the virtual TUN interface -- DNS servers, IPv4/IPv6 routes, MTU, proxy settings. |
| `NEPacketTunnelFlow` | The packet I/O object. Call `readPackets` to get outbound IP packets and `writePackets` to inject inbound packets. |
| `NETunnelProviderManager` | Used by the containing app to install, configure, and start/stop the tunnel. |
| `NETunnelProviderProtocol` | Holds the VPN configuration: server address, provider bundle identifier, and custom `providerConfiguration` dictionary. |

## Implementation

### Packet Tunnel Provider (Realistic VPN Client)

```swift
import NetworkExtension

class PacketTunnelProvider: NEPacketTunnelProvider {

    private var connection: NWTCPConnection?
    private var pendingStartCompletion: ((Error?) -> Void)?

    // 1. System calls this when the user enables the VPN.
    override func startTunnel(
        options: [String: NSObject]?,
        completionHandler: @escaping (Error?) -> Void
    ) {
        let serverAddress = protocolConfiguration.serverAddress ?? "vpn.example.com"
        let port = (protocolConfiguration as? NETunnelProviderProtocol)?
            .providerConfiguration?["port"] as? String ?? "443"

        // 2. Establish a connection to the VPN server through the system's
        //    network stack (not the tunnel itself).
        let endpoint = NWHostEndpoint(hostname: serverAddress, port: port)
        connection = createTCPConnectionThroughTunnel(
            to: endpoint,
            enableTLS: true,
            tlsParameters: nil,
            delegate: nil
        )

        // 3. Configure the virtual network interface.
        let settings = NEPacketTunnelNetworkSettings(tunnelRemoteAddress: serverAddress)

        // IPv4 settings -- route all traffic through the tunnel.
        let ipv4 = NEIPv4Settings(
            addresses: ["10.8.0.2"],
            subnetMasks: ["255.255.255.0"]
        )
        ipv4.includedRoutes = [NEIPv4Route.default()]
        settings.ipv4Settings = ipv4

        // DNS settings
        settings.dnsSettings = NEDNSSettings(servers: ["10.8.0.1"])

        // MTU
        settings.mtu = 1400 as NSNumber

        // 4. Apply the settings. Once complete, the system starts routing
        //    traffic to the tunnel's virtual interface.
        setTunnelNetworkSettings(settings) { error in
            if let error = error {
                completionHandler(error)
                return
            }

            // 5. Begin reading packets from the virtual interface.
            self.readPacketsFromTUN()
            completionHandler(nil)
        }
    }

    // 6. Continuously read outbound IP packets and forward to the VPN server.
    private func readPacketsFromTUN() {
        packetFlow.readPackets { [weak self] packets, protocols in
            guard let self = self else { return }

            for (index, packet) in packets.enumerated() {
                // In a real implementation, encrypt the packet and send
                // it to the VPN server via self.connection.
                self.sendPacketToServer(packet, protocolFamily: protocols[index])
            }

            // 7. Continue reading -- this is a recursive loop.
            self.readPacketsFromTUN()
        }
    }

    private func sendPacketToServer(_ packet: Data, protocolFamily: NSNumber) {
        // Encrypt and frame the packet for your VPN protocol, then write
        // to self.connection. When encrypted packets arrive from the server,
        // decrypt them and call:
        // self.packetFlow.writePackets([decryptedData], withProtocols: [protocolFamily])
    }

    // 8. System calls this when the user disables the VPN.
    override func stopTunnel(
        with reason: NEProviderStopReason,
        completionHandler: @escaping () -> Void
    ) {
        connection?.cancel()
        connection = nil
        completionHandler()
    }

    // 9. Receive messages from the containing app (e.g., status queries).
    override func handleAppMessage(
        _ messageData: Data,
        completionHandler: ((Data?) -> Void)?
    ) {
        completionHandler?(messageData)
    }

    // 10. Power management hooks for sleep/wake.
    override func sleep(completionHandler: @escaping () -> Void) {
        completionHandler()
    }

    override func wake() {
        // Re-establish server connection if needed.
    }
}
```

### Containing App -- Installing the VPN Configuration

```swift
import NetworkExtension

func installVPNProfile() {
    let manager = NETunnelProviderManager()

    let proto = NETunnelProviderProtocol()
    proto.providerBundleIdentifier = "com.example.app.PacketTunnel"
    proto.serverAddress = "vpn.example.com"
    proto.providerConfiguration = ["port": "443"]

    manager.protocolConfiguration = proto
    manager.localizedDescription = "My VPN"
    manager.isEnabled = true

    manager.saveToPreferences { error in
        if let error = error {
            print("Failed to save VPN profile: \(error)")
            return
        }
        // Now the user can enable the VPN from Settings or programmatically.
    }
}
```

## Usage

- Create: `bun create target network-packet-tunnel`
- Edit: `targets/network-packet-tunnel/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| iOS | 9.0+ | Full support. |
| iPadOS | 9.0+ | Full support. |
| macOS | 10.11+ | Runs as app extension (10.11) or system extension (10.15+). |
| tvOS | 17.0+ | Added in tvOS 17. |
| visionOS | 1.0+ | Supported. |
| watchOS | -- | Not supported. |

## Gotchas

- **Network Extension entitlement required.** You must request the Network Extension entitlement from Apple via [the request form](https://developer.apple.com/contact/request/network-extension/). Your app will be rejected without it. This is a manual approval process that can take days or weeks.
- **Memory limit is strict.** Packet tunnel providers run in a low-memory extension environment (typically ~15 MB on iOS). Exceeding the limit causes the system to kill your extension silently. Profile memory usage carefully and avoid buffering large amounts of packet data.
- **`readPackets` is a recursive loop, not a delegate.** You must call `readPackets(completionHandler:)` again inside its own completion handler to keep receiving packets. Forgetting to re-call it will silently stop all traffic flow.
- **Use `createTCPConnectionThroughTunnel` for server connections.** If you create a normal `URLSession` or `NWConnection` from within the extension, your traffic will loop through the tunnel itself. Use the provider's `createTCPConnection(to:enableTLS:)` or `createUDPSession(to:from:)` methods to reach your VPN server outside the tunnel.
- **TN3120 lists approved use cases.** Apple explicitly states that packet tunnel providers should only be used for VPN. Using them for content filtering, ad blocking, or local traffic inspection (loopback VPN tricks) may result in App Store rejection. See [TN3120](https://developer.apple.com/documentation/technotes/tn3120-expected-use-cases-for-network-extension-packet-tunnel-providers).
- **`setTunnelNetworkSettings` must complete before reading packets.** If you start calling `readPackets` before the settings completion handler fires, you will get no packets. Always chain the read loop inside the settings callback.
- **Sleep/wake handling is important.** On iOS, the system may suspend your extension when the device sleeps. Override `sleep(completionHandler:)` to save state and `wake()` to re-establish the server connection. Failing to handle this causes VPN disconnections after sleep.
