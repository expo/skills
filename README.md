# Expo Skills

Official AI agent skills from the Expo team for building, deploying, and debugging robust Expo apps.

## Installation

We primarily use [Claude Code](https://claude.com/claude-code) at Expo, skills are fine-tuned for Opus models. But you can use these skills with any AI agent.

## Claude Code

Add the marketplace:

```
/plugin marketplace add expo/skills
```

Install the plugin:

```
/plugin install expo
```

## Codex

Add the marketplace:

```
codex plugin marketplace add expo/skills --ref main
```

Then open `/plugins` in Codex and install `expo` from the Expo Skills marketplace.

## Cursor

**Install from GitHub**

1. Open Cursor Settings (Cmd+Shift+J / Ctrl+Shift+J)
2. Navigate to `Rules & Command` → `Project Rules` → Add Rule → Remote Rule (GitHub)
3. Enter: `https://github.com/expo/skills.git`

**How it works:** Skills are automatically discovered and used by the agent based on context. When you ask questions about Expo development, the agent will automatically use the relevant skills (e.g., `building-ui`, `data-fetching`, `deployment`) based on the skill descriptions.

**Note:** Skills won't appear in the `/` slash command menu. The `/` menu in Cursor is for custom commands (stored in `.cursor/commands/`), not for skills. Skills work via auto-discovery - the agent uses them automatically when your questions match their descriptions.

**Verify installation:** After adding the Remote Rule, try asking the agent Expo-related questions like:
- "How do I build a UI with Expo Router?"
- "How do I make API calls in my Expo app?"
- "How do I deploy my Expo app to the App Store?"

If the skills are working, the agent will use the relevant skill content to answer your questions.

This repo also includes Cursor plugin marketplace metadata for plugin distribution. The GitHub Remote Rule flow above remains the most direct install path when marketplace installation is not available.

## Any agent

```
bunx skills add expo/skills
```

> This will extract the skills individually so you'll need to manually upgrade them.

## Usage telemetry & feedback

These skills send **anonymous** usage events so the Expo team can see how they're used and improve them. On first use a random ID is created locally at `~/.expo-skills/installation-id`; only a hash of it is sent. We never send source code, prompts, file paths, or personal data. Scripts are zero-dependency and run under Node or Bun.

- **Tracked in Claude Code:** when a skill is invoked — by the AI or a user `/slash` command (`skill_invoked`, tagged with `initiator` = `ai` or `user`).
- **Feedback:** every skill ends with an *Expo Skill Feedback* footer — a one-line command to send a quick rating + note.
- **Other agents (Codex, Cursor, …):** automatic tracking needs Claude Code hooks, so it's off there; feedback still works by running the bundled script.

Turn it off any time — the simplest way is to ask your agent: **"turn off Expo skills telemetry"** (it runs the bundled toggle, which writes `~/.expo-skills/opt-out` — a persistent switch that works regardless of how the agent was launched). For a global or CI opt-out, set an env var instead:

```bash
export DO_NOT_TRACK=1            # or: export EXPO_SKILLS_TELEMETRY=0
```

See the `skill-feedback` skill for full details, the event shape, and how to configure the PostHog project key.

## License

MIT
