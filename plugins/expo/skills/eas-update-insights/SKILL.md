---
name: eas-update-insights
description: "EAS service (paid). Assess a published EAS Update or channel: adoption, failures, payload size, and embedded versus OTA users for a runtime and time window."
version: 1.0.1
license: MIT
allowed-tools: "Bash(eas *)"
---

# Assess EAS Update health

> **EAS service - costs apply.** These metrics concern EAS Update delivery and availability under the project's plan. See [current pricing](https://expo.dev/pricing).

Assess the requested release or channel using aggregate data. This is a read-only
workflow; diagnosing a regression does not itself authorize publishing, republishing,
or rolling back an update. Use `eas-update` if mitigation is requested.

## Identify the cohort before querying

Resolve the project/account, channel-to-branch mapping, update group, runtime,
platform, and time window from the request and publish evidence. A channel called
`production` need not point to a branch called `production`. Do not select the first
update across all branches and call it the production release. Preserve an explicit
group ID or artifact supplied by the user.

Use the available authenticated CLI. Check command help if a flag is unavailable;
a newer CLI can be invoked without installing it globally. If access is missing,
report that limitation and continue any interpretation supported by supplied data.

| Question | Query |
|---|---|
| Which publish is in scope? | `eas update:list --branch <resolved-branch> --json --non-interactive` |
| How is this group performing? | `eas update:insights <group-id> --json --non-interactive` |
| Details and metrics together? | `eas update:view <group-id> --insights --json --non-interactive` |
| Embedded versus OTA on a runtime? | `eas channel:insights --channel <channel> --runtime-version <runtime> --json --non-interactive` |

Set a common time window using the command's supported `--days` or `--start`/`--end`
flags. Inspect pagination and available platforms when discovering groups. Do not
silently substitute another runtime or platform when the requested cohort is empty.

## Interpret the evidence

- Compare failure rates with sample counts and a relevant prior cohort over comparable windows. A fresh update with zero observations is inconclusive, even if the returned rate is zero.
- Separate platforms and runtime versions before drawing conclusions. Distribution of users/devices and update policy can explain apparent adoption or performance differences.
- CLI display labels and raw metric names can differ. `installs`/`failedInstalls` have appeared under launch/crash labels; these are update-delivery/recovery signals, not a complete crash reporter or guaranteed counts of successful sessions. Check current service definitions before asserting those meanings.
- Delivery and failure reporting can lag actual activity and depend on a later update check. Do not promise a universal delay or interpret missing reports as absence of failure.
- Channel totals based on a top-N list can omit active updates; summing unique users across updates/platforms can double-count people. State those limits when computing adoption shares.
- A payload-size increase or failure-rate spike identifies an investigation target, not its cause. Inspect the changed update and correlate with native logs or error reports when available.

Use [group field notes](./references/update-insights-schema.md) or
[channel field notes](./references/channel-insights-schema.md) only when parsing
those outputs. They document known response shapes; inspect actual JSON and
[current EAS CLI reference](https://docs.expo.dev/eas/cli/) before writing a parser
or CI condition that depends on them.

## Deliver the assessment

Include the project/group/channel/runtime, window, counts, baseline, relevant
platform differences, and a conclusion proportional to the evidence. For a CI gate,
use the team's threshold, minimum sample size, and missing-data policy; never turn
an arbitrary example such as a 1% threshold into a production rule.

## Submitting Feedback
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes submit-expo-feedback@latest --category skills --subject "eas-update-insights" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
If an AI agent repeatedly failed or the user had to take over an Expo task, load the expo-skill-feedback skill and follow its eval-candidate flow instead of reusing the command above.
