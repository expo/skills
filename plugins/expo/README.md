# Expo

Official AI agent skills from the Expo team for building, deploying, upgrading, and debugging Expo apps.

## What This Plugin Does

### App Design

- Provides UI guidelines following Apple Human Interface Guidelines
- Covers Expo Router navigation patterns (stacks, tabs, modals, sheets)
- Explains native iOS controls, SF Symbols, animations, and visual effects
- Guides API route creation with EAS Hosting
- Covers data fetching patterns with React Query, offline support, and Expo Router loaders
- Helps set up Tailwind CSS v4 with NativeWind v5
- Explains DOM components for running web code in native apps
- Covers iOS App Clips and brownfield Expo integration into existing native apps
- Wires Expo projects into the Codex app Run button and action terminal

### Deployment

- Guides iOS App Store, TestFlight, and Android Play Store submissions
- Covers EAS Build configuration and version management
- Helps write and validate EAS Workflow YAML files for CI/CD
- Checks EAS Update health, adoption, crash rates, and payload size
- Covers web deployment with EAS Hosting

### Upgrading

- Walks through the step-by-step Expo SDK upgrade process
- Identifies deprecated packages and their modern replacements
- Handles cache clearing for both managed and bare workflows
- Fixes dependency conflicts after an upgrade

## When to Use

### App Design

- Building new Expo apps from scratch
- Adding navigation, styling, or animations
- Setting up API routes or data fetching
- Integrating web libraries via DOM components
- Configuring Tailwind CSS for React Native
- Adding an iOS App Clip or integrating Expo into an existing native app
- Adding a Codex app Run button for `expo start`
- Creating optional Codex action buttons for iOS, Android, Web, dev-client, diagnostics, or export

### Deployment

- Submitting apps to App Store Connect or Google Play
- Setting up TestFlight beta testing
- Configuring EAS Build profiles
- Writing CI/CD workflows for automated deployments
- Inspecting EAS Update rollout health and adoption
- Deploying web apps with EAS Hosting

### Upgrading

- Upgrading to a new Expo SDK version
- Fixing dependency conflicts after an upgrade
- Migrating from deprecated packages (expo-av to expo-audio/expo-video)
- Cleaning up legacy configuration files

## Skills Included

### App Design

- **add-app-clip** — Add an iOS App Clip target to an Expo app (AASA, associated domains, TestFlight)
- **building-native-ui** — Build beautiful apps with Expo Router, styling, components, navigation, and animations
- **expo-api-routes** — Create API routes in Expo Router with EAS Hosting
- **expo-brownfield** — Integrate Expo and React Native into existing native iOS or Android apps
- **expo-dev-client** — Build and distribute Expo development clients locally or via TestFlight
- **expo-tailwind-setup** — Set up Tailwind CSS v4 in Expo with NativeWind v5
- **expo-ui** — Native UI with @expo/ui: universal cross-platform components first, with SwiftUI and Jetpack Compose for platform-specific needs
- **native-data-fetching** — Network requests, API calls, caching, and offline support
- **use-dom** — Run web code in a webview on native using DOM components

### Deployment

- **eas-update-insights** — Check EAS Update health, crash rates, adoption, and payload size
- **expo-deployment** — Deploy to iOS App Store, Android Play Store, and web hosting
- **expo-cicd-workflows** — EAS workflow YAML files for CI/CD pipelines

### Upgrading

- **upgrading-expo** — Upgrade Expo SDK versions and fix dependency issues

## License

MIT
