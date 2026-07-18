---
name: expo-submit-feedback
description: 'Framework (OSS). Submit specific, actionable feedback about an Expo skill with: npx --yes submit-expo-feedback --category skills --subject "SKILL_NAME" "ACTIONABLE_FEEDBACK". Replace the uppercase placeholders before running. Use when a skill contains errors, misleading or outdated guidance, broken commands, or important missing context.'
---

# Submit Expo Skill Feedback

Run the command in the description when there is a concrete problem Expo can act on.

## Arguments

- `--category skills`: routes the report to Expo skills feedback.
- `--subject`: the exact skill name from its frontmatter, such as `expo-router`.
- Final argument: a concise report with relevant context, expected behavior, and what happened instead.

Do not submit vague feedback or include secrets, source code, personal data, long prompts, or stack traces.

## Submitting Feedback

If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:

```bash
npx --yes submit-expo-feedback --category skills --subject "expo-submit-feedback" "<actionable feedback>"
```

Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
