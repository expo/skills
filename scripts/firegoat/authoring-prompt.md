Help me test `$skill`. Read the [PR diff]($diff_url), the [skill at this commit]($skill_url), and its relevant references. Pick one behavior this PR changes.

Check that you can use the Firegoat MCP server in the Expo workspace and load the `suggesting-eval-prompts` skill. If the connection is missing, help me sign in to https://firegoat.ai with my Expo Google account and connect the MCP using https://firegoat.ai/docs/mcp. If the skills are missing, give me `npx --yes skills@latest add firegoat-ai/skills --global --all`.

Use `list_prompts` and `get_prompt` to check coverage. CI runs every active eval with both tags `expo-skills-ci` and `$skill_tag`. If one already covers this change, link it and show me the check that would catch a regression. Otherwise draft a case for the uncovered behavior. You can use a suggested case or a copy of a scheduled case as a starting point.

Show me the draft in plain language:

1. **User task** — the exact request an Expo user would make, without naming the skill or giving away the solution.
2. **Expected outcome** — one observable result that would tell the user the task succeeded.
3. **Pass/fail checks** — what trace evidence would show that Claude loaded `$skill`, and what evidence would prove each task result.
4. **Setup and login** — list the fixtures and identify any EAS CLI command that needs authentication. The Expo workspace already has a global Firegoat credential named `EXPO_TOKEN`. If a command needs it, use `list_credentials` to find its ID and set `envCredentials.EXPO_TOKEN` to that ID. Run the authenticated command during the agent's task, after `setupCommand` finishes and Firegoat supplies the token. Leave the eval environment empty when no login is needed.

Start the sandbox with this setup. It installs all published skills from this PR for all agents. Append any fixture steps, including a linked test project ID if needed.

```sh
$setup
```

Wait for my approval before saving. Give the case a descriptive title and both tags above. Save the user task as `text`, the expected outcome as `endGoal`, and the checks as a flat map with `skill-activation` and one `task-*` entry per result. In the saved `setupCommand`, replace the quoted install source with `'$source_template'` so CI can supply the next PR revision.

Create an active, top-level case with `run: false`, `frequency: none`, `runsPerEval: 1`, `scaffold: blank`, `loginHints: false`, and Claude Code on `claude-sonnet-4-6`. Read it back with `get_prompt`, verify its tags and setup, and give me the link.
