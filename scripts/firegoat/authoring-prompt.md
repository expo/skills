Help me test `$skill` on this PR. First check that you can call the Firegoat MCP tool `list_prompts` in the Expo workspace and load the Firegoat skill `suggesting-eval-prompts`. If either is missing, walk me through signing in to https://firegoat.ai with my Expo Google account and connecting the MCP server using https://firegoat.ai/docs/mcp. For missing skills, give me `npx --yes skills@latest add firegoat-ai/skills --global --all`. Resume once both are available.

Use the [skill at this commit]($skill_url), its references, and the [PR diff]($diff_url) as source material. Pick one behavior the PR changes. Use `list_prompts` and `get_prompt` to check active and suggested cases. If an active `expo-skills-ci` case for `[$skill]` already covers the change, show me its link and the check that would catch a regression. Otherwise show me a draft top-level `create_prompt` payload. If a scheduled case is close, use a copy as the starting point. Fill in each field for the behavior you picked.

- `text` — the exact request an Expo user would make. Keep the skill name, install command, and answer out of it.
- `endGoal` — one observable end state. Name the artifact, output, or service state that would show the user's request succeeded.
- `checks` — a flat JSON object. Give `skill-activation` a criterion for trace evidence that Claude loaded `$skill`. Add a descriptive `task-*` key for each result the verifier should inspect. Each value is one pass/fail criterion.
- `setupCommand` — start with the block below, which installs all published skills from this PR for all agents. Append only the fixtures the task needs. For the reusable saved case, replace the quoted source with `'$source_template'`. CI supplies the repository owner, repository name, and commit separately on each run.

```sh
$setup
```

Check the EAS CLI commands the agent needs to run. If one requires Expo authentication, tell me which one. Use `list_credentials` to find the saved `EXPO_TOKEN` in the Expo workspace and set `envCredentials.EXPO_TOKEN` to its credential ID. If it is missing, ask me to save a scoped test token in Firegoat. The agent receives it after setup. If the command also needs a linked EAS project, use the test project's ID in the fixture. Keep token values out of chat, commands, and fixtures. For a task that needs no login, use `env: {}` and omit `envCredentials`.

Use a title beginning `[$skill] `, `tags: ["expo-skills-ci"]`, `status: active`, `run: false`, `frequency: none`, `runsPerEval: 1`, `scaffold: blank`, and `loginHints: false`. Set `harnessModel` to `{"harness":"claude-code","model":"claude-sonnet-4-6"}`. Wait for my approval before saving. Then read the case back with `get_prompt`, check the three variables in `setupCommand`, and share its link.
