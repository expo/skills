# Network capture (iOS)

When you need to see what the user's app sends and receives (API calls, status codes, headers, timing), start the session with network capture and read the recording from the preview API. Capture runs through the session's preview server (serve-sim) on iOS sessions only.

## Start a session with capture

```bash
npx --yes eas-cli@latest simulator:start --platform ios --name "<description>" \
  --build-id <build-id> --network-capture --non-interactive
```

- By default a recording keeps only the method, URL, status, timing, and size of each request, and redacts query values in URLs.
- `--network-capture-field` keeps more: `header`, `query`, `request-body`, `response-body`. Repeat the flag or pass a comma-separated list. Headers that usually hold credentials, such as `Authorization` and cookies, are redacted.
- Capture decrypts HTTPS, so headers and bodies can contain credentials in cleartext. Ask only for the fields the task needs. Before you keep bodies from an app that signs in to real accounts, get the user's OK.
- Capture is not available on Android or together with `--egress local`; the service refuses those sessions.
- An older `eas-cli` rejects `--network-capture`. Run it through `npx --yes eas-cli@latest`.

## Which requests are recorded

Capture records every HTTP(S) request an app sends through `URLSession`, which React Native `fetch`, image loading, and most iOS SDKs use. That includes requests from libraries and SDKs inside the app (analytics, crash reporting, `expo-updates` checks), not only the app's own code.

- Requests from third-party apps that start after capture starts. For agent-device and Argent sessions, capture may start after the installed app's initial launch. Startup-only requests can be missed, and relaunching does not guarantee that those requests recur. For startup-sensitive tests, start a bare session with capture and install and launch the app after the session is ready.
- An app that was already running is not recorded until it relaunches:

  ```bash
  # agent-device session
  npx --yes eas-cli@latest simulator:exec npx agent-device@latest open <bundle-id> --platform ios --relaunch
  # argent session
  npx --yes eas-cli@latest simulator:exec argent run restart-app --udid <udid> --bundleId <bundle-id>
  ```

- Apple system apps, such as Safari, are not recorded, and neither are requests made with `URLSession.shared`.
- Apps that pin their server certificates cannot connect while capture is on.

Capture sends the app's traffic through a proxy and decrypts it, and some apps react to that: pinned connections fail, and other requests can fail or time out. If the app misbehaves while capture is on, check it in a new session without `--network-capture` before you debug the app, and leave capture off when the task does not need it.

## Read the recording

The recording exists only while the session runs and is not saved as a session artifact, so download it before you stop the session.

Use the original session ID, even if another session has replaced the dotenv. Run this from the Expo project directory and replace the script path with this skill's installed path:

```bash
npx --yes eas-cli@latest simulator:get --id <session-id> --json |
  node "/path/to/eas-simulator/scripts/download-network-capture.mjs"
```

The helper reads the preview URL from stdin, sends its token in an `Authorization` header, and streams the HAR into a private temporary folder (`0700`) with an owner-only file (`0600`). It prints only the local file path. Each download has a ten-minute timeout; a failed run removes its partial download.

Open the local HAR to inspect request methods, URLs, status codes and timings, plus the headers and bodies that you selected. The user can also inspect requests live or select **Download session as HAR** in the preview's network panel.

A `401` or `403` means the download was refused: confirm the session is active and re-run `simulator:get` for its current token. A `404` can mean no active capture session or an unsupported export route; the status alone does not identify an older server. Check capture state in the preview before deciding that an upgrade is needed.

The HAR holds decrypted traffic. Delete the helper's temporary folder when analysis is done, and don't paste credentials or preview URLs into your reply. Download before stopping the session; automatic HAR artifact uploads are not available in the current workflow.
