---
name: expo-observe-queries
description: Use when you need to query EAS Observe performance data for an Expo app — app startup metrics like TTI, cold launch, warm launch, TTR, and bundle load time, individual performance events, or app version/build/update hierarchy. Covers the three EAS CLI commands: observe:metrics, observe:events, and observe:versions.
version: 1.0.0
license: MIT
---

# EAS Observe CLI

EAS Observe collects app performance telemetry from Expo apps and exposes it through three hidden EAS CLI commands. All commands are in preview and subject to breaking changes.

## Commands Overview

| Command | Purpose |
|---------|---------|
| `eas observe:metrics` | Per-version statistical aggregates for performance metrics (median, p90, etc.) |
| `eas observe:events` | Individual performance events ordered by metric value or timestamp (paginated) |
| `eas observe:versions` | App version hierarchy with build numbers, OTA update IDs, and event counts |

All three commands share these common flags:

- `--platform ios` or `--platform android` — filter by platform (default: both)
- `--start <ISO date>` and `--end <ISO date>` — explicit time range
- `--days <N>` — show data from the last N days (mutually exclusive with `--start`/`--end`)
- `--project-id <id>` — run against a specific project without needing a project directory
- `--json` — machine-readable output
- `--non-interactive` — fail instead of prompting

Default time range is the last 60 days when none of `--days`, `--start`, `--end` is given.

## Supported Metrics

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
- Update IDs are omitted from the table but included in JSON output

**JSON output shape:**
```json
{
  "versions": [
    {
      "appVersion": "1.2.0",
      "platform": "IOS",
      "buildNumbers": ["42"],
      "updateIds": ["abc-def-..."],
      "metrics": {
        "expo.app_startup.tti": { "median": 0.45, "p90": 0.9, ... }
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

## `eas observe:versions`

Shows app version hierarchy with build numbers, OTA update IDs, and event counts per version.

```bash
# Both platforms, last 60 days
eas observe:versions

# iOS only, last 14 days
eas observe:versions --days 14 --platform ios
```

No metric-related flags. Output shows separate iOS and Android tables with columns: App Version, First Seen, Events, Users, Builds (count), Updates (count).

JSON output returns the full nested hierarchy with `buildNumbers[].easBuilds[]` and `updates[].easBuilds[]`.

## Common Workflows

**"What are my app's startup times right now?"**
```bash
eas observe:metrics --days 7 --stat median --stat p90
```

**"Which events were slowest this week?"**
```bash
eas observe:events tti --sort slowest --days 7 --limit 20
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
