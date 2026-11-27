# Contributing

- Use your skills locally first to build something meaningful before contributing.

## Adding a new skill

Skills teach an agent how to do one Expo task well. Follow these guidelines so new
skills stay consistent with the rest of the marketplace.

### 1. Scaffold it with `skill-creator`

From Claude Code, run the `/skill-creator` skill to scaffold a new skill - and to edit, optimize,
or eval an existing one. It sets up the folder structure and helps you tune the `description` for
reliable triggering.

Skills live one level deep:

```
plugins/expo/skills/<skill-name>/
  SKILL.md            # required
  references/         # optional, loaded on demand
  scripts/            # optional, reusable logic
  agents/openai.yaml  # Codex trigger metadata
```

### 2. Name it `expo-*` or `eas-*`

Names are lowercase kebab-case (max 64 chars). The prefix signals the free/paid boundary:

- **`expo-*`** - open-source framework skills: the Expo SDK, Expo Router, React Native, and
  local tooling. Examples: `expo-router`, `expo-dom`, `expo-module`, `expo-web-to-native`.
- **`eas-*`** - skills whose core purpose is a paid Expo Application Services product.
  Examples: `eas-hosting`, `eas-app-stores`, `eas-workflows`, `eas-observe`, `eas-simulator`.

Name after what users say, and prefer the real product or package name (e.g. `eas-hosting`,
not `expo-api-routes`). To rename an existing skill, `git mv` the directory (to preserve
history), update the frontmatter `name:`, and fix every reference (catalogs, `agents/openai.yaml`,
cross-links in other skills).

### 3. Decide free vs paid - and be strict about it

A skill belongs in **Services & paid distribution** only if its **core purpose requires a paid
EAS product** (EAS Build, Submit, Hosting, Update, Workflows, Observe, Simulator, …).

- A paid **Apple Developer or Google Play** account does **not** make a skill "paid" here - that
  is app-store distribution, not EAS. `expo-app-clip` is a framework skill even though shipping a
  Clip needs an Apple account.
- If authoring is free and only *deploying* is paid, it is usually still framework - unless the
  skill is fundamentally about the paid service. (`eas-hosting` is the deploy skill, so it is
  paid; free API-route authoring lives inside it.)
- Litmus test: *can a developer get the main value of this skill without paying Expo?*
  Yes → framework (`expo-*`). No → paid (`eas-*`).

### 4. Add a costs note for paid skills

Paid skills open the `SKILL.md` **body** with a short callout:

```markdown
> **EAS service - costs apply.** <one line on what consumes the plan>. See https://expo.dev/pricing.
```

### 5. Write a description that triggers well

The `description` is how an agent decides to load the skill, so it matters more than any other field.

- **Max 1024 characters** (CI-enforced).
- Say **what it does** *and* **when to use it**, in the words users actually type ("turn a website
  into an app", "run on a cloud simulator", "ship to TestFlight").
- Use concrete package, command, and API names (`@expo/ui`, `eas deploy`, `+api.ts`) - but don't
  keyword-stuff with unrelated terms.
- When a sibling skill is easy to confuse with, add a `Not for …` clause (see `expo-ui` vs
  `expo-router`).

### 6. Keep it concise - context windows are the constraint

When a skill triggers, its whole `SKILL.md` loads into the agent's context. Shorter is better.

- The body is capped at **500 lines** (CI-enforced) - treat that as a ceiling, not a target.
- Move anything the agent needs only *sometimes* into `references/*.md` and link to it; references
  load on demand.
- Put reusable validation or fetching logic in `scripts/` instead of long inline command blocks.
- In runnable shell examples, use `npx --yes eas-cli@latest <command>` instead of bare `eas <command>`.
  Prose and headings can use `eas <command>` so they match how users ask for help. CI checks this
  with `bun scripts/check-eas-cli-commands.ts`.
- One skill = one job. If it grows two distinct triggers, split it (that is why `eas-hosting` and
  `eas-app-stores` are separate skills).
- Keep skills and references focused on requirements, supported workflows, and instructions.
  Put test results and validation history in fixture READMEs or PR descriptions.

### 7. Add the Codex agent file

Add `agents/openai.yaml` with `display_name`, `short_description`, and a `default_prompt`
that references the skill via `$<skill-name>`.

### 8. Register the skill in every catalog

Add it to the correct group (framework vs paid) in all of:

- `skills.sh.json`
- `plugins/expo/README.md` - **What This Plugin Does**, **When to Use**, and **Skills Included**
- `plugins/expo/skills/README.md`
- `README.md`

Also add a one-line entry to the `expo-overview` Skill Map
(`plugins/expo/skills/expo-overview/SKILL.md`) so the router can dispatch to the new skill.
The `check` workflow (`bun scripts/check-overview-routing.ts`) enforces this.

### 9. Add the feedback instructions

Every `SKILL.md` ends with a canonical feedback block whose subject matches the skill name. Add or
refresh it automatically:

```bash
bun scripts/check-skill-limits.ts --fix-feedback
```

CI fails if the block is missing, has drifted, or names the wrong skill.

### 10. Bump the plugin version

Bump `version` in **both** manifests together. They must match each other and be greater
than `main`. CI enforces this.

- `plugins/expo/plugin.json` - the [Agent Plugins](https://agent-plugins.org/) manifest. Codex and other compatible clients read it. Grok reads it when the file exists. Codex install metadata lives under `extensions["com.openai"]`.
- `plugins/expo/.claude-plugin/plugin.json` - Claude Code and Cursor.

The check script writes both for you, rejecting a version that is not valid semver or is not
greater than the base ref:

```bash
bun scripts/check-plugin-version-bump.ts --set-version 1.14.0
```

Run it with `--help` for the full usage, or `bun test scripts/check-plugin-version-bump.test.ts` to exercise
every case (the manifests are restored afterward).

### 11. Validate before opening a PR

```bash
claude plugin validate ./plugins/expo
bun scripts/check-skill-limits.ts
bun scripts/check-plugin-version-bump.ts origin/main
```

Also run `python3 -m json.tool <file>` on any JSON you edited, and if the skill ships `scripts/`,
run that skill's own validation.

`check-skill-limits.ts` enforces more than the size caps: the naming rule (step 2), the paid
costs callout (step 4), the Codex agent file (step 7), the `skills.sh.json` grouping (step 8),
and the feedback block (step 9) all fail CI when violated. It also enforces the agent CLI rule
in Conventions below.

## Firegoat evals on pull requests

Every PR that adds or edits an installable skill needs a passing Firegoat eval for each changed skill. Edits to references and scripts count. Apply the `no-eval` PR label to skip the check. Removing the label requests the check again.

CI runs every active eval in Expo's Firegoat workspace with both the `expo-skills-ci` tag and the skill's tag. For example, tag both a navigation case and a deep-linking case with `expo-skills-ci` and `expo-router` to run both when `expo-router` changes. Give each case a descriptive title. The authoring prompt supplies the exact skill tag, including a shortened tag for names over Firegoat's 24-character limit.

If a skill lacks a valid case, the check fails before queuing runs. Copy the [authoring prompt](scripts/firegoat/authoring-prompt.md) from the PR comment into your coding agent. It checks your Firegoat MCP connection and skills, then shows you the user task, expected outcome, pass/fail checks, setup, and any login the task needs. Review the draft before the agent saves it, then select **Re-run jobs** on the Firegoat workflow.

Setup installs every skill under `plugins/` from the exact PR head commit for every agent the skills CLI supports. This includes `expo-overview`, the other Expo and EAS skills, and the experimental skills. Each case runs once with Claude Code and Sonnet 4.6. It checks the trace for activation of its target skill and grades at least one observable task outcome. The PR comment links to each result and names any required checks or end goal that scored zero. Setup errors, unmet checks, and timeouts fail the commit status. Rerunning the Firegoat workflow can retry a finished case on the same commit.

When a case needs an authenticated EAS CLI command, bind the Expo Firegoat workspace's saved credential named `EXPO_TOKEN` to the agent's `EXPO_TOKEN` environment variable with `envCredentials`. Use a token scoped to the test account. Firegoat supplies it to the agent after setup. On a fork or bot-authored PR, a repository writer must review the linked revision and rerun the Firegoat job to authorize that commit to use the token. Cases that need no login run with an empty environment.

The workflow uses the GitHub Actions secret `FIREGOAT_API_KEY` for an Expo Firegoat account with hosted runs enabled. Only the default-branch controller receives the key. To enforce the result before merging, select the `Firegoat skill evals` commit status in the repository's branch rules.

### Syncing `expo-animation`

`expo-animation` mirrors `skills/animate-expo` from `emilkowalski/skills`. Pull upstream changes
with `bun scripts/sync-animate-expo.ts`; use `--check` to detect drift without writing. The script
preserves this repository's skill name, collaboration notice, and feedback block.

### Conventions

- MIT license for every skill; use `@expo.io` or `@expo.dev` author emails.
- Do not add a `version` key to `SKILL.md` frontmatter. Official skill validators reject it. Versions live on the plugin manifests.
- Keep `references/` next to the skill that uses them.
- Run Expo CLI through the agent CLI: write `npx --yes @expo/agent-cli@latest <command>`, not `npx expo <command>`, `npx expo-doctor` (use `doctor`), or `npx create-expo-app` (use `new`). Web commands stay on Expo CLI: `npx expo export --platform web`, `npx expo serve`, and `npx expo start --web`. A skill whose `allowed-tools` pre-approves Bash also lists `Bash(npx --yes @expo/agent-cli@latest *)`. CI enforces both rules. `expo-animation` is exempt, because it is synced from upstream.
- Don't broaden a skill's scope or trigger intent when editing it - keep changes focused.

## Runnable brownfield fixtures

Use the [iOS brownfield playgrounds](tests/fixtures/expo-brownfield/README.md) to exercise integrated and isolated SwiftUI hosts when changing `expo-brownfield`. They include SDK 55 and SDK 57 dependency snapshots, setup commands, and a Debug/Release acceptance checklist. Native validation requires the selected SDK's Xcode toolchain; these fixtures are not part of the distributed plugin.
