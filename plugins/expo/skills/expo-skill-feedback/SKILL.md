---
name: expo-skill-feedback
description: Framework (OSS). Submit feedback on an Expo skill — or on Expo itself — or turn the bundled anonymous usage telemetry on or off (off by default / opt-in; the user saying "enable Expo skills telemetry" in conversation is the switch). Use when an Expo skill was useful, confusing, broken, missing context, or worth improving; when something fell short because of Expo (an SDK bug or confusing framework behavior) rather than the skill; or when the user wants to enable, turn on, opt in to, disable, turn off, opt out of, check the status of, or understand the anonymous usage tracking these skills can send.
---

# Expo Skill Feedback

Send anonymous feedback on an Expo skill — or on Expo itself — and turn the bundled usage
telemetry on or off. **Telemetry is off by default (opt-in)** — nothing is sent until it's
enabled. Feedback goes to the Expo team via PostHog. Only the skill name, your rating + note,
platform, and a hash of a random local install id are sent — never code, prompts, file paths,
secrets, or personal data. (A separate automatic `skill_invoked` event fires when a skill runs
*once enabled*; the switch below controls both.)

## Submitting feedback

Be proactive: when a skill was wrong, confusing, outdated, or missing — or the trouble is
with **Expo itself** — send 1-3 concrete sentences. Pass the skill you're rating to
`--skill` (the skill being rated, not `expo-skill-feedback`):

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/expo-skill-feedback/scripts/skill-feedback.cjs" \
   --skill eas-app-stores --rating useful \
   --text "TestFlight steps were clear and worked first try."
```

- `--rating`: `useful` · `confusing` · `bug` · `idea` · `other`
- `--about`: `skill` (default) · `expo` (the issue is Expo itself, not the skill)
- `--dry-run` prints the payload without sending

Never include secrets, source code, long prompts, or stack traces.

If the command refuses because telemetry is off, don't drop the feedback — ask the user
once (see *Turning it on or off*), and resend the same command after they enable.

## Turning it on or off

Telemetry is anonymous and **off by default (opt-in)** — nothing (neither the automatic
`skill_invoked` event nor feedback) is sent until the user enables it. Saying so in
conversation is the switch: when the user says **"enable Expo skills telemetry"** — or
answers yes when you offer — run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/expo-skill-feedback/scripts/telemetry.cjs" --on
```

`--off` turns it off again. When the user asks whether telemetry is on, run `--status`
and relay its output — don't answer from memory; env vars and CI can override the saved
state. Env equivalents: `EXPO_SKILLS_TELEMETRY=1` to enable, `=0` or `DO_NOT_TRACK=1` to
disable; CI never sends.

**Never enable it on your own.** If a feedback send was refused because telemetry is off,
ask the user once — "Expo skills telemetry is off; enable it (anonymous) and send this?" —
and run `--on` only after an explicit yes. If they decline, drop the feedback silently.
