---
name: eas-simulator
description: "EAS service (paid). Run and control an Expo app on an EAS remote iOS simulator or Android emulator for cloud testing, live iteration, screenshots, or a shareable preview."
version: 1.0.1
license: MIT
allowed-tools: "Bash(npx *eas-cli@*), Bash(npx *agent-device@*), Bash(npx expo *), Bash(eas *), Bash(expo *), Bash(xcodebuild*), Bash(pod*), Bash(argent *), Bash(ffmpeg*)"
---

# EAS Simulator

> **EAS service - costs apply.** EAS Simulator is a hosted EAS service. Session usage is subject to your account's pricing and limits. See https://expo.dev/pricing for current terms.

Use a remote iOS simulator or Android emulator when the user requests cloud access,
a shareable preview, or device verification unavailable locally. Check the target
platform and actual local tools; Linux can run Android emulators, and macOS does
not guarantee an installed iOS simulator. Preserve an explicit local/remote choice.
For an ambiguous local-simulator request, inspect local options before proposing a
paid cloud session. Do not repeat a cloud-choice question already answered.

When the user requests EAS Simulator or a cloud simulator, proceed within that
request and any stated budget. Explain applicable usage once and carry existing
authorization through the session. Ask before exceeding a stated budget or
expanding beyond the requested work.

## Establish access and session ownership

The `simulator:*` commands are experimental/hidden. Use a CLI version supporting
them; examples use `npx --yes eas-cli@latest`. Read the relevant subcommand's
`--help` before using non-default start flags, machine-readable/config output,
list filters, or session events; it is authoritative when a tested sequence differs.
Use existing authentication/project linking; do
not invent a bundle ID or create a remote project solely to explain these commands.

Before starting, run the read-only availability check from the intended project:

```bash
npx --yes eas-cli@latest simulator:availability --json
```

If unavailable, report that result and continue with available local/device work;
do not repeatedly start sessions or promise an account rollout date.

`.env.eas-simulator` holds a session ID and connection token. Keep it gitignored,
never print its token, and record the ID of the session this task owns. Inspect an
existing session before overwriting the file. Stop/reset only sessions and Metro
processes owned by this task, or ones the user explicitly asked to manage.

The dotenv is not concurrency-safe. Do not start concurrent sessions sharing it.
For parallel sessions, isolate working directories or use explicit IDs and the
CLI's supported connection configuration. Confirm the remote ID/device before
trusting a screenshot: missing remote config can send a controller to a local sim.

## Choose the build for the task

Read [the tested run sequences](./references/run-your-app.md) for the chosen mode.
These include integration details not exposed by ordinary command help.

| Mode | Use when | Build contract |
|---|---|---|
| A: local release | One-shot verification with a local native toolchain | Simulator artifact with embedded JS from the intended source |
| B: EAS artifact | Testing a specified build or preparing a cloud-built static artifact | Correct platform/runtime and source; identify the artifact used |
| C: development build + Metro tunnel | Live iteration/Fast Refresh | Compatible dev client connected to the current workspace's Metro |

A release artifact cannot gain Fast Refresh by reconnecting Metro. Reuse a dev
client when its native dependencies/configuration match; source-only edits do not
require rebuilding it. For current-source static verification, check source/commit
and bundled JS as well as native compatibility; a native fingerprint alone cannot
prove that the embedded JavaScript includes today's edits. A user-requested old
artifact remains the correct target when reproducing that release.

Before starting a Mode C tunnel, read [Tunnel scope and approvals](./references/run-your-app.md#tunnel-scope-and-approvals)
for its data flow, authorization context, and handling approval rejections.

## Run, inspect, clean up

Start a named session for the task, confirm `IN_PROGRESS` and usable connection
configuration with `simulator:get`, install the chosen artifact, then drive it.
`simulator:exec` loads connection settings and invokes a controller; device actions
come from `agent-device`, Appium, or `argent`, not `simulator:tap`. See
[controller commands](./references/controllers.md) for supported verbs.

Give the session a short descriptive name, such as `Checkout failure repro`.
The default `--out-config-type dotenv` writes `.env.eas-simulator`; `--json`
changes stdout and implies non-interactive mode but does not suppress that write.
Use `--out-config-type env` and explicit connection handling when no file should
be written. Use `simulator:list` for session filters/pagination and
`simulator:events` for recorded activity; consult their help for current options.

Poll the existing session with a bounded timeout instead of starting another for a
slow boot. If the connection is unusable, inspect cwd/session/build/Metro identity,
then reset this task's resources and retry once. On another failure, stop the
session and report the blocker. After a timed-out action, inspect state before
retrying an action that may already have executed.

Capture screenshots for static state; record and inspect motion when verifying
transitions or gestures. A low-frame-rate recording cannot prove 60/120 Hz timing.
Keep results tied to the actual build and device. Use
[troubleshooting](./references/troubleshooting.md) for concrete known failures.
If a controller cannot download a recording, retrieve it from
[EAS session artifacts](./references/controllers.md#recording-download-recovery).

### Watch it live

The `webPreviewUrl` is for the user's browser, never an app deep link and never
a controller `open` argument sent to the simulator. Use an available user-browser
surface if requested, otherwise provide the URL. Current session types include a
browser preview; `agent-device`, `appium`, and `argent` also provide automation,
while `web-preview-only` has no automation interface. Android support is still
developing and may lack iOS parity; verify the requested behavior.

### Session lifetime

- `--max-duration-minutes N` is the hard automatic-stop deadline. Customize it when supported by the account; otherwise use the service's default session limit.
- `--max-idle-time-minutes N` stops a session after that many inactive minutes. Omitted means no idle timeout; the maximum duration or an explicit stop still applies.
- Only activity reported through `agent-device` and `argent` resets the idle timer. Appium commands and browser-preview activity do not. Bound Appium and user-driven previews by maximum duration, and report the CLI's actual duration or expiry.

Keep a session alive only for an intended live preview/interaction. State its
lifetime and stop procedure; use `--max-duration-minutes` when supported by the plan.
Otherwise stop this task's session on completion or failure, confirm it stopped,
then clear only its stale dotenv state and stop its Metro process. If cleanup fails,
report the session ID and unfinished stop explicitly.

## Submitting Feedback
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes submit-expo-feedback@latest --category skills --subject "eas-simulator" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
If an AI agent repeatedly failed or the user had to take over an Expo task, load the expo-skill-feedback skill and follow its eval-candidate flow instead of reusing the command above.
