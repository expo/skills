# Expo Skills Repository

This repository contains official Expo AI agent skills. The primary distribution format is a Claude Code plugin marketplace, but the skills should stay useful to any agent that can consume `SKILL.md` files.

## Repository Structure

```
.claude-plugin/
  marketplace.json          # Marketplace catalog for the repo
plugins/
  expo/
    .claude-plugin/
      plugin.json           # Plugin manifest
    .mcp.json               # Expo MCP server configuration
    skills/
      skill-name/
        SKILL.md            # Main skill file
        references/         # Optional supporting documentation
        scripts/            # Optional utility scripts
    README.md               # Plugin documentation
README.md                   # User-facing installation instructions
CONTRIBUTING.md             # Contributor guidance
```

The marketplace currently exposes `expo` as the active plugin. It also keeps deprecated aliases such as `expo-app-design`, `upgrading-expo`, and `expo-deployment` pointing at `./plugins/expo` for backward compatibility.

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

The root `.claude-plugin/marketplace.json` file catalogs installable plugins:

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

Plugin entry fields:

- `name` is required and uses kebab-case.
- `source` is required and should be a relative path to the plugin directory.
- `description` should be concise and user-facing.

When changing marketplace aliases, preserve backward compatibility unless the task explicitly removes an old install path.

## Adding a Skill

1. Create `plugins/expo/skills/my-skill/SKILL.md`.
2. Add focused reference files under `plugins/expo/skills/my-skill/references/` when the skill needs more detail than belongs in the main `SKILL.md`.
3. Add scripts under `plugins/expo/skills/my-skill/scripts/` only for reusable logic.
4. Update `plugins/expo/README.md` or the root `README.md` only when the user-facing installation or usage story changes.
5. Keep the skill under the existing `expo` plugin unless there is a clear distribution reason to create a new plugin.

## Testing Plugins

Validate the changed surface before publishing:

```bash
claude plugin validate ./plugins/expo
```

For JSON-only changes, also verify the edited JSON file parses:

```bash
python3 -m json.tool .claude-plugin/marketplace.json >/dev/null
python3 -m json.tool plugins/expo/.claude-plugin/plugin.json >/dev/null
python3 -m json.tool plugins/expo/.mcp.json >/dev/null
```

If a skill includes scripts, run the relevant script-level validation from that skill's `scripts/` directory.

## User Installation

Users install the active plugin from this marketplace:

```text
/plugin marketplace add expo/skills
/plugin install expo
```

The deprecated marketplace entries are compatibility aliases only. New documentation should point users to `/plugin install expo`.

## Conventions in This Repo

- Use kebab-case for plugin names, skill names, and file names.
- Use `@expo.io` or `@expo.dev` author emails.
- Use MIT licensing for all plugins and skills.
- Include a brief `README.md` for each plugin.
- Keep references close to the skill that uses them.
- Avoid broad rewrites when updating a skill; preserve the skill's existing scope and trigger intent.
