# Querying Observe

Read [the CLI reference](https://docs.expo.dev/eas/observe/eas-cli/) or the installed
command's `--help` for exact flags and supported metrics. Use the existing CLI if
compatible; no global installation is required merely to read metrics.

## Choose the question before the command

| Question | Command family |
| --- | --- |
| Which version regressed? | `observe:metrics-summary` |
| Which individual samples are slow? | `observe:metrics` |
| Which routes regressed? | `observe:routes` |
| What custom events occurred? | `observe:events` |
| What surrounded one slow sample? | `observe:session` using its session ID |
| Which builds/updates contributed? | `observe:versions` |

Specify the intended project and time window; use `--project-id` where supported
to query an existing project without creating a new local one. Keep platform and
version cohorts comparable. Prefer JSON for aggregation and record the actual
response shape before writing a parser. Plan-gate errors are unavailable features,
not evidence that a flag or metric name should be guessed repeatedly.

## Non-obvious CLI/output differences

These observations came from `eas-cli` 21.8.0; confirm against current help and
returned JSON before relying on them in automation. They are retained because
a general command catalog does not explain the parsing mistakes they prevent.

- Navigation aliases use `nav_cold_ttr`, `nav_warm_ttr`, and `nav_tti`. Metric
  selection differs between positional arguments and `--metric` options; don't
  assume every command accepts the same alias, full name, or stat abbreviation.
- `metrics-summary` can omit update IDs in its human table while returning them
  in JSON. It aggregates per version; use a command with update filtering for an
  update-specific investigation rather than pretending the table is that cohort.
- Sample/event listings paginate. Routes have per-platform pagination
  (`pageInfoByPlatform`), so one platform's exhausted cursor does not establish
  completeness for both. Session output instead exposes truncation flags such as
  `hasMoreMetricEvents`/`hasMoreLogEvents`, with no continuation cursor in that version.
- A known session ID and interactive picker filters are different modes. In
  noninteractive use, discover a sample's `sessionId` first and query that session
  directly; do not combine an ID with picker-only time/sort filters.
- Event-name summary and event listings have different shapes. `observe:events`
  summarizes names; a selected name or `--all-events` lists events. A truncated
  name summary cannot establish that an event type never exists.

Finish with measured results and their cohort/window/coverage. Missing data,
partial pages, and absent instrumentation remain limitations. Route analysis
questions to [interpretation guidance](./metrics.md); do not enable new telemetry
just to answer a read-only question.
