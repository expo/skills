<div align="center">
  <a href="https://docs.expo.dev/skills/" target="_blank">
    <img src="assets/expo-skills.png" alt="Expo Skills" width="100%" />
  </a>
</div>

# Expo Skills

Official AI agent skills from the Expo team for building, deploying, upgrading, and debugging Expo apps.

<p>
  <a href="https://skills.sh/expo/skills"><img src="https://skills.sh/b/expo/skills" alt="skills.sh installs" /></a>
  <img src="https://img.shields.io/badge/Expo-official-000020" alt="Official Expo" />
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license" />
</p>

Skills give AI agents focused Expo knowledge: when to use Expo APIs, how to structure common workflows, and which Expo, EAS, React Native, iOS, and Android constraints matter. Expo documentation, Expo CLI, and EAS CLI remain the source of truth; these skills help agents apply them correctly.

## Installation

Use a plugin install for Claude Code or Codex. Use the skills CLI for Cursor and other agents that load `SKILL.md` files.

| Path | Best for |
| --- | --- |
| Plugin install | Claude Code or Codex installs from their official plugin marketplaces. |
| Skills CLI | Cursor, GitHub Copilot, Windsurf, Gemini, and other agents that load `SKILL.md` files. |

### Skills CLI

Install with the [skills CLI](https://skills.sh/docs/cli):

```text
npx skills@latest add expo/skills
```

This installs the skills for supported local agents using the open `SKILL.md` format.

For most agents, this is the only install command you need. Run it from the project root, then restart or refresh your agent session so it can discover the installed `SKILL.md` files.

Update CLI-installed skills with:

```text
npx skills@latest update
```

### Claude Code Plugin

Install from the official Claude Code plugin marketplace:

```text
/plugin install expo@claude-plugins-official
```

### Codex Plugin

Install from the OpenAI-curated Codex marketplace:

```text
codex plugin add expo@openai-curated
```

You can also open `/plugins` in Codex and install `expo` from the OpenAI-curated marketplace.

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

### Maintenance

| Skill | Use it for |
| --- | --- |
| `upgrading-expo` | Expo SDK upgrades, dependency conflicts, deprecated packages, and cache cleanup. |

## Expo MCP Server

Skills teach an agent how Expo work gets done. The [Expo MCP server](https://docs.expo.dev/eas/ai/mcp/) gives it live access to actually do that work: read the latest Expo docs on demand, install compatible dependencies with `npx expo install`, trigger and monitor EAS builds and workflows, pull crash data from TestFlight, and screenshot a running app in the simulator.

The `expo` plugin bundles this MCP configuration, so Claude Code and Codex plugin installs wire it up automatically. For other agents, or to add it on its own, follow the [Expo MCP setup guide](https://docs.expo.dev/eas/ai/mcp/).

## FAQ

### Which agents are supported?

Use `npx skills add expo/skills` for agents that load `SKILL.md` files, including Claude Code, Cursor, Codex, GitHub Copilot, Windsurf, Gemini, Cline, AMP, Factory Droid, Antigravity, OpenCode, Kiro CLI, and similar tools.

### Should I install the skills or the plugin?

Use a plugin install for Claude Code or Codex. Use `npx skills@latest add expo/skills` for Cursor and other agents that load `SKILL.md` files.

### What is the source of truth?

Expo documentation, Expo CLI, and EAS CLI are the source of truth. These skills teach agents how to apply Expo guidance in real projects.

## License

MIT
