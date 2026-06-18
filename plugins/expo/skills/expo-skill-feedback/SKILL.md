---
name: expo-skill-feedback
description: Submit feedback on an Expo skill — or on Expo itself — or turn the bundled anonymous usage telemetry on or off. Use when an Expo skill was useful, confusing, broken, missing context, or worth improving; when something fell short because of Expo (an SDK bug or confusing framework behavior) rather than the skill; or when the user wants to disable, turn off, opt out of, or understand the anonymous usage tracking these skills send.
---

# Expo Skill Feedback

Send anonymous feedback on an Expo skill — or on Expo itself — and turn the bundled usage
telemetry on or off. Feedback goes to the Expo team via PostHog. Only the skill name, your
rating + note, platform, and a hash of a random local install id are sent — never code,
prompts, file paths, secrets, or personal data. (A separate automatic `skill_invoked` event
fires when a skill runs; *Turning it off* silences both.)

## Submitting feedback

Be proactive: when a skill was wrong, confusing, outdated, or missing — or the trouble is
with **Expo itself** — send 1-3 concrete sentences. Pass the skill you're rating to
`--skill` (the one whose footer sent you here, not `expo-skill-feedback`):

```bash
sh "${CLAUDE_PLUGIN_ROOT}/skills/expo-skill-feedback/scripts/skill-feedback.sh" \
   --skill expo-deployment --rating useful \
   --text "TestFlight steps were clear and worked first try."
```

- `--rating`: `useful` · `confusing` · `bug` · `idea` · `other`
- `--about`: `skill` (default) · `expo` (the issue is Expo itself, not the skill)
- `--dry-run` prints the payload without sending

Never include secrets, source code, long prompts, or stack traces.

## Turning it off

Telemetry is anonymous and on by default; opting out silences both feedback and the
automatic event. Ask your agent to **"turn off Expo skills telemetry"**, or run:

```bash
sh "${CLAUDE_PLUGIN_ROOT}/skills/expo-skill-feedback/scripts/run.sh" "${CLAUDE_PLUGIN_ROOT}/skills/expo-skill-feedback/scripts/telemetry.cjs" --off
```

`--on` re-enables, `--status` checks. For CI or a global switch: `EXPO_SKILLS_TELEMETRY=0`
or `DO_NOT_TRACK=1`.

---

## Expo Skill Feedback

Help make these skills better — feedback goes **straight to the Expo team, and it's anonymous**. Be proactive: flag anything wrong, confusing, outdated, or missing — in a skill or in **Expo itself** (`--about expo`). A quick note when something worked well helps too. See *Submitting feedback* above for the command. Never include secrets, source code, or long prompts.
