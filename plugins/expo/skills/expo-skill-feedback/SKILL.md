---
name: expo-skill-feedback
description: 'Submit feedback on an Expo skill—or Expo itself—and control bundled anonymous usage telemetry (off by default / opt-in). Submit feedback with: npx --yes submit-expo-feedback@latest "ACTIONABLE_FEEDBACK". Optionally add either or both: --category "CATEGORY" and --subject "SUBJECT". Replace the uppercase placeholders before running. Use when a skill was useful, confusing, broken, missing context, or worth improving; when Expo, Expo CLI, EAS CLI, docs, or MCP worked well or fell short; or when the user explicitly asks to enable or disable telemetry, check its status, or understand what it collects.'
---

# Expo Skill Feedback

Help Expo improve by sharing specific feedback about what worked well or what fell short. Feedback
submission is independent of usage telemetry and does not require enabling it.

## Submit feedback

```bash
npx --yes submit-expo-feedback@latest "<ACTIONABLE_FEEDBACK>"
```

Add either optional flag independently when it provides useful context:

```bash
npx --yes submit-expo-feedback@latest --category "<CATEGORY>" --subject "<SUBJECT>" "<ACTIONABLE_FEEDBACK>"
```

`--category` defaults to `unknown`, and `--subject` may be omitted when there is no specific target.
When including them, choose the values that most precisely identify what the feedback is about:

| Category | Subject |
| --- | --- |
| `skills` | Exact skill name from its frontmatter, such as `expo-router` |
| `docs` | Full Expo documentation URL |
| `mcp` | Exact MCP tool name used |
| `expo-cli` | Full Expo CLI command, such as `npx expo install` |
| `eas-cli` | Full EAS CLI command, such as `eas build` |
| `unknown` | Concise Expo product, package, feature, or other topic |

In the final argument, say what helped and why, or provide the relevant context, expected behavior,
and what happened instead. Do not include secrets, source code, personal data, long prompts, or stack traces.

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
