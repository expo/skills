# Expo

Official guides and tools from the Expo team for building, testing, and deploying iOS and Android apps with Expo and React Native. Develop mobile apps, run them on iOS simulators and Android emulators, and ship beta builds and production releases.

Skills come in two groups so the free vs paid boundary stays clear: open-source **framework** skills, and **services & paid distribution** skills whose core purpose uses paid Expo Application Services (EAS). Each services skill opens with a costs/plan-limits note.

## What This Plugin Does

### Framework (open source)

- Routes any Expo/EAS request to the right skill and applies shared setup rules (`expo-overview`)
- Recommends a starting folder structure for new projects
- Provides UI guidelines following Apple Human Interface Guidelines
- Builds polished, accessible React Native animations and gestures that stay off the JS thread
- Builds in-app design systems: token themes, reusable component conventions, and style audits
- Covers Expo Router navigation patterns (stacks, tabs, modals, sheets)
- Explains native iOS controls, SF Symbols, and visual effects
- Covers `@expo/ui` native components (universal, SwiftUI, and Jetpack Compose)
- Covers data fetching patterns with React Query, offline support, and Expo Router loaders
- Explains DOM components for running web code in native apps
- Covers Expo native modules, iOS App Clips, and brownfield integration into existing native apps
- Points at the `expo/examples` repo for canonical third-party integrations
- Walks through Expo SDK upgrades, deprecated-package migration, cache clearing, and dependency fixes
- Wires Expo projects into the Codex app Run button and action terminal

### Services & paid distribution

- Guides iOS App Store, TestFlight, and Android Play Store submissions
- Covers EAS Build configuration and version management
- Helps write and validate EAS Workflow YAML files for CI/CD
- Checks EAS Update health, adoption, crash rates, and payload size
- Configures, publishes, tests, and debugs over-the-air updates with EAS Update
- Tracks production performance with EAS Observe
- Covers website and API route authoring and deployment with EAS Hosting
- Runs and drives your app on remote iOS/Android simulators with Expo Simulators

## When to Use

### Framework (open source)

- Starting any Expo/EAS task when no specific skill is named yet
- Building new Expo apps from scratch
- Adding navigation, styling, or animations
- Building or fixing animations, gestures, transitions, press feedback, or haptics
- Setting up a theme with design tokens, or standardizing styles across screens
- Wiring up data fetching
- Integrating web libraries via DOM components
- Migrating an existing web/React app to native with Expo
- Writing Expo native modules or integrating Expo into an existing native app
- Adapting a third-party integration from `expo/examples`
- Upgrading to a new Expo SDK version and fixing dependency conflicts after an upgrade
- Migrating from deprecated packages (expo-av to expo-audio/expo-video)
- Adding an iOS App Clip (needs an Apple Developer account)
- Adding a Codex app Run button for `expo start` and optional iOS/Android/Web/dev-client action buttons

### Services & paid distribution

- Submitting apps to App Store Connect or Google Play
- Setting up TestFlight beta testing
- Configuring EAS Build profiles
- Writing CI/CD workflows for automated deployments
- Inspecting EAS Update rollout health and adoption
- Configuring, publishing, testing, or debugging an EAS Update
- Tracking startup, navigation, and event performance with EAS Observe
- Deploying a website or Expo Router API routes to EAS Hosting
- Running your app on a remote cloud simulator when no local simulator is available

## Skills Included

### Start Here

- **expo-overview** — Router and shared setup rules; the entry point when a request is vague or the user hasn't named a specific Expo tool

### Framework (open source)

- **expo-project-structure** - Recommended folder structure for new Expo projects
- **expo-router** - Navigation and routing: file-based routes, links, native stacks, modals, sheets, native tabs, and headers
- **expo-animation** - Build polished animations and gestures with Reanimated, Gesture Handler, Expo Router, and expo-haptics
- **expo-native-ui** - Build beautiful native-feeling screens: styling, semantic colors, controls, icons, media, and visual effects
- **expo-design-system** - Build a design system inside an app: token theme (color, spacing, typography, radius, shadow, motion), reusable component conventions, and design-system drift audits
- **expo-ui** - Native UI with @expo/ui: universal cross-platform components first, with SwiftUI and Jetpack Compose for platform-specific needs
- **expo-data-fetching** - Network requests, API calls, caching, and offline support
- **expo-dom** - Run web code in a webview on native using DOM components
- **expo-web-to-native** - Migrate an existing web/React app to a native iOS/Android app with Expo
- **expo-module** - Write Expo native modules and views (Swift, Kotlin, TypeScript, config plugins)
- **expo-brownfield** - Integrate Expo and React Native into existing native iOS or Android apps
- **expo-dev-client** - Build and distribute Expo development clients (local builds free; EAS Build/TestFlight paid)
- **expo-examples** - Adapt or scaffold from the `expo/examples` repo of `with-*` integrations
- **expo-app-clip** - Add an iOS App Clip target (AASA, associated domains, Smart App Banners; needs an Apple Developer account)
- **expo-upgrade** - Upgrade Expo SDK versions and fix dependency issues

### Services & paid distribution

- **eas-app-stores** - Build and submit iOS/Android apps to the stores and TestFlight: Expo and other React Native projects, plus existing native apps
- **eas-hosting** - Deploy Expo websites and API routes to EAS Hosting (secrets, custom domains, Cloudflare Workers)
- **eas-workflows** - EAS workflow YAML files for CI/CD pipelines
- **eas-observe** - EAS Observe setup and launch, route, event, and version metrics
- **eas-update** - Configure, publish, test, and debug over-the-air updates
- **eas-update-insights** - Check EAS Update health, crash rates, adoption, and payload size
- **eas-simulator** - Run and drive your app on a remote iOS/Android simulator with Expo Simulators, from the CLI or an AI agent

## ChatGPT plugin submission

The shared listing metadata lives in `plugin.json` under `extensions.com.openai`. The upload-specific identity, version, subtitle, MCP endpoint, and review cases live in [`scripts/chatgpt-submission.json`](../../scripts/chatgpt-submission.json). Follow the [OpenAI submission guide](https://developers.openai.com/plugins/deploy/submission) for the current listing limits and review requirements.

Run this from the repository root to create a ZIP with the portable manifest, MCP configuration, skills, and assets at the archive root:

```bash
bun scripts/create-chatgpt-plugin.ts --output /tmp/expo-plugin.zip
```

The script requires Git, npm, and `zip`. It packages tracked files from the working tree; stage new package files first. It resolves `eas-cli@latest` and other versioned npm helpers once per package with `npm view <package>@latest version --json` and pins them only in the ZIP. This includes `@expo/agent-cli@latest`, which now provides feedback submission. It removes `@latest` from `create-expo-app`; legacy `submit-expo-feedback@latest` references are preserved. Existing exact tool versions and source files stay unchanged.

The default profile produces `expo2` version `1.14.7`, displayed as **Expo** with the subtitle **Build, test & ship mobile apps**, using `https://mcp.expo.dev/mcp-openai`. It embeds five positive and three negative review cases and omits `interface.screenshots`. These overrides apply only to the archive; the marketplace plugin remains `expo`. Update the profile version for each upload release, or use `--profile <json-path>` for an alternate submission profile.

It prints the resolved tool versions and refuses to overwrite an existing ZIP. Without `--output`, it writes `.context/<name>-plugin-<version>-chatgpt.zip`. Rebuild the upload package for each release to refresh its tool pins.

The package leaves out the Claude-specific manifest and `.mcp.json`, lifecycle hooks, and untracked submission files. The portable `mcp.json` is included. Public plugin submissions currently do not support lifecycle hooks. Upload the ZIP to the Plugins dashboard, complete MCP authentication and domain verification, and inspect the metadata, skill, and tool scan results.

Before submitting for review, prepare a dedicated reviewer account with access to `@expo-mcp/sdk58` and the build referenced by the packaged review cases. Verify those cases against that account, and provide a video walkthrough and release notes. Enter reviewer credentials in the dashboard, outside the package. See [CONTRIBUTING.md](../../CONTRIBUTING.md#packaging-for-chatgpt-submission) for packaging and profile validation instructions.

## Feedback

Every skill includes instructions to submit user-requested, actionable feedback with `npx --yes @expo/agent-cli@latest feedback`. Include only relevant technical details and keep credentials, private data, and conversation contents out of feedback.

## License

MIT
