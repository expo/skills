---
name: eas-agentic-workflows
description: "Set up an Expo agentic workflow that runs a headless coding agent (Claude Code, Codex, Cursor, or Grok via .eas/agents/run-agent.sh) inside EAS Workflows, drives an Expo Simulators session with agent-device or Argent, and returns a verdict, screenshots, a recording, and a preview link. The workflow does not merge. Use this whenever the user wants Agentic CI on pull requests, Issue to PR from a GitHub issue, Bug triage of a GitHub issue or TestFlight feedback, QA Swarm, or an agent that tests a pull request, opens a pull request from an issue, or reproduces a bug on a cloud simulator in CI. Also use it when they mention EXPO_TOKEN_SIMULATOR, .eas/agents/run-agent.sh, or agentic workflows. Not for ordinary EAS Workflow YAML (eas-workflows) or driving a cloud simulator from this machine (eas-simulator)."
license: MIT
allowed-tools: "Read,Write,Bash(node:*),Bash(npx *eas-cli@*),Bash(npx expo *),Bash(eas *)"
---

# EAS agentic workflows

> **EAS service - costs apply.** A run spends EAS Workflow minutes, EAS Build minutes when the fingerprint does not match an existing build, one Expo Simulators session of up to 30 minutes, and the coding agent's model usage. QA Swarm spends one session and one agent run per lane, and its evidence site uses EAS Hosting. Expo Simulators is a limited-access preview. It is not included with paid or free plans. Only select partners can use it today. Check access before you install a workflow. Join the waitlist at https://expo.dev/services/simulators when access is off. See https://expo.dev/pricing.

An agentic workflow runs a coding agent in the cloud, on an Expo Simulators session, and posts evidence. A person reviews that evidence. These workflows do not merge, submit, or ship.

Use another skill when the job is different:

- **`eas-workflows`.** Write or debug ordinary EAS Workflow YAML, including builds, submits, deploys, triggers, and syntax. Load it when `workflow:validate` reports a schema error in a file this skill just copied.
- **`eas-simulator`.** Drive a cloud simulator from this machine. That covers install, tap, screenshot, and live preview. If that skill is installed as `expo-simulators`, use that name for the same job. Add the workflow here. A local `simulator:start` session does not replace it.

## Decide first

Ask for anything the user has not already named. One message, then wait:

1. **Workflow.** Agentic CI tests a pull request. Issue to PR needs Agentic CI. Bug triage needs both, and TestFlight is iOS only. QA Swarm runs several flows at once, one session per lane. There is no Agent Sessions guide. Ask what they mean instead of inventing one.
2. **Platform.** iOS, Android, or both. Android emulator support is still in development.
3. **Agent.** Claude Code, Codex, Cursor, or Grok. Another agent is allowed only if it has a headless mode and a key that works without a browser login.
4. **Controller.** `agent-device` or Argent.

Bug triage includes the two workflows it depends on. Say that before adding them.

## Read the guide, then copy it

Fetch the page before writing files. Copy each file body from that page.

```bash
node <skill-dir>/scripts/fetch-docs.js <introduction|setup|agentic-ci|issue-to-pr|bug-triage|qa-swarm>
```

The script fetches `https://docs.expo.dev/agentic-workflows/<slug>.md` and prints `source: <url>` on stderr. Read [references/docs-pages.md](./references/docs-pages.md) for the copy rules and the runner contract. Read [references/files.md](./references/files.md) for the paths to create.

Fetch `setup` once, then the guide. The guides do not repeat the shared files. Agentic CI and QA Swarm need the setup steps from "Add a build profile for the remote device" through "Push the files". Issue to PR and Bug triage also need "Add a GitHub token to EAS". QA Swarm needs that token step only to post its report on a pull request.

Follow the page's "paste this into your agent" steps. The rules in this skill win where they disagree. That covers secrets, the four choices above, and not pushing or starting a run unless the user asked.

## Preflight

Run these in the Expo project. Fix or stop before writing workflow files.

1. **CNG.** The guides require Continuous Native Generation, so the repo has no committed `ios/` or `android/` directory. If those directories are part of the app, stop and say so. Leave them in place.
2. **App id.** The platform under test needs `ios.bundleIdentifier` or `android.package`. Read `npx expo config --json`. If the id is missing, ask the user. Do not invent one.
3. **Link.** `npx --yes eas-cli@latest whoami`. If `extra.eas.projectId` is missing, run `npx --yes eas-cli@latest init`. A headless shell uses `EXPO_TOKEN` for this CLI. That is the developer's CLI token, not the robot token below.
4. **Access.** `npx --yes eas-cli@latest simulator:availability --json`. Continue only when `available` is `true`. Otherwise stop and send the user to the waitlist. You may still add files when they explicitly want the repo prepared, and you must say the workflow cannot run yet.
5. **`preview` profile.** Merge the page's keys into `build.preview`, or add that profile if it is missing. One profile holds both platform keys when they test both. If `preview` already builds for physical devices, `ios.simulator: true` would stop those builds. Add a separate profile instead, such as `agent`, and change `profile: preview` to that name in each workflow file. Android needs a keystore only when the project has none yet. The user runs `eas credentials --platform android`, selects the profile, and lets EAS generate it. Leave that interactive command to the user.
6. **GitHub.** Agentic CI, Issue to PR, and Bug triage post to GitHub. The user connects the repository to the EAS project. Follow the EAS Workflows get-started link on the fetched page. A GitHub `git remote` does not mean that connection exists.

## Secrets

Never print, echo, log, commit, or write a token into a file, a prompt, or the chat. Never create a token. Stop and tell the user what to create, the variable name, and where it goes. They type the value into the Expo dashboard or into `gh secret set`, which prompts. Do not pass a token on the command line.

`eas env:list --environment preview` is how you check. Confirm the names. If the CLI prints values, do not repeat them.

Put these in the EAS `preview` environment:

| Name | Visibility | Who creates it |
| --- | --- | --- |
| `EXPO_TOKEN_SIMULATOR` | Secret | Robot user with the Developer role, in the account that owns the project. Developer is the lowest role that can start and stop sessions. Not a personal access token. |
| One agent key: `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY`, `CODEX_API_KEY`, `CURSOR_API_KEY`, or `XAI_API_KEY` | Secret | The user, from the agent section of the fetched page. Claude Code: `claude setup-token` (Pro, Max, Team, or Enterprise) or an Anthropic API key. Codex: an OpenAI API key. Cursor: dashboard API keys. Grok: an xAI key from console.x.ai. |

The agent job can read every variable in `preview`. Keep other secrets out of `preview`. `EXPO_PUBLIC_` values can stay. If `preview` already has a secret such as `NPM_TOKEN`, warn the user that the agent can read it. If `preview` has `SENTRY_AUTH_TOKEN`, remove it from `preview` and add `SENTRY_DISABLE_AUTO_UPLOAD` with the value `true`.

Issue to PR and Bug triage also need, in `preview`:

| Name | Visibility | Notes |
| --- | --- | --- |
| `GITHUB_TOKEN` | Secret | Fine-grained personal access token. This repository only. Contents, Issues, and Pull requests: read and write. |
| `GITHUB_REPOSITORY` | Plain text | `owner/name`, such as `acme/app`. |

QA Swarm needs those two variables only to post its report on a pull request. Agentic CI does not need them.

The job unsets `GITHUB_TOKEN` for the agent process. Codex can still run any command on the worker. In Agentic CI the `check` job checks out the pull request. In QA Swarm each lane checks out the branch of `--ref`. That code can change `.eas/agents/run-agent.sh` and read `EXPO_TOKEN_SIMULATOR` and the agent key. It can also read `GITHUB_TOKEN` when that step was done. Keep the GitHub token scoped to this one repository. EAS does not start `pull_request` workflows for forks. Leave fork runs disabled.

The Issue to PR GitHub Action needs a second robot token, stored as the GitHub Actions secret `EXPO_TOKEN` (`gh secret set EXPO_TOKEN`). It is not `EXPO_TOKEN_SIMULATOR`, and it does not go in a file.

Do not commit `.env.eas-simulator` or `agent-output/`. Add both to `.gitignore`. The session script writes `.env.eas-simulator` on the worker. It holds a session token.

## Install

After preflight, create the files listed in [references/files.md](./references/files.md) for the chosen workflow and its dependencies. Copy each body from the fetched page.

Then validate every workflow file you added or edited, from the project root:

```sh
npx --yes eas-cli@latest workflow:validate .eas/workflows/<file>.yml --non-interactive
```

Repeat until it prints `Workflow configuration YAML is valid.` This needs a logged-in CLI and a linked project. Keep this command. A local YAML or JSON Schema check does not replace it.

Commit the files locally and do not push, unless the user said not to commit or asked you to push. Before the commit, read the diff and confirm it contains no token, no `.env.eas-simulator`, and no secret. Tell the user which files you added, and which commands only they can run. Those commands are the keystore, `gh secret set`, `gh label create`, the GitHub connection, and App Store Connect.

Start `eas workflow:run` only when the user asks. A run spends build, simulator, and model usage. The first run is slower because it creates a build.

## Read a result

Read [references/failures.md](./references/failures.md) when a run finishes or a setup command fails. It has the verdict line for each workflow and the failure table.

- **Agentic CI.** The pull request comment shows `PASS` or `FAIL`, the session recording, the artifact report, and a browser preview link. Each click of that link starts a new session. The `result` job fails the run when the verdict does not start with `PASS`. Push a new commit to test again. The workflow skips draft pull requests until they are ready for review.
- **Issue to PR.** The workflow posts a comment on the issue with the pull request URL. The branch is `agent/issue-<number>`. Agentic CI then comments on that pull request. If the agent changes no file, or edits `.eas` or `.github`, the job does not open a pull request.
- **Bug triage.** The issue comment is headed `Bug triage (Android)` or `Bug triage (iOS)`. The verdict is `REPLICATED`, `NOT-REPLICATED`, or `INCONCLUSIVE`. A person reads a `REPLICATED` report before adding the `agent` label. Leave that label to them. TestFlight intake is iOS only and opens a new issue per report. Connect App Store Connect before testers send feedback. Earlier feedback does not start the workflow.
- **QA Swarm.** The workflow run page lists each lane's `PASS` or `FAIL` and an evidence link. A lane fails the run when its verdict is not `PASS`. The evidence site is public.

## References

Read a reference when you reach that step. These references do not point at other references.

- [references/docs-pages.md](./references/docs-pages.md). Read it before you fetch a guide or copy a file. It has the page URL, the copy rules, and the runner contract.
- [references/files.md](./references/files.md). Read it when you create files for the chosen workflow.
- [references/failures.md](./references/failures.md). Read it when you interpret a verdict or a command fails.

## Submitting Feedback
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes @expo/agent-cli@latest feedback --category skills --subject "eas-agentic-workflows" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
If an agent repeatedly fails at an Expo task or the user has to step in, submit a brief report of the task, expected result, and what went wrong using `--category evals` and the relevant Expo package or command as `--subject`.
