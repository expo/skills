# Update-group field notes

These notes describe known `eas update:insights <group-id> --json` output, not a
versioned schema guarantee. Check the installed command's help, actual returned
JSON, and [CLI source](https://github.com/expo/eas-cli/tree/main/packages/eas-cli/src/commands/update)
when a parser depends on a field. Do not invent absent values or silently treat an
unknown response shape as zero activity.

| Field | How to use it |
|---|---|
| `groupId`, `timespan` | Confirm the requested group and observation window. |
| `platforms[].platform`, `.updateId` | Keep platform-specific update IDs distinct from the publish group ID. |
| `platforms[].totals.uniqueUsers` | Report the service's unique-user count for this cohort; do not sum it across platforms as deduplicated people. |
| `.totals.installs`, `.failedInstalls` | Preserve raw delivery/recovery metric names. CLI launch/crash labels do not establish complete session or crash counts. Check current service semantics and reporting delay. |
| `.totals.crashRatePercent` | Report alongside numerator/denominator counts and the service definition. A returned zero with no observations is inconclusive. |
| `.payload.launchAssetCount`, `.averageUpdatePayloadBytes` | Asset count and average update payload, not necessarily the entire native app/download size. |
| `.daily[]` | Time-series buckets; verify dates, gaps, and scope before comparing periods. |

`update:view --insights --json` has used an object containing `updates` and
`insights`, unlike a plain `update:view` response. Inspect the actual wrapper before
extracting data. Missing platform entries or delayed recovery reports should appear
as limitations in the assessment, not proof of health.
