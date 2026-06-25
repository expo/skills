# Controllers: agent-device and argent

`eas-cli` has no device verbs — it manages the *session*. The verbs (open/tap/type/screenshot/inspect) come from a **controller** that `npx --yes eas-cli@latest simulator:exec` runs locally and that talks to the controller daemon on the remote VM. Two controllers are supported by `npx --yes eas-cli@latest simulator:start --type`:

- `agent-device` (Callstack, MIT) — used throughout this skill; runs on demand via `npx agent-device@latest`, nothing installed globally.
- `argent` (Software Mansion) — a capable alternative controller; check its license for your use.
- `serve-sim` — not a controller; a streaming/preview-only type (iOS), no programmatic control.

## agent-device verbs (run via `npx --yes eas-cli@latest simulator:exec npx agent-device@latest <verb>`)

agent-device is a thin **client** talking to a **daemon** (the daemon runs on the VM in a session). `npx --yes eas-cli@latest simulator:exec` sets `AGENT_DEVICE_DAEMON_BASE_URL` + `AGENT_DEVICE_DAEMON_AUTH_TOKEN` from `.env.eas-simulator`, which switches the client into remote mode. Selectors and `@e`-refs come from the latest `snapshot`.

| Verb | Notes |
|---|---|
| `apps --platform ios` | List installed apps (blank session → none) |
| `install <appId> <path> --platform ios` | Install a local binary; **uploads** it to the daemon. `--platform` (or an open session) is required. |
| `install-from-source <url> --platform ios` | The VM **downloads** from the URL (use for EAS artifacts; avoids a big upload). Also `--github-actions-artifact`. |
| `open <appId\|deep-link> --platform ios` | Launch an app by bundle id, or follow an app **deep link** (`exp+slug://…`) — a custom-scheme deep link triggers a system "Open in '<app>'?" dialog you must `press`. **Not** the `webPreviewUrl` (a browser preview for the user, never the device). |
| `snapshot -i` | Interactive accessibility tree → `@e1`-style refs. iOS snapshots can be slow (tens of seconds). |
| `press <ref\|selector> [x y]` | **Tap.** The verb is `press`, NOT `tap`. Selector form e.g. `press 'label="Open"'`. |
| `fill <ref> "text"` | Type into a field |
| `screenshot <path>` | Capture to a local PNG (downloaded from the daemon) |
| `gesture <pan\|fling\|swipe\|pinch\|rotate\|transform>` / `swipe` / `scroll` / `longpress` / `type` / `back` / `home` | Standard interactions — `gesture` needs a kind subcommand |
| `metro prepare (--public-base-url <url> \| --proxy-base-url <url>)` / `metro reload` | Wire a dev client to Metro / reload (Mode C). `--proxy-base-url` = optional bridge origin for remote Metro access — **not exercised by this skill's flow** (run-your-app.md connects via the public tunnel URL). |
| `logs` / `record` / `network` / `perf` | Evidence capture |

Run `npx --yes eas-cli@latest simulator:exec npx agent-device@latest --help` (and `<verb> --help`) for the authoritative, current set — the CLI help is the source of truth.

**Proven in this skill's flows:** `apps`, `install`, `install-from-source`, `open`, `snapshot -i`, `press`, `fill`, `screenshot`. The rest (`gesture`/`scroll`/`longpress`/`logs`/`record`/`network`/`perf`/`metro`) are real in the CLI but not exercised here — confirm shape via `<verb> --help` before relying on them.

## argent (alternative)

`npx --yes eas-cli@latest simulator:start --type argent` provisions an argent remote session. The connection config it returns is different (`ARGENT_TOOLS_URL` / `ARGENT_AUTH_TOKEN`).

**argent is a driver, not an installer.** Its `reinstall-app` tool runs `xcrun simctl install` on the remote VM with a literal local path — it does not upload a binary or accept a URL. **Always use agent-device (or `install-from-source`) for the install step**, then use argent to drive the already-installed app.

**Connecting to Cursor's MCP.** Install the CLI globally first — the package is `@swmansion/argent`, not `argent`:

```bash
npm install -g @swmansion/argent
```

Then run `argent init --yes` to register the Argent MCP server in `.cursor/mcp.json`. Wire the session credentials in as env vars (this is argent's highest-precedence resolution — no `argent link` or `~/.argent/link.json` needed, and it works in sandboxed shells):

```json
{
  "mcpServers": {
    "argent": {
      "command": "argent",
      "args": ["mcp"],
      "env": {
        "ARGENT_TOOLS_URL": "<ARGENT_TOOLS_URL from simulator:start>",
        "ARGENT_AUTH_TOKEN": "<ARGENT_AUTH_TOKEN from simulator:start>"
      }
    }
  }
}
```

`.cursor/mcp.json` now carries a session token — **add it to `.gitignore`**. Then reload Cursor (Cmd+Shift+P → "Reload Window") and Argent's MCP tools drive the remote sim from chat.

Alternatively, on a non-sandboxed machine you can use `argent link` instead of env vars:

```bash
# --no-verify skips the health check if the session isn't fully live yet
argent link '<ARGENT_TOOLS_URL>' --token '<ARGENT_AUTH_TOKEN>' --yes
```

**Known issues:**
- Screenshots crash on EAS worker VMs (`NSPasteboard` error — worker runs under a System LaunchDaemon with no window server). Fall back to agent-device for screenshots.
- `argent init --help` launches an interactive wizard regardless of the flag — use `--yes` to skip it, or read the package source for non-interactive flags.
