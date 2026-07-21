#!/usr/bin/env bash
# Produces OUT_DIR/metrics.json for skill-eval-ci.yml's combined
# author+evaluate job: either copies a cache hit, or authors and evaluates
# directly in this job's own workspace (no tar/artifact round-trip --
# eval-skill-use.sh's --authored-artifact accepts a plain directory, so
# authoring and evaluating in the same job needs no packaging step at all).
# Then prints the parsed fields as shell assignments for the caller to
# `eval` before set-output-ing each one.
#
# Tolerates an author-app.sh or eval-skill-use.sh failure (no `set -e`) so
# the PR comment still shows *something* (print-skill-eval-outputs.py's own
# "no report"/"?" fallbacks) rather than the job aborting silently.
# skill-eval-main-baseline.yml intentionally uses a stricter sibling script
# (author-and-evaluate-baseline.sh, `set -euo pipefail`) since a failed
# baseline must never be cached or promoted.
#
# Usage: author-and-evaluate.sh <cache_hit> <cached-dir> <plugin-dir> <out-dir> <scenario> <tarball>
#   cached-dir: only used when cache_hit is "true"; pass "-" otherwise.
#   tarball: also packages OUT_DIR into this path, so the caller's own
#     "Package skill-eval report" step (and its `if: always()`) isn't
#     needed -- one less step per job, which adds up across 6 jobs.

CACHE_HIT="$1"
CACHED_DIR="$2"
PLUGIN_DIR="$3"
OUT_DIR="$4"
SCENARIO="$5"
TARBALL="$6"

if [ "$CACHE_HIT" = "true" ]; then
  cp -r "$CACHED_DIR" "$OUT_DIR"
else
  bash scripts/fetch-eval-harness.sh

  export SKILL_PLUGIN_DIR="$PLUGIN_DIR"
  bash ./eval-harness/eval_harness/app_builder/scripts/author-app.sh

  AUTHORED_ARTIFACT="$(pwd)/eval-harness" \
  SCENARIO="$SCENARIO" \
  OUT_DIR="$OUT_DIR" \
  PRD_SKILLS="$(pwd)/eval-harness/dataset/prd_skills.json" \
  CASE_DIR="$(pwd)/eval-harness/eval_harness/evaluator/skill_invocation/skill_cases" \
  bash ./eval-harness/eval_harness/evaluator/skill_invocation/scripts/eval-skill-use.sh
fi

tar -czf "$TARBALL" "$OUT_DIR" 2>/dev/null || true
python3 scripts/print-skill-eval-outputs.py "$OUT_DIR/metrics.json"
