---
name: eas-observe
description: "EAS service (paid). Add or debug expo-observe instrumentation, query startup and navigation performance, interpret Observe metrics, or integrate Observe into a library."
version: 1.1.1
license: MIT
---

# EAS Observe

> **EAS service - costs apply.** Collection and analysis are subject to the project's Observe plan and feature limits. Check [current pricing](https://expo.dev/pricing#plan-features) when cost or access affects the requested work.

Use Observe for app performance instrumentation and analysis. Querying existing
metrics does not require changing app instrumentation; adding startup metrics
does not imply adding every event, error integration, or paid feature.

## Choose the task

- **App instrumentation:** [setup decisions](./references/setup.md) and [current setup docs](https://docs.expo.dev/eas/observe/get-started/).
- **CLI analysis:** [query workflow and output caveats](./references/queries.md).
- **Interpreting a regression:** [analysis guidance](./references/metrics.md).
- **Library integration:** [package-author guidance](./references/third-party.md).

Resolve the installed `expo-observe`/SDK or EAS CLI version before applying API
examples. Use current docs for supported behavior, installed exports/help for the
version in use, and local notes for known pitfalls. Older observations are not
permanent overrides of newer documentation. Read only the relevant source and
reuse evidence already available.

For setup, continue through the requested instrumentation and available runtime
verification. Report code integration separately from successful event dispatch.
For analysis, identify project, time range, version/platform cohort, sample counts,
and data limitations. Keep observed measurements separate from causal hypotheses.

## Submitting Feedback
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
```bash
npx --yes submit-expo-feedback@latest --category skills --subject "eas-observe" "<actionable feedback>"
```
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
If an AI agent repeatedly failed or the user had to take over an Expo task, load the expo-skill-feedback skill and follow its eval-candidate flow instead of reusing the command above.
