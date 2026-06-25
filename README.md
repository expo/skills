<p align="center">
  <a href="https://docs.expo.dev/skills/" target="_blank">
    <img src="assets/expo-skills.png" alt="Expo Skills" width="100%" />
  </a>
</p>

<h3 align="center">Expo Skills</h3>

<p align="center">
  <a href="https://skills.sh/expo/skills"><img src="https://skills.sh/b/expo/skills" alt="skills.sh installs" /></a>
  <img src="https://img.shields.io/badge/Expo-official-000020" alt="Official Expo" />
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license" />
</p>

<p align="center">
  Official AI agent skills from the Expo team for building, deploying, upgrading, and debugging Expo apps.
</p>

## How It Works

Skills give AI agents focused Expo knowledge: when to use Expo APIs, how to structure common workflows, and which Expo, EAS, React Native, iOS, and Android constraints matter. Expo documentation, Expo CLI, and EAS CLI remain the source of truth; these skills help agents apply them correctly.

## Installation

For Claude Code or Codex, install the plugin so updates are handled by the official plugin marketplace. For Cursor, OpenCode, and other AI coding agents, use the skills CLI.

| Path | Best for |
| --- | --- |
| Plugin install | Claude Code or Codex, with updates handled by their official plugin marketplaces. |
| Skills CLI | Cursor, OpenCode, GitHub Copilot, Windsurf, Gemini, Cline, AMP, Factory Droid, Antigravity, Kiro CLI, and other AI coding agents. |

### Skills CLI

Install all Expo skills with the [skills CLI](https://skills.sh/docs/cli):

```text
npx skills@latest add expo/skills --skill '*'
```

This selects every Expo skill without selecting every agent. The CLI will still ask where to install them; to target one agent directly, add `--agent <agent>`.

For most agents, this is the only install command you need. Run it from the project root, then restart or refresh your agent session so it can discover the installed `SKILL.md` files.

### Claude Code Plugin

Install from the official Claude Code plugin marketplace:

```text
claude plugin install expo@claude-plugins-official
```

You can also run `/plugin install expo@claude-plugins-official` inside Claude Code.

### Codex Plugin

Install from the OpenAI-curated Codex marketplace:

```text
codex plugin add expo@openai-curated
```

You can also open `/plugins` in Codex and install `expo` from the OpenAI-curated marketplace.

## Updating

Claude Code and Codex plugin installs are updated through their official plugin marketplaces.

For skills CLI installs, update installed skills with:

```text
npx skills@latest update
```

To update a single Expo skill, pass its name:

```text
npx skills@latest update building-native-ui
```

## Try It

After installing, ask your agent Expo-specific questions like:

- "Build a native-feeling Expo Router screen with tabs, modals, and animations."
- "Set up Tailwind CSS v4 and NativeWind v5 in this Expo app."
- "Create an EAS workflow that builds previews on pull requests."
- "Help me upgrade this app to the latest Expo SDK."
- "Check whether this EAS Update rollout is healthy."

Agents choose the right skill from the task context and each skill's description.

## Skills Included

### App Design and Architecture

| Skill | Use it for |
| --- | --- |
| `building-native-ui` | Expo Router screens, navigation, styling, animations, native tabs, and app UI patterns. |
| `native-data-fetching` | API calls, React Query, SWR, caching, offline support, and Expo Router data loaders. |
| `expo-api-routes` | Expo Router API routes with EAS Hosting. |
| `expo-tailwind-setup` | Tailwind CSS v4, `react-native-css`, and NativeWind v5 setup. |
| `use-dom` | Expo DOM components for gradually using web code in native apps. |
| `expo-dev-client` | Local and TestFlight development client builds. |

### Native and Platform Work

| Skill | Use it for |
| --- | --- |
| `expo-module` | Expo native modules and views with Swift, Kotlin, TypeScript, config plugins, and autolinking. |
| `expo-ui-swift-ui` | `@expo/ui/swift-ui` components and modifiers. |
| `expo-ui-jetpack-compose` | `@expo/ui/jetpack-compose` views and modifiers. |
| `add-app-clip` | iOS App Clip targets, AASA files, associated domains, and Smart App Banners. |
| `expo-brownfield` | Adding Expo or React Native to an existing iOS or Android app. |

### Deployment, CI, and Observability

| Skill | Use it for |
| --- | --- |
| `expo-deployment` | App Store, Play Store, TestFlight, EAS Build, web hosting, and API route deployment. |
| `expo-cicd-workflows` | EAS Workflow YAML files and CI/CD automation. |
| `expo-observe` | EAS Observe setup and launch, route, event, and version metrics. |
| `eas-update-insights` | EAS Update health, crash rates, launch counts, payload size, and rollout gates. |
| `eas-simulator` | Run and drive your app on a remote iOS/Android simulator on EAS cloud — from the CLI or an agent, with a live browser preview. |

### Maintenance

| Skill | Use it for |
| --- | --- |
| `upgrading-expo` | Expo SDK upgrades, dependency conflicts, deprecated packages, and cache cleanup. |

## Expo MCP Server

Skills teach an agent how Expo work gets done. The [Expo MCP server](https://docs.expo.dev/eas/ai/mcp/) gives it live access to actually do that work: read the latest Expo docs on demand, install compatible dependencies with `npx expo install`, trigger and monitor EAS builds and workflows, pull crash data from TestFlight, and screenshot a running app in the simulator.

The `expo` plugin bundles this MCP configuration, so Claude Code and Codex plugin installs wire it up automatically. For other agents, or to add it on its own, follow the [Expo MCP setup guide](https://docs.expo.dev/eas/ai/mcp/).

## FAQ

### Which AI coding agents are supported?

Use `npx skills@latest add expo/skills --skill '*'` for Cursor, OpenCode, GitHub Copilot, Windsurf, Gemini, Cline, AMP, Factory Droid, Antigravity, Kiro CLI, and similar AI coding tools.

### Should I install the skills or the plugin?

Use the plugin for Claude Code or Codex; it stays updated through the plugin marketplace. Use `npx skills@latest add expo/skills --skill '*'` for Cursor, OpenCode, and other AI coding agents.

### What is the source of truth?

Expo documentation, Expo CLI, and EAS CLI are the source of truth. These skills teach agents how to apply Expo guidance in real projects.

## License

MIT
