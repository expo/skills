---
title: App Proxy Provider
description: Implements a flow-oriented network proxy that routes specific app traffic through a custom proxy server, operating at the TCP/UDP flow level rather than raw IP packets.
version: iOS 9.0+, macOS 10.11+
---

# App Proxy Provider (`network-app-proxy`)

A network extension that implements the client side of a custom app-layer proxy protocol. Unlike the packet tunnel provider which captures all device traffic as raw IP packets, the app proxy provider operates at the flow level, receiving individual TCP and UDP connections (`NEAppProxyTCPFlow` and `NEAppProxyUDPFlow`) from specific apps matched by per-app VPN rules. This makes it ideal for enterprise per-app VPN solutions where only designated managed apps need to route traffic through a proxy.

## Apple Documentation

- [App Proxy Provider](https://developer.apple.com/documentation/networkextension/app-proxy-provider) -- overview guide for implementing a flow-oriented VPN client
- [NEAppProxyProvider](https://developer.apple.com/documentation/networkextension/neappproxyprovider) -- principal class to subclass
- [NEAppProxyProviderManager](https://developer.apple.com/documentation/networkextension/neappproxyprovidermanager) -- configure and control the proxy from the containing app
- [NEAppProxyTCPFlow](https://developer.apple.com/documentation/networkextension/neappproxytcpflow) -- represents a TCP connection from a matched app
- [NEAppProxyUDPFlow](https://developer.apple.com/documentation/networkextension/neappproxyudpflow) -- represents a UDP datagram session from a matched app
- [NEAppProxyFlow](https://developer.apple.com/documentation/networkextension/neappproxyflow) -- abstract base class for TCP and UDP flows

## WWDC History

- **[WWDC 2015, Session 717 -- What's New in Network Extension and VPN](https://developer.apple.com/videos/play/wwdc2015/717/)** -- Introduced NEAppProxyProvider as one of two tunnel provider types (alongside packet tunnel). Explained the flow-level vs. IP-level distinction and per-app VPN rules.
- **[WWDC 2017, Session 707 -- Advances in Networking, Part 1](https://developer.apple.com/videos/play/wwdc2017/707/)** -- Covered Network Extension framework updates and improvements to provider lifecycle handling.
- **[WWDC 2019, Session 714 -- Network Extensions for the Modern Mac](https://developer.apple.com/videos/play/wwdc2019/714/)** -- Introduced System Extensions on macOS Catalina, enabling app proxy providers to run as system extensions. Also introduced `NETransparentProxyProvider` as a macOS-only alternative.

## What It Does

1. An MDM profile or app configuration defines per-app VPN rules (`NEAppRule`) that specify which apps should route traffic through the proxy.
2. When a matched app opens a network connection, the system launches your extension and calls `startProxy(options:completionHandler:)`.
3. Your extension establishes a connection to the proxy server using your custom protocol.
4. For each new connection from a matched app, the system calls `handleNewFlow(_:)` with an `NEAppProxyTCPFlow` or `NEAppProxyUDPFlow`.
5. Your extension opens the flow, reads data from it, forwards it through the proxy server, and writes response data back to the flow.
6. When the proxy configuration is removed or the system decides to stop, it calls `stopProxy(with:completionHandler:)`.

## Use Cases

### Enterprise Per-App VPN

Route traffic from specific managed apps (e.g., corporate email, internal wikis) through a secure proxy while leaving personal app traffic on the normal network path. This is the primary use case Apple designed the API for.

### App-Specific Proxy Servers

Proxy traffic from designated applications through a custom protocol that performs inspection, logging, or transformation at the application flow level. Because you receive typed TCP and UDP flows rather than raw packets, you can apply proxy logic without IP-level parsing.

### Selective Traffic Routing

Direct traffic from specific apps through different network paths based on business rules -- for example, routing a finance app through a dedicated secure channel while other corporate apps use a general VPN.

## Key Classes

| Class | Role |
|-------|------|
| `NEAppProxyProvider` | Subclass this. The system calls `startProxy`, `stopProxy`, and `handleNewFlow` on it. |
| `NEAppProxyProviderManager` | Used by the containing app to install, configure, and manage the proxy. Holds `NEAppRule` routing rules. |
| `NEAppProxyTCPFlow` | A single TCP connection from a matched app. Call `open` to begin, then `readData` / `write` to shuttle bytes. |
| `NEAppProxyUDPFlow` | A related stream of UDP datagrams. Call `open` then `readDatagrams` / `writeDatagrams`. |
| `NEAppProxyFlow` | Abstract base of TCP/UDP flows. Provides `metaData` (source app bundle ID, etc.) and `networkInterface`. |
| `NETunnelProviderProtocol` | Configuration object holding server address, provider bundle ID, and custom `providerConfiguration` dictionary. |

## Implementation

### App Proxy Provider (Per-App VPN Proxy)

```swift
import NetworkExtension

class AppProxyProvider: NEAppProxyProvider {

    private var serverConnection: NWTCPConnection?

    // 1. System calls this when a matched app triggers the proxy.
    override func startProxy(
        options: [String: Any]? = nil,
        completionHandler: @escaping (Error?) -> Void
    ) {
        let serverAddress = protocolConfiguration.serverAddress ?? "proxy.example.com"

        // 2. Connect to the proxy server outside the tunnel.
        let endpoint = NWHostEndpoint(hostname: serverAddress, port: "8443")
        serverConnection = createTCPConnectionThroughTunnel(
            to: endpoint,
            enableTLS: true,
            tlsParameters: nil,
            delegate: nil
        )

        serverConnection?.addObserver(self, forKeyPath: "state", context: nil)
        completionHandler(nil)
    }

    // 3. System calls this when a matched app opens a new connection.
    override func handleNewFlow(_ flow: NEAppProxyFlow) -> Bool {
        if let tcpFlow = flow as? NEAppProxyTCPFlow {
            handleTCPFlow(tcpFlow)
            return true
        } else if let udpFlow = flow as? NEAppProxyUDPFlow {
            handleUDPFlow(udpFlow)
            return true
        }
        // 4. Return false to reject flows you cannot handle.
        return false
    }

    // 5. Open the TCP flow and begin reading data from the app.
    private func handleTCPFlow(_ flow: NEAppProxyTCPFlow) {
        flow.open(withLocalEndpoint: nil) { error in
            if let error = error {
                flow.closeReadWithError(error)
                flow.closeWriteWithError(error)
                return
            }
            self.readFromTCPFlow(flow)
        }
    }

    // 6. Read loop: pull data from the app's TCP connection.
    private func readFromTCPFlow(_ flow: NEAppProxyTCPFlow) {
        flow.readData { data, error in
            if let error = error {
                flow.closeReadWithError(error)
                return
            }
            guard let data = data, !data.isEmpty else {
                // 7. Empty data means the flow has ended.
                flow.closeReadWithError(nil)
                return
            }
            // 8. Forward the data to the proxy server, then continue reading.
            self.forwardToServer(data) { responseData in
                flow.write(responseData) { writeError in
                    if writeError != nil {
                        flow.closeWriteWithError(writeError)
                        return
                    }
                    self.readFromTCPFlow(flow)
                }
            }
        }
    }

    // 9. Handle UDP flows similarly using readDatagrams/writeDatagrams.
    private func handleUDPFlow(_ flow: NEAppProxyUDPFlow) {
        flow.open(withLocalEndpoint: nil) { error in
            guard error == nil else { return }
            self.readFromUDPFlow(flow)
        }
    }

    private func readFromUDPFlow(_ flow: NEAppProxyUDPFlow) {
        flow.readDatagrams { datagrams, endpoints, error in
            guard let datagrams = datagrams,
                  let endpoints = endpoints,
                  error == nil else { return }

            // 10. Forward each datagram to the proxy server.
            for (datagram, endpoint) in zip(datagrams, endpoints) {
                self.forwardDatagramToServer(datagram, destination: endpoint)
            }
            self.readFromUDPFlow(flow)
        }
    }

    private func forwardToServer(
        _ data: Data,
        completion: @escaping (Data) -> Void
    ) {
        // Forward data through the proxy server connection and
        // return the response. Implementation depends on your protocol.
    }

    private func forwardDatagramToServer(_ data: Data, destination: NWEndpoint) {
        // Forward UDP datagram through the proxy server.
    }

    // 11. System calls this to tear down the proxy.
    override func stopProxy(
        with reason: NEProviderStopReason,
        completionHandler: @escaping () -> Void
    ) {
        serverConnection?.cancel()
        serverConnection = nil
        completionHandler()
    }

    // 12. Receive messages from the containing app.
    override func handleAppMessage(
        _ messageData: Data,
        completionHandler: ((Data?) -> Void)?
    ) {
        completionHandler?(messageData)
    }

    override func sleep(completionHandler: @escaping () -> Void) {
        completionHandler()
    }

    override func wake() {
        // Re-establish server connection if needed.
    }
}
```

### Containing App -- Installing the Proxy Configuration

```swift
import NetworkExtension

func installAppProxyProfile() {
    let manager = NEAppProxyProviderManager()

    let proto = NETunnelProviderProtocol()
    proto.providerBundleIdentifier = "com.example.app.AppProxy"
    proto.serverAddress = "proxy.example.com"
    proto.providerConfiguration = ["port": "8443"]

    manager.protocolConfiguration = proto
    manager.localizedDescription = "Corporate App Proxy"
    manager.isEnabled = true

    // Per-app VPN rules: only proxy traffic from these apps.
    let mailRule = NEAppRule(signingIdentifier: "com.example.corporate-mail")
    let wikiRule = NEAppRule(signingIdentifier: "com.example.internal-wiki")
    manager.appRules = [mailRule, wikiRule]

    manager.saveToPreferences { error in
        if let error = error {
            print("Failed to save proxy profile: \(error)")
        }
    }
}
```

## Usage

- Create: `bun create target network-app-proxy`
- Edit: `targets/network-app-proxy/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| iOS | 9.0+ | Full support. Requires MDM or configuration profile for per-app VPN rules. |
| iPadOS | 9.0+ | Full support. |
| macOS | 10.11+ | Runs as app extension (10.11) or system extension (10.15+). Consider `NETransparentProxyProvider` on macOS 11+. |
| tvOS | 17.0+ | Added in tvOS 17. |
| visionOS | 1.0+ | Supported. |
| watchOS | -- | Not supported. |

## Gotchas

- **Network Extension entitlement required.** You must request the Network Extension entitlement from Apple via [the request form](https://developer.apple.com/contact/request/network-extension/). Your app will be rejected without it. This is a manual approval process that can take days or weeks.
- **Per-app VPN rules require MDM or configuration profile.** On iOS, `NEAppRule` matching only works when the proxy is configured via a managed app configuration or MDM profile. You cannot set up per-app VPN rules purely in code on unmanaged devices.
- **Returning `false` from `handleNewFlow` drops the connection.** Unlike `NETransparentProxyProvider` (macOS 11+), where returning `false` lets the OS handle the flow normally, `NEAppProxyProvider` will discard the flow entirely if you return `false`. You must proxy every flow you receive.
- **Flows are app-layer, not IP packets.** You receive typed `NEAppProxyTCPFlow` and `NEAppProxyUDPFlow` objects, not raw bytes. This is more convenient than packet tunnel but means you cannot inspect or modify IP headers.
- **`open` must complete before reading.** You must call `open(withLocalEndpoint:completionHandler:)` on a flow and wait for the completion handler before calling `readData` or `readDatagrams`. Reading before the flow is open will fail silently.
- **Memory limits are strict.** Like all network extensions, the app proxy provider runs in a constrained memory environment (~15 MB on iOS). Avoid buffering large amounts of data from multiple concurrent flows.
- **Consider `NETransparentProxyProvider` on macOS.** If you only target macOS 11+, the transparent proxy provider is a better choice: it supports selective proxying (return `false` to let the OS handle a flow) and does not require per-app VPN rules. `NEAppProxyProvider` remains necessary for iOS or older macOS support.
- **`handleNewUDPFlow(_:initialRemoteEndpoint:)` was added in iOS 13.** Before iOS 13, UDP flows arrived via the base `handleNewFlow(_:)` without an initial remote endpoint. Override the newer method if you need the destination address upfront and your minimum target is iOS 13+.
