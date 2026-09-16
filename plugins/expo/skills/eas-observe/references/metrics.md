# Interpreting Observe results

Read the relevant [metric definition](https://docs.expo.dev/eas/observe/reference/metrics/)
for units, measurement boundaries, automatic attributes, and collection limits.
Use project baselines and requirements rather than treating copied target
thresholds as universal release criteria.

## Compare like with like

Record the time range, platform, app/build/update versions, metric, sample count,
and percentile. Separate cold/warm startup and startup/navigation measurements.
Changes in instrumentation, sampling, device mix, or entry routes can shift the
numbers without a code performance regression. Missing TTI may mean a readiness
marker was never called, not that startup took zero time.

## Form a hypothesis, then seek evidence

- **High TTI with little frame delay:** inspect initialization dependencies,
  network waits, and the chosen ready point. The UI may be waiting without freezing.
- **High TTI with slow/frozen frames:** inspect synchronous work and render/layout
  cost; use a sample's session timeline or a profiler to locate the blocking work.
- **Device/network differences:** stratify by power/thermal state and network
  conditions. Correlation with cellular, offline, or low-power samples does not
  alone prove the network or OS caused the regression.
- **Long time to first byte:** includes connection and server waiting; corroborate
  with endpoint timing before attributing it solely to server processing.
- **Large request-duration totals:** concurrent requests can sum to more than
  wall-clock startup time. Counts/slowest-request summaries may omit unfinished
  requests or be bounded by a buffer; check the metric's documented coverage.

Check dispatch conditions before interpreting absence of events. Debug collection,
sampling, environment labels, offline buffering, and server ingestion are different
parts of the pipeline. [Setup guidance](./setup.md) covers delivery verification;
[query guidance](./queries.md) covers pagination and cohort selection.

Report observations separately from likely causes, and name the next measurement
that would distinguish competing explanations. Do not automatically modify the
app or gate a release based on an arbitrary threshold.
