# Expo Skills Repository

This repository contains official Expo AI agent skills. The primary distribution format is a Claude Code plugin marketplace, but the skills should stay useful to any agent that can consume `SKILL.md` files.

## Repository Structure

```
.claude-plugin/
  marketplace.json          # Claude Code marketplace catalog
.agents/
  plugins/
    marketplace.json        # Codex marketplace catalog
.cursor-plugin/
  marketplace.json          # Cursor marketplace catalog
plugins/
  expo/
    .claude-plugin/
      plugin.json           # Claude Code plugin manifest
    .codex-plugin/
      plugin.json           # Codex plugin manifest
    .cursor-plugin/
      plugin.json           # Cursor plugin manifest
    .mcp.json               # Claude Code and Codex MCP server configuration
    mcp.json                # Cursor MCP server configuration
    skills/
      skill-name/
        SKILL.md            # Main skill file
        references/         # Optional supporting documentation
        scripts/            # Optional utility scripts
    README.md               # Plugin documentation
README.md                   # User-facing installation instructions
CONTRIBUTING.md             # Contributor guidance
```

The Claude Code marketplace currently exposes `expo` as the active plugin. It also keeps deprecated aliases such as `expo-app-design`, `upgrading-expo`, and `expo-deployment` pointing at `./plugins/expo` for backward compatibility. The Codex and Cursor marketplaces expose only the active `expo` plugin because their marketplace entries must match the plugin manifest name.

## Plugin Manifest

Each plugin has a `.claude-plugin/plugin.json` file:

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "Brief description of the plugin",
  "author": {
    "name": "Expo Team",
    "email": "support@expo.dev"
  }
}
```

Required fields:

- `name`: Unique identifier in kebab-case.

Optional fields:

- `version`: Semantic versioning, for example `"1.0.0"`.
- `description`: Brief explanation shown in plugin managers.
- `author`: Object with `name` and optionally `email`.

## Skill Files

Skills teach agents how to perform specific Expo tasks. Each skill has a `SKILL.md` file with YAML frontmatter:

```markdown
---
name: skill-name
description: What the skill does and when to use it.
version: 1.0.0
license: MIT
---

# Skill Title

Skill content goes here...
```

Frontmatter fields:

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Skill identifier, lowercase with hyphens, max 64 chars |
| `description` | Yes | Natural-language trigger description, max 1024 chars |
| `allowed-tools` | No | Tools Claude can use without permission, for example `"Read, Grep, Bash(node:*)"` |
| `version` | No | Skill version |
| `license` | No | License identifier |

Skill guidelines:

- Keep `SKILL.md` focused and under 500 lines when practical.
- Move detailed material to `references/` and load it only when the skill needs it.
- Put reusable validation or fetching logic in `scripts/` instead of pasting large command blocks into the skill.
- Write descriptions that match how users naturally ask for help.
- Include keywords users are likely to mention, but do not stuff descriptions with unrelated terms.
- Prefer concrete commands, APIs, and Expo package names over vague advice.

## Supporting Files

Skills can include supporting files:

```
skills/my-skill/
├── SKILL.md
├── references/
│   ├── setup.md
│   └── examples.md
└── scripts/
    ├── fetch.js
    └── validate.js
```

Reference support files from `SKILL.md` with relative paths:

```markdown
## References

Consult these resources as needed:

- `./references/setup.md`: Setup and configuration guide
- `./references/examples.md`: Usage examples
```

## Marketplace Configuration

This repo has one shared plugin implementation at `plugins/expo` and separate marketplace wrappers for each agent ecosystem:

- `.claude-plugin/marketplace.json`: Claude Code marketplace.
- `.agents/plugins/marketplace.json`: Codex marketplace.
- `.cursor-plugin/marketplace.json`: Cursor marketplace.

Claude Code and Cursor marketplace entries use string `source` paths:

```json
{
  "name": "marketplace-name",
  "owner": {
    "name": "Expo Team",
    "email": "support@expo.dev"
  },
  "metadata": {
    "description": "Marketplace description"
  },
  "plugins": [
    {
      "name": "plugin-name",
      "source": "./plugins/plugin-name",
      "description": "What the plugin does."
    }
  ]
}
```

Codex marketplace entries use an object `source` plus install policy and category:

```json
{
  "name": "marketplace-name",
  "interface": {
    "displayName": "Marketplace Display Name"
  },
  "plugins": [
    {
      "name": "plugin-name",
      "source": {
        "source": "local",
        "path": "./plugins/plugin-name"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL"
      },
      "category": "Developer Tools"
    }
  ]
}
```

Marketplace entry fields:

- `name` is required and uses kebab-case.
- `source` is required and should point at the plugin directory relative to the marketplace root.
- `description` fields, when present, should be concise and user-facing.
- Codex entries must include `policy.installation`, `policy.authentication`, and `category`.

When changing Claude Code marketplace aliases, preserve backward compatibility unless the task explicitly removes an old install path. Do not add deprecated alias entries to Codex or Cursor unless their plugin manifest names also match.

## Adding a Skill

1. Create `plugins/expo/skills/my-skill/SKILL.md`.
2. Add focused reference files under `plugins/expo/skills/my-skill/references/` when the skill needs more detail than belongs in the main `SKILL.md`.
3. Add scripts under `plugins/expo/skills/my-skill/scripts/` only for reusable logic.
4. Update `plugins/expo/README.md` or the root `README.md` only when the user-facing installation or usage story changes.
5. Keep the skill under the existing `expo` plugin unless there is a clear distribution reason to create a new plugin.

## Testing Plugins

Validate the changed surface before publishing:

```bash
claude plugin validate .
claude plugin validate ./plugins/expo
```

For JSON-only changes, also verify the edited JSON file parses:

```bash
python3 -m json.tool .claude-plugin/marketplace.json >/dev/null
python3 -m json.tool .agents/plugins/marketplace.json >/dev/null
python3 -m json.tool .cursor-plugin/marketplace.json >/dev/null
python3 -m json.tool plugins/expo/.claude-plugin/plugin.json >/dev/null
python3 -m json.tool plugins/expo/.codex-plugin/plugin.json >/dev/null
python3 -m json.tool plugins/expo/.cursor-plugin/plugin.json >/dev/null
python3 -m json.tool plugins/expo/.mcp.json >/dev/null
python3 -m json.tool plugins/expo/mcp.json >/dev/null
```

For Codex marketplace changes, verify registration in an isolated Codex home before using your real config:

```bash
mkdir -p .context/codex-home .context/fake-home
CODEX_HOME="$PWD/.context/codex-home" HOME="$PWD/.context/fake-home" codex plugin marketplace add "$PWD"
```

For Cursor marketplace changes, validate against Cursor's plugin template validator when available. This workspace has `bun`, so the Node-based validator can be run with Bun.

If a skill includes scripts, run the relevant script-level validation from that skill's `scripts/` directory.

## User Installation

Users install the active plugin from this marketplace:

```text
/plugin marketplace add expo/skills
/plugin install expo
```

The deprecated marketplace entries are compatibility aliases only. New documentation should point users to `/plugin install expo`.

Codex users can add this repository as a marketplace and then install `expo` from the Codex plugin directory:

```text
codex plugin marketplace add expo/skills --ref main
```

## Conventions in This Repo

- Use kebab-case for plugin names, skill names, and file names.
- Use `@expo.io` or `@expo.dev` author emails.
- Use MIT licensing for all plugins and skills.
- Include a brief `README.md` for each plugin.
- Keep references close to the skill that uses them.
- Avoid broad rewrites when updating a skill; preserve the skill's existing scope and trigger intent.

## Usage Telemetry & Feedback

The `expo` plugin sends **anonymous**, on-by-default usage telemetry and collects skill feedback (details in the `skill-feedback` skill). Two signals: automatic `skill_invoked` (via the plugin's `hooks/hooks.json`, no per-skill hooks — **Claude Code only**, since Codex can't host plugin hooks today, so other harnesses fall back to manual feedback) and explicit `skill_feedback`. When adding a skill, copy the `## Expo Skill Feedback` footer from another product skill and swap in your skill's `--skill <name>` (note `skill-feedback`'s own footer uses a different relative script path).

**Turn it off:** ask your agent to "turn off Expo skills telemetry", run `plugins/expo/skills/skill-feedback/scripts/telemetry.js --off`, or set `EXPO_SKILLS_TELEMETRY=0` / `DO_NOT_TRACK=1`.
