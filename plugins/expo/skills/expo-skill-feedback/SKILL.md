---
name: expo-skill-feedback
description: Submit feedback on an Expo skill — or on Expo itself — or turn the bundled anonymous usage telemetry on or off. Use when an Expo skill was useful, confusing, broken, missing context, or worth improving; when something fell short because of Expo (an SDK bug or confusing framework behavior) rather than the skill; or when the user wants to disable, opt out of, turn off, stop, or understand the anonymous usage tracking these skills send.
---

# Skill Feedback

The shared telemetry + feedback helper for the Expo skills on **Claude Code**. It powers
two **anonymous** signals, sent to PostHog so the Expo team can see how skills are used and
where they fall short:

- **Automatic usage** (`skill_invoked`) — emitted by the plugin's hooks when a skill runs.
  No manual step. **On by default.**
- **Explicit feedback** (`skill_feedback`) — a rating + short note you (or the agent, with
  the user's OK) send deliberately by running the command below.

Both send only a short **hash** of a random local installation ID
(`~/.expo-skills/installation-id`, created on first send). Hostnames, usernames, emails,
file paths, source code, **prompts, and chat history** are **never** sent. Telemetry is
**skipped automatically in CI**. To turn everything off, see *Turning it off* below.

## Runtime

Scripts are plain JavaScript and run under **Node or Bun** — both ship the built-ins they
use (`crypto`, `https`, `fs`). `scripts/run.sh` picks whichever is installed (`node`, then
`bun`) and does nothing if neither is found, so a missing runtime never blocks a tool call.
Node/Bun is a hard requirement for Expo development, so it's effectively always present.

## The two signals

| Event | Trigger | Mechanism |
| --- | --- | --- |
| `skill_invoked` | A skill runs — by the **AI** (`Skill` tool) or a **user** `/slash` command | Automatic, via the plugin's `hooks/hooks.json`; tagged `initiator: ai`\|`user`, scoped to this plugin |
| `skill_feedback` | You deliberately send a rating + note | Manual — the command below |

## Submitting feedback

**We want this — please be proactive.** When an Expo skill was wrong, confusing, outdated,
or missing something, send a quick note so the team can fix it (a note when it worked well
helps too). Keep it to 1-3 short sentences, prefer concrete observations, and pass **the
skill you're giving feedback on** to `--skill` — usually the skill whose footer sent you
here, not `expo-skill-feedback` itself (`${CLAUDE_PLUGIN_ROOT}` resolves to the plugin's install path):

```bash
sh "${CLAUDE_PLUGIN_ROOT}/skills/expo-skill-feedback/scripts/skill-feedback.sh" \
   --skill expo-deployment --rating useful \
   --text "TestFlight steps were clear and worked first try."
```

Ratings: `useful`, `confusing`, `bug`, `idea`, `other`. Add `--dry-run` to print the payload without sending.

If the trouble is with **Expo itself** rather than the skill (e.g. an SDK bug or confusing
framework behavior the skill couldn't paper over), add `--about expo` (default `skill`) so
the team can tell framework issues from skill issues.

**Never include** secrets, private data, source code, long prompts, stack traces, API
keys, or tokens.

## Turning it off

Telemetry is anonymous and **on by default**. Opting out silences **both** signals. The
reliable switch is the bundled toggle; it writes `~/.expo-skills/opt-out`, which every
script checks before sending. Easiest: ask your agent to **"turn off Expo skills
telemetry."** Or run it:

```bash
sh "${CLAUDE_PLUGIN_ROOT}/skills/expo-skill-feedback/scripts/run.sh" "${CLAUDE_PLUGIN_ROOT}/skills/expo-skill-feedback/scripts/telemetry.cjs" --off
```

For CI or a global opt-out, set an env var instead (`--on` re-enables, `--status` checks):

```bash
export EXPO_SKILLS_TELEMETRY=0   # or: false / off / no
export DO_NOT_TRACK=1            # cross-tool standard, https://consoledonottrack.com
```

When disabled, no installation ID is created and nothing is sent. Uninstalling the plugin
removes everything.

## Notes for maintainers

`skill_invoked` is wired for **Claude Code** via the plugin's `hooks/hooks.json`. See
`./references/telemetry.md` for the event shape, PostHog key configuration, why other
harnesses have no automatic signal, and the prompt-capture and Windows notes.

---

## Expo Skill Feedback

Help make these skills better — feedback goes **straight to the Expo team, and it's anonymous**. Be proactive: flag anything wrong, confusing, outdated, or missing — in a skill or in **Expo itself** (`--about expo`). A quick note when something worked well helps too. See *Submitting feedback* above for the command. Never include secrets, source code, or long prompts.
