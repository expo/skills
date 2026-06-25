---
title: Content Filter Data Provider
description: Inspects network traffic flows on-device and makes allow/block decisions for content filtering without sending user data off the device.
version: iOS 9.0+, macOS 10.15+
---

# Content Filter Data Provider (`network-filter-data`)

A network extension that examines TCP and UDP flows passing through the device and renders allow, block, or need-more-data verdicts for each one. The filter data provider runs in a heavily sandboxed process with read-only access to flow data -- it cannot make network requests or write to disk, ensuring user privacy. A companion filter control provider extension (with network access but no data access) can supply updated rules. This architecture was designed for parental controls, enterprise content filtering, and educational device management.

## Apple Documentation

- [Content Filter Providers](https://developer.apple.com/documentation/networkextension/content-filter-providers) -- overview guide for building on-device content filters
- [NEFilterDataProvider](https://developer.apple.com/documentation/networkextension/nefilterdataprovider) -- principal class to subclass for inspecting flow data
- [NEFilterControlProvider](https://developer.apple.com/documentation/networkextension/nefiltercontrolprovider) -- companion extension that fetches updated rules (has network access)
- [NEFilterManager](https://developer.apple.com/documentation/networkextension/nefiltermanager) -- configure and enable the filter from the containing app
- [NEFilterNewFlowVerdict](https://developer.apple.com/documentation/networkextension/nefilternewflowverdict) -- initial verdict for a new flow (allow, drop, filterData, needRules)
- [NEFilterDataVerdict](https://developer.apple.com/documentation/networkextension/nefilterdataverdict) -- verdict after inspecting flow data chunks (allow, drop, needRules)
- [NEFilterFlow](https://developer.apple.com/documentation/networkextension/nefilterflow) -- base class representing a network flow with metadata

## WWDC History

- **[WWDC 2015, Session 717 -- What's New in Network Extension and VPN](https://developer.apple.com/videos/play/wwdc2015/717/)** -- Introduced the content filter provider architecture with the split data/control provider model for privacy.
- **[WWDC 2019, Session 714 -- Network Extensions for the Modern Mac](https://developer.apple.com/videos/play/wwdc2019/714/)** -- Brought content filter providers to macOS via system extensions. Covered the macOS-specific content filter behavior including the `pause` verdict.
- **[WWDC 2025, Session 234 -- Filter and Tunnel Network Traffic with NetworkExtension](https://developer.apple.com/videos/play/wwdc2025/234/)** -- Introduced URL-based filtering on iOS 26 as a simpler alternative to data-level inspection for URL-based decisions.

## What It Does

1. The containing app uses `NEFilterManager` to install and enable a filter configuration.
2. On iOS, the device must be supervised (MDM-managed) for production builds. Development-signed builds bypass this restriction for testing.
3. Once active, the system passes every new TCP and UDP flow to `handleNewFlow(_:)` as an `NEFilterFlow`.
4. Your extension returns an `NEFilterNewFlowVerdict`: `.allow()`, `.drop()`, `.needRules()`, or `.filterDataVerdict(withFilterInbound:peekInboundBytes:filterOutbound:peekOutboundBytes:)` to request data inspection.
5. If you requested data inspection, the system calls `handleInboundData(from:readBytesStartOffset:readBytes:)` and `handleOutboundData(from:readBytesStartOffset:readBytes:)` as data chunks arrive.
6. You return `NEFilterDataVerdict` for each chunk: `.allow()`, `.drop()`, `.needRules()`, or request more data with a new byte range.
7. When the flow completes, `handleInboundDataComplete(for:)` and `handleOutboundDataComplete(for:)` are called for final decisions.

## Use Cases

### Parental Controls

Filter inappropriate content on children's devices by inspecting flow hostnames and data patterns. Combine with the filter control provider to download updated blocklists without exposing user data.

### Enterprise Content Filtering

Enforce acceptable-use policies on corporate-managed devices by blocking access to unauthorized services, detecting data exfiltration patterns, or restricting specific protocols.

### Educational Device Management

Schools using supervised iPads can filter student network access during class hours, blocking social media and streaming while allowing educational resources.

## Key Classes

| Class | Role |
|-------|------|
| `NEFilterDataProvider` | Subclass this. The system calls `handleNewFlow`, `handleInboundData`, and `handleOutboundData` on it. Runs in a strict sandbox (no network, no disk writes). |
| `NEFilterControlProvider` | Companion extension that can fetch updated rules from a server. Has network access but no access to flow data. |
| `NEFilterManager` | Used by the containing app to install and enable the content filter configuration. |
| `NEFilterProviderConfiguration` | Holds the filter configuration: organization name, server address, filter browsers flag. |
| `NEFilterFlow` | Represents a network flow. Provides `identifier`, `direction`, and source app info via `sourceAppAuditToken`. |
| `NEFilterSocketFlow` | Subclass of `NEFilterFlow` for socket-based flows. Provides `remoteHostname`, `remoteEndpoint`, `localEndpoint`. |
| `NEFilterNewFlowVerdict` | The initial verdict: allow, drop, need rules, or request data inspection with byte ranges. |
| `NEFilterDataVerdict` | Verdict after inspecting data chunks: allow, drop, need rules, or request more bytes. |

## Implementation

### Content Filter Data Provider

```swift
import NetworkExtension

class FilterDataProvider: NEFilterDataProvider {

    // 1. System calls this when the filter is enabled.
    override func startFilter(completionHandler: @escaping (Error?) -> Void) {
        // Load any cached rules from the shared container.
        // The filter control provider writes rules; we read them.
        completionHandler(nil)
    }

    override func stopFilter(
        with reason: NEProviderStopReason,
        completionHandler: @escaping () -> Void
    ) {
        completionHandler()
    }

    // 2. Called for every new TCP/UDP flow on the device.
    override func handleNewFlow(_ flow: NEFilterFlow) -> NEFilterNewFlowVerdict {
        guard let socketFlow = flow as? NEFilterSocketFlow,
              let hostname = socketFlow.remoteHostname else {
            // 3. No hostname available -- allow by default.
            return .allow()
        }

        // 4. Check the hostname against a blocklist.
        if isBlocked(hostname) {
            return .drop()
        }

        // 5. For suspicious domains, request to inspect the first 4 KB
        //    of inbound and outbound data before deciding.
        if needsInspection(hostname) {
            return .filterDataVerdict(
                withFilterInbound: true,
                peekInboundBytes: 4096,
                filterOutbound: true,
                peekOutboundBytes: 4096
            )
        }

        return .allow()
    }

    // 6. Called with chunks of inbound data for flows being inspected.
    override func handleInboundData(
        from flow: NEFilterFlow,
        readBytesStartOffset offset: Int,
        readBytes: Data
    ) -> NEFilterDataVerdict {
        // 7. Inspect the data for blocked content patterns.
        if containsBlockedContent(readBytes) {
            return .drop()
        }

        // 8. If we have seen enough data, allow the rest of the flow.
        if offset + readBytes.count >= 4096 {
            return .allow()
        }

        // 9. Request more data before making a final decision.
        return .needRules()
    }

    // 10. Called with chunks of outbound data for flows being inspected.
    override func handleOutboundData(
        from flow: NEFilterFlow,
        readBytesStartOffset offset: Int,
        readBytes: Data
    ) -> NEFilterDataVerdict {
        if containsBlockedContent(readBytes) {
            return .drop()
        }
        return .allow()
    }

    // 11. Called when all inbound data has been delivered.
    override func handleInboundDataComplete(
        for flow: NEFilterFlow
    ) -> NEFilterNewFlowVerdict {
        return .allow()
    }

    // 12. Called when all outbound data has been delivered.
    override func handleOutboundDataComplete(
        for flow: NEFilterFlow
    ) -> NEFilterNewFlowVerdict {
        return .allow()
    }

    // MARK: - Private Helpers

    private func isBlocked(_ hostname: String) -> Bool {
        let blocklist = ["blocked-site.example.com", "malware.example.com"]
        return blocklist.contains(where: { hostname.hasSuffix($0) })
    }

    private func needsInspection(_ hostname: String) -> Bool {
        let watchlist = ["suspicious.example.com"]
        return watchlist.contains(where: { hostname.hasSuffix($0) })
    }

    private func containsBlockedContent(_ data: Data) -> Bool {
        // Inspect data bytes for blocked patterns.
        return false
    }
}
```

### Containing App -- Enabling the Content Filter

```swift
import NetworkExtension

func enableContentFilter() {
    NEFilterManager.shared().loadFromPreferences { error in
        if let error = error {
            print("Failed to load filter preferences: \(error)")
            return
        }

        let config = NEFilterProviderConfiguration()
        config.filterBrowsers = true
        config.filterSockets = true
        config.organization = "Example Corp"

        NEFilterManager.shared().providerConfiguration = config
        NEFilterManager.shared().isEnabled = true

        NEFilterManager.shared().saveToPreferences { error in
            if let error = error {
                print("Failed to save filter: \(error)")
            }
        }
    }
}
```

## Usage

- Create: `bun create target network-filter-data`
- Edit: `targets/network-filter-data/`
- This will require a native rebuild.
## Platform Availability

| Platform | Minimum OS | Notes |
|----------|-----------|-------|
| iOS | 9.0+ | Requires supervised device for production builds. Development signing bypasses this for testing. |
| iPadOS | 9.0+ | Same supervised requirement as iOS. Primary deployment target for education. |
| macOS | 10.15+ | Runs as a system extension. No supervised requirement. No WebKit integration (browsers may not use WebKit). |
| tvOS | -- | Not supported. |
| visionOS | -- | Not supported. |
| watchOS | -- | Not supported. |

## Gotchas

- **Network Extension entitlement required.** You must request the Network Extension entitlement from Apple via [the request form](https://developer.apple.com/contact/request/network-extension/). Your app will be rejected without it. This is a manual approval process that can take days or weeks.
- **iOS requires supervised devices in production.** The content filter API enforces supervised-device-only on iOS for any build signed with distribution, Ad Hoc, or Enterprise certificates. Only development-signed builds (with `get-task-allow` entitlement) bypass this check. This effectively limits iOS deployment to MDM-managed enterprise or education devices.
- **The data provider cannot make network requests.** The filter data provider runs in a strict sandbox with no network access and no disk write access. If you need to download updated rules, implement a `NEFilterControlProvider` companion extension which has network access but cannot see flow data.
- **Two extensions are required on iOS.** On iOS, you need both a filter data provider and a filter control provider extension. On macOS, the control provider is optional.
- **`handleNewFlow` receives every flow.** The system sends all TCP and UDP flows to your extension. Returning verdicts quickly for known-good traffic is critical for performance. Slow verdicts will degrade the user's entire network experience.
- **HTTP/3 traffic arrives as UDP flows.** Modern browsers using QUIC/HTTP/3 will send UDP flows, not TCP. If you only check `NEFilterSocketFlow` for TCP connections, you will miss HTTP/3 traffic. Always handle both flow types.
- **`remoteHostname` may be nil.** If DNS resolution happened outside the filter's view or the app connected by IP address directly, `remoteHostname` on `NEFilterSocketFlow` will be nil. Do not rely on it being present for every flow.
- **Screen Time API is an alternative for consumer apps.** If you need content filtering in a consumer (non-supervised) iOS app, look at the Screen Time `ManagedSettings` framework (WWDC 2021 Session 10123) which provides web content filtering without the supervised device requirement.
- **`filterBrowsers` is deprecated on macOS.** Many macOS browsers do not use WebKit or NSURLSession, so the browser filtering path is unreliable. Use `filterSockets = true` on macOS and inspect `NEFilterSocketFlow` instead.
