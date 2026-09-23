# Device logs and crash reports (iOS)

When the user's app crashes, closes on launch, or misbehaves on an iOS session, read what the device recorded instead of guessing from screenshots. The session's preview server (serve-sim) keeps a shared buffer of the simulator's device log and collects the crash reports macOS writes for simulator apps, each with the app's own log lines from just before the crash.

This covers iOS sessions. If the session's preview server predates these routes, `/crashes` returns `404`: fall back to `agent-device logs` (see [controllers.md](./controllers.md)) and tell the user crash reports aren't available on that session.

## Reach the preview API

Use the skill's script instead of building URLs by hand. Run it from the Expo project directory, like `simulator:exec`; it reads the session's `previewApiUrl` from `simulator:get --json`. That URL carries the session token, so the script keeps it inside and never prints it. Don't print or share the URL yourself either: the token grants control of the session. The script only reaches `/crashes`, `/crashes/<id>`, and `/logs`.

```bash
node <skill-dir>/scripts/preview-api.js get /crashes                        # the dotenv session
node <skill-dir>/scripts/preview-api.js get /crashes --id <session-id>      # another session
```

`<skill-dir>` is this skill's directory. Calls to the preview server do not reset the session's idle timer.

## Catch a crash with its log tail

The device log only runs while something holds it, so **start holding it before you reproduce the crash.** A crash that happens while nothing holds the log still gets a report, but its tail is empty. `watch` holds the log and prints each crash event as one JSON line:

```bash
# Run with your agent's background-command option, so you can read its output later:
node <skill-dir>/scripts/preview-api.js watch --seconds 120

# Wait for "holding the device log" on stderr, then reproduce the crash with agent-device.

node <skill-dir>/scripts/preview-api.js get /crashes   # {meta, crashes}: one record per distinct crash
```

A crash shows up in the `watch` output as a `{"type":"crash"}` (or `"recurred"`) line a few seconds after the process dies. `watch` stops after `--seconds` (default 300) or when interrupted, and exits with an error if the server closes the stream early. Without `watch`, call `get /logs "snapshot=1&follow=1&limit=1"` more often than every 8 seconds: the log stops 8 seconds after its last reader.

Right after a session boots, the device logs heavily for a minute or two, and a crash in that window can come back without its tail (`logTailSource` of `buffer-rolled-past` or `no-app-lines`, no lines). If that happens, reproduce again once logging settles; the new occurrence gets its tail.

An empty `crashes` array right after a crash means "not yet", not "nothing happened". `meta.reportDelaySeconds` estimates the delay, and `meta.status` says whether collection is running (`watching`) at all.

## Read a crash

```bash
node <skill-dir>/scripts/preview-api.js get /crashes/<id>            # newest occurrence of that crash
node <skill-dir>/scripts/preview-api.js get /crashes/<id> key=<key>  # an occurrence, by a key from occurrenceTimes
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
node <skill-dir>/scripts/preview-api.js get /logs "snapshot=1&follow=1&limit=500"  # newest 500 lines, keep the log running
node <skill-dir>/scripts/preview-api.js get /logs "snapshot=1&follow=1&since=<latestSeq>"   # only lines after a previous read
```

The JSON has `lines` (`{seq, raw}`, where `raw` is one NDJSON log entry with `processImagePath`, `processID`, `eventMessage`, and `messageType`), `latestSeq`, `oldestSeq`, and `status` (`streaming`, `restarting`, or `stopped`). Without `follow=1`, `/logs` only reads what is already buffered, and `stopped` means nothing is holding the log. To keep only the user's app, match `processImagePath` ending in the app's executable name, or `processID` for one launch.

A busy simulator can log hundreds of lines a second, and the buffer is capped at about 4 MB, so it may hold only seconds to minutes of history. Read right after the event you care about; if `since` is older than `oldestSeq`, those lines are gone.

## What the user sees

The same data is in the browser preview the user opens from `webPreviewUrl`: the device log in the Logs drawer (toolbar icon), and crashes in the Crashes section of the Tools panel, where each crash opens its stack, log tail, and `.ips`. Point the user there when they want to look for themselves.
