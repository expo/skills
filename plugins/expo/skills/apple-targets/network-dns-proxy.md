---
title: DNS Proxy Provider
description: Intercepts all system DNS queries and resolves them through a custom DNS resolver, enabling encrypted DNS (DoH/DoT) or DNS-based filtering.
version: iOS 11.0+, macOS 10.15+
---

# DNS Proxy Provider (`network-dns-proxy`)

A network extension that intercepts every DNS query on the device and resolves them through your custom DNS resolver. The system diverts all DNS traffic to your `NEDNSProxyProvider` subclass, which receives queries as `NEAppProxyUDPFlow` (and occasionally `NEAppProxyTCPFlow` for TCP-based DNS). You must parse raw DNS packets yourself, forward them to your resolver using any protocol you choose (DNS-over-HTTPS, DNS-over-TLS, or plain DNS), and write the response back to the flow. This gives you complete control over DNS resolution system-wide.

## Apple Documentation

- [DNS Proxy Provider](https://developer.apple.com/documentation/networkextension/dns-proxy-provider) -- overview guide for building a custom DNS proxy
- [NEDNSProxyProvider](https://developer.apple.com/documentation/networkextension/nednsproxyprovider) -- principal class to subclass
- [NEDNSProxyManager](https://developer.apple.com/documentation/networkextension/nednsproxymanager) -- configure and enable the DNS proxy from the containing app
- [NEDNSProxyProviderProtocol](https://developer.apple.com/documentation/networkextension/nednsproxyproviderprotocol) -- configuration parameters for the DNS proxy
- [NEAppProxyUDPFlow](https://developer.apple.com/documentation/networkextension/neappproxyudpflow) -- UDP flow carrying DNS query datagrams
- [NEAppProxyTCPFlow](https://developer.apple.com/documentation/networkextension/neappproxytcpflow) -- TCP flow for DNS-over-TCP queries

## WWDC History

- **[WWDC 2017, Session 707 -- Advances in Networking, Part 1](https://developer.apple.com/videos/play/wwdc2017/707/)** -- Introduced `NEDNSProxyProvider` in iOS 11 as a way to implement custom DNS resolution, including DNS-over-HTTPS and DNS-over-TLS, with full control over all DNS traffic.
- **[WWDC 2019, Session 714 -- Network Extensions for the Modern Mac](https://developer.apple.com/videos/play/wwdc2019/714/)** -- Brought DNS proxy providers to macOS via system extensions. Also introduced `NEDNSSettingsManager` as a simpler alternative for configuring system DNS to use DoH/DoT without writing a full proxy.
- **[WWDC 2025, Session 234 -- Filter and Tunnel Network Traffic with NetworkExtension](https://developer.apple.com/videos/play/wwdc2025/234/)** -- Updated guidance on network extension providers including DNS proxy lifecycle improvements.

## What It Does

1. The containing app uses `NEDNSProxyManager` to install and enable the DNS proxy configuration.
2. Once active, the system diverts all DNS queries to your extension instead of the system resolver.
3. For each DNS query, the system calls `handleNewFlow(_:)` with an `NEAppProxyUDPFlow` (for standard UDP DNS) or `NEAppProxyTCPFlow` (for DNS-over-TCP).
4. Your extension calls `open` on the flow, then reads raw DNS query datagrams from it.
5. You parse the DNS packet, forward the query to your resolver (e.g., via HTTPS for DoH or TLS for DoT), and receive the response.
6. You write the DNS response datagram back to the flow.
7. The system delivers the response to the requesting application.

## Use Cases

### Encrypted DNS (DoH / DoT)

Encrypt all device DNS queries using DNS-over-HTTPS or DNS-over-TLS to prevent ISP snooping, DNS hijacking, and man-in-the-middle attacks. The DNS proxy intercepts plain DNS queries and forwards them over an encrypted channel to a trusted resolver like Cloudflare (1.1.1.1) or Google (8.8.8.8).

### DNS-Based Ad and Tracker Blocking

Intercept DNS queries and block resolution for known advertising and tracking domains by returning NXDOMAIN or 0.0.0.0 responses. This provides system-wide ad blocking at the DNS level without inspecting HTTP traffic.

### Custom DNS Routing

Route DNS queries to different resolvers based on the queried domain -- for example, sending internal corporate domain lookups to an on-premise DNS server while routing all other queries to a public resolver.

## Key Classes

| Class | Role |
|-------|------|
| `NEDNSProxyProvider` | Subclass this. The system calls `startProxy`, `stopProxy`, and `handleNewFlow` on it. Receives all DNS queries system-wide. |
| `NEDNSProxyManager` | Used by the containing app to install, configure, and enable the DNS proxy. |
| `NEDNSProxyProviderProtocol` | Configuration object holding server address and provider bundle identifier. |
| `NEAppProxyUDPFlow` | Carries DNS query/response datagrams for standard UDP DNS. Call `readDatagrams` / `writeDatagrams`. |
| `NEAppProxyTCPFlow` | Carries DNS query/response data for TCP-based DNS (less common). Call `readData` / `write`. |

## Implementation

### DNS Proxy Provider (DoH Resolver)

```swift
import NetworkExtension

class DNSProxyProvider: NEDNSProxyProvider {

    // 1. System calls this when the DNS proxy is enabled.
    override func startProxy(
        options: [String: Any]? = nil,
        completionHandler: @escaping (Error?) -> Void
    ) {
        // Initialize your DNS resolver connection (e.g., URLSession
        // for DoH or NWConnection for DoT).
        completionHandler(nil)
    }

    override func stopProxy(
        with reason: NEProviderStopReason,
        completionHandler: @escaping () -> Void
    ) {
        completionHandler()
    }

    // 2. System calls this for every DNS query on the device.
    override func handleNewFlow(_ flow: NEAppProxyFlow) -> Bool {
        if let udpFlow = flow as? NEAppProxyUDPFlow {
            handleDNSUDPFlow(udpFlow)
            return true
        } else if let tcpFlow = flow as? NEAppProxyTCPFlow {
            handleDNSTCPFlow(tcpFlow)
            return true
        }
        return false
    }

    // 3. Open the UDP flow and read DNS query datagrams.
    private func handleDNSUDPFlow(_ flow: NEAppProxyUDPFlow) {
        flow.open(withLocalEndpoint: nil) { error in
            guard error == nil else { return }
            self.readDNSDatagrams(from: flow)
        }
    }

    // 4. Read loop for UDP DNS queries.
    private func readDNSDatagrams(from flow: NEAppProxyUDPFlow) {
        flow.readDatagrams { datagrams, endpoints, error in
            guard let datagrams = datagrams,
                  let endpoints = endpoints,
                  error == nil,
                  !datagrams.isEmpty else {
                return
            }

            // 5. Process each DNS query datagram.
            for (datagram, endpoint) in zip(datagrams, endpoints) {
                self.resolveDNSQuery(datagram) { response in
                    // 6. Write the DNS response back to the flow.
                    flow.writeDatagrams([response], sentBy: [endpoint]) { writeError in
                        if writeError != nil {
                            flow.closeWriteWithError(writeError)
                        }
                    }
                }
            }

            // 7. Continue reading subsequent queries on this flow.
            self.readDNSDatagrams(from: flow)
        }
    }

    // 8. Handle TCP DNS flows (DNS-over-TCP uses a 2-byte length prefix).
    private func handleDNSTCPFlow(_ flow: NEAppProxyTCPFlow) {
        flow.open(withLocalEndpoint: nil) { error in
            guard error == nil else { return }
            self.readDNSTCPData(from: flow)
        }
    }

    private func readDNSTCPData(from flow: NEAppProxyTCPFlow) {
        flow.readData { data, error in
            guard let data = data, !data.isEmpty, error == nil else { return }

            // 9. TCP DNS prepends a 2-byte length. Strip it, resolve,
            //    then write response with the length prefix back.
            let queryData = data.dropFirst(2)
            self.resolveDNSQuery(Data(queryData)) { response in
                var responseWithLength = Data()
                var length = UInt16(response.count).bigEndian
                responseWithLength.append(
                    Data(bytes: &length, count: MemoryLayout<UInt16>.size)
                )
                responseWithLength.append(response)
                flow.write(responseWithLength) { _ in }
            }

            self.readDNSTCPData(from: flow)
        }
    }

    // 10. Forward the DNS query to a DoH resolver (e.g., Cloudflare).
    private func resolveDNSQuery(
        _ queryData: Data,
        completion: @escaping (Data) -> Void
    ) {
        var request = URLRequest(
            url: URL(string: "https://cloudflare-dns.com/dns-query")!
        )
        request.httpMethod = "POST"
        request.setValue("application/dns-message", forHTTPHeaderField: "Content-Type")
        request.setValue("application/dns-message", forHTTPHeaderField: "Accept")
        request.httpBody = queryData

        // 11. Use URLSession to send the query over HTTPS.
        //     The DNS proxy extension CAN make network requests
        //     (unlike the filter data provider).
        URLSession.shared.dataTask(with: request) { data, _, error in
            if let data = data, error == nil {
                completion(data)
            }
        }.resume()
    }

    override func sleep(completionHandler: @escaping () -> Void) {
        completionHandler()
    }

    override func wake() {
        // Re-initialize resolver connections if needed.
    }
}
```

### Containing App -- Enabling the DNS Proxy

```swift
import NetworkExtension

func enableDNSProxy() {
    let manager = NEDNSProxyManager.shared()

    manager.loadFromPreferences { error in
        if let error = error {
            print("Failed to load DNS proxy preferences: \(error)")
            return
        }

        let proto = NEDNSProxyProviderProtocol()
        proto.providerBundleIdentifier = "com.example.app.DNSProxy"
        proto.serverAddress = "cloudflare-dns.com"

        manager.providerProtocol = proto
        manager.isEnabled = true

        manager.saveToPreferences { error in
            if let error = error {
                print("Failed to save DNS proxy: \(error)")
            }
        }
    }
}
```

## Usage

- Create: `bun create target network-dns-proxy`
- Edit: `targets/network-dns-proxy/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| iOS | 11.0+ | Requires supervised device or MDM configuration profile for production. Development signing bypasses for testing. |
| iPadOS | 11.0+ | Same requirements as iOS. |
| macOS | 10.15+ | Runs as a system extension. No supervised requirement. |
| Mac Catalyst | 13.0+ | Supported via Catalyst. |
| tvOS | -- | Not supported. |
| visionOS | -- | Not supported. |
| watchOS | -- | Not supported. |

## Gotchas

- **Network Extension entitlement required.** You must request the Network Extension entitlement from Apple via [the request form](https://developer.apple.com/contact/request/network-extension/). Your app will be rejected without it. This is a manual approval process that can take days or weeks.
- **You must parse DNS packets yourself.** Apple does not provide a DNS parsing API. You receive raw DNS wire-format bytes in each datagram and must parse the query (extracting the domain name, record type, transaction ID, etc.) and construct valid DNS response packets. Use a third-party Swift DNS library or write your own parser.
- **Supervised device requirement on iOS.** Like other network extension providers, the DNS proxy requires a supervised device (managed via MDM) for production builds on iOS. Development-signed builds bypass this check. This limits consumer App Store distribution.
- **`NEDNSSettingsManager` is simpler for basic DoH/DoT.** If you only need to redirect DNS to a specific DoH or DoT resolver without inspecting or modifying queries, use `NEDNSSettingsManager` (iOS 14+) instead. It does not require a network extension, a supervised device, or DNS packet parsing.
- **System DoH/DoT bypasses the proxy.** If the system DNS is already configured to use a DoH or DoT resolver (e.g., via Settings or a configuration profile), those encrypted DNS transactions will not be routed to your `NEDNSProxyProvider`. Your `handleNewFlow` will not be called for those queries. This is by design.
- **You must proxy all DNS traffic.** Unlike transparent proxy providers, you cannot selectively handle some queries and let the OS handle others. Every DNS query arrives at your extension, and you must resolve and respond to all of them. Failing to respond will cause DNS timeouts for the querying app.
- **Multiple DNS queries can arrive on a single flow.** A `NEAppProxyUDPFlow` may carry multiple DNS query datagrams over its lifetime, not just one. Your read loop must continue reading after processing each datagram.
- **TCP DNS uses a 2-byte length prefix.** DNS queries over TCP prepend a 2-byte big-endian length before the DNS message. You must strip this prefix when reading queries and add it back when writing responses. Forgetting this will produce malformed responses.
- **Memory and performance constraints apply.** The DNS proxy handles every DNS query on the device, including system services, background refresh, push notifications, and all apps. Slow resolution or memory issues will degrade the entire device's network performance. Keep resolution fast and avoid caching large amounts of state.
