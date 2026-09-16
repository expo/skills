# Channel field notes

Use actual `eas channel:insights --channel <name> --runtime-version <version> --json`
output and [CLI source](https://github.com/expo/eas-cli/tree/main/packages/eas-cli/src/commands/channel)
for the installed command contract. The following are known field names and
interpretation traps, not a complete versioned schema.

- `channel`, `runtimeVersion`, `timespan`: confirm all three match the requested cohort. An empty result for one runtime does not characterize the whole channel.
- `embeddedUpdateTotalUniqueUsers`: the service's embedded-update user count within this scope.
- `mostPopularUpdates[]`: ranked update/group/platform entries with `totalUniqueUsers`. Check the number of entries and whether the server truncates this list.
- `otaTotalUniqueUsers`: has been computed as a sum over `mostPopularUpdates`. Verify that behavior before calculating adoption; a top-N sum may omit active updates, and overlapping users may be counted more than once.
- `uniqueUsersOverTime`, `cumulativeMetricsOverTime`: chart-shaped labels/datasets. Align date buckets and distinguish interval values from cumulative values before comparing or summing them.
- `cumulativeMetricsAtLastTimestamp`: labeled endpoint totals. Do not guess meanings from array position or assume a missing series is zero.

Report embedded and OTA values with their actual counting scope. Without proof of
coverage and deduplication, their sum is not a unique-user population denominator.
Zero/empty data can reflect filters, delayed reporting, or absent observations;
confirm before claiming that every user remains on the embedded build.
