---
name: eas-simulator
description: "EAS service (paid). Run, inspect, and test an app on a remote iOS Simulator or Android emulator hosted on EAS. Use for EAS Simulator or eas sim commands, cloud or shareable device previews, agents without a suitable local simulator, and live Expo development on a remote device. Covers Expo Go, development builds, and simulator builds of native Swift apps, including artifacts built with EAS Workflows. On macOS, a plain request to run on the simulator normally means the local simulator; use this skill when remote execution is intended. Not for physical devices, web-only previews, or app store submission."
version: 1.0.0
license: MIT
allowed-tools: "Bash(npx *eas-cli@*), Bash(npx *agent-device@*), Bash(npx expo *), Bash(eas *), Bash(expo *), Bash(xcodebuild*), Bash(pod*), Bash(argent *), Bash(ffmpeg*)"
---

# EAS Simulator

> **EAS service - costs apply.** EAS Simulator is a hosted EAS service. Session usage is subject to your account's pricing and limits. See https://expo.dev/pricing for current terms.

Use EAS Simulator to exercise a native app from a cloud agent, inspect a device configuration unavailable locally, reproduce a UI bug, or share an interactive browser preview. The result is an app running on a **simulated device**, not a physical-device test.

## Understand the pieces

- **EAS Simulator** provisions and stops the remote device and exposes its browser preview.
- **The controller** inspects and operates the device. `agent-device` is the default; Argent and Appium are alternatives. `web-preview-only` has no automation interface. Current CLI help says all session types include a preview; Android support is still in development, so verify the capabilities needed for the task.
- **The app runtime** is Expo Go, a development build, or a standalone native binary. EAS Simulator can install and launch one at startup; it does not compile your source.
- **Metro** serves live JavaScript from your checkout over a reachable tunnel. **EAS Build or Workflows** can produce a native artifact when a build is needed.

Cloud hosting is useful when local execution is unavailable or sharing/offloading is wanted. Linux and Windows cannot host Apple's iOS Simulator, but can run local Android emulators when virtualization is available. Preserve the user's choice of local or cloud execution. For a generic simulator request, use a suitable local simulator when available; otherwise use EAS Simulator after checking access.

When the user requests EAS Simulator or a cloud simulator, proceed within that request and any stated budget. Explain applicable usage once and carry existing authorization through the session. Ask before exceeding a stated budget or expanding beyond the requested work.

## Choose what to run

Inspect the existing app and the behavior being tested before starting a build. Use the lightest runtime that faithfully exercises that behavior; keep an existing development-build setup when it fits.

| Goal / app | Runtime | What makes edits visible? |
|---|---|---|
| Expo app whose dependencies and tested behavior work in Expo Go | SDK-matched **Expo Go + Metro** | JS/TS and asset edits through Fast Refresh; no app build needed |
| Custom native modules, native configuration, or a feature Expo Go cannot represent | **Development build + Metro** | JS edits refresh; native dependency/configuration/source changes require rebuilding and reinstalling |
| Verify a specific build, release startup, or an app that runs without Metro | **Standalone simulator build** | Rebuild/reinstall to test source edits; record the exact build and any loaded EAS Update |
| Native Swift/SwiftUI iOS app | **Simulator `.app`**, built locally or in a macOS workflow | Rebuild/reinstall after Swift changes; Metro and Expo Go do not apply |

Reuse a compatible development binary for JS-only edits. A native fingerprint can help establish **native compatibility**; it does not prove that embedded JavaScript or a loaded update matches the current checkout. For standalone-build verification, establish source/build provenance as well. A `Debug` label alone does not make a Swift app or a bare React Native binary an Expo development client.

Read [run-your-app.md](./references/run-your-app.md) for installation and Metro connections. Read [workflows.md](./references/workflows.md) when a cloud build or repeatable CI test is needed. Use the sibling `expo-dev-client` skill for development-client setup and `eas-workflows` when authoring workflow YAML.

## Establish access and session ownership

Run from the intended EAS project directory with a current EAS CLI. These commands are experimental: the relevant subcommand's `--help` is authoritative. Check it before using non-default start flags, machine-readable/config output, list filters, or session events. Examples use `npx --yes eas-cli@latest`; a current installed `eas` works too.

```bash
npx --yes eas-cli@latest whoami
npx --yes eas-cli@latest sim:availability --json
```

Use an existing authenticated session or `EXPO_TOKEN` in headless environments. Inspect the project's EAS linkage (`extra.eas.projectId`); link with `eas init` when needed. This project determines the account used for access and billing, including when the installed app is a native Swift app. If access is unavailable, report it and use an appropriate available testing environment; another build does not grant simulator access.

Before creating a session, check whether the intended session already exists. Use `sim:list` to inspect project sessions; its help covers status/type/platform, name-prefix and tag filters, and pagination with `--limit` / `--after`. Record the **session ID**, purpose, platform/device, and app/build identity. Give new sessions a short human-readable `--name`; use `--tag` to group a task or app variant.

`.env.eas-simulator` contains credentials for **one session in one project directory**. Keep it gitignored and out of source uploads. Do not clear it before identifying its owner: creating another session overwrites the file but leaves the earlier session running. Use separate project directories or explicit connection data for concurrent work; see [controllers.md](./references/controllers.md).

## Provision, connect, verify

For live Expo development, read [Tunnel scope and approvals](./references/run-your-app.md#tunnel-scope-and-approvals) before starting the tunnel or connecting the app. Carry existing authorization through tunnel creation, connection, and live edits; include its source and the concrete data flow in any required approval request.

1. **Prepare the runtime.** For Expo Go or an existing compatible development build, prepare a Metro tunnel. For a new native build, submit the build and track its ID. Overlap simulator boot with short preparation when it helps latency; avoid consuming a session through a long build queue. There is no universal build-first or simulator-first rule.
2. **Start once.** Supply `--expo-go`, `--build-id`, or `--application-archive-url` to install and launch during startup, or install a local artifact through the controller afterward. If supplying `--open-url`, have Metro and its public deep link ready first.
3. **Confirm the remote session.** Check `sim:get --id <session-id> --json`: require a live status and controller connection data. Attach the controller to the installed app with `open <app-id> --foreground`. Match connection data to the recorded ID before trusting any device output.
4. **Prove the app is ready.** Wait for a specific app landmark, not just an installed package, an open launcher, or a green build. For live edits, change a visible piece of test content and verify that change on the device before relying on Fast Refresh.
5. **Exercise the requested behavior** using the loop below, then stop the hosted session.

### Session lifetime

Name and bound a session according to the task. `--non-interactive` returns when ready and leaves the session running.

- `--max-duration-minutes N` is the hard automatic-stop deadline. Customize it when supported by the account; otherwise use the service's default session limit.
- `--max-idle-time-minutes N` stops a session after that many inactive minutes. Omitted means **no idle timeout**: the session runs until its maximum duration or an explicit stop.
- **Only activity reported through `agent-device` and `argent` resets the idle timer.** Appium commands and browser-preview activity do not reset it. For Appium or a user-driven browser preview, rely on the maximum duration to bound the session; customize it when supported by the account.

If startup is slow, inspect that session with `sim:get` and `sim:events --id <session-id> --follow`. Do not create a second session to retry a pending start. The EAS session can be ready while the app is still loading or failing: verify both separately.

## Operate with observable expectations

The controller-specific examples are in [controllers.md](./references/controllers.md). For agent-device:

- Start with `open <app-id> --foreground`, which returns the initial interactive tree. Act with `press`, `fill`, or `scroll` and `--settle`; use the returned diff to choose the next action.
- Verify a **named result** with `wait`, `is`, or `get`. A successful tap only confirms dispatch. A screenshot supports visual inspection; saving one without inspecting the expected state does not prove the behavior.
- Copy current refs exactly, including any pinned `~sN` suffix. Refresh the tree when navigation or asynchronous changes make them stale. Prefer refs or specific selectors; use screenshot-derived coordinates for inaccessible UI.
- Target the actual text-field node, not its placeholder's static-text node. Narrow ambiguous matches by role/id or a current ref. When the keyboard fills the tree, locate the field rather than assuming it disappeared.
- Scroll a missing target into view and wait for delayed content before declaring it absent. A failed accessibility capture or timeout is an observation failure, not proof that the app lacks the element.
- Serialize state-changing commands on a device. After a timeout, inspect the current state before repeating an action that may already have happened.

Keep the test faithful to the question. If a bug names a particular native control, navigation transition, SDK version, or app configuration, reproduce that condition. A simpler substitute can be a control experiment but cannot answer the original question on its own.

## Evidence and handoff

If a controller fails to download a recording, retrieve it from [EAS session artifacts](./references/controllers.md#recording-download-recovery).

Record enough context to reproduce the result: session/device, app runtime and build/source identity, actions, expected versus observed state, and evidence paths. Label screenshots by what they show. Use video for motion and timing, and account for the capture's frame rate and any static-frame trimming; a recording cannot establish physical-device frame pacing.

For launch/crash claims, distinguish foreground attachment from a cold launch. Use explicit relaunches and retain a landmark or crash/termination evidence for each attempt. A blank screen alone does not identify a crash. Simulator success also cannot rule out a hardware-only failure or prove real-device performance.

Report the finding first: reproduced, passed for the tested conditions, not reproduced, or blocked. State what was actually exercised and what remains untested. Share `remoteConfig.webPreviewUrl` with the user for browser viewing when available; it is not an app deep link and must never be opened on the simulated device.

## Stop and clean up

```bash
npx --yes eas-cli@latest sim:stop --id <session-id> --json
```

Stop on completion and failure paths, and verify the returned status. Current EAS CLI clears its dotenv only if it still belongs to the stopped session. Stop only Metro/processes created for this task. Closing agent-device alone does not stop the EAS session.

If the user wants to keep driving the preview, hand off the session ID, preview URL, stop command, and known expiry/limits from the CLI. Browser-preview activity does not reset an idle timeout; use the maximum duration for the requested handoff. Otherwise stop before finishing. Diagnose failures with [troubleshooting.md](./references/troubleshooting.md); preserve evidence before replacing a session.

## Documentation

This skill teaches decisions and working sequences. Load authoritative details as needed:

- [EAS CLI reference](https://docs.expo.dev/eas/cli/) — session, build, and workflow commands.
- [Expo CLI](https://docs.expo.dev/more/expo-cli/#tunneling) — Metro tunneling and development URLs.
- [agent-device and Expo](https://docs.expo.dev/agents/agent-device/) / [Argent and Expo](https://docs.expo.dev/agents/argent/) — controller integrations.
- [EAS Workflows syntax](https://docs.expo.dev/eas/workflows/syntax/) — jobs, checkout, and artifact transfer.

## Submitting Feedback
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes submit-expo-feedback@latest --category skills --subject "eas-simulator" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
If an AI agent repeatedly failed or the user had to take over an Expo task, load the expo-skill-feedback skill and follow its eval-candidate flow instead of reusing the command above.
