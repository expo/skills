# `eas update:insights` field semantics

Fields returned by `eas update:insights <groupId> --json --non-interactive`. Run the command once with `--json` to see the literal shape; this file records what the fields mean.

| Path | Meaning |
|---|---|
| `groupId` | The update group queried. |
| `timespan.start` / `.end` | UTC ISO timestamps bounding the window. |
| `timespan.daysBack` | Convenience field: size of the window in days. |
| `platforms[]` | One entry per platform the group was published to (`ios`, `android`). |
| `platforms[].updateId` | Platform-specific update ID (distinct from the group ID). |
| `platforms[].totals.uniqueUsers` | Distinct users who ran this update in the window. |
| `platforms[].totals.installs` | Launches / successful installs in the window. |
| `platforms[].totals.failedInstalls` | Crashes / failed installs in the window. |
| `platforms[].totals.crashRatePercent` | `failedInstalls / (installs + failedInstalls) * 100`. Zero when no installs. |
| `platforms[].payload.launchAssetCount` | Number of assets the manifest references. |
| `platforms[].payload.averageUpdatePayloadBytes` | Mean bundle size for the window. |
| `platforms[].daily[]` | Per-day time series of installs and failed installs. |

## Caveats

- The CLI table renders `installs` as "Launches" and `failedInstalls` as "Crashes" — same fields, different display names.
- `eas update:view <groupId> --insights --json` wraps this same insights payload as `{ "updates": [ /* standard update:view entries */ ], "insights": { /* shape above */ } }`.
