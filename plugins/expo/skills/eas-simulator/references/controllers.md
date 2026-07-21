# Controllers: agent-device and argent

`eas-cli` has no device verbs — it manages the *session*. The verbs (open/tap/type/screenshot/inspect) come from a **controller** that `npx --yes eas-cli@latest simulator:exec` runs locally and that talks to the controller daemon on the remote VM. Two controllers are supported by `npx --yes eas-cli@latest simulator:start --type`:

- `agent-device` (Callstack, MIT) — used throughout this skill; runs on demand via `npx agent-device@latest`, nothing installed globally.
- `argent` (Software Mansion) — a capable alternative controller; check its license for your use.
- `serve-sim` — not a controller; a streaming/preview-only type (iOS), no programmatic control.

## agent-device verbs (run via `npx --yes eas-cli@latest simulator:exec npx agent-device@latest <verb>`)

agent-device is a thin **client** talking to a **daemon** (the daemon runs on the VM in a session). `npx --yes eas-cli@latest simulator:exec` sets `AGENT_DEVICE_DAEMON_BASE_URL` + `AGENT_DEVICE_DAEMON_AUTH_TOKEN` from `.env.eas-simulator`, which switches the client into remote mode. Selectors and `@e`-refs come from the latest `snapshot`.

The CLI help is written for agents and is the source of truth — run these for the full verb set and agentic loop guidance:

```bash
npx --yes eas-cli@latest simulator:exec npx agent-device@latest --help
npx --yes eas-cli@latest simulator:exec npx agent-device@latest help workflow
```

EAS-specific notes:

- **`press`, not `tap`.** The tap verb is `press` — `tap` is not a verb.
- **`snapshot -i` is slow on iOS** — tens of seconds is normal; wait for it.
- **`install` uploads** a local binary to the daemon; **`install-from-source`** has the VM download from a URL (use for EAS artifacts — avoids a large upload).
- **Exercised against a live session:** `apps`, `install`, `install-from-source`, `open`, `snapshot -i`, `press`, `fill`, `screenshot`, `scroll`, `gesture` (needs a preset, e.g. `gesture swipe left`), `logs`, `record` (`start`/`stop <path>`), `network`, `perf`. `metro` (`prepare`/`reload`) is the Mode C dev-client bridge. Pass `--platform ios`; run `<verb>` with no args to see its required subcommand/args.

## argent (alternative)

`npx --yes eas-cli@latest simulator:start --type argent` provisions an argent remote session. The connection config it returns is different (`ARGENT_TOOLS_URL` / `ARGENT_AUTH_TOKEN`).

**Installing apps in an argent session.** `--type argent` provisions only an argent daemon on the VM — there is no agent-device daemon, so agent-device install verbs don't apply. Install a local build with argent's own `reinstall-app` (tar-upload):

```bash
argent run reinstall-app --udid <udid> --bundleId <bundle-id> --appPath ./MyApp.app
```

Whenever the tools client is routed to a remote tool-server, it tars the local bundle and streams it up automatically — no extra flag. "Remote" covers both `argent link` and the env-var MCP config (`ARGENT_TOOLS_URL`), so this works in sandboxed shells too. It's a registry tool, so the MCP server exposes it identically — same call by CLI or MCP. Works for iOS `.app` (a directory), Android `.apk`, and Vega `.vpkg`; the client prints an upload line on stderr.

Needs argent ≥ 0.16.0 (the release that adds tar-upload) — verify with `argent --version`. On older versions `reinstall-app` resolves `--appPath` on the VM only, so a local path fails; drive an app already on the sim instead.

**Connecting via MCP (Cursor, Claude Code, Codex, and others).** Install the CLI globally first — the package is `@swmansion/argent`, not `argent`:

```bash
npm install -g @swmansion/argent
```

Then run `argent init --yes` to register the Argent MCP server. Link the session credentials with `argent link` — the recommended path:

```bash
argent link '<ARGENT_TOOLS_URL>' --token '<ARGENT_AUTH_TOKEN>' --yes
```

Reload the agent after linking so its `argent mcp` process picks up the remote session.

**Sandboxed shells** (Claude Code, some CI environments) can't write to `~/.argent/` so `argent link` won't work there. Use env vars in the MCP config file instead — this is argent's highest-precedence resolution and overrides any link:

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

MCP config file location: `.cursor/mcp.json` (Cursor), `.claude/mcp.json` (Claude Code), `mcp.json` in the Codex project root. It carries a session token — **add it to `.gitignore`**.

**Known issues:**
- `argent init --help` launches an interactive wizard regardless of the flag — use `--yes` to skip it, or read the package source for non-interactive flags.
- Re-running `argent link` against an already-linked URL **without `--yes`** reports "Already linked. No changes." and keeps the old token — every call then fails with `401 Unauthorized`. Always pass `--yes` (as above) so a rotated token is actually written.
