# Agentic workflow docs

The guide pages are the source of truth for file contents. Fetch a page before creating or editing its files. Do not reconstruct workflow YAML, runners, prompts, or helper scripts from memory or from this skill.

## Fetch

From this skill's directory:

```bash
node <skill-dir>/scripts/fetch-docs.js <slug>
```

Slugs: `introduction`, `setup`, `agentic-ci`, `issue-to-pr`, `bug-triage`, `qa-swarm`.

The script prints the markdown on stdout and `source: <url>` on stderr. The page is `https://docs.expo.dev/agentic-workflows/<slug>.md`. The guides live in `docs/pages/agentic-workflows/`, and the paste prompts use this path.

If the script is unavailable, fetch that URL. Accept the body when it is the guide. Ignore an HTML shell.

Each page ends with a "paste this into your agent" prompt. Follow that prompt. This skill's rules win on secrets, on asking for workflow / platform / agent / controller, and on not pushing or running unless the user asked.

## What each page owns

| Slug | Install it when | Depends on |
| --- | --- | --- |
| `introduction` | The user wants the model, not a specific workflow | None |
| `setup` | Every workflow, once | None. Steps from "Add a build profile for the remote device" through "Push the files". "Add a GitHub token to EAS" is a separate step. |
| `agentic-ci` | Test each pull request and comment a verdict | `setup`, except the GitHub token step |
| `issue-to-pr` | A GitHub `agent` label should open a PR | `setup`, including the GitHub token step, and Agentic CI |
| `bug-triage` | Reproduce a GitHub issue, or TestFlight feedback on iOS | `setup`, including the GitHub token step, plus Agentic CI and Issue to PR |
| `qa-swarm` | Several agents test flows in parallel | `setup`, except the GitHub token step. That step is required only to post the report on a PR. |

Fetch `setup` once. The guides point at that page and do not repeat its files. Agentic CI and QA Swarm stop before "Add a GitHub token to EAS". Issue to PR and Bug triage include that step.

`setup` owns the app id, the `preview` profile, the robot token, the agent key, `.eas/agents/run-agent.sh`, `.eas/agents/start-session.sh`, `.cursor/cli.json` for Cursor, and the `.gitignore` lines for `.env.eas-simulator` and `agent-output/`. Merge the profile keys into an existing `preview` profile. If that profile already builds for physical devices, add a separate profile, such as `agent`, and change `profile: preview` to that name in each workflow file. If `preview` has `SENTRY_AUTH_TOKEN`, remove it and add `SENTRY_DISABLE_AUTO_UPLOAD` set to `true`. On Enterprise and Production plans the page also allows a custom environment. Then change `environment: preview` in the build profile and in each workflow file.

There is no Agent Sessions guide in this section. If the user asks for one, say this skill does not cover it and ask what they want instead.

## Copy rules

- Create each file at the path the fetched page shows, with that page's content for the agent and controller the user named. A code fence names that path after the language, such as `sh .eas/agents/run-agent.sh`. Use that path. A fence without a path is a prompt or a profile snippet. The heading above it says which file it belongs to.
- The page shows one runner per agent (Claude Code, Codex, Cursor, Grok) and one `start-session.sh` per controller (`agent-device`, Argent). Copy one of each. Do not merge them.
- Claude Code and Grok runners on the page already allow both controllers in `device` mode. Keep both allow rules even when the user picked one controller.
- Cursor also needs the `.cursor/cli.json` from the page.
- For another agent, write a `run-agent.sh` that accepts the same two arguments (`prompt file`, then `device` or `change`) and runs without a person. `device` tests the app. `change` edits code.
- iOS and Android workflow YAML differ (`simulator: true` on iOS `get-build`, APK profile on Android). Copy the variant for the chosen platform. For both platforms, the Agentic CI and Bug triage pages say to add two files with different names, such as `agentic-ci-android.yml` and `agentic-ci-ios.yml`.
- Do not translate EAS Workflow YAML into GitHub Actions. `set-output`, `uses: eas/checkout`, `uses: eas/install_node_modules`, `type: fingerprint`, `get-build`, `build`, `repack`, `github-comment`, and `doc` are EAS jobs. If `workflow:validate` rejects one, load `eas-workflows` and fetch its schema instead of inventing a replacement.
- `start-session.sh` on the page reads `app.json` with `require("./app.json")`. If the ids live only in `app.config.js` or `app.config.ts`, change those `APP_ID` lines so they read the config the project actually uses. Leave the rest of the script as the page shows it, and tell the user about that edit.
- The jobs run `source .eas/agents/start-session.sh <android|ios> <build-id> <session name> <tag>`. The `source` matters: the script's `EXIT` trap stops the session in the job's shell. Do not change it to a subprocess.
- The jobs run `bash .eas/agents/run-agent.sh <prompt-file> <device|change>`.

## Worked example that is not the source of truth

https://github.com/jacobhammerle/todo-app is a reference app with agent workflows already running. Its layout is older than these guides. Prompts are at `.eas/*.md`, secrets are described on the `production` environment, and it uses a personal access token. When the repo and a fetched guide disagree, follow the guide.

## Related docs the guides link to

Follow the link on the fetched page rather than guessing the URL. The usual targets:

- EAS Workflows get started, including connecting GitHub: `https://docs.expo.dev/eas/workflows/get-started/`
- Expo Simulators: `https://docs.expo.dev/preview/simulators/introduction/`
- Waitlist: `https://expo.dev/services/simulators`
- Pricing: `https://expo.dev/pricing`
