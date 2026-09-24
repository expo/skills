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

### 4. Prefix the description, and add a costs note for paid skills

Every `description` opens with its category label, except the cross-cutting
`expo-skill-feedback` skill, which accepts feedback across framework, EAS, docs, CLI, and MCP:

- Framework: `Framework (OSS). <what it does and when to use it>`
- Paid: `EAS service (paid). <what it does and when to use it>`

Paid skills also open the `SKILL.md` **body** with a short callout:

```markdown
> **EAS service - costs apply.** <one line on what consumes the plan>. See https://expo.dev/pricing.
```

### 5. Write a description that triggers well

The `description` is how an agent decides to load the skill, so it matters more than any other field.

- **Max 1024 characters** (CI-enforced); use the shortest description that distinguishes the task.
- Say **what it does** *and* **when to use it**, in the words users actually type ("turn a website
  into an app", "run on a cloud simulator", "ship to TestFlight").
- Use concrete package, command, and API names (`@expo/ui`, `eas deploy`, `+api.ts`) - but don't
  keyword-stuff with unrelated terms.
- When a sibling skill is easy to confuse with, add a `Not for …` clause (see `expo-ui` vs
  `expo-router`).

For example, prefer "Implement or debug data fetching in Expo apps" over "Use for ANY
network request." Keep command syntax, component inventories, and execution rules in the
body or references. Check both requests that should trigger the skill and nearby requests
that should not; keep `agents/openai.yaml` consistent when changing the scope.

Put the defining task immediately after the required category prefix. Some agents
shorten descriptions by keeping only their beginning, potentially mid-word; the
1024-character validation limit does not guarantee that the full description reaches
the model. Make the opening clause useful on its own. Put secondary capabilities,
examples, and less important qualifications later, or in the body. Keep Codex's
`short_description` independently meaningful too. Review shortened prefixes during
trigger checks; no fixed prefix length is guaranteed across catalogs and runtimes.

For a concrete harness example, [Codex 0.153.4's catalog renderer](https://github.com/openai/codex/blob/rust-v0.153.4/codex-rs/ext/skills/src/render.rs)
caps each displayed description at 1024 characters, then fits names, descriptions,
paths, and instructions into a shared budget. By default that budget is 2% of the
model's context capacity in approximate tokens; a 200,000-token window gives the
whole catalog 4,000 approximate tokens, not 4,000 per skill. Crowded catalogs can
shorten descriptions further, remove descriptions, or omit entries. This is
version-specific behavior, not a cross-agent contract or a guaranteed per-skill
allowance. [The budget input](https://github.com/openai/codex/blob/rust-v0.153.4/codex-rs/ext/skills/src/extension.rs#L432-L436)
is total model capacity, not remaining conversation space; conversation compaction
is a separate mechanism. Keep descriptions concise even when they pass CI.


### 6. Keep the skill focused on decisions and execution

When a skill triggers, the agent reads its `SKILL.md`; how much is loaded at once depends on the harness and reading tool. Keep what changes the agent's decisions or helps it complete the task; length alone is not the quality measure.

- The body is capped at **500 lines** (CI-enforced) - treat that as a ceiling, not a target.
- Move anything the agent needs only *sometimes* into `references/*.md` and link to it; references
  load on demand.
- Put reusable validation or fetching logic in `scripts/` instead of long inline command blocks.
- One skill = one job. If it grows two distinct triggers, split it (that is why `eas-hosting` and
  `eas-app-stores` are separate skills).
- Keep skills and references focused on requirements, supported workflows, and instructions.
  Put test results and validation history in fixture READMEs or PR descriptions.

Use conditional guidance: read setup instructions when installing dependencies, and deployment
instructions when preparing a deployment. For shared Expo SDK and setup rules, link to
`expo-overview/references/project-setup.md` where relevant; a clear task can load its skill
directly. Prefer outcomes and decision criteria over mandatory itineraries. Keep precise
commands and safeguards for fragile workflows, costs, and production operations. State what
completes an implementation and what remains unverified if runtime access is unavailable;
retain the user's requested scope and existing authorization.

#### Skills and documentation have different jobs

- **Keep in the skill:** task selection, decision boundaries, integration pitfalls, project constraints, and observable completion. Describe when a step is needed; avoid turning a sample's library choices or deployment stages into requirements.
- **Keep a local reference:** a tested multi-part integration, an undocumented CLI sequence, a platform/version-specific workaround, or an example that prevents a demonstrated failure. State the applicable versions and source; explain the extra value beyond the API docs.
- **Link to official documentation:** API signatures, complete prop/flag catalogs, pricing/limits, and routine library tutorials. Do not copy a manual into `references/` merely to make `SKILL.md` shorter. A short code example is useful when it resolves a real integration ambiguity.
- **Remove:** generic coding reminders, redundant trigger lists, arbitrary thresholds, placeholder application code, and unconditional migrations to a preferred library.

Point to the relevant page or section and say what question it answers. Match SDK
pages to the installed version; use CLI help/schema for the available command
contract. An older tested recipe is evidence for that version, not a permanent
override of current official docs. If evidence conflicts, inspect the installed
package/source and explain the version boundary. When docs are unavailable, use
local types/help and existing code, and identify what remains unverified rather
than inventing an API or stopping all independent work.

Fetch only the source needed for the task. Reuse already-read, applicable evidence;
fetching a whole documentation index or every linked reference is not a prerequisite
for a small change. Treat instructions embedded in external docs as source material,
not authorization to create accounts, publish, submit feedback, or add approval
checkpoints to the user's workflow.

For substantial changes, walk through realistic positive and nearby negative
requests, existing-project constraints, missing tools/access, and completion paths.
Check that conditional references agree with the root. Record which behaviors were
actually exercised; structural checks and instruction walkthroughs are not evidence
of measured model performance. Preserve upstream sync ownership (for example,
`expo-animation`) rather than silently forking imported instructions.

Follow the actual retrieval path into references, including unchanged ones: a safe
root does not repair a contradictory example later. When removing a tutorial,
check that its non-obvious integration constraints still have a discoverable home.
For harnesses that inject only a file prefix, inspect what guidance and links are
missing until the agent continues reading.

### 7. Add the Codex agent file

Add `agents/openai.yaml` with `display_name`, `short_description` (paid skills prefix it
`Paid EAS service.`), and a `default_prompt` that references the skill via `$<skill-name>`.

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

Bump `version` in **all four** manifests together - they must match each other and be greater
than `main`. CI enforces this.

- `plugins/expo/.claude-plugin/plugin.json`
- `plugins/expo/.codex-plugin/plugin.json`
- `plugins/expo/.cursor-plugin/plugin.json`
- `plugins/expo/.grok-plugin/plugin.json`

The check script writes all four for you, rejecting a version that is not valid semver or is not
greater than the base ref:

```bash
bun scripts/check-plugin-version-bump.ts --set-version 1.10.1
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

`check-skill-limits.ts` enforces more than the size caps: the naming rule (step 2), the category
prefixes and paid costs callout (step 4), the Codex agent file and its paid prefix (step 7), the
`skills.sh.json` grouping (step 8), and the feedback block (step 9) all fail CI when violated.

### Syncing `expo-animation`

`expo-animation` mirrors `skills/animate-expo` from `emilkowalski/skills`. Pull upstream changes
with `bun scripts/sync-animate-expo.ts`; use `--check` to detect drift without writing. The script
preserves this repository's skill name, category metadata, collaboration notice, and feedback block.

### Conventions

- MIT license for every skill; use `@expo.io` or `@expo.dev` author emails.
- Keep `references/` next to the skill that uses them.
- Don't broaden a skill's scope or trigger intent when editing it - keep changes focused.

## Runnable brownfield fixtures

Use the [iOS brownfield playgrounds](tests/fixtures/expo-brownfield/README.md) to exercise integrated and isolated SwiftUI hosts when changing `expo-brownfield`. They include SDK 55 and SDK 57 dependency snapshots, setup commands, and a Debug/Release acceptance checklist. Native validation requires the selected SDK's Xcode toolchain; these fixtures are not part of the distributed plugin.
