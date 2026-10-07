# Device logs and crash reports (iOS)

When the user's app crashes, closes on launch, or misbehaves on an iOS session, read what the device recorded instead of guessing from screenshots. The session's preview server (serve-sim) keeps a shared buffer of the simulator's device log and collects the crash reports macOS writes for simulator apps, each with the app's own log lines from just before the crash.

This covers iOS sessions. Call `sim_api /crashes` first. If it returns `404 Not found`, the session's preview server predates these routes. Use `sim_control logs` only for an agent-device session. For Appium or Argent, use a log facility supported by that installed controller; if none is available, report the missing diagnostic data and preserve the session. Tell the user crash reports aren't available on that session. Don't call `/logs` there, because older servers stream it without end.

## Reach the preview API

`simulator:get --json` returns `remoteConfig.previewApiUrl`, the preview server's API URL with the session token already in its query. Keep it in a shell variable and don't print it: the token grants control of the session. As with the other session commands, run this from the Expo project directory. Pass `--id` with the session you are driving, because another agent can replace the dotenv session between your commands.

Verify that the returned HTTPS URL belongs to the selected EAS session before sending its token, and do not follow redirects to another host. Keep shell tracing off while handling credentials. Use private temporary files for raw logs, filter to the requested app, and redact tokens and personal data before showing excerpts.

```bash
set +x
umask 077
set -o pipefail
EVENTS_DIR=$(mktemp -d "${TMPDIR:-/tmp}/eas-sim-crashes.XXXXXX")
EVENTS="$EVENTS_DIR/events"  # private files for this run's requests and log hold
# Set the exact HTTPS origin from the independently verified EAS preview for this session.
PREVIEW_ORIGIN="https://<verified-preview-hostname>"
npx --yes eas-cli@latest simulator:get --json --id "$SESSION_ID" \
  > "$EVENTS_DIR/session.json" 2> "$EVENTS_DIR/requests.err" || exit 1
API=$(node -e '
  let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
    let j;
    try { j = JSON.parse(s); } catch { console.error("simulator:get did not print JSON"); process.exit(1); }
    const expectedId = process.argv[2];
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(expectedId ?? "") || j?.id !== expectedId) {
      console.error("Preview response does not match the requested session"); process.exit(1);
    }
    const url = j.remoteConfig?.previewApiUrl;
    if (j.status !== "IN_PROGRESS" || j.platform !== "IOS" || !url) {
      console.error("Selected session has no active iOS preview API");
      process.exit(1);
    }
    let endpoint;
    try { endpoint = new URL(url); } catch { console.error("invalid preview URL"); process.exit(1); }
    if (typeof url !== "string" || endpoint.protocol !== "https:" || endpoint.origin !== process.argv[1] ||
        endpoint.username || endpoint.password || endpoint.hash || /[\s\x00-\x20\x7f"\\]/.test(url)) {
      console.error("unsafe preview URL"); process.exit(1);
    }
    process.stdout.write(url);
  });' "$PREVIEW_ORIGIN" "$SESSION_ID" < "$EVENTS_DIR/session.json") || exit 1

API_BASE="${API%%\?*}"; API_BASE="${API_BASE%/}"
case "$API" in *\?*) API_QUERY="${API#*\?}" ;; *) API_QUERY="" ;; esac

# Validate the complete request, including the selected crash ID and extra query.
# printf is a shell builtin; the token-bearing URL stays on stdin, outside `ps`.
sim_api_config() {
  : "${API_BASE:?no preview API}"
  printf '%s' "$API_BASE$1?$API_QUERY${2:+&$2}" | node -e '
    let s = "";
    process.stdin.on("data", d => s += d).on("end", () => {
      try {
        const path = process.argv[1];
        if (!/^\/(?:logs|crashes(?:\/[A-Za-z0-9_-]+)?)$/.test(path)) throw new Error();
        const query = new URLSearchParams(process.argv[2] || "");
        const allowed = new Set(["key", "tail", "snapshot", "follow", "limit", "since"]);
        if ([...query.keys()].some(k => !allowed.has(k))) throw new Error();
        const u = new URL(s);
        if (u.protocol !== "https:" || u.origin !== process.argv[3] || u.username || u.password || /[\s\x00-\x20\x7f"\\]/.test(s)) throw new Error();
        if (!u.pathname.endsWith(path) || u.hash) throw new Error();
        process.stdout.write(`url = "${s}"\n`);
      } catch { console.error("Invalid preview API request"); process.exitCode = 1; }
    });' "$1" "${2-}" "$PREVIEW_ORIGIN"
}

sim_api() {
  sim_api_config "$1" "${2-}" | \
    curl --disable --proto '=https' -sS --fail --max-time 20 -K - 2>> "$EVENTS_DIR/requests.err"
}
```

Keep each helper response redirected to a file in `EVENTS_DIR`, as in the examples below; never stream raw log/crash responses into the tool transcript. Keep the selected crash ID to the route's identifier characters; URL-encode an occurrence key before using `key=...`. The helper rejects unknown query parameters, fragments, and curl configuration characters. `--disable` prevents a user curl config from enabling redirects or printing the credential-bearing request; these calls do not follow redirects. Request errors are captured privately too.

If your shell does not keep variables between commands, repeat these lines at the start of each command. Each repeat runs `simulator:get` again, which takes a few seconds, so put related reads in one command. Only call `/crashes`, `/crashes/<id>`, and `/logs`. Don't call `/api`: its response includes the exec token. Calls to the preview server do not reset the session's idle timer.

## Catch a crash with its log tail

The device log only runs while something holds it, so **start holding it before you reproduce the crash.** A crash that happens while nothing holds the log still gets a report, but its tail is empty. Hold it with a `/crashes` stream opened with `?tail=1`, which also writes each crash event to `$EVENTS.log`:

```bash
sim_api_config /crashes "tail=1" |
  curl --disable --proto '=https' -sSN --fail --max-time 300 -H 'Accept: text/event-stream' -K - > "$EVENTS.log" 2> "$EVENTS.err" &
echo $! > "$EVENTS.pid"
for i in $(seq 1 20); do
  grep -q '^data:' "$EVENTS.log" && break
  kill -0 "$(cat "$EVENTS.pid")" 2>/dev/null || break
  sleep 0.5
done
grep -q '^data:' "$EVENTS.log" && echo "log held" || echo "Log hold failed; inspect private files and redact before sharing."

# ... reproduce the crash with the selected controller in the requested app ...

grep -E '"type":"(crash|recurred)"' "$EVENTS.log" > "$EVENTS_DIR/crash-events.txt"
sim_api /crashes > "$EVENTS_DIR/crashes.json"        # keep the response private
kill "$(cat "$EVENTS.pid")" 2>/dev/null; rm -f "$EVENTS.log" "$EVENTS.err" "$EVENTS.pid"
```

Filter the private results to the requested app's bundle ID and selected crash identifiers before inspecting them. Reports and log text may contain credentials or personal data; extract and redact only the diagnostic fields needed for the task rather than printing the entire response or event.

Reproduce only after `log held`. Otherwise inspect the private error: `401` means the session ended or its token changed, and `404` means the server predates these routes. `--max-time 300` ends the hold after 5 minutes even if nothing kills it; start it again for a longer run. Without the stream, capture `sim_api /logs "snapshot=1&follow=1&limit=1"` privately more often than every 8 seconds: the log stops 8 seconds after its last reader.

Right after a session boots, the simulator writes many log lines for a minute or two, and a crash in that window can come back without its tail (`logTailSource` of `buffer-rolled-past` or `no-app-lines`, no lines). If that happens, reproduce again once logging settles; the new occurrence gets its tail.

An empty `crashes` array right after a crash means "not yet", not "nothing happened". `meta.reportDelaySeconds` estimates the delay, and `meta.status` says whether collection is running (`watching`) at all.

## Read a crash

```bash
sim_api "/crashes/<id>" > "$EVENTS_DIR/crash-detail.json"
# Or select an occurrence using a verified key from occurrenceTimes:
sim_api "/crashes/<id>" "key=<key>" > "$EVENTS_DIR/crash-detail.json"
```

The list gives one record per crash signature, with `signal`, `exceptionType`, `culpritFrame`, `bundleId`, `pid`, `count`, and `occurrenceTimes` (each retained occurrence's `key`, oldest first). Repeats of the same crash collapse into one record with a higher `count`.

The detail returns `{record, occurrence, report, reportError}`:

- `occurrence.frames` is that occurrence's stack. The first frame with `appOwned: true` is usually where to look in the user's code.
- `occurrence.logTail` holds the app's own device-log lines (NDJSON) from at or before the crash. `occurrence.logTailSource` says how it was chosen:
  - `app-windowed`: lines found.
  - `buffer-rolled-past`: the buffer no longer reached back that far, or nothing held the log when the crash happened.
  - `no-app-lines`: the window was there, but the app logged nothing.
  - `none`: nothing was buffered for the device, usually because nothing held the log. It is also `none` when the report has no timestamp or process name.
- `occurrence.appVersion`, `buildVersion`, and `faultingQueue` are per occurrence.
- `report` is the full `.ips` text. When it is `null`, `reportError` says why. The detail can be large, so print only the fields you need.

## Read the device log

```bash
sim_api /logs "snapshot=1&follow=1&limit=500" > "$EVENTS_DIR/device-log.json"
# Or read only lines after the previous response's verified sequence:
sim_api /logs "snapshot=1&follow=1&since=<latestSeq>" > "$EVENTS_DIR/device-log.json"
```

The JSON has `lines` (`{seq, at, raw}`, where `raw` is one NDJSON log entry with `processImagePath`, `processID`, `eventMessage`, and `messageType`), `latestSeq`, `oldestSeq`, and `status` (`streaming`, `restarting`, or `stopped`). `streamError` keeps the last stream error, so it can be set while `status` is `streaming`. Keep `snapshot=1`: without it, `/logs` is an event stream that does not end. Without `follow=1`, `/logs` only reads what is already buffered, and `stopped` means nothing is holding the log. The first `follow=1` read after the log was idle can return no lines, so read again after a second or two.

To keep only the user's app, match `processImagePath` ending in the app's executable name (its `CFBundleExecutable`; app paths contain `/Containers/Bundle/Application/`), or `processID` for one launch.

A busy simulator can log hundreds of lines a second, and the buffer is capped at about 4 MB, so it may hold only seconds to minutes of history. Read right after the event you care about; if `since` is older than `oldestSeq`, those lines are gone.

After extracting the redacted diagnostic result, remove this run's private raw files. Stop any log-hold process you started first; do not stop a process from another run:

```bash
rm -f -- "$EVENTS_DIR/crash-events.txt" "$EVENTS_DIR/crashes.json" \
  "$EVENTS_DIR/crash-detail.json" "$EVENTS_DIR/device-log.json" \
  "$EVENTS_DIR/session.json" "$EVENTS_DIR/requests.err" \
  "$EVENTS.log" "$EVENTS.err" "$EVENTS.pid"
rmdir "$EVENTS_DIR"
unset API API_BASE API_QUERY
```

## What the user sees

The same data is in the browser preview the user opens from `webPreviewUrl`: the device log in the Logs drawer (toolbar icon), and crashes in the Crashes section of the Tools panel, where each crash opens its stack, log tail, and `.ips`. Point the user there when they want to look for themselves.
