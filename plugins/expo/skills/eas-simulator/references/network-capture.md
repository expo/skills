# Network inspection on an iOS session

Use capture when the task needs HTTP(S) requests, status codes, timings, headers,
or bodies from the app. It uses the session's serve-sim host and is iOS-only.
It changes the app's network path and decrypts HTTPS; certificate-pinned apps
can fail. If behavior changes with capture on, compare with capture off before
attributing the failure to the app.

## Enable capture and choose fields

```bash
npx --yes eas-cli@latest simulator:start --platform ios --name "API request diagnosis" \
  --build-id <build-id> --network-capture --non-interactive
```

The default recording keeps method, redacted URL, status, timing, and size.
`--network-capture-field` opts into `header`, `query`, `request-body`, or
`response-body`; repeat it or use a comma-separated list. Choose only fields the
task needs. Query values default to redacted, but URL paths and parameter names
remain. Credential-header redaction does not remove secrets from arbitrary
headers or bodies. Keep the recording private.

The browser preview's **Tools → Network requests** panel can enable capture and
change retained fields live. Changes apply to future eligible requests, not
retroactively. Capture covers supported app-owned URLSession HTTP(S), including
React Native fetch and requests from libraries in the app; it is not all device
traffic. Apple system apps such as Safari and `URLSession.shared` bypass it.
When capture starts after the app, relaunch that app before reproducing the
request. Installation-at-start and relaunch setup depend on the worker path;
confirm the target request appears rather than assuming startup was captured.

Current workers can combine capture with local egress. Both features must be
supported by the session worker; a local CLI update alone does not change it.
Follow the session's egress instructions and keep its client running.

## Download before stopping

The live recording is removed when capture is turned off or the session ends.
It is not currently uploaded as a retained HAR artifact. Download it first from
the panel's **Download session as HAR** button or use the helper below.

`simulator:network-requests`, `simulator:crashes`, and `--network-capture-recording`
are not released (eas-cli 27.2.0). Use existing capture, controller logs, and
browser diagnostics rather than those proposals. For app logs, use
`simulator:logs` (see [logs and crashes](./logs-and-crashes.md)).

### Authenticated private session

The REST API can return the session's API URL and preview token without changing
its sharing preference. Use an existing `EXPO_TOKEN` for an account with access.
Do not print the response. Set `SKILL_DIR` to the directory of this loaded skill
and `SESSION_ID` to the same session you are driving:

```bash
: "${EXPO_TOKEN:?EXPO_TOKEN is required for this REST request}"
printf 'url = "https://api.expo.dev/v2/device-run-sessions/%s"\nheader = "Authorization: Bearer %s"\n' "$SESSION_ID" "$EXPO_TOKEN" |
  curl -sS --fail-with-body --max-time 20 -K - |
  node "$SKILL_DIR/scripts/download-network-capture.mjs"
```

The helper accepts the REST envelope, checks the running iOS status, and sends
the preview token in an Authorization header to the HAR route. It saves into a
private temporary directory (0700) with a private file (0600), prints only the
local filename, rejects redirects and invalid HAR responses, and removes a partial
download on failure. Its download timeout
is ten minutes; give the outer command enough time to finish.

### Existing public or older API output

If `simulator:get --json` already includes `remoteConfig.previewApiUrl` with its
token, the same helper accepts that output:

```bash
npx --yes eas-cli@latest simulator:get --id "$SESSION_ID" --json |
  node "$SKILL_DIR/scripts/download-network-capture.mjs"
```

Private CLI JSON deliberately omits the direct URL. Do not restart a private
session with `--public-link` just to export traffic. Use the REST path or the
browser download. Capture routes require the bearer header and reject tokens
in the query; the helper removes a URL token before making the request.

## Read the result

Inspect only the HAR entries needed for the task. `401` means authentication or
session access failed; `404` can mean an older host or missing capture route.
The live panel's 500-request list and the HAR's 10,000-entry cap are different
limits. Body previews are bounded, so an absent or truncated body is not proof
that the app sent none. Delete local captures when they are no longer needed,
and redact credentials before sharing any excerpt.
