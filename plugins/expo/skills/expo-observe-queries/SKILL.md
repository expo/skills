---
name: expo-observe-queries
description: Use when you need to query EAS Observe data for an Expo app — app startup metrics like TTI, cold launch, warm launch, TTR, and bundle load time, individual performance events, custom event logs, or app version/build/update hierarchy. Covers the four EAS CLI commands: observe:metrics, observe:events, observe:logs, and observe:versions.
version: 1.1.0
license: MIT
---

# EAS Observe CLI

EAS Observe collects app performance telemetry and custom event logs from Expo apps and exposes them through four hidden EAS CLI commands. All commands are in preview and subject to breaking changes. Pass the `--help` flag to any command for the latest API.

## Commands Overview

| Command | Purpose |
|---------|---------|
| `eas observe:metrics` | Per-version statistical aggregates for performance metrics (median, p90, etc.) |
| `eas observe:events` | Individual performance events ordered by metric value or timestamp (paginated) |
| `eas observe:logs` | Custom events emitted by the app — name summary, all events, or filtered by event name (paginated) |
| `eas observe:versions` | App version hierarchy with build numbers, OTA update IDs, and event counts |

All four commands share these common flags:

- `--platform ios` or `--platform android` — filter by platform (default: both)
- `--start <ISO date>` and `--end <ISO date>` — explicit time range
- `--days <N>` — show data from the last N days (mutually exclusive with `--start`/`--end`)
- `--project-id <id>` — run against a specific project without needing a project directory. When passed, the command will not try to create a new EAS project where one is unneeded.
- `--json` — machine-readable output (implies `--non-interactive`)
- `--non-interactive` — fail instead of prompting

Default time range is the last 60 days when none of `--days`, `--start`, `--end` is given.

## Supported Performance Metrics

Used by `observe:metrics` and `observe:events`.

| Alias | Full name | Display |
|-------|-----------|---------|
| `tti` | `expo.app_startup.tti` | TTI (time to interactive) |
| `ttr` | `expo.app_startup.ttr` | TTR (time to render) |
| `cold_launch` | `expo.app_startup.cold_launch_time` | Cold Launch |
| `warm_launch` | `expo.app_startup.warm_launch_time` | Warm Launch |
| `bundle_load` | `expo.app_startup.bundle_load_time` | Bundle Load |

## `eas observe:metrics`

Shows per-version statistical aggregates for one or more metrics, with separate tables per platform.

```bash
# All five default metrics, last 60 days, both platforms
eas observe:metrics

# Single metric
eas observe:metrics --metric tti

# Multiple metrics — each renders as its own table
eas observe:metrics --metric tti --metric cold_launch

# Choose which statistics to display
eas observe:metrics --metric tti --stat median --stat p90 --stat eventCount

# Narrow time range and platform
eas observe:metrics --metric tti --days 14 --platform ios
```

**Stat flags:** `min`, `max`, `median` (alias `med`), `average` (alias `avg`), `p80`, `p90`, `p99`, `eventCount` (alias `count`).

**Default stats:** `median` + `eventCount` in the table; all stats in JSON.

**Table layout:**
- One table per metric (with merged value + event count cells, e.g. `0.45s (150)`)
- Each table shows iOS and Android in separate sections
- App Version column includes build numbers in parentheses (e.g. `1.2.0 (42)`)
- Footer row per platform shows total events per metric
- **Update IDs are omitted from the table** to keep output readable when a version has many updates; they are included in the JSON output as an array per version

**JSON output shape:**
```json
{
  "versions": [
    {
      "appVersion": "1.2.0",
      "platform": "IOS",
      "buildNumbers": ["42"],
      "updateIds": ["abc-def-...", "..."],
      "metrics": {
        "expo.app_startup.tti": { "median": 0.45, "p90": 0.9, "...": "..." }
      }
    }
  ],
  "totalEventCounts": {
    "expo.app_startup.tti": { "IOS": 1234, "ANDROID": 890 }
  }
}
```

## `eas observe:events`

Shows individual performance events, paginated. The metric is a positional argument, not a flag. If omitted and running interactively, prompts for selection; in non-interactive mode it throws an error.

```bash
# Interactive: prompts for metric
eas observe:events

# Specify metric as positional arg
eas observe:events tti

# Filter by version or update, sort by slowest
eas observe:events tti --app-version 1.2.0 --sort slowest --limit 20

# Pagination — pass the endCursor from the previous run
eas observe:events tti --after <cursor>
```

**Event-specific flags:**
- `--sort <oldest|newest|slowest|fastest>` — defaults to `oldest`
- `--limit <N>` — events per page (default 10, max 100)
- `--after <cursor>` — pagination cursor from the previous run
- `--app-version <version>` — filter by app version string
- `--update-id <id>` — filter by EAS update ID

**Table layout:**
- Summary header shows the metric name, time range, and total event count across all versions (e.g. `TTI events for the last 60 days — 1,234 total events`)
- Columns: Value, App Version (with build number), Update (only when any event has one), Platform, Device, Country, Timestamp
- When `hasNextPage` is true, prints `Next page: --after <endCursor>` hint below the table
- JSON output also includes `sessionId`, `easClientId`, and a `customParams` object per event

## `eas observe:logs`

Shows custom events (logs) emitted by the app via the `expo-observe` API. Behavior depends on what is passed:

| Invocation | Result |
|---|---|
| `observe:logs` | Summary table of available event names with counts |
| `observe:logs --all-events` | Full list of events across **all** event names |
| `observe:logs <event-name>` | Full list of events filtered by that event name |

```bash
# List the available custom event names and their counts (last 60 days)
eas observe:logs

# All events across all names, last 7 days, iOS only
eas observe:logs --all-events --days 7 --platform ios

# Only events with the given name
eas observe:logs login_failed --limit 50

# Drill into a single session
eas observe:logs --all-events --session-id <session-id>

# Pagination
eas observe:logs login_failed --after <cursor>
```

**Logs-specific flags:**
- `--all-events` — when no event name argument is given, list all events instead of the name summary. Cannot be combined with an event name argument.
- `--session-id <id>` — filter to events from a single session (logs only)
- `--app-version <version>` — filter by app version string
- `--update-id <id>` — filter by EAS update ID
- `--limit <N>` — events per page (default 10, max 100)
- `--after <cursor>` — pagination cursor

**Table layout (event listings):**
- Summary header: `<event-name> events <time range>` or `Custom events <time range>` for `--all-events`, with a total event count when available
- Columns: Timestamp, Event (only when listing across multiple names), Severity (only when at least one event in the page has a severity), App Version (with build number), Platform, Device, Country
- `Next page: --after <endCursor>` hint below the table when there is a next page

**Empty-result helper:** if a specific event name is queried and returns no events, the command prints a yellow `No events found matching "<name>"` warning followed by the available event names + counts in the same time range — useful for fixing typos.

**Truncation note:** the event-names summary may flag `Result is truncated; not all event names are shown.` when there are more names than the server returns in a single response.

**JSON output shape (event listing):**
```json
{
  "events": [
    {
      "id": "...",
      "eventName": "login_failed",
      "timestamp": "2026-...",
      "sessionId": "...",
      "severityNumber": 13,
      "severityText": "WARN",
      "properties": [{ "key": "reason", "value": "bad_password", "type": "string" }],
      "appVersion": "1.2.0",
      "appBuildNumber": "42",
      "appUpdateId": null,
      "appEasBuildId": null,
      "deviceModel": "...",
      "deviceOs": "iOS",
      "deviceOsVersion": "17.4",
      "countryCode": "US",
      "environment": "production",
      "easClientId": "..."
    }
  ],
  "pageInfo": { "hasNextPage": true, "endCursor": "..." }
}
```

The name-summary mode returns `{ "names": [{ "eventName": "...", "count": 123 }], "isTruncated": false }`.

## `eas observe:versions`

Shows app version hierarchy with build numbers, OTA update IDs, and event counts per version.

```bash
# Both platforms, last 60 days
eas observe:versions

# iOS only, last 14 days
eas observe:versions --days 14 --platform ios
```

No metric-related flags. Output shows separate iOS and Android tables with columns: **App Version, First Seen, Events, Users, Builds (count), Updates (count)**.

JSON output returns the full nested hierarchy with `buildNumbers[].easBuilds[]` and `updates[].easBuilds[]`, including `firstSeenAt`, `eventCount`, and `uniqueUserCount` at every level.

## Common Workflows

**"What are my app's startup times right now?"**
```bash
eas observe:metrics --days 7 --stat median --stat p90
```

**"Which events were slowest this week?"**
```bash
eas observe:events tti --sort slowest --days 7 --limit 20
```

**"What custom events is my app emitting?"**
```bash
eas observe:logs --days 7
```

**"Show me every error log from one user's session."**
```bash
eas observe:logs --all-events --session-id <session-id>
```

**"What versions of my app are in the field?"**
```bash
eas observe:versions
```

**"Show me metrics for a specific project without needing to be in the repo"**
```bash
eas observe:metrics --project-id <uuid> --metric tti
```

**"Get JSON for scripting"**
```bash
eas observe:metrics --metric tti --json --non-interactive
```

## Notes

- These commands are currently hidden (not shown in top-level `eas --help`). They are considered preview features and their output format may change.
- Requires the user to be logged in (`eas login`).
- When `--project-id` is provided, the command does not require running inside an EAS project directory; otherwise the project ID is read from the local `app.config` / `app.json`.
- `observe:metrics` does not print update IDs in the table but still returns them in JSON for scripting or piping into other commands.
