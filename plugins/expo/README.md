# Expo

Official AI agent skills from the Expo team for building, deploying, upgrading, and debugging Expo apps.

Skills come in two groups so the free vs paid boundary stays clear: open-source **framework** skills, and **services & paid distribution** skills whose core purpose uses paid Expo Application Services (EAS). Each services skill opens with a costs/plan-limits note.

## What This Plugin Does

### Framework (open source)

- Provides UI guidelines following Apple Human Interface Guidelines
- Covers Expo Router navigation patterns (stacks, tabs, modals, sheets)
- Explains native iOS controls, SF Symbols, animations, and visual effects
- Covers `@expo/ui` native components (universal, SwiftUI, and Jetpack Compose)
- Covers data fetching patterns with React Query, offline support, and Expo Router loaders
- Helps set up Tailwind CSS v4 with NativeWind v5
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
- Tracks production performance with EAS Observe
- Covers website and API route authoring and deployment with EAS Hosting
- Runs and drives your app on remote iOS/Android simulators on EAS cloud

## When to Use

### Framework (open source)

- Building new Expo apps from scratch
- Adding navigation, styling, or animations
- Wiring up data fetching
- Integrating web libraries via DOM components
- Migrating an existing web/React app to native with Expo
- Configuring Tailwind CSS for React Native
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
- Tracking startup, navigation, and event performance with EAS Observe
- Deploying a website or Expo Router API routes to EAS Hosting
- Running your app on a remote cloud simulator when no local simulator is available

## Skills Included

### Framework (open source)

- **expo-router** - Navigation and routing: file-based routes, links, native stacks, modals, sheets, native tabs, and headers
- **expo-native-ui** - Build beautiful native-feeling screens: styling, semantic colors, controls, icons, media, animations, and visual effects
- **expo-ui** - Native UI with @expo/ui: universal cross-platform components first, with SwiftUI and Jetpack Compose for platform-specific needs
- **expo-data-fetching** - Network requests, API calls, caching, and offline support
- **expo-tailwind-setup** - Set up Tailwind CSS v4 in Expo with NativeWind v5
- **expo-dom** - Run web code in a webview on native using DOM components
- **expo-web-to-native** - Migrate an existing web/React app to a native iOS/Android app with Expo
- **expo-module** - Write Expo native modules and views (Swift, Kotlin, TypeScript, config plugins)
- **expo-brownfield** - Integrate Expo and React Native into existing native iOS or Android apps
- **expo-dev-client** - Build and distribute Expo development clients (local builds free; EAS Build/TestFlight paid)
- **expo-examples** - Adapt or scaffold from the `expo/examples` repo of `with-*` integrations
- **expo-app-clip** - Add an iOS App Clip target (AASA, associated domains, Smart App Banners; needs an Apple Developer account)
- **expo-upgrade** - Upgrade Expo SDK versions and fix dependency issues

### Services & paid distribution

- **eas-app-stores** - Build and submit to the iOS App Store, Android Play Store, and TestFlight
- **eas-hosting** - Deploy Expo websites and API routes to EAS Hosting (secrets, custom domains, Cloudflare Workers)
- **eas-workflows** - EAS workflow YAML files for CI/CD pipelines
- **eas-observe** - EAS Observe setup and launch, route, event, and version metrics
- **eas-update-insights** - Check EAS Update health, crash rates, adoption, and payload size
- **eas-simulator** - Run and drive your app on a remote iOS/Android simulator on EAS cloud, from the CLI or an AI agent

## License

MIT
