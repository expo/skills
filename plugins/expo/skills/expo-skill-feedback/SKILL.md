---
name: expo-skill-feedback
description: Framework (OSS). Turn the bundled anonymous Expo skills usage telemetry on or off and check its current status. Telemetry is opt-in and off by default; the user saying "enable Expo skills telemetry" in conversation is the switch. Use when the user wants to enable, turn on, opt in to, disable, turn off, opt out of, check the status of, or understand automatic skill usage tracking. For submitting feedback, use the command exposed by expo-submit-feedback.
---

# Expo Skills Telemetry

Control the plugin's anonymous automatic usage telemetry. Feedback submission is separate and is
described by `expo-submit-feedback`.

## Turning it on or off

Automatic usage telemetry is anonymous and **off by default (opt-in)**. Saying so in conversation
is the switch: when the user says **"enable Expo skills telemetry"**, run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/expo-skill-feedback/scripts/telemetry.cjs" --on
```

`--off` turns it off again. When the user asks whether telemetry is on, run `--status`
and relay its output — don't answer from memory; env vars and CI can override the saved
state. Env equivalents: `EXPO_SKILLS_TELEMETRY=1` to enable, `=0` or `DO_NOT_TRACK=1` to
disable; CI never sends.

**Never enable it on your own.** Run `--on` only after an explicit user request.

## Submitting Feedback

If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:

```bash
npx --yes submit-expo-feedback --category skills --subject "expo-skill-feedback" "<actionable feedback>"
```

Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
