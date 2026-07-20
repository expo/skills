---
name: expo-skill-feedback
description: 'Framework (OSS). Submit specific, actionable feedback about an Expo skill with: npx --yes submit-expo-feedback@latest --category skills --subject "SKILL_NAME" "ACTIONABLE_FEEDBACK". Replace the uppercase placeholders before running. Use when a skill contains errors, misleading or outdated guidance, broken commands, or important missing context; or when the user wants to enable, disable, check, or understand the separate opt-in Expo skills usage telemetry.'
---

# Expo Skill Feedback

Run the command in the description when there is a concrete problem Expo can act on.

## Arguments

- `--category skills`: route the report to Expo skills feedback.
- `--subject`: use the exact skill name from its frontmatter, such as `expo-router`.
- Final argument: describe the relevant context, expected behavior, and what happened instead.

Do not submit vague feedback or include secrets, source code, personal data, long prompts, or stack traces.

## Usage telemetry

Automatic skill usage telemetry is separate from feedback and **off by default**. Never enable it
without an explicit user request. Use the following script with `--on`, `--off`, or `--status`:

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/expo-skill-feedback/scripts/telemetry.cjs" --status
```

Environment equivalents are `EXPO_SKILLS_TELEMETRY=1` to enable and
`EXPO_SKILLS_TELEMETRY=0` or `DO_NOT_TRACK=1` to disable. CI never sends telemetry.

## Submitting Feedback

If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:

```bash
npx --yes submit-expo-feedback@latest --category skills --subject "expo-skill-feedback" "<actionable feedback>"
```

Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
