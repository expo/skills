# Expo Skills

Official AI agent skills from the Expo team for building, deploying, and debugging robust Expo apps.

## Installation

We primarily use [Claude Code](https://claude.com/claude-code) at Expo, skills are fine-tuned for Opus models. But you can use these skills with any AI agent.

## Claude Code

Add the marketplace:

```
/plugin marketplace add expo/skills
```

Install a plugin:

```
/plugin install expo-app-design
/plugin install upgrading-expo
/plugin install expo-deployment
```

## Any agent

```
bunx skills add expo/skills
```

> This will extract the skills individually so you'll need to manually upgrade them.

## License

MIT
