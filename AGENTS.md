# Expo Skills Repository

This repository contains official Expo AI agent skills. Each plugin ships as an [Agent Plugins](https://agent-plugins.org/) 1.0.0 package for Codex, Cursor, and other compatible clients, plus a Claude Code plugin. The skills should stay useful to any agent that can consume `SKILL.md` files.

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
    plugin.json             # Agent Plugins manifest (Codex, Cursor, and other compatible clients)
    mcp.json                # Agent Plugins MCP server configuration
    .claude-plugin/
      plugin.json           # Claude Code plugin manifest
    .mcp.json               # Claude Code MCP server configuration
    skills/
      README.md             # Grouped index of all skills
      skill-name/
        SKILL.md            # Main skill file
        references/         # Optional supporting documentation
        scripts/            # Optional utility scripts
        agents/
          openai.yaml       # Codex trigger metadata
    README.md               # Plugin documentation
README.md                   # User-facing installation instructions
CONTRIBUTING.md             # Contributor guidance (adding skills, naming, free vs paid)
skills.sh.json              # skills.sh catalog groupings
scripts/                    # CI checks (skill limits, plugin version bump)
```

All three marketplaces expose the active `expo` and `expo-experiments` plugins. The Claude Code marketplace additionally keeps deprecated aliases such as `expo-app-design`, `upgrading-expo`, and `expo-deployment` pointing at `./plugins/expo` for backward compatibility. Do not add those aliases to Codex or Cursor - their marketplace entries must match the plugin manifest name.

## Plugin Manifests

Each plugin carries two manifests: a portable [Agent Plugins](https://agent-plugins.org/) manifest at the plugin root, and a Claude Code manifest under `.claude-plugin/`.

### Agent Plugins manifest (`plugin.json`)

This is the manifest Codex, Cursor, and every other Agent Plugins client reads. Its schema is **closed** - the only permitted top-level fields are `$schema`, `name`, `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`, and `extensions`. Component locations are fixed and cannot be overridden: skills come from `skills/`, MCP servers from `mcp.json`.

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "Brief description of the plugin",
  "author": {
    "name": "Expo Team",
    "email": "support@expo.dev",
    "url": "https://expo.dev"
  },
  "license": "MIT",
  "extensions": {
    "com.openai": {
      "interface": {
        "displayName": "My Plugin"
      }
    }
  }
}
```

`$schema` and `name` are required. Client-specific data goes under a reverse-domain namespace in `extensions`; `com.openai` is Codex's namespace, and Codex reads only `interface`, `apps`, and `hooks` from it. A field outside the permitted list is a schema violation, so do not add `skills`, `mcpServers`, or a top-level `displayName`.

The MCP configuration is a sibling `mcp.json` with its own `$schema`. Remote servers use `"type": "streamable-http"` - `"http"` is not a valid Agent Plugins transport.

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
  "mcpServers": {
    "expo": {
      "type": "streamable-http",
      "url": "https://mcp.expo.dev/mcp"
    }
  }
}
```

### Claude Code manifest (`.claude-plugin/plugin.json`)

Claude Code is not an Agent Plugins client. It reads its own manifest and its own `.mcp.json`, and ignores the root `plugin.json` entirely.

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

Only `name` is required. `version`, `description`, and `author` are optional.

Both manifests share the same `version`, and CI enforces that they are bumped together.

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

- Name skills `expo-*` (open-source framework) or `eas-*` (paid EAS service), and prefix the description with `Framework (OSS).` or `EAS service (paid).` to match. The cross-cutting `expo-skill-feedback` skill is exempt because it accepts framework, EAS, docs, CLI, and MCP feedback. Paid skills open the body with a costs/plan-limits callout. See `CONTRIBUTING.md` for the full rules.
- Keep the `SKILL.md` body under 500 lines and the `description` under 1024 characters - both are CI-enforced by `scripts/check-skill-limits.ts`.
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

Agent Plugins standardizes the plugin package, not its distribution, so each agent ecosystem still needs its own marketplace catalog. This repo has one shared plugin implementation at `plugins/expo` and three marketplace wrappers pointing at it:

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

Follow the full guide in `CONTRIBUTING.md`. In short:

1. Pick the name per the naming rule: `expo-*` for open-source framework skills, `eas-*` for paid EAS service skills.
2. Create `plugins/expo/skills/<skill-name>/SKILL.md` with the category-prefixed description (`Framework (OSS).` or `EAS service (paid).`); `expo-skill-feedback` is the sole cross-cutting exception. Paid skills open with a costs/plan-limits callout.
3. Add focused reference files under `references/` when the skill needs more detail than belongs in the main `SKILL.md`, scripts under `scripts/` only for reusable logic, and `agents/openai.yaml` for Codex triggering.
4. Add the canonical feedback block with `bun scripts/check-skill-limits.ts --fix-feedback`; CI verifies that its subject matches the skill name.
5. Register the skill in every catalog: `skills.sh.json`, `plugins/expo/README.md`, `plugins/expo/skills/README.md`, and the root `README.md`.
6. Bump the version in both plugin manifests together - `plugins/expo/plugin.json` and `plugins/expo/.claude-plugin/plugin.json` (they must match and be greater than main; CI-enforced).
7. Keep the skill under the existing `expo` plugin unless there is a clear distribution reason to create a new plugin.

## Testing Plugins

Validate the changed surface before publishing:

```bash
claude plugin validate .
claude plugin validate ./plugins/expo
bun scripts/check-skill-limits.ts
bun scripts/check-plugin-version-bump.ts origin/main
```

For JSON-only changes, also verify the edited JSON file parses:

```bash
python3 -m json.tool .claude-plugin/marketplace.json >/dev/null
python3 -m json.tool .agents/plugins/marketplace.json >/dev/null
python3 -m json.tool .cursor-plugin/marketplace.json >/dev/null
python3 -m json.tool plugins/expo/plugin.json >/dev/null
python3 -m json.tool plugins/expo/mcp.json >/dev/null
python3 -m json.tool plugins/expo/.claude-plugin/plugin.json >/dev/null
python3 -m json.tool plugins/expo/.mcp.json >/dev/null
```

For changes to a root `plugin.json` or `mcp.json`, also validate against the published Agent Plugins schemas. The manifest schema sets `additionalProperties: false`, so a stray field fails validation rather than being silently ignored:

```bash
bun scripts/check-agent-plugin-schemas.ts
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

Telemetry is anonymous, **opt-in, and off by default** — nothing is sent until the user enables it with `node plugins/expo/skills/expo-skill-feedback/scripts/telemetry.cjs --on` or `EXPO_SKILLS_TELEMETRY=1` (`--off` / `=0` / `DO_NOT_TRACK=1` disable; CI never sends). When enabled, the plugin-level hook sends automatic `skill_invoked` events on **Claude Code only**. The gate is `telemetryActive()` in `telemetry_common.cjs`.

For contributors: new skills need no telemetry edits. They do need the canonical feedback footer; run `bun scripts/check-skill-limits.ts --fix-feedback`, and CI will enforce it. Codex and Cursor cannot host plugin hooks (verified against their sources; don't re-investigate), so they ship no automatic telemetry hooks.
