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

- Requests from third-party apps that start after capture starts. The app the session installs with `--build-id`, `--application-archive-url`, or `--expo-go` is recorded from its first launch.
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

Set `API_BASE` and `API_QUERY` as in [Reach the preview API](./logs-and-crashes.md#reach-the-preview-api). The capture routes refuse the token in the URL, so `sim_api` does not work for them: send the token in an `Authorization` header instead. The header goes to curl on stdin, so the token stays out of `ps`. Then list the requests:

```bash
HAR="${TMPDIR:-/tmp}/eas-sim-capture-${API_BASE##*//}.har"
TOKEN="${API_QUERY#*token=}"; TOKEN="${TOKEN%%&*}"
printf 'url = "%s"\nheader = "Authorization: Bearer %s"\n' "$API_BASE/network-capture.har" "$TOKEN" |
  curl -sS --fail-with-body --max-time 60 -K - -o "$HAR"
node -e '
  const entries = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).log.entries;
  for (const e of entries) console.log(e.request.method, e.response.status, e.request.url);
' "$HAR"
```

Each entry also holds timings and, with the matching fields, the request and response headers and bodies. A `401` means the token was not sent as a header, or the session ended. A `404` means the session's preview server predates network capture. The user can follow the same requests live in the web preview's network panel.

The HAR file holds decrypted traffic. Delete it when the task is done (`rm -f "$HAR"`), and don't paste credentials from it into your reply.
