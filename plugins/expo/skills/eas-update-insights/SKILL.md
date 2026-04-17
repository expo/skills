---
name: eas-update-insights
description: How to check EAS Update health, crash rates, adoption metrics, and rollout status using the CLI. Covers eas update:insights and eas channel:insights with JSON output for programmatic use.
version: 1.0.0
license: MIT
allowed-tools: "Bash(eas *)"
---

# EAS Update Insights

Query the health of published EAS Updates directly from the CLI: launches, failed launches, crash rates, unique users, payload size, channel adoption, and the most popular updates per runtime version.

## When to use this skill

- "How is the update I just published doing?"
- "What's the crash rate of update group X?"
- "How many users are on the latest update vs the embedded build?"
- "Which update is most popular on production right now?"
- "Compare adoption between production and staging channels."
- Post-publish rollout monitoring, regression detection, and CI pipelines that gate on update health.

The data is the same data that powers the update and channel detail pages on expo.dev; these commands expose it in the terminal in human and JSON form.

## Prerequisites

- `eas-cli` installed (`npm install -g eas-cli`).
- Logged in: `eas login`.
- For `channel:insights`: run from an Expo project directory (the command resolves the project ID from `app.json`). `update:insights` only needs a login.

## Commands at a glance

| Command | Purpose |
|---|---|
| `eas update:list` | Discover recent update groups, their `group` IDs, and branch names |
| `eas update:insights <groupId>` | Per-platform launches, failed launches, crash rate, unique users, payload size, daily breakdown |
| `eas update:view <groupId> --insights` | Update group details + the same metrics appended |
| `eas channel:insights --channel <name> --runtime-version <version>` | Embedded/OTA user counts, most popular updates, cumulative metrics for a channel + runtime |

All of these support `--json --non-interactive` for programmatic parsing.

## Discovering IDs

Before querying insights for an update group, you need its `group` ID. Use `eas update:list`. The command needs either `--branch <name>` (updates on that branch) or `--all` (updates across all branches):

```bash
# Interactive: pick a branch, see its recent groups
eas update:list

# Programmatic: latest group id across all branches
eas update:list --all --json --non-interactive | jq -r '.currentPage[0].group'

# Programmatic: latest group id on a specific branch
eas update:list --branch production --json --non-interactive | jq -r '.currentPage[0].group'
```

The JSON response has a `currentPage` array with one entry per update group (both platforms of the same publish are collapsed into one entry):

```json
{
  "currentPage": [
    {
      "branch": "production",
      "message": "\"Fix checkout crash\" (1 week ago by someone)",
      "runtimeVersion": "1.0.6",
      "group": "03d5dfcf-736c-475a-8730-af039c3f4d06",
      "platforms": "android, ios",
      "isRollBackToEmbedded": false
    }
  ]
}
```

When called with `--branch <name>`, the response also includes `name` (the branch name) and `id` (the branch ID) at the top level.

## `eas update:insights <groupId>`

Shows launches, failed launches, crash rate, unique users, launch asset count, and average payload size for a single update group, broken down **per platform** (iOS, Android), plus a daily breakdown of launches and failures.

### Basic use

```bash
eas update:insights 03d5dfcf-736c-475a-8730-af039c3f4d06
```

### Flags

| Flag | Description |
|---|---|
| `--days <N>` | Look back N days. Default: **7**. Mutually exclusive with `--start`/`--end`. |
| `--start <iso-date>` / `--end <iso-date>` | Explicit time range, e.g. `--start 2026-04-01 --end 2026-04-15`. |
| `--platform <ios\|android>` | Filter to a single platform. Omit to see all platforms in the group. |
| `--json` | Machine-readable output. Implies `--non-interactive`. |
| `--non-interactive` | Required when scripting. |

### JSON output shape

```json
{
  "groupId": "03d5dfcf-736c-475a-8730-af039c3f4d06",
  "timespan": {
    "start": "2026-04-10T00:00:00.000Z",
    "end": "2026-04-17T00:00:00.000Z",
    "daysBack": 7
  },
  "platforms": [
    {
      "platform": "android",
      "updateId": "019d72ca-...",
      "totals": {
        "uniqueUsers": 500,
        "installs": 990,
        "failedInstalls": 10,
        "crashRatePercent": 1.0
      },
      "payload": {
        "launchAssetCount": 4,
        "averageUpdatePayloadBytes": 1115771
      },
      "daily": [
        { "date": "2026-04-10T00:00:00.000Z", "installs": 182, "failedInstalls": 2 },
        { "date": "2026-04-11T00:00:00.000Z", "installs": 195, "failedInstalls": 1 }
      ]
    },
    {
      "platform": "ios",
      "updateId": "019d72ca-...",
      "totals": { "uniqueUsers": 100, "installs": 1, "failedInstalls": 0, "crashRatePercent": 0 },
      "payload": { "launchAssetCount": 4, "averageUpdatePayloadBytes": 1115771 },
      "daily": [ { "date": "2026-04-10T00:00:00.000Z", "installs": 1, "failedInstalls": 0 } ]
    }
  ]
}
```

Fields that matter for health assessment:

- `platforms[].totals.crashRatePercent` — computed as `failedInstalls / (installs + failedInstalls) * 100`. Zero when there are no installs.
- `platforms[].totals.installs` / `uniqueUsers` — adoption signal.
- `platforms[].daily` — time series, useful for spotting a sudden spike in failures.

### Errors

- `Could not find any updates with group ID: "<id>"` — group doesn't exist or you lack access.
- `Update group "<id>" has no ios update (available platforms: android)` — `--platform ios` was used but the group wasn't published for iOS.
- `EAS Update insights is not supported by this version of eas-cli. Please upgrade ...` — the server deprecated a field the CLI relies on. Run `npm install -g eas-cli@latest`.

## `eas update:view <groupId> --insights`

Extends the standard `update:view` output with the same per-platform insights, inline.

```bash
# Human-readable
eas update:view 03d5dfcf-... --insights
eas update:view 03d5dfcf-... --insights --days 30

# JSON: wrapped as { updates: [...], insights: {...} }
eas update:view 03d5dfcf-... --json --insights
```

Without `--insights`, `update:view` behaves exactly as before — no JSON shape change for existing consumers. The `--days` / `--start` / `--end` flags only apply when `--insights` is set; passing them alone errors.

## `eas channel:insights --channel <name> --runtime-version <version>`

Channel-level adoption view: how many users are on the embedded build vs over-the-air updates, and which updates are pulling the most traffic. Must be run from an Expo project directory.

### Basic use

```bash
eas channel:insights --channel production --runtime-version 1.0.6
```

### Flags

| Flag | Description |
|---|---|
| `--channel <name>` | **Required.** The channel name (e.g. `production`, `staging`). |
| `--runtime-version <version>` | **Required.** Match exactly what was published. Check `runtimeVersion` values in `update:list`. |
| `--days <N>` | Look back N days. Default: **7**. |
| `--start` / `--end` | Explicit time range, like `update:insights`. |
| `--json` / `--non-interactive` | Machine-readable output. |

### JSON output shape

```json
{
  "channel": "production",
  "runtimeVersion": "1.0.6",
  "timespan": { "start": "...", "end": "...", "daysBack": 7 },
  "embeddedUpdateTotalUniqueUsers": 2401,
  "otaTotalUniqueUsers": 8312,
  "mostPopularUpdates": [
    {
      "rank": 1,
      "groupId": "abc123",
      "message": "Fix checkout crash",
      "platform": "ios",
      "totalUniqueUsers": 4210
    }
  ],
  "cumulativeMetricsAtLastTimestamp": [
    { "id": "...", "label": "Embedded update", "data": 12345 },
    { "id": "...", "label": "Embedded update failed installs", "data": 0 }
  ],
  "uniqueUsersOverTime": { "labels": ["..."], "datasets": [ { "id": "...", "label": "...", "data": [100, 200] } ] },
  "cumulativeMetricsOverTime": { "labels": ["..."], "datasets": [ { "id": "...", "label": "...", "data": [10, 20] } ] }
}
```

Fields that matter:

- `embeddedUpdateTotalUniqueUsers` — users running the embedded (binary-bundled) build.
- `mostPopularUpdates[]` — updates ranked by `totalUniqueUsers`. **Caveat**: this is the top-N the server returns; `otaTotalUniqueUsers` is a sum of that list and may undercount total OTA reach if more than top-N updates are active.
- `uniqueUsersOverTime`, `cumulativeMetricsOverTime` — daily data series for charting.

### Errors

- `Could not find channel with the name <name>` — typo or wrong account.
- "No update launches recorded" in the table / empty `mostPopularUpdates` in JSON — no OTA update has been launched for that channel + runtime yet. Usually means the channel is still serving the embedded build only.

## Common workflows

### Verify the update I just published is healthy

```bash
# 1. Grab the latest publish on production
GROUP_ID=$(eas update:list --branch production --json --non-interactive \
  | jq -r '.currentPage[0].group')

# 2. Give it some adoption time (minutes to hours), then check crash rate
eas update:insights "$GROUP_ID" --json --non-interactive \
  | jq '.platforms[] | {platform, installs: .totals.installs, crashRate: .totals.crashRatePercent}'
```

Compare the `crashRate` across platforms and against previous releases; sudden spikes or asymmetric behaviour (iOS spiking while Android is flat, or vice versa) is the signal to investigate.

### Compare adoption between two channels

```bash
for channel in production staging; do
  echo "--- $channel ---"
  eas channel:insights --channel "$channel" --runtime-version 1.0.6 --json --non-interactive \
    | jq '{
        channel,
        embedded: .embeddedUpdateTotalUniqueUsers,
        ota: .otaTotalUniqueUsers,
        topUpdate: .mostPopularUpdates[0]
      }'
done
```

### Detect a rollout regression in the last 24 hours

```bash
eas update:insights "$GROUP_ID" --days 1 --json --non-interactive \
  | jq '.platforms[] | select(.totals.crashRatePercent > 1)'
```

### Summarize group metrics for release notes

```bash
eas update:view "$GROUP_ID" --insights --days 30
```

Human-readable group details plus 30 days of launches/failures per platform — suitable for pasting into a changelog or incident review.

## Output tips

- Pipe JSON through `jq`; payloads are structured for easy filtering.
- `--json` implies `--non-interactive`, but passing both is explicit and scripting-friendly.
- Dates in `daily[].date` are UTC ISO timestamps; the human-readable table renders them as `YYYY-MM-DD` (UTC).
- The CLI table labels say "Launches" / "Crashes" while JSON uses `installs` / `failedInstalls`. Same field, different display name.

## Limitations

- **Web updates**: `--platform` accepts only `ios` or `android`. If a group has a web update, it will appear in the default (all-platforms) output but can't be filtered via `--platform`.
- **Unique users across platforms** may double-count users who run the same publish on both iOS and Android. The same caveat applies to `otaTotalUniqueUsers` in channel insights, which is a sum over `mostPopularUpdates`.
- **Fresh publishes** may show zeros for a short period while the metrics pipeline catches up.
- **Installs are downloads, not launches**: the `installs` / "Launches" field counts users who downloaded the manifest and launch asset. A confirmed run only registers on the user's *next* update check (typically up to 24h later, depending on the app's update policy). So metrics lag the real-world state slightly.
- **Crashes are self-reported**: `failedInstalls` / "Crashes" counts updates that errored during install/launch and were reported on the next update check. Crashes that don't trigger an update request (e.g. process kill before recovery) won't appear.
