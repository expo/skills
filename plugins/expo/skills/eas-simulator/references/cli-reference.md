# EAS Simulator CLI reference

The `simulator:*` commands are experimental. This reference covers the public flags in
eas-cli 23.2.0; run `npx --yes eas-cli@latest simulator:<command> --help` when exact
syntax matters.

`eas simulator`, `eas simulator:start`, `eas sim`, and `eas sim:start` all start a session.

## Start

```bash
npx --yes eas-cli@latest simulator:start [flags]
```

| Flag | Meaning |
|---|---|
| `-p, --platform ios\|android` | Device platform. Required in non-interactive mode. |
| `--name <value>` | Human-readable session name. Follow the naming rules in `SKILL.md`. |
| `--tag <value>...` | Repeatable grouping label. Values are stored lowercased. |
| `--device <value>` | iOS Simulator name/UDID or Android AVD hardware profile; otherwise the runner chooses. |
| `--build-id <id>` | Install and launch an EAS Build. Mutually exclusive with `--application-archive-url` and `--expo-go`. |
| `--application-archive-url <url>` | Download, install, and launch an application archive. Mutually exclusive with `--build-id` and `--expo-go`. |
| `--expo-go` | Install and launch Expo Go for the project's SDK. Mutually exclusive with the other application sources. |
| `--sdk-version <value>` | Select the Expo Go SDK instead of the project SDK. Valid only with `--expo-go`. |
| `--launch-arg <value>...` | Repeatable argument passed to the installed application at launch. Requires an application source. |
| `--open-url <value>` | URL opened in the installed application after launch. Requires an application source. |
| `--type agent-device\|appium\|argent\|web-preview-only` | Session interface. The first three provide automation; `web-preview-only` provides preview without automation. All include a web preview. |
| `--package-version <value>` | Version of the package backing the session; defaults to latest. |
| `--max-duration-minutes <n>` | Hard maximum before automatic stop. Custom values require a paid plan; otherwise omit it for the plan/job default. |
| `--max-idle-time-minutes <n>` | Stop after inactivity. Read [Session lifetime](../SKILL.md#session-lifetime) before using it; reset support depends on the session interface. |
| `--[no-]force` | Defaults to `--force`, which starts even when the environment names an existing session. `--no-force` turns that existing dotenv session into a guard. |
| `--out-config-type dotenv\|env` | `dotenv` (default) writes `.env.eas-simulator`; `env` avoids that file and prints shell exports in ordinary output when the interface has automation configuration. |
| `--json` | Emit JSON and imply `--non-interactive`. It does not by itself suppress the default dotenv write. |
| `--non-interactive` | Disable prompts; requires `--platform`. |

With the default `--force`, replacing `.env.eas-simulator` does not stop the session it
previously named. Inspect or stop that session before starting another; use `--no-force`
when an existing dotenv should block creation.

## Inspect and manage

| Command | Flags and behavior |
|---|---|
| `simulator:availability` | `--json`, `--non-interactive`. Read-only account/project availability check. |
| `simulator:get` | `--id <id>` (defaults to `.env.eas-simulator`), `--json`, `--non-interactive`. |
| `simulator:list` | Repeatable `--status new\|in-progress\|stopped\|errored`, `--type agent-device\|appium\|argent\|web-preview-only`, and `--platform ios\|android`; `--name <prefix>`; repeatable `--tag <value>` (session must have every requested tag); `--limit <1..100>` (default 10); `--after <endCursor>`; `--json`; `--non-interactive`. |
| `simulator:events` | `--id <id>` (defaults to dotenv), `-f, --follow`, `--json`, `--non-interactive`. `--follow` and `--json` are mutually exclusive. |
| `simulator:stop` | `--id <id>` (defaults to dotenv), `--json`, `--non-interactive`. Idempotently stops the session. |
| `simulator:exec <command> [args...]` | No EAS flags. Loads `.env.eas-simulator` and passes the command and arguments through with the remote connection environment. |

`--json` always implies `--non-interactive` on commands that support it.
