---
name: apple-targets
description: Use for anything related to multi-target Apple/iOS apps including widgets (home screen, Lock Screen, Live Activities), App Clips, share extensions, Safari extensions, watch apps, notification extensions, keyboard extensions, or any Apple extension type. Trigger phrases include "widget", "share extension", "App Clip", "watchOS app", "multi-target", "apple-targets", "bunx create-target", "bun create target", "iOS extension".
version: 1.0.0
license: MIT
---

# Apple Extension Target Skills Reference

This directory contains comprehensive skill documents for all supported Apple extension and target types. Each skill document provides everything an AI agent needs to understand, implement, and troubleshoot a specific Apple extension type, including:

- Apple documentation links and WWDC session references
- Runtime behavior and lifecycle explanation
- Real-world use cases and implementation patterns
- Production-ready Swift code examples
- Platform availability and version requirements
- Common gotchas and debugging tips

> **Tip:** For a focused, end-to-end iOS **App Clip** setup, a dedicated `add-app-clip` skill is also available. Use this `apple-targets` skill for the full catalog of Apple extension and target types.

## How to Use These Skills

**For AI Agents:**

1. **When a user asks about a specific extension type** (e.g., "How do I build a widget?" or "I need to add a share extension"), read the corresponding skill document to get complete implementation guidance.

2. **When planning a feature** that might require an extension (e.g., "Add home screen presence" -> read `widget.md`), consult the skill document to understand requirements and constraints.

3. **When debugging extension issues**, refer to the "Gotchas" section of the relevant skill document -- these capture common pitfalls from Apple Developer Forums and real-world experience.

4. **When uncertain which extension type fits a use case**, scan the "Use Cases" sections across related skills to find the best match.

**Structure of Each Skill Document:**

Every skill document follows this template:
- **Frontmatter**: Title, one-line description, minimum OS version
- **Apple Documentation**: Official reference links
- **WWDC History**: Session links showing evolution of the feature
- **What It Does**: Step-by-step runtime behavior
- **Use Cases**: Real-world scenarios organized by industry/app type
- **Key Classes**: Table of essential framework types
- **Implementation**: Production-ready Swift code with inline comments
- **Using with @bacons/apple-targets**: Setup instructions for this plugin
- **Platform Availability**: OS version matrix
- **Gotchas**: Common mistakes, memory limits, and silent failure modes

## Skills by Category

### User Interface Extensions

| Skill | Extension Type | When to Read |
|-------|---------------|--------------|
| [widget.md](widget.md) | `widget` | User wants home screen widgets, Lock Screen widgets, Live Activities, StandBy mode UI, or Control Center controls (iOS 18+). Timeline-based SwiftUI views. |
| [clip.md](clip.md) | `clip` | User wants instant-launch mini-apps triggered by NFC, QR codes, App Clip Codes, Safari banners, or Messages links. Not an extension--a size-constrained application target. |
| [share.md](share.md) | `share` | User wants their app in the system share sheet to receive URLs, images, text, or files from other apps. |
| [action.md](action.md) | `action` | User wants context menu actions in Safari, Photos, or Files that transform content and optionally return modified data. |
| [keyboard.md](keyboard.md) | `keyboard` | User wants a custom system keyboard with specialized input (emoji pickers, GIF search, language-specific layouts, calculators). |
| [photo-editing.md](photo-editing.md) | `photo-editing` | User wants to add filters, adjustments, or effects to photos/videos directly in the Photos app editing UI. |
| [quicklook-preview.md](quicklook-preview.md) | `quicklook-preview` | User wants rich previews of custom file types in Quick Look with interactive controls and multiple pages. |
| [quicklook-thumbnail.md](quicklook-thumbnail.md) | `quicklook-thumbnail` | User wants to generate thumbnail images for custom file types shown in Finder, Files app, and Spotlight. |

### Notifications

| Skill | Extension Type | When to Read |
|-------|---------------|--------------|
| [notification-service.md](notification-service.md) | `notification-service` | User wants to download images, decrypt payloads, or modify push notification content before display. Runs in background with 30-second time limit. |
| [notification-content.md](notification-content.md) | `notification-content` | User wants custom SwiftUI/UIKit UI for expanded push notifications with interactive controls and rich media. |

### Siri & Intents

| Skill | Extension Type | When to Read |
|-------|---------------|--------------|
| [intent.md](intent.md) | `intent` | User wants Siri voice commands for built-in domains (messaging, payments, workouts, media playback, ride booking). Uses legacy SiriKit framework. |
| [intent-ui.md](intent-ui.md) | `intent-ui` | User wants custom UI in the Siri interface when confirming or handling intents. Companion to the `intent` extension. |
| [app-intent.md](app-intent.md) | `app-intent` | User wants modern App Intents (iOS 16+) for Shortcuts, Spotlight, Siri, Focus Filters, and Control Center widgets. Replaces custom `.intentdefinition` files. |

### Networking & VPN

| Skill | Extension Type | When to Read |
|-------|---------------|--------------|
| [network-packet-tunnel.md](network-packet-tunnel.md) | `network-packet-tunnel` | User wants to build a VPN client that tunnels all device traffic through a custom protocol. Classic and modern Personal VPN. |
| [network-app-proxy.md](network-app-proxy.md) | `network-app-proxy` | User wants app-level network filtering (per-app VPN) where specific apps route traffic through a custom proxy. Requires MDM or supervised devices. |
| [network-dns-proxy.md](network-dns-proxy.md) | `network-dns-proxy` | User wants to intercept and respond to DNS queries system-wide, enabling DNS filtering, logging, or custom resolution. |
| [network-filter-data.md](network-filter-data.md) | `network-filter-data` | User wants deep packet inspection for content filtering (parental controls, enterprise security). Requires special Apple entitlement. |

### File Management

| Skill | Extension Type | When to Read |
|-------|---------------|--------------|
| [file-provider.md](file-provider.md) | `file-provider` | User wants to expose cloud storage or remote file systems in the Files app with on-demand download, search, and sync. |
| [file-provider-ui.md](file-provider-ui.md) | `file-provider-ui` | User wants custom UI for file actions (sharing, permissions) in the document picker. Companion to File Provider extension. |

### Communication & Telephony

| Skill | Extension Type | When to Read |
|-------|---------------|--------------|
| [message-filter.md](message-filter.md) | `message-filter` | User wants to filter incoming SMS/MMS messages to classify spam, transactions, or promotions into separate tabs. |
| [call-directory.md](call-directory.md) | `call-directory` | User wants to block phone numbers or provide caller ID labels for incoming calls. Updates a system-managed SQLite database. |
| [unwanted-communication.md](unwanted-communication.md) | `unwanted-communication` | User wants a UI for users to report unwanted calls, messages, or FaceTime attempts to a reporting service. Requires special entitlement. |

### Content & Media

| Skill | Extension Type | When to Read |
|-------|---------------|--------------|
| [broadcast-upload.md](broadcast-upload.md) | `broadcast-upload` | User wants to stream ReplayKit screen recordings to a live streaming service (Twitch, YouTube Live). Receives video/audio buffers in real time. |
| [broadcast-setup-ui.md](broadcast-setup-ui.md) | `broadcast-setup-ui` | User wants custom UI for configuring a live broadcast (selecting stream key, privacy settings). Companion to broadcast upload extension. |
| [safari.md](safari.md) | `safari` | User wants Safari Web Extensions (Manifest V3) with content scripts, background pages, and native messaging to the containing app. |
| [content-blocker.md](content-blocker.md) | `content-blocker` | User wants rule-based ad blocking, tracker blocking, or content hiding in Safari using JSON declarative rules. No JavaScript execution. |

### Education & Screen Time

| Skill | Extension Type | When to Read |
|-------|---------------|--------------|
| [classkit-context.md](classkit-context.md) | `classkit-context` | User wants to report student progress in educational apps to Apple's Schoolwork app via ClassKit framework. |
| [device-activity-monitor.md](device-activity-monitor.md) | `device-activity-monitor` | User wants to monitor app/website usage and trigger actions when Screen Time limits are reached. Parental control and focus apps. |
| [shield-action.md](shield-action.md) | `shield-action` | User wants custom UI when a user attempts to bypass a Screen Time shield (blocked app/website). Handle or deny the request. |
| [shield-config.md](shield-config.md) | `shield-config` | User wants custom shield UI (blocking screen) shown when apps or websites are restricted by Screen Time rules. |

### Authentication & Security

| Skill | Extension Type | When to Read |
|-------|---------------|--------------|
| [authentication-services.md](authentication-services.md) | `authentication-services` | User wants AutoFill for passwords and passkeys in Safari and apps. Modern replacement for `credentials-provider`. Supports passkey creation/assertion (WebAuthn). |
| [credentials-provider.md](credentials-provider.md) | `credentials-provider` | User wants legacy password AutoFill (iOS 12+). For new projects, use `authentication-services` instead, which supports both passwords and passkeys. |
| [smart-card.md](smart-card.md) | `smart-card` | User wants to authenticate with smart cards or hardware tokens (YubiKey, PIV cards) via the CryptoTokenKit framework. Enterprise use. |
| [account-auth.md](account-auth.md) | `account-auth` | User wants to modify authentication requests for Kerberos or other enterprise single sign-on (SSO) protocols. Requires special entitlement. |

### Location & Background Services

| Skill | Extension Type | When to Read |
|-------|---------------|--------------|
| [location-push.md](location-push.md) | `location-push` | User wants silent push notifications that wake the app for high-accuracy location updates. Used for fleet tracking, delivery apps, and location-based alerts. |
| [bg-download.md](bg-download.md) | `bg-download` | User wants on-demand resources or large asset downloads managed by the system's background asset downloader. Used for games and media apps. |

### Smart Home & Matter

| Skill | Extension Type | When to Read |
|-------|---------------|--------------|
| [matter.md](matter.md) | `matter` | User wants to add Matter smart home device support for device commissioning via Home app. Requires MFi enrollment and Matter certification. |

### Printing

| Skill | Extension Type | When to Read |
|-------|---------------|--------------|
| [print-service.md](print-service.md) | `print-service` | User wants to discover and print to network printers without AirPrint, or provide custom print rendering for specialized printers. |

### Search & Indexing

| Skill | Extension Type | When to Read |
|-------|---------------|--------------|
| [spotlight.md](spotlight.md) | `spotlight` | User wants to index app content in Spotlight, provide rich search results, and handle taps from Spotlight search. Uses Core Spotlight and `NSUserActivity`. |
| [spotlight-delegate.md](spotlight-delegate.md) | `spotlight-delegate` | User wants a background extension for large-scale Spotlight indexing that runs periodically on a system-managed schedule. macOS only (not iOS). |

### Collaboration & Conferencing

| Skill | Extension Type | When to Read |
|-------|---------------|--------------|
| [virtual-conference.md](virtual-conference.md) | `virtual-conference` | User wants to integrate a video conferencing app with the system call UI and CallKit, enabling Handoff, picture-in-picture, and system call controls. |

### Apple Watch

| Skill | Extension Type | When to Read |
|-------|---------------|--------------|
| [watch.md](watch.md) | `watch` | User wants a standalone watchOS app with complications, workout sessions, HealthKit integration, and Watch Connectivity for iPhone sync. Not an extension--a full application target. |

## Target Types vs. Extensions

**Application Targets** (not extensions):
- **App Clip** (`clip`) -- uses product type `com.apple.product-type.application.on-demand-install-capable`
- **watchOS App** (`watch`) -- uses product type `com.apple.product-type.application`

These are full applications with their own `Info.plist`, app icons, and lifecycle. They do not use `NSExtensionPointIdentifier`.

**All other types are app extensions** that use product type `com.apple.product-type.app-extension` and declare an extension point identifier in their `Info.plist`.

## Quick Reference: Common Use Cases

| User Says... | Read This Skill |
|-------------|----------------|
| "Add a home screen widget" | [widget.md](widget.md) |
| "Add a share extension" | [share.md](share.md) |
| "Build an instant app / App Clip" | [clip.md](clip.md) |
| "Integrate with Siri" | [intent.md](intent.md) or [app-intent.md](app-intent.md) |
| "Modify push notifications" | [notification-service.md](notification-service.md) |
| "Custom notification UI" | [notification-content.md](notification-content.md) |
| "Build a VPN app" | [network-packet-tunnel.md](network-packet-tunnel.md) |
| "Password manager AutoFill" | [authentication-services.md](authentication-services.md) |
| "Block spam calls" | [call-directory.md](call-directory.md) |
| "Filter SMS spam" | [message-filter.md](message-filter.md) |
| "Add to Files app" | [file-provider.md](file-provider.md) |
| "Custom keyboard" | [keyboard.md](keyboard.md) |
| "Photo filter extension" | [photo-editing.md](photo-editing.md) |
| "Safari ad blocker" | [content-blocker.md](content-blocker.md) |
| "Safari extension" | [safari.md](safari.md) |
| "Live streaming / screen recording" | [broadcast-upload.md](broadcast-upload.md) |
| "watchOS app" | [watch.md](watch.md) |
| "Screen Time parental controls" | [device-activity-monitor.md](device-activity-monitor.md) |
| "Smart home / Matter" | [matter.md](matter.md) |
| "Print to network printer" | [print-service.md](print-service.md) |
| "Spotlight search integration" | [spotlight.md](spotlight.md) |

## Creating a New Extension with @bacons/apple-targets

Every skill document includes a "Using with @bacons/apple-targets" section with the three-step setup:

```sh
# 1. Run the CLI to scaffold the extension
bunx create-target <type>

# 2. Ensure the plugin is in app.json (automatic with CLI)
{
  "expo": {
    "plugins": [["@bacons/apple-targets"]]
  }
}

# 3. Generate the native project
bunx expo prebuild --clean -p ios
```

The `<type>` parameter corresponds to the extension type slug shown in each skill document's title (e.g., `widget`, `share`, `clip`, `notification-service`).

### When to Run Prebuild

Because target source files live outside the `/ios` directory and are **linked** into the Xcode project (not copied), Swift code changes are automatically synchronized. You don't need to re-run prebuild when editing code.

- **Run `prebuild --clean`** when:
  - Initial setup after creating a new target
  - Changing `expo-target.config.js` (icon, colors, entitlements, bundle ID, frameworks)
  - Changing `app.json` plugin configuration
  - Adding or removing targets
  - Xcode project corruption or mysterious build failures

- **Run `prebuild` (without `--clean`)** when:
  - You need to regenerate the project but want to preserve manual Xcode modifications
  - Updating the plugin version with minor project changes

- **No prebuild needed** for:
  - Editing Swift code in `targets/<name>/` directories -- files are linked, changes appear immediately in Xcode
  - Adding/modifying Swift files within an existing target
  - Most day-to-day development work on target implementations

This architecture allows you to iterate on extension code without constantly regenerating the entire Xcode project, speeding up development and preserving manual project customizations.

## Entitlements & Capabilities Guides

The `entitlements/` directory contains guides for iOS entitlements and capabilities that apply across multiple extension types:

| Guide | When to Read |
|-------|--------------|
| [entitlements/app-groups.md](entitlements/app-groups.md) | User needs to share data between the main app and extensions (widgets, share, notifications, App Clips). Covers naming conventions, UserDefaults suite, shared containers, Keychain access groups, and automatic EAS provisioning. |

**Common questions answered by entitlements guides:**
- "How do I share data between my app and widget?" -> Read `app-groups.md`
- "My extension can't access UserDefaults from the main app" -> Read `app-groups.md`
- "How does EAS handle App Groups code signing?" -> Read `app-groups.md`

## Additional Resources

- **Expo Documentation**: https://docs.expo.dev/config-plugins/introduction/
- **Continuous Native Generation**: https://docs.expo.dev/workflow/continuous-native-generation/
