# Device logs and crash reports (iOS)

When the user's app crashes, closes on launch, or misbehaves on an iOS session, read what the device recorded instead of guessing from screenshots. The session's preview server (serve-sim) keeps a shared buffer of the simulator's device log and collects the crash reports macOS writes for simulator apps, each with the app's own log lines from just before the crash.

This covers iOS sessions. If the session's preview server predates these routes, `/crashes` returns `404`: fall back to `agent-device logs` (see [controllers.md](./controllers.md)) and tell the user crash reports aren't available on that session.

## Reach the preview API

`simulator:get --json` returns `remoteConfig.previewApiUrl`, the preview server's API URL with the session token already in its query. Keep it in a shell variable and don't print it: the token grants control of the session. Run this from the Expo project directory, like `simulator:exec`, or add `--id <session-id>`:

```bash
API=$(npx --yes eas-cli@latest simulator:get --json | node -e '
  let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
    const j = JSON.parse(s), url = j.remoteConfig?.previewApiUrl;
    if (j.status !== "IN_PROGRESS" || j.platform !== "IOS" || !url) {
      console.error(`no preview API (status ${j.status}, platform ${j.platform})`);
      process.exit(1);
    }
    process.stdout.write(url);
  });')

API_BASE="${API%%\?*}"; API_BASE="${API_BASE%/}"
case "$API" in *\?*) API_QUERY="${API#*\?}" ;; *) API_QUERY="" ;; esac

# sim_api <path> [extra query]: call a preview route, keeping the token query.
sim_api() { curl -fsS "$API_BASE$1?$API_QUERY${2:+&$2}"; }
```

If your shell does not keep variables between commands, repeat these lines at the start of each command. Only call `/crashes`, `/crashes/<id>`, and `/logs`. Don't call `/api`: its response includes the exec token. Calls to the preview server do not reset the session's idle timer.

## Catch a crash with its log tail

The device log only runs while something holds it, so **start holding it before you reproduce the crash.** A crash that happens while nothing holds the log still gets a report, but its tail is empty. Hold it with a `/crashes` stream opened with `?tail=1`, which also writes each crash event as it lands:

```bash
EVENTS="${TMPDIR:-/tmp}/crash-events.log"
curl -fsSN --max-time 300 -H 'Accept: text/event-stream' \
  "$API_BASE/crashes?$API_QUERY&tail=1" > "$EVENTS" 2>/dev/null &
HOLD=$!
for i in $(seq 1 20); do grep -q '^data:' "$EVENTS" && break; sleep 0.5; done  # first frame = log held

# ... reproduce the crash with agent-device (open the app, press through the flow) ...

grep -E '"type":"(crash|recurred)"' "$EVENTS"  # a crash event lands a few seconds after the process dies
sim_api /crashes                                  # {meta, crashes}: one record per distinct crash
kill "$HOLD"
```

If no `data:` line shows up, the stream did not open: check that `$HOLD` is still running and that the session is `IN_PROGRESS`. `--max-time 300` ends the hold after 5 minutes, even if `kill` runs in another shell; start it again for a longer run. Without the stream, call `sim_api /logs "snapshot=1&follow=1&limit=1"` more often than every 8 seconds: the log stops 8 seconds after its last reader.

Right after a session boots, the device logs heavily for a minute or two, and a crash in that window can come back without its tail (`logTailSource` of `buffer-rolled-past` or `no-app-lines`, no lines). If that happens, reproduce again once logging settles; the new occurrence gets its tail.

An empty `crashes` array right after a crash means "not yet", not "nothing happened". `meta.reportDelaySeconds` estimates the delay, and `meta.status` says whether collection is running (`watching`) at all.

## Read a crash

```bash
sim_api "/crashes/<id>"                 # newest occurrence of that crash
sim_api "/crashes/<id>" "key=<key>"     # an occurrence, by a key from occurrenceTimes
```

The list gives one record per crash signature, with `signal`, `exceptionType`, `culpritFrame`, `bundleId`, `pid`, `count`, and `occurrenceTimes` (each retained occurrence's `key`, oldest first). Repeats of the same crash collapse into one record with a higher `count`.

The detail returns `{record, occurrence, report, reportError}`:

- `occurrence.frames` is that occurrence's stack. The first frame with `appOwned: true` is usually where to look in the user's code.
- `occurrence.logTail` holds the app's own device-log lines (NDJSON) from at or before the crash. `occurrence.logTailSource` says how it was chosen:
  - `app-windowed`: lines found.
  - `buffer-rolled-past`: the buffer no longer reached back that far, or nothing held the log when the crash happened.
  - `no-app-lines`: the window was there, but the app logged nothing.
  - `none`: nothing was buffered for the device, usually because nothing held the log.
- `occurrence.appVersion`, `buildVersion`, and `faultingQueue` are per occurrence.
- `report` is the full `.ips` text. When it is `null`, `reportError` says why.

## Read the device log

```bash
sim_api /logs "snapshot=1&follow=1&limit=500"             # newest 500 lines, keep the log running
sim_api /logs "snapshot=1&follow=1&since=<latestSeq>"     # only lines after a previous read
```

The JSON has `lines` (`{seq, raw}`, where `raw` is one NDJSON log entry with `processImagePath`, `processID`, `eventMessage`, and `messageType`), `latestSeq`, `oldestSeq`, and `status` (`streaming`, `restarting`, or `stopped`). Without `follow=1`, `/logs` only reads what is already buffered, and `stopped` means nothing is holding the log. To keep only the user's app, match `processImagePath` ending in the app's executable name, or `processID` for one launch.

A busy simulator can log hundreds of lines a second, and the buffer is capped at about 4 MB, so it may hold only seconds to minutes of history. Read right after the event you care about; if `since` is older than `oldestSeq`, those lines are gone.

## What the user sees

The same data is in the browser preview the user opens from `webPreviewUrl`: the device log in the Logs drawer (toolbar icon), and crashes in the Crashes section of the Tools panel, where each crash opens its stack, log tail, and `.ips`. Point the user there when they want to look for themselves.
