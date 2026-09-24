# Control and inspect the hosted app

EAS CLI owns the hosted session; the controller provides app/device operations. Select a controller at startup. Its connection data and commands must match the session type.

| Session type | Use it for | Connection data |
|---|---|---|
| `agent-device` | CLI/agent inspection, interaction, screenshots, recordings | `AGENT_DEVICE_DAEMON_BASE_URL`, `AGENT_DEVICE_DAEMON_AUTH_TOKEN` |
| `argent` | Argent CLI or MCP workflows | `ARGENT_TOOLS_URL`, `ARGENT_AUTH_TOKEN` |
| `appium` | Existing Appium tests | `APPIUM_URL`, JSON-encoded `APPIUM_CAPS` |
| `web-preview-only` | Human interaction in a browser | Preview URL; no automation interface |

Current EAS CLI help specifies browser previews for every type. Check returned capabilities and actual behavior on Android, whose support is still in development. Do not send agent-device commands to an Argent or preview-only session. Follow [Session lifetime](../SKILL.md#session-lifetime) before setting an idle timeout; Appium commands and browser-preview activity do not reset it.

## Connection identity comes before device identity

For one session in its own project directory, `eas sim:exec <command> ...` loads `.env.eas-simulator` and passes the remaining arguments through. It has no session `--id` selector: `sim:exec --id ...` is not a way to select another session.

Without remote configuration, a controller can select an available local device. Verify the dotenv's session ID and both daemon variables as shown in [run-your-app.md](./run-your-app.md), plus a live `sim:get` result, before opening an app. Do not infer remote identity from a believable screenshot or a local diagnostics-file path.

For concurrent sessions, prefer separate project directories. Alternatively, start with `--out-config-type env --json`, keep each returned ID and `remoteConfig` in a private per-session file, and launch the controller directly with explicit environment values from that record. For EAS CLI 23.2.0's `AgentDeviceRunSessionRemoteConfig`:

| JSON field | Controller environment variable |
|---|---|
| `agentDeviceRemoteSessionUrl` | `AGENT_DEVICE_DAEMON_BASE_URL` |
| `agentDeviceRemoteSessionToken` | `AGENT_DEVICE_DAEMON_AUTH_TOKEN` |

Reject a missing URL/token, wrong controller type, or non-live session before dispatch. Pass the same distinct agent-device `--session <name>` on each command when multiple client sessions coexist. Do not route this explicit-env flow back through `sim:exec`, which can load a different dotenv over those values. Avoid shell tracing, printing tokens, or putting session files in source uploads. Raw EAS output is not automatically an agent-device `--remote-config` profile.

## agent-device: inspect, act, verify

Examples below use the single-session dotenv flow. Guidance matches agent-device 0.21.0; consult targeted help when a command differs or the hosted daemon is older:

```bash
npx --yes eas-cli@latest sim:exec npx --yes agent-device@latest help workflow
npx --yes eas-cli@latest sim:exec npx --yes agent-device@latest help react-native
```

Attach to the installed app, then perform one action and verify its outcome:

```bash
npx --yes eas-cli@latest sim:exec npx --yes agent-device@latest \
  open com.example.myapp --foreground --platform ios
# Read the initial tree and use an actual returned ref or an observed selector.
npx --yes eas-cli@latest sim:exec npx --yes agent-device@latest \
  press 'role=button label="Search"' --settle
npx --yes eas-cli@latest sim:exec npx --yes agent-device@latest \
  wait text 'Search results' 30000
npx --yes eas-cli@latest sim:exec npx --yes agent-device@latest \
  screenshot ./search-results.png
```

- **Refs:** preserve `@` and any `~sN` suffix. Use the current settle diff or `snapshot -i` to refresh stale targets. Pinned stale refs are rejected rather than safely reusable.
- **Text:** `fill <actual-input-ref> 'text' --settle` replaces a field's contents. A placeholder label may resolve to static text. `type` appends to an already-focused field and does not accept `--settle`; inspect afterward.
- **Ambiguity:** narrow by role/id or choose a current candidate ref. Do not pick a similarly labeled control in another part of the screen.
- **Missing UI:** scroll into view or wait for the expected transition. For sparse/unavailable accessibility trees, inspect a screenshot and use observed coordinates, then try the tree again after navigation.
- **Dialogs:** inspect and handle the visible system alert; `help alert` gives current syntax. Do not blindly accept unrelated permission prompts as a connection fix.
- **Device selection:** use the remote inventory (`devices --json`) when selecting a non-default device. Pass a consistent selector if more than one is booted; install the app on that selected device too. Do not hard-code a device list or infer OS versions from model names.
- **Timeouts:** use the command's supported timeout options. `--settle` establishes local UI quiet, not a successful business outcome. A slow/failed capture requires diagnosis; inspect before replaying a mutating action.

### Launches, captures, and diagnostics

`open --foreground` attaches; `open <app-id> --relaunch` requests a fresh app launch. Repeated foreground opens are not repeated cold launches. Track app/foreground state and logs when diagnosing termination, and capture per-launch evidence rather than inferring a crash from a blank frame.

Use `record start` / `record stop ./flow.mp4` for motion; inspect the recording. For visual comparisons, keep viewport, content, theme, and screenshot scale consistent. `screenshot --scale 1` requests full resolution; older hosted daemons may differ from a newer client. Avoid claims about exact frame pacing unless the capture method supports them.

Load `help debugging` for app state, logs, performance, and network diagnostics; load `help react-native` for Metro and native overlays. Use the smallest diagnostic that distinguishes the failing layer.

## Recording download recovery

If downloading a recording through agent-device or argent fails, fetch the recording from **EAS session artifacts**. A controller download failure does not mean the recording was lost. Keep the original EAS session id and query its artifacts:

```bash
npx --yes eas-cli@latest simulator:get --id <session-id> --json
# Select the recording in artifacts[] by filename/name and metadata; use its downloadUrl:
curl --fail --location --max-time 600 --output ./capture.mp4 '<downloadUrl>'
```

Use the URL returned by EAS, not a path on the simulator or a controller artifact id. If the recording has not appeared yet, poll the same session with a bounded wait for upload completion. Already-uploaded artifacts can be retrieved after the session stops using its explicit id. If a download URL expires, query the session again for a fresh one. Give the download command more than 10 minutes in the outer runner, increase `--max-time` for larger files, and verify the downloaded video before reporting success.

Source: EAS CLI [simulator:get](https://github.com/expo/eas-cli/blob/main/packages/eas-cli/src/commands/simulator/get.ts) exposes `artifacts[].{id,name,filename,metadata,downloadUrl}`.

## Argent and Appium

For Argent, use the session's own connection instructions or invoke its CLI through `sim:exec`. The package is `@swmansion/argent`. Startup installation via `--build-id`, `--application-archive-url`, or `--expo-go` is the simplest shared entry point. For a local app, current Argent supports upload via `reinstall-app`; confirm its semantics before replacing an installed app.

```bash
npx --yes eas-cli@latest sim:exec argent run list-devices
npx --yes eas-cli@latest sim:exec argent run screenshot --udid <remote-udid>
```

Use the actual remote UDID. Argent's gesture coordinates are normalized (0–1), unlike pixel-coordinate examples from other controllers. Its UI queries may miss a system dialog that is visible in a screenshot; follow the command's corrective hints. Check recording options such as static-frame trimming before using recordings to measure timing.

For an already-installed Argent MCP client, link the returned session with `argent link '<tools-url>' --token '<token>' --yes` and restart the MCP process so it loads the new connection. Keep credentials in the host's supported private configuration; consult [Argent and Expo](https://docs.expo.dev/agents/argent/) for current setup rather than assuming every agent uses the same MCP file format. Switching an existing link requires updating its token as well as its URL.

For Appium, use the returned endpoint and capabilities with the project's existing Appium client, through `sim:exec` or explicit connection configuration. Consult current controller documentation for supported platform operations. A successful client connection still needs an app-level assertion.

Close the controller when finished, then **stop the EAS session by ID**. Controller cleanup and EAS resource cleanup are separate operations.
