#!/usr/bin/env bash
# Produces OUT_DIR/metrics.json -- either by copying a cache hit or by
# running eval-skill-use.sh against a downloaded authored-app artifact --
# then prints the resulting fields as shell assignments for the caller to
# `eval` before set-output-ing each one. Combines what were ~15 lines of
# inline branching + parsing per PRD/side into one script call, for
# skill-eval-ci.yml's eval_skill_<prd>_<main|pr> jobs.
#
# Usage: evaluate-and-print.sh <cache_hit> <cached-bundle-dir> <authored-artifact> <out-dir> <scenario>
#   cached-bundle-dir and authored-artifact: only the one matching
#   cache_hit ("true" -> cached-bundle-dir, "false" -> authored-artifact) is
#   actually used; pass a placeholder for the other (e.g. "-").
set -euo pipefail

CACHE_HIT="$1"
CACHED_DIR="$2"
AUTHORED_ARTIFACT="$3"
OUT_DIR="$4"
SCENARIO="$5"

if [ "$CACHE_HIT" = "true" ]; then
  cp -r "$CACHED_DIR" "$OUT_DIR"
else
  AUTHORED_ARTIFACT="$AUTHORED_ARTIFACT" \
  SCENARIO="$SCENARIO" \
  OUT_DIR="$OUT_DIR" \
  PRD_SKILLS="$(pwd)/eval-harness/dataset/prd_skills.json" \
  CASE_DIR="$(pwd)/eval-harness/eval_harness/evaluator/skill_invocation/skill_cases" \
  bash ./eval-harness/eval_harness/evaluator/skill_invocation/scripts/eval-skill-use.sh
fi

python3 scripts/print-skill-eval-outputs.py "$OUT_DIR/metrics.json"
