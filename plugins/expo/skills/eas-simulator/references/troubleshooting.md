# Diagnose the failing layer

Keep the session/build ID and relevant error before changing state. Check the layer that failed; replacing the entire session is appropriate for a terminated/unrecoverable remote runtime, not every app or Metro error.

| Symptom | Check and next action |
|---|---|
| Command or flag not recognized | Check `npx --yes eas-cli@latest <command> --help`. Current start is `eas sim` / `eas simulator`; `simulator:start` remains an alias. `serve-sim` was replaced in CLI choices by `web-preview-only`. |
| `An Expo user account is required` | Authenticate with `eas login` or provide `EXPO_TOKEN` through the environment. Confirm with `whoami`; do not paste tokens into logs or skill files. |
| Project not linked / no `projectId` | Check the working directory and resolved EAS project config. Link the intended project with `eas init`; a native Swift app still needs an EAS project to own its sessions/workflows. |
| Account not enabled | Check `sim:availability --json` for the project's account. Stop retrying allocation and report the access limitation. |
| Maximum-duration option rejected by plan | Use the service's default maximum or the account's supported limit. Do not silently change plans. An idle timeout is a separate setting. |
| Slow startup / no connection data yet | Inspect the same ID with `sim:get` and `sim:events --follow`; consult the job error if it stops or errors. Do not create another session to retry an allocation in progress. |
| Dotenv contains only the session ID | Startup may not have finished. Wait for controller connection data and verify live status before invoking a controller. |
| Unexpected local device / wrong app or session | Check the saved session ID, live `remoteConfig`, and actual controller URL/token. Missing remote env can allow local selection. Do not use diagnostics-path prefixes as proof of remote execution. |
| Concurrent session overwrote the dotenv | Stop using that shared file. Identify both sessions by ID; use separate project directories or per-session explicit connection data. Stop only sessions owned by this task. |
| `--json` unexpectedly wrote a dotenv | In EAS CLI 23.2.0 it writes the ready-state dotenv by default. Use `--out-config-type env --json` to avoid the file; manage the returned ID and credentials explicitly. |
| `SESSION_NOT_FOUND` after startup installed/launched the app | Attach with `open <app-id> --foreground --platform ios` (or Android). EAS's app launch and the controller's interaction session are separate. |
| App missing on an iPad / another selected device | List the remote devices, choose a supported selector, and install/open on that device. An installation on the first device does not install on every device exposed by the session. |
| Tunnel offline / daemon unavailable | Check EAS status first. If stopped/errored, create a replacement only if still needed, then reinstall/reconnect. For a live session, inspect events and connection data before concluding the VM was lost. Do not repeat a failed mutation blindly. |
| Controller action timed out | Observe the screen/app state before retrying: the action may have completed while its response or capture stalled. Use command-specific timeout help. |
| Stale ref / ambiguous selector | Read a current settle diff or `snapshot -i`, then use a fresh ref or a narrower role/id selector. Coordinates must come from an inspected current screenshot. |
| Filling a placeholder fails | Target the actual text-field node. The placeholder can be a static-text child, and the keyboard may dominate the accessibility tree. |
| Target absent / wait failed | Distinguish an observed absence from capture failure, delayed rendering, or off-screen content. Scroll/wait as appropriate and verify the exact expected state. |
| App opens to the dev-client launcher | Verify Metro's public URL and the configured custom scheme. Inspect any Open dialog; use the actual deep link or the launcher's manual URL field. A launcher screenshot is not evidence that the app loaded. |
| Expo Go reports an incompatible SDK / missing native module | Confirm the SDK selected for Expo Go and whether that native dependency/feature is supported. Use the project's development build when required; do not rebuild just to fix a transient Metro error. |
| Edits do not appear | Identify the installed runtime. A standalone bundle does not load live code from Metro. In Expo Go/development builds, verify the actual Metro URL and logs; native changes require rebuilding/reinstalling. |
| Metro port already in use | Choose another free port; preserve processes owned by other tasks. Refresh the deep link after restarting your own server or tunnel. |
| ngrok rejects a robot user / legacy tunnel insists on 8081 | Use a supported account-signed tunnel (`EXPO_UNSTABLE_TUNNEL_V2=1`) with login/project linkage, or another reachable dev-server arrangement. Check installed Expo CLI support; avoid forcing webcontainer mode. |
| `pod install` reports an ASCII-8BIT Unicode normalization error | Run the app's CocoaPods command with a UTF-8 locale, such as `LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8`. |
| Process exits 137 | SIGKILL; check resource limits/logs before assuming the cause. Memory pressure during concurrent Metro/native builds is one possibility. |
| Workflow says Xcode project or source file is missing | Include `eas/checkout`, verify working directory/upload exclusions, and ensure required files and shared schemes reached the worker. Do not repair the Xcode project based solely on a missing upload. |
| Workflow custom-job artifact upload is rejected | Use `eas/upload_artifact` with `type: other`; managed build artifact types require a build job. |
| Artifact download expires | Re-query the completed workflow/build and use its current download URL. Do not spend another build merely to replace an expired link. |
| Argent gives 401 after switching sessions | Update both URL and token. When linking, `argent link ... --yes` replaces a stale link; restart the MCP process if it retained old configuration. |

Boot, first bundle transfer, and accessibility capture latency vary. Use observable status and bounded waits rather than fixed sleep sequences or invented timing guarantees. Before finishing, stop the task's hosted sessions by explicit ID and retain any failures as test evidence.
