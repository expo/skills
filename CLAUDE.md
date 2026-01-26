# Expo Skills Repository

This repository contains Claude Code plugins for building Expo apps. It serves as a marketplace for distributing skills to the Expo community.

## Repository Structure

```
.claude-plugin/
  marketplace.json          # Marketplace catalog - lists all plugins
plugins/
  expo-app-design/          # Plugin for building Expo apps
    .claude-plugin/
      plugin.json           # Plugin manifest
    skills/
      building-ui/
        SKILL.md            # Main skill file
        references/         # Supporting documentation
      deployment/
        SKILL.md
        reference/
      ...
    README.md
  upgrading-expo/           # Plugin for SDK upgrades
  expo-cicd-workflows/      # Plugin for EAS workflows
README.md                   # User-facing installation instructions
```

## Creating Claude Code Plugins

### Plugin Directory Structure

Each plugin follows this structure:

```
my-plugin/
├── .claude-plugin/
│   └── plugin.json         # Required: Plugin manifest (only file in this dir)
├── skills/                 # Skill directories
│   └── skill-name/
│       ├── SKILL.md        # Required: Main skill file
│       ├── references/     # Optional: Supporting docs
│       └── scripts/        # Optional: Utility scripts
└── README.md               # Optional: Plugin documentation
```

### Plugin Manifest (`plugin.json`)

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "Brief description of the plugin",
  "author": {
    "name": "Your Name",
    "email": "you@example.com"
  }
}
```

Required fields:
- `name`: Unique identifier in kebab-case

Optional fields:
- `version`: Semantic versioning (e.g., `"1.0.0"`)
- `description`: Brief explanation shown in plugin manager
- `author`: Object with `name` and optionally `email`

### Skill Files (`SKILL.md`)

Skills teach Claude how to perform specific tasks. Each skill has a `SKILL.md` file with YAML frontmatter:

```markdown
---
name: skill-name
description: What the skill does and when to use it. Claude uses this for auto-discovery.
---

# Skill Title

Skill content goes here...
```

**Frontmatter fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Skill identifier (lowercase, hyphens, max 64 chars) |
| `description` | Yes | When to use this skill (max 1024 chars) - crucial for auto-discovery |
| `allowed-tools` | No | Tools Claude can use without permission (e.g., `"Read, Grep, Bash(node:*)"`) |
| `version` | No | Skill version |
| `license` | No | License identifier |

**Best practices:**
- Keep `SKILL.md` under 500 lines
- Use `references/` subdirectory for detailed documentation
- Write descriptions that match what users naturally say
- Include keywords users would search for

### Supporting Files

Skills can include supporting files:

```
skills/my-skill/
├── SKILL.md                 # Main skill (required)
├── references/              # Detailed documentation
│   ├── setup.md
│   └── examples.md
└── scripts/                 # Utility scripts
    ├── fetch.js
    └── validate.js
```

Reference these in your SKILL.md:
```markdown
## References

Consult these resources as needed:
- [references/setup.md](references/workflows.md) - Setup and configuration guide
- [references/examples.md](references/workflows.md) - Usage examples
```

## Marketplace Configuration

The `.claude-plugin/marketplace.json` file catalogs all plugins:

```json
{
  "name": "marketplace-name",
  "owner": {
    "name": "Owner Name",
    "email": "owner@example.com"
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

**Plugin entry fields:**
- `name` (required): Plugin identifier in kebab-case
- `source` (required): Relative path to plugin directory
- `description`: Brief description for the plugin list

## Adding a New Plugin

1. Create the plugin directory structure:
   ```bash
   mkdir -p plugins/my-plugin/.claude-plugin
   mkdir -p plugins/my-plugin/skills/my-skill
   ```

2. Create `plugins/my-plugin/.claude-plugin/plugin.json`:
   ```json
   {
     "name": "my-plugin",
     "version": "1.0.0",
     "description": "What the plugin does",
     "author": {
       "name": "Your Name",
       "email": "you@example.com"
     }
   }
   ```

3. Create `plugins/my-plugin/skills/my-skill/SKILL.md`:
   ```markdown
   ---
   name: my-skill
   description: When to use this skill and what it does.
   ---

   # My Skill

   Content...
   ```

4. Create `plugins/my-plugin/README.md`:
   ```markdown
   # My Plugin

   Brief description.

   ## License

   MIT
   ```

5. Add to `.claude-plugin/marketplace.json`:
   ```json
   {
     "name": "my-plugin",
     "source": "./plugins/my-plugin",
     "description": "What the plugin does."
   }
   ```

6. Add to `README.md` installation examples:
   ```
   /plugin install my-plugin
   ```

## Testing Plugins

Test plugins locally before publishing:

```bash
# Load plugin for testing
claude --plugin-dir ./plugins/my-plugin

# Validate plugin structure
claude plugin validate ./plugins/my-plugin
```

## User Installation

Users install plugins from this marketplace:

```bash
# Add the marketplace
/plugin marketplace add expo/skills

# Install a plugin
/plugin install expo-app-design
/plugin install upgrading-expo
/plugin install expo-cicd-workflows
```

## Conventions in This Repo

- **Plugin names**: Use kebab-case (e.g., `expo-app-design`)
- **Skill names**: Use kebab-case (e.g., `building-ui`, `cicd-workflows`)
- **File names**: Use kebab-case for all files
- **Author emails**: Use `@expo.io` or `@expo.dev` domain
- **License**: MIT for all plugins
- **README.md**: Include in each plugin with brief description and license
