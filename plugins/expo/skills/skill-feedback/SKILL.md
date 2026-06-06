---
name: skill-feedback
description: Submit feedback about Expo skills, and how the bundled usage telemetry works. Use when an Expo skill was useful, confusing, broken, missing context, or worth improving.
---

# Skill Feedback

The shared feedback + usage-telemetry helper for the Expo skills. Every skill ends
with an `Expo Skill Feedback` footer that points here. It sends anonymous events to
PostHog so the Expo team can see how skills are used and where they need work.

No setup, no env vars, and no user token are required. On first send it creates one
random local installation ID at `~/.expo-skills/installation-id` and sends only a
short **hash** of it. Hostnames, usernames, emails, file paths, source code, prompts,
tool inputs, and machine identifiers are **never** sent. Telemetry is **skipped
automatically in CI**, and the first real send prints a one-time notice to stderr.

## Runtime

Scripts are plain JavaScript and run under **Node or Bun** — both ship the built-ins
they use (`crypto`, `https`, `fs`). `scripts/run.sh` picks whichever is installed
(`node`, then `bun`) and does nothing if neither is found, so a missing runtime never
blocks a tool call. Node/Bun is a hard requirement for Expo development, so it is
effectively always present where these skills run.

## Events

| Event | When | How |
| --- | --- | --- |
| `skill_invoked` | A skill is invoked — by the **AI** (`Skill` tool) or a **user** `/slash` command | Plugin `Skill` + `UserPromptExpansion` hooks; tagged `initiator: ai`\|`user`, scoped to this plugin |
| `skill_feedback` | You submit feedback | Manual — the command below |

## Submitting feedback

Keep it to 1-3 short sentences, name the skill, and prefer concrete observations.

**Claude Code** (`${CLAUDE_SKILL_DIR}` resolves to the active skill's folder):

```bash
sh "${CLAUDE_SKILL_DIR}/../skill-feedback/scripts/run.sh" \
   "${CLAUDE_SKILL_DIR}/../skill-feedback/scripts/skill-feedback.js" \
   --skill expo-deployment --rating useful \
   --text "TestFlight steps were clear and worked first try."
```

**Other agents (Codex, etc.)** — run the same bundled script with `node` or `bun`,
using its path on disk (the harness auto-detects; `--agent-harness` below is an
explicit override):

```bash
node skill-feedback/scripts/skill-feedback.js \
  --skill deslop --rating confusing --agent-harness codex \
  --text "The skill should say which files it inspected before changing code."
```

Ratings: `useful`, `confusing`, `bug`, `idea`, `other`. Add `--dry-run` to print the payload without sending.

**Never include** secrets, private data, source code, long prompts, stack traces, API
keys, or tokens.

## Harness support

- **Claude Code** — `skill_invoked` is automatic via hooks (the AI's `Skill` tool + user `/slash` commands).
- **Codex / Cursor / other agents** — no hook system, so automatic events do not fire.
  The skills still work fully; only `skill_feedback` is available (run the script
  directly). If a harness later exposes a per-tool hook adapter, the same scripts wire
  straight into it.

## Turning it off

Telemetry is anonymous and on by default. The reliable, launch-independent way to opt
out is the bundled toggle — it writes `~/.expo-skills/opt-out`, which every script checks
before sending. Easiest: ask your agent to **"turn off Expo skills telemetry."** Or run
it directly:

```bash
# Claude Code:
sh "${CLAUDE_SKILL_DIR}/scripts/run.sh" "${CLAUDE_SKILL_DIR}/scripts/telemetry.js" --off
# Other agents:
node skill-feedback/scripts/telemetry.js --off      # --on to re-enable, --status to check
```

For CI or a global opt-out, set an env var instead. Env vars are convenient but only
apply where they're exported and don't always reach hook subprocesses, so prefer the
toggle for a persistent opt-out:

```bash
export EXPO_SKILLS_TELEMETRY=0   # or: false / off / no
export DO_NOT_TRACK=1            # cross-tool standard, https://consoledonottrack.com
```

When disabled, no installation ID is created and nothing is sent. Uninstalling the plugin
removes everything.

## Configuring the PostHog project

The project key lives in `scripts/telemetry_common.js`. It is a **write-only, public**
ingestion key (`phc_...`) — the same kind embedded in browser snippets — so it is safe
to commit. Override it per environment (e.g. a staging project) without editing the file:

```bash
export EXPO_SKILLS_POSTHOG_KEY="phc_your_project_key"
```

Only ever use a *project* key (`phc_...`) here. Never a *personal* API key (`phx_...`) —
those are secret and used only for reading/querying (e.g. the PostHog MCP).

## PostHog event shape

- `event`: `skill_invoked` | `skill_feedback`
- `distinct_id`: `expo-skills-installation:<installation_id_hash>`
- `properties.source`: `expo-skills`
- `properties.$process_person_profile`: `false`
- `properties.skill`: skill folder name (e.g. `expo-deployment`)
- `properties.agent_harness`: auto-detected (`claude-code`, `codex`), else `unknown`; override with `--agent-harness`
- `properties.initiator` (on `skill_invoked`): `ai` (Claude invoked via the `Skill` tool) or `user` (a `/slash` command)
- `properties.os` / `properties.arch`: platform, e.g. `macos` / `arm64` (non-PII)
- `properties.installation_id_hash`: anonymous hash of the local random installation ID
- `properties.session_id_hash`: short hash only; raw session IDs are never sent
- `skill_feedback` adds `properties.rating` and `properties.feedback_text`

---

## Expo Skill Feedback

If this skill was useful, confusing, broken, or missing context, submit 1-3 safe sentences with the bundled feedback script:

- **Claude Code:** `sh "${CLAUDE_SKILL_DIR}/scripts/run.sh" "${CLAUDE_SKILL_DIR}/scripts/skill-feedback.js" --skill skill-feedback --rating idea --text "..."`
- **Other agents (Codex, etc.):** run `skill-feedback/scripts/skill-feedback.js` (bundled in this plugin) with `node` or `bun`, same flags (the harness is auto-detected).

Never include secrets, private data, source code, long prompts, or stack traces.
