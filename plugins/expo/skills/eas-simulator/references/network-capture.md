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

- Requests from third-party apps that start after capture starts. The app the session installs with `--build-id`, `--application-archive-url`, or `--expo-go` is recorded from its first launch.
- An app that was already running is not recorded until it relaunches:

  ```bash
  # agent-device session
  npx --yes eas-cli@latest simulator:exec npx agent-device@latest open <bundle-id> --platform ios --relaunch
  # argent session
  npx --yes eas-cli@latest simulator:exec argent run restart-app --udid <udid> --bundleId <bundle-id>
  ```

- Apple system apps, such as Safari, are not recorded, and neither are requests made with `URLSession.shared`.
- Apps that pin their server certificates cannot connect while capture is on. A connection failure that only happens with capture can be pinning.

## Read the recording

Set up `sim_api` as in [Reach the preview API](./logs-and-crashes.md#reach-the-preview-api), then download the session's recording as a HAR file and list its requests:

```bash
HAR="${TMPDIR:-/tmp}/eas-sim-capture-${API_BASE##*//}.har"
sim_api /network-capture.har > "$HAR"
node -e '
  const entries = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).log.entries;
  for (const e of entries) console.log(e.request.method, e.response.status, e.request.url);
' "$HAR"
```

Each entry also holds timings and, with the matching fields, the request and response headers and bodies. A `404` means the session's preview server predates network capture. The user can follow the same requests live in the web preview's network panel.

The HAR file holds decrypted traffic. Delete it when the task is done (`rm -f "$HAR"`), and don't paste credentials from it into your reply.
