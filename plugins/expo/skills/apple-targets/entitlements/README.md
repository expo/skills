# Entitlements & Capabilities

This directory contains skill documents for iOS entitlements and capabilities that apply across multiple extension types.

Unlike the extension-specific skills in the parent directory (which focus on a single target type like `widget` or `share`), these guides cover cross-cutting entitlements and frameworks that are used by many different extensions.

## Available Guides

### [app-groups.md](app-groups.md)
Comprehensive guide to the App Groups entitlement (`com.apple.security.application-groups`), which enables data sharing between your main app, extensions, and App Clips via shared containers and UserDefaults.

**Read this when:**
- Setting up widgets that need to display data from the main app
- Building share extensions that save content for the main app to process
- Creating notification service extensions that decrypt messages using shared keychain items
- Implementing App Clips that migrate user data to the full app after installation
- Debugging "container URL returns nil" or "UserDefaults not syncing" issues
- Understanding how EAS Build automatically provisions App Group identifiers

**Topics covered:**
- Standard naming conventions (`group.<bundle-id>`)
- Using `UserDefaults(suiteName:)` for shared preferences
- Accessing shared file containers with `FileManager.containerURL(forSecurityApplicationGroupIdentifier:)`
- Sharing Keychain items with `kSecAttrAccessGroup`
- Automatic syncing for extensions with `appGroupsByDefault: true`
- EAS Build automatic code signing and provisioning
- Common gotchas and debugging techniques

## Future Guides

Additional entitlements that may be documented in this directory:

- **Keychain Access Groups** — Sharing credentials across apps and extensions
- **Associated Domains** — Universal Links, App Clips, handoff, and web credentials
- **Push Notifications** — APNs entitlement and notification capabilities
- **HealthKit** — Accessing health and fitness data from extensions
- **iCloud** — CloudKit, Key-Value Storage, and Documents syncing
- **Network Extensions** — VPN and content filtering entitlements
- **Siri** — SiriKit intents and Shortcuts capabilities
- **Background Modes** — Background fetch, remote notifications, location updates

## Contributing

When adding a new entitlements guide:

1. Use the extension skill template structure (frontmatter, Apple docs, WWDC history, implementation examples)
2. Focus on practical usage across multiple extension types rather than a single API
3. Include EAS-specific guidance for automatic provisioning where applicable
4. Add debugging sections for common entitlement validation failures
5. Update this README and the main `SKILL.md` with a reference to the new guide
