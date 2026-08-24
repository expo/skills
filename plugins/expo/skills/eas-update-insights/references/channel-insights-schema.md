# `eas channel:insights` field semantics

Fields returned by `eas channel:insights --channel <name> --runtime-version <version> --json --non-interactive`. Run the command once with `--json` to see the literal shape; this file records what the fields mean.

| Path | Meaning |
|---|---|
| `channel` | The channel queried. |
| `runtimeVersion` | The runtime version filter used. Channel insights are always scoped to a single runtime. |
| `timespan.start` / `.end` / `.daysBack` | Window bounds (UTC ISO) and size in days. |
| `embeddedUpdateTotalUniqueUsers` | Distinct users running the embedded (binary-bundled) build in the window. |
| `otaTotalUniqueUsers` | Sum of `totalUniqueUsers` across `mostPopularUpdates`. May undercount if more than top-N updates are active (see caveat below). |
| `mostPopularUpdates[]` | Top-N updates ranked by `totalUniqueUsers`. Each entry has `rank`, `groupId`, `message`, `platform`, `totalUniqueUsers`. |
| `cumulativeMetricsAtLastTimestamp[]` | Snapshot totals at the end of the window, labelled (e.g., "Embedded update", "Embedded update failed installs"). |
| `uniqueUsersOverTime` | Chart-shaped object with `labels` (dates) and `datasets` for plotting unique users over time. |
| `cumulativeMetricsOverTime` | Chart-shaped object for plotting cumulative metrics over time. |

## Caveats

- `otaTotalUniqueUsers` is a sum of `mostPopularUpdates[].totalUniqueUsers`. If more OTA updates are active than the top-N the server returns, this figure undercounts true OTA reach.
- A user running the same publish on both iOS and Android may be counted on each platform. Don't treat `uniqueUsers` as cross-platform-deduped.
