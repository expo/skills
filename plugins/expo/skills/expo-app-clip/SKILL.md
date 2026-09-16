---
name: expo-app-clip
description: "Framework (OSS). Add, configure, test, or ship an iOS App Clip target alongside an Expo app, including Clip-specific URL invocation and website association."
---

# Add an App Clip to an Expo app

> **Requirements.** Target generation is open source. Distribution requires Apple's developer program and review; EAS builds/hosting use the project's plan when chosen. See [Apple App Clips](https://developer.apple.com/app-clips/) and [EAS pricing](https://expo.dev/pricing).

Match the scope: adding a target, testing URL invocation, or shipping the parent
app with its Clip. Adding native files does not by itself require a production
website deployment, account registration, or TestFlight submission.

## Establish identity and target configuration

Preserve the parent app's bundle identifier and Apple team. Derive the Clip's
identifier from the actual target configuration; never replace existing identities
with a tutorial's username, team ID, or App Store ID. Reuse the existing Clip target
if present.

Use [`@bacons/apple-targets`](https://github.com/EvanBacon/expo-apple-targets)' current
Clip generator (`bun create target clip`) when creating a target. Inspect the
installed generator's output and plugin configuration; the usual source location
is `targets/clip/`, with `expo-target.config.js`, `Info.plist`, and native entry files.
Keep native edits in the target sources/configuration that survive prebuild.

Choose the Clip's smallest useful flow and URL entry point. Check dependencies,
permissions, deployment target, and size constraints against
[Apple's App Clip documentation](https://developer.apple.com/documentation/appclip).
Do not mirror every parent permission or capability: an App Clip has different
restrictions, and unnecessary features increase its size.

## Connect invocation to the website

Use [Apple's website association guide](https://developer.apple.com/documentation/appclip/associating-your-app-clip-with-your-website)
for the current entitlement and AASA contract.

- Configure the Clip's `appclips:<domain>` associated-domain entitlement and the parent relationships required by the chosen integration. Add `applinks:` only for the parent universal-link behavior being implemented.
- Merge the Clip's full application identifier into the AASA `appclips.apps` array. Preserve existing `applinks`, credential-sharing, and other app entries; do not copy sample IDs or grant every route without a reason.
- Serve the extensionless `/.well-known/apple-app-site-association` over HTTPS with the required JSON response and no redirect. Verify the deployed response, not just the local file. Any compatible HTTPS host can serve it.
- If adding a Smart App Banner, merge its App Store/Clip identifiers into the existing web HTML shell. Use the project's actual route tree (`app/` or `src/app/`) and preserve existing head content.
- A correct AASA file is one part of invocation, not proof that the Clip experience is configured or distributed. Follow Apple's local testing and App Store Connect experience setup for the requested stage; allow for association caching when diagnosing devices.

For a local native detection/install-prompt bridge, read
[the App Clip module recipe](./references/native-module.md). Its `navigator.appClip`
API is an app-defined wrapper, not a built-in web or Expo API.

## Build and distribution, when requested

Inspect generated entitlements and Info.plist for both parent and Clip. A custom
native build is required; Expo Go cannot contain this target. Verify provisioning
for both targets when preparing a device/store build.

Use `eas-app-stores` for an authorized TestFlight/store delivery and `eas-hosting`
when the chosen site is hosted on EAS. Preserve existing store metadata when pulling
or editing it. Read the current Apple/EAS metadata schema for experience fields,
image specifications, and invocation URLs rather than copying a full sample config.

## Completion

For target work, verify configuration and the available native build/launch path.
For invocation work, test the intended URL and delivered Clip flow. For shipping,
verify the parent embeds the Clip and the requested experience/submission stage is
configured. Report separately any device, domain, provisioning, or review steps
that could not be verified.

## Submitting Feedback
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes submit-expo-feedback@latest --category skills --subject "expo-app-clip" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
If an AI agent repeatedly failed or the user had to take over an Expo task, load the expo-skill-feedback skill and follow its eval-candidate flow instead of reusing the command above.
