---
name: skill-feedback
description: Submit feedback on an Expo skill, or turn the bundled anonymous usage telemetry on or off. Use when an Expo skill was useful, confusing, broken, missing context, or worth improving — or when the user wants to disable, opt out of, turn off, stop, or understand the anonymous usage tracking these skills send.
---

# Skill Feedback

The shared telemetry + feedback helper for the Expo skills. It powers two separate
signals, both **anonymous** and sent to PostHog so the Expo team can see how skills are
used and where they fall short:

- **Automatic usage** (`skill_invoked`) — emitted by plugin hooks when a skill runs. No
  manual step. **On by default.**
- **Explicit feedback** (`skill_feedback`) — a rating + short note you (or the agent, with
  the user's OK) send deliberately by running the command below.

Both send only a short **hash** of a random local installation ID
(`~/.expo-skills/installation-id`, created on first send). Hostnames, usernames, emails,
file paths, source code, **prompts, and chat history** are **never** sent. Telemetry is
**skipped automatically in CI**, and a direct (non-quiet) run prints a one-time stderr
notice on first send. To turn everything off, see *Turning it off* below.

## Runtime

Scripts are plain JavaScript and run under **Node or Bun** — both ship the built-ins they
use (`crypto`, `https`, `fs`). `scripts/run.sh` picks whichever is installed (`node`, then
`bun`) and does nothing if neither is found, so a missing runtime never blocks a tool call.
Node/Bun is a hard requirement for Expo development, so it's effectively always present.

## The two signals

| Event | Trigger | Mechanism |
| --- | --- | --- |
| `skill_invoked` | A skill runs — by the **AI** (`Skill` tool) or a **user** `/slash` command | Automatic, via the plugin's `hooks/hooks.json`; tagged `initiator: ai`\|`user`, scoped to this plugin. **Claude Code only** — see *Harness support* |
| `skill_feedback` | You deliberately send a rating + note | Manual — the command below |

## Submitting feedback

Keep it to 1-3 short sentences, name the skill, and prefer concrete observations.

**Claude Code** (`${CLAUDE_SKILL_DIR}` resolves to the active skill's folder):

```bash
sh "${CLAUDE_SKILL_DIR}/scripts/skill-feedback.sh" \
   --skill expo-deployment --rating useful \
   --text "TestFlight steps were clear and worked first try."
```

**Other agents (Codex, Cursor, …)** — run the bundled script directly with `node` or
`bun`. The harness is auto-detected only for Claude Code and Codex; on any other agent
pass `--agent-harness` so the event is labelled correctly:

```bash
node skill-feedback/scripts/skill-feedback.js \
  --skill use-dom --rating confusing --agent-harness cursor \
  --text "The skill should say which files it inspected before changing code."
```

Ratings: `useful`, `confusing`, `bug`, `idea`, `other`. Add `--dry-run` to print the payload without sending.

**Never include** secrets, private data, source code, long prompts, stack traces, API
keys, or tokens.

## Turning it off

Telemetry is anonymous and **on by default**. Opting out silences **both** signals —
automatic `skill_invoked` and explicit `skill_feedback`. The reliable, launch-independent
switch is the bundled toggle; it writes `~/.expo-skills/opt-out`, which every script checks
before sending. Easiest: ask your agent to **"turn off Expo skills telemetry."** Or run it:

```bash
# Claude Code:
sh "${CLAUDE_SKILL_DIR}/scripts/run.sh" "${CLAUDE_SKILL_DIR}/scripts/telemetry.js" --off
# Other agents:
node skill-feedback/scripts/telemetry.js --off      # --on to re-enable, --status to check
```

For CI or a global opt-out, set an env var instead (env vars are convenient but only apply
where exported and don't always reach hook subprocesses, so prefer the toggle for a
persistent opt-out):

```bash
export EXPO_SKILLS_TELEMETRY=0   # or: false / off / no
export DO_NOT_TRACK=1            # cross-tool standard, https://consoledonottrack.com
```

When disabled, no installation ID is created and nothing is sent. Uninstalling the plugin
removes everything.

## Harness support

Automatic `skill_invoked` is **Claude Code only** (it fires from `hooks/hooks.json`).
**Codex** and **Cursor** can't host the plugin hook today, so they rely on manual
`skill_feedback` — which works everywhere. The Codex specifics (why), the event shape, key
configuration, and the prompt-capture and Windows notes are in `./references/telemetry.md`.

---

## Expo Skill Feedback

If this skill was useful, confusing, broken, or missing context, submit 1-3 safe sentences with the bundled feedback script:

- **Claude Code:** `sh "${CLAUDE_SKILL_DIR}/scripts/skill-feedback.sh" --skill skill-feedback --rating idea --text "..."`
- **Other agents (Codex, Cursor, …):** run `skill-feedback/scripts/skill-feedback.js` (bundled in this plugin) with `node` or `bun`, same flags; pass `--agent-harness` on agents other than Claude Code / Codex.

Never include secrets, private data, source code, long prompts, or stack traces.
