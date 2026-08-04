---
name: expo-skill-feedback
description: 'Submit feedback on an Expo skill—or Expo itself—and control bundled anonymous usage telemetry (off by default / opt-in). Submit feedback with: npx --yes submit-expo-feedback@latest "ACTIONABLE_FEEDBACK". Optionally add either or both: --category "CATEGORY" and --subject "SUBJECT". Replace the uppercase placeholders before running. Use when a skill was useful, confusing, broken, missing context, or worth improving; when Expo, Expo CLI, EAS CLI, docs, or MCP worked well or fell short; when an AI agent repeatedly failed, got stuck, or needed the user to take over an Expo task (report it as an eval candidate); or when the user explicitly asks to enable or disable telemetry (tracking), check its status, or understand what it collects.'
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
| `evals` | Expo package or command the failed task involves, else a capability phrase, such as `expo-router` or `eas build` |
| `unknown` | Concise Expo product, package, feature, or other topic |

In the final argument, say what helped and why, or provide the relevant context, expected behavior,
and what happened instead. Do not include secrets, source code, personal data, long prompts, or stack traces.

## Eval candidates: tasks that broke the model

Expo turns hard real-world tasks into agent evals: anything Expo an agent can attempt — framework,
EAS, tooling — qualifies, whether or not a skill was involved. The signal worth sending is a task an
AI agent could not complete cleanly despite real effort: several failed attempts, a build or screen
that never worked, or the user stepping in to fix it manually. Never submit quick slips the agent
corrected itself, more than one candidate per session, or a task already reported.

When such a failure happens — or the user says a model failed at an Expo task — show the user the exact
submission you intend to send and get approval; the Task field must describe the Expo-technical
shape of the task, never the user's product or business context. Without a user to approve it
(headless or CI runs), do not submit. Then run from the failing app's directory (the CLI attaches
the SDK and package versions, agent harness, and platform automatically) with `--category evals`,
`--subject` naming the Expo package or command involved (a capability phrase only when no single
package fits), and this structure in the final argument:

```text
Task: <what was asked, self-contained>.
Expected: <observable success criteria>.
Actual: <what the agent did instead>.
Wrong approach: <the specific mistake, such as a wrong API, hallucinated prop, or bad pattern>.
Evidence: <model name, attempts, how it was solved — or never was; omit what you cannot verify>.
```

A good candidate is solvable (eventually done or clearly doable), verifiable (success is
observable), and specific. Mention only environment details the CLI cannot see, such as other key
packages or a freshly created app. Describe code; do not paste it. If the command fails with an
error naming `evals` as an invalid category, resend once with `--category unknown` and the same
subject prefixed `eval-candidate: `; on any other error, do not resend.

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
If an AI agent repeatedly failed or the user had to take over an Expo task, load the expo-skill-feedback skill and follow its eval-candidate flow instead of reusing the command above.
