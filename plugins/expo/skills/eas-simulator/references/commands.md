# Commands at a glance

Query the installed CLI for the complete current flag set before using non-default start
flags, machine-readable/config output, list filters, or session events:

```bash
# Replace `start` with the simulator subcommand you are about to run.
npx --yes eas-cli@latest simulator:start --help
```

The examples below cover the common workflow; they are intentionally not an exhaustive
copy of the CLI surface. Keep non-obvious behavioral guidance from this skill—especially
[Session lifetime](../SKILL.md#session-lifetime)—even when constructing the command from `--help`.

| Command | Purpose |
|---|---|
| `npx --yes eas-cli@latest simulator:availability [--json] [--non-interactive]` | Check access without creating a session. |
| `npx --yes eas-cli@latest simulator:start --platform ios\|android --name "<description>" [flags]` | Create a session; boot the sim + selected interface; write `.env.eas-simulator` by default; print the preview + job-run URLs. **Always pass `--name`**. `--json` does not suppress the dotenv; use `--out-config-type env` when no file should be written (it prints only the controller `export` lines, without `EAS_SIMULATOR_SESSION_ID`, so pass `--id` to `get`/`stop`/`events`). |
| `npx --yes eas-cli@latest simulator:exec <cmd> [args…]` | Load `.env.eas-simulator`, then run `<cmd>` with that env. The bridge to the controller. |
| `npx --yes eas-cli@latest simulator:get [--id <id>] [--json] [--non-interactive]` | Session status + connection details, including the session name. **Use this to confirm readiness** (see *Operating principles* in [SKILL.md](../SKILL.md#operating-principles)). |
| `npx --yes eas-cli@latest simulator:list [filters] [--limit N] [--after <cursor>] [--json]` | List and paginate project sessions; filter by status, type, platform, name prefix, and tags. |
| `npx --yes eas-cli@latest simulator:events [--id <id>] [--follow\|--json]` | Show recorded activity events; `--follow` watches until the session ends. |
| `npx --yes eas-cli@latest simulator:logs [--id <id>] [--follow\|--json] [--scope user-apps\|all] [--limit N]` | iOS app logs. Live sessions: the newest buffered lines (100 by default, installed apps only by default), or `--follow` to stream; `--scope all` (system logs too) needs `--follow`. Stopped sessions: `--output <path>` downloads the saved `app-logs.ndjson` (first 30 minutes only). See [logs-and-crashes.md](./logs-and-crashes.md). |
| `npx --yes eas-cli@latest simulator:control [<action> [values…]] [--id <id>] [--output <path>] [--import <file>]` | Run direct actions on an iOS session (any session type, private links are fine), such as `screenshot.capture`, `app.launch`, `app.openUrl`, `app.install`, `appearance.set`, `location.set`, or `tap`. See [simulator-actions.md](./simulator-actions.md). |
| `npx --yes eas-cli@latest simulator:stop [--id <id>] [--json] [--non-interactive]` | Stop a session (idempotent). |

`sim:` is a short alias for the `simulator:` topic (for example, `eas sim:start`). This skill uses the full name.
