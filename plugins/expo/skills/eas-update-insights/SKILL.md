---
name: eas-update-insights
description: "EAS service (paid). Check the health of published EAS Update: crash rates, install/launch counts, unique users, payload size, and the split between embedded and OTA users per channel. Use when the user asks how an update is performing, whether a rollout is healthy, how many users are on the embedded build vs OTA, or wants to gate CI on update health."
version: 1.0.0
license: MIT
allowed-tools: "Bash(eas *)"
---

# EAS Update Insights

> **EAS service - costs apply.** Insights cover updates published through EAS Update, a paid Expo Application Services product with free-tier limits. Update delivery and the data behind these commands count against your plan's EAS Update usage. Review https://expo.dev/pricing.

Query the health of published EAS Update directly from the CLI: launches, failed launches, crash rates, unique users, payload size, the embedded-vs-OTA user split per channel, and the most popular updates per runtime version. The data is the same data that powers the update and channel detail pages on expo.dev; these commands expose it in the terminal in human and JSON form.

> **Adjacent docs:** https://docs.expo.dev/eas-update/eas-cli/ covers branch/channel CLI workflows. The insights commands themselves have no docs page — `--help` on each command is the authoritative reference.

## When to use this skill

Use this when the user wants to assess the health or adoption of a published EAS Update: crash rates, install counts, unique users, bundle size, or the split between embedded and OTA users on a channel.

Example prompts:

- "How is the latest update doing?"
- "Is the latest update healthy?"
- "Is the new release crashing more than the last one?"
- "How many users are on the latest update vs the embedded build?"
- "Which update is most popular on production right now?"
- "How big is our update bundle?"

Also fits: post-publish rollout monitoring and regression detection.

Don't use when the user needs per-user crash detail or device-level reporting; this skill only exposes aggregate EAS metrics.

## Prerequisites

- `eas-cli` installed (`npm install -g eas-cli`).
- Logged in: `eas login`.
- For `channel:insights`: run from an Expo project directory (the command resolves the project ID from `app.json`). `update:insights` only needs a login.

## Commands

Four entry commands, all supporting `--json --non-interactive` for programmatic parsing. Run `--help` on each for the current flag surface — flags vary by installed eas-cli version.

- `eas update:list` — discover recent update groups, their `group` IDs, and branch names.
- `eas update:insights <groupId>` — per-platform launches, failed launches, crash rate, unique users, payload size, daily breakdown.
- `eas update:view <groupId> --insights` — update group details with the same metrics appended.
- `eas channel:insights --channel <name> --runtime-version <version>` — embedded/OTA user counts and most popular updates for a channel + runtime.

Flag traps (everything else is in `--help`):

- **`update:list` prompts for a branch selection** unless you pass `--branch <name>` or `--all` — when scripting, always pass one of them plus `--json --non-interactive`.
- `--days <N>` (default 7) is mutually exclusive with the explicit `--start <iso-date>` / `--end <iso-date>` range.
- `channel:insights` requires both `--channel` and `--runtime-version`, and the runtime version must match exactly what was published — check `runtimeVersion` values in `update:list` output.
- `update:view`: the `--days` / `--start` / `--end` flags only apply when `--insights` is set; passing them alone errors. Without `--insights`, `update:view` behaves exactly as before — no JSON shape change for existing consumers.
- `--json` implies `--non-interactive`, but passing both is explicit and scripting-friendly.

## Discovering IDs

Before querying insights for an update group, you need its `group` ID:

```bash
# Latest group id across all branches
eas update:list --all --json --non-interactive | jq -r '.currentPage[0].group'

# Latest group id on a specific branch
eas update:list --branch production --json --non-interactive | jq -r '.currentPage[0].group'
```

JSON semantics: `currentPage[]` has one entry per update group — both platforms of the same publish are collapsed into a single entry. `codeSigningKey` and `rolloutPercentage` appear only when those features are in use for the group (undefined values are omitted from the output). With `--branch <name>`, the response also includes the branch `name` and `id` at the top level.

## `eas update:insights <groupId>`

Shows launches, failed launches, crash rate, unique users, launch asset count, and average payload size for a single update group, broken down **per platform** (iOS, Android), plus a daily breakdown of launches and failures. `--platform <ios|android>` filters to one platform. Field semantics: [references/update-insights-schema.md](./references/update-insights-schema.md).

Fields that matter for health assessment:

- `platforms[].totals.crashRatePercent`, computed as `failedInstalls / (installs + failedInstalls) * 100`. Zero when there are no installs.
- `platforms[].totals.installs` and `uniqueUsers` give the adoption signal.
- `platforms[].daily` is a time series, useful for spotting a sudden spike in failures.

### Errors

- `Could not find any updates with group ID: "<id>"` — group doesn't exist or you lack access.
- `Update group "<id>" has no ios update (available platforms: android)` — `--platform ios` was used but the group wasn't published for iOS.
- `EAS Update insights is not supported by this version of eas-cli. Please upgrade ...` — the server deprecated a field the CLI relies on. Run `npm install -g eas-cli@latest`.

## `eas channel:insights --channel <name> --runtime-version <version>`

Shows, per channel, how many users are on the embedded build vs over-the-air updates and which updates are pulling the most traffic. Must be run from an Expo project directory. Field semantics: [references/channel-insights-schema.md](./references/channel-insights-schema.md).

Fields that matter:

- `embeddedUpdateTotalUniqueUsers` is the count of users running the embedded (binary-bundled) build.
- `mostPopularUpdates[]` is updates ranked by `totalUniqueUsers`. **Caveat**: this is the top-N the server returns; `otaTotalUniqueUsers` is a sum of that list and may undercount total OTA reach if more than top-N updates are active.
- `uniqueUsersOverTime` and `cumulativeMetricsOverTime` are daily data series for charting.

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

- Dates in `daily[].date` are UTC ISO timestamps; the human-readable table renders them as `YYYY-MM-DD` (UTC).
- The CLI table labels say "Launches" / "Crashes" while JSON uses `installs` / `failedInstalls`. Same field, different display name.

## Limitations

- **Unique users across platforms** may double-count users who run the same publish on both iOS and Android. The same caveat applies to `otaTotalUniqueUsers` in channel insights, which is a sum over `mostPopularUpdates`.
- **Fresh publishes** may show zeros for a short period while the metrics pipeline catches up.
- **Installs are downloads, not launches**: the `installs` / "Launches" field counts users who downloaded the manifest and launch asset. A confirmed run only registers on the user's *next* update check (typically up to 24h later, depending on the app's update policy). So metrics lag the real-world state slightly.
- **Crashes are self-reported**: `failedInstalls` / "Crashes" counts updates that errored during install/launch and were reported on the next update check. Crashes that don't trigger an update request (e.g. process kill before recovery) won't appear.

## Submitting Feedback
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes submit-expo-feedback@latest --category skills --subject "eas-update-insights" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
If an AI agent repeatedly failed or the user had to take over an Expo task, load the expo-skill-feedback skill and follow its eval-candidate flow instead of reusing the command above.
