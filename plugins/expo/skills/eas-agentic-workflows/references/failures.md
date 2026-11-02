# Verdicts and failures

Read this when a run finishes or a setup step fails. The workflow posts evidence for a person. It does not merge.

## Verdicts

| Workflow | Where it lands | Line 1 | If the agent writes nothing |
| --- | --- | --- | --- |
| Agentic CI | PR comment | `PASS: …` or `FAIL: …` | `FAIL: The agent did not write a verdict.` The `result` job fails the run unless the line starts with `PASS`. |
| Issue to PR | Issue comment, then an Agentic CI comment on the new PR | PR title is line 1 of `agent-output/summary.md` | No file changes: the job comments the reason and exits 1. Edits under `.eas` or `.github`: the job fails and does not open a PR. |
| Bug triage | Issue comment headed `Bug triage (Android)` or `Bug triage (iOS)` | `REPLICATED: …` or `NOT-REPLICATED: …` | `INCONCLUSIVE: The agent did not write a verdict. See the logs of this run.` |
| QA Swarm | Workflow run report, one line per lane. Optional PR comment. | `PASS: …` or `FAIL: …` | `FAIL: The agent did not write a verdict.` The lane job exits 1 unless the line starts with `PASS`. |

Agentic CI comment links:

- Session recording. This is the session page on expo.dev. Sign in with an account that can view the project.
- Agent report and screenshots. This is the workflow run. Artifacts hold `agent-output/evidence`.
- Try this build in your browser. The link starts a new simulator session for that build. Each click starts another session.

Bug triage adds a folded report. A `REPLICATED` comment tells a person to read the report and then add the `agent` label. That label starts Issue to PR, which follows the issue text, including tester text. Do not add the label yourself.

`NOT-REPLICATED` means the steps were not enough. The user adds steps and runs the workflow again. Bug triage builds the default branch, not the build the tester had installed.

Issue to PR branches are `agent/issue-<number>`. The PR body ends with `Closes #<number>`. Re-running means removing the `agent` label and adding it again.

QA Swarm evidence sites include the verdict, screenshots, action timeline, performance charts, and the recording. The site is public to anyone with the link. Lane screenshots are also in that lane's artifacts. A lane's agent timeout is 15 minutes. The other workflows use 20 minutes. Sessions are capped at 30 minutes in `start-session.sh`.

Claude Code writes `agent-output/evidence/agent-log.jsonl`, which the artifact upload keeps. Codex, Cursor, and Grok print their logs to the job log.

## Failures

| What you see | What to do |
| --- | --- |
| `simulator:availability` is `available: false`, or the command is missing | Stop. The account is not on the Expo Simulators preview. Send the user to https://expo.dev/services/simulators. Do not start a session. An unrecognized command means the CLI is too old: rerun via `npx --yes eas-cli@latest`. |
| `workflow:validate` says not logged in, or no project | `npx --yes eas-cli@latest whoami`, then `eas init` if `extra.eas.projectId` is missing. A headless shell needs `EXPO_TOKEN` for the CLI only. That token is not `EXPO_TOKEN_SIMULATOR`. |
| Validate rejects `set-output`, `eas/checkout`, or a job `type` | Leave the YAML as the guide wrote it. Load `eas-workflows` and check the live schema. |
| Committed `ios/` or `android/` | The guides require Continuous Native Generation. Stop. Do not delete native projects. |
| Missing bundle id or package | Ask the user for the id. A fresh app often has none. Do not invent one. |
| `require("./app.json")` fails in `start-session.sh` | The ids are in another config file. Adapt the `APP_ID` lines only. |
| Android job cannot install the build | `preview` needs `android.buildType: apk`. If the project has no Android keystore yet, the user creates one with `eas credentials --platform android` for that profile. |
| iOS job looks for a device build | `get-build` needs `simulator: true`, and the `preview` profile needs `ios.simulator: true`. Simulator builds are not signed. |
| Every run builds instead of repacking | `fingerprint` and `build` must both use `environment: preview`. A preview variable that changes the native fingerprint (for example an app variant) has to match the build that already exists. |
| Workflow never starts on a PR | Connect the GitHub repo to the EAS project (EAS Workflows get started). The sample triggers on `main` and skips drafts until `ready_for_review`. Change `branches` when the base branch has another name. EAS does not start `pull_request` workflows for forks. |
| PR from a fork would need the robot token | Do not enable fork runs. In Agentic CI the `check` job checks out the PR. In QA Swarm each lane checks out the branch of `--ref`. That code can change `.eas/agents/run-agent.sh` and read `EXPO_TOKEN_SIMULATOR` and the agent key, and `GITHUB_TOKEN` when that step was done. |
| Agent cannot call the controller | The runner and `start-session.sh` disagree. Claude Code and Grok `device` mode must allow the controller in the file. Copy the runner from the guide again. |
| Argent exits "did not list a device" | The script already retries. Android emulators can take a few minutes. Read the job log. Android screenshots use scale `0.9`. |
| `GITHUB_TOKEN` or `GITHUB_REPOSITORY` errors | Both belong in the `preview` environment. The token is fine-grained, this repository only, Contents / Issues / Pull requests read and write. `GITHUB_REPOSITORY` is plain text `owner/name`. |
| Issue to PR Action fails at `npm ci` | The workflow file assumes npm. Match the project's package manager. The page shows a Bun replacement: `oven-sh/setup-bun@v2`, then `bun install --frozen-lockfile`. |
| TestFlight feedback does nothing | iOS workflow only. Connect App Store Connect before testers send feedback. Earlier feedback does not start the workflow. Add the API key used by `eas testflight:feedback` (the `production` submit profile), and create the `testflight` label. Screenshot links in the issue expire. The issue omits the tester's name and email. Each report opens a new issue. |
| User wants the browser preview | Hand them the link from the comment. Do not open it on the simulator, and do not print session tokens from `.env.eas-simulator` or `deviceRunSessionUrl` internals beyond the link the comment already contains. |
| First run is very long | Expected. The first run creates a build. Later runs repack while the native fingerprint stays the same. |

Android emulator support is still in development. Some iOS session features may be missing on Android. Follow the limitations link on the fetched guide before promising Android parity.
