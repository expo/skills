#!/usr/bin/env bash
# Runs author-app.sh then eval-skill-use.sh directly into OUT_DIR -- no
# tarball round-trip needed, since skill-eval-main-baseline.yml evaluates in
# the same job workspace it just authored in. Combines what were 2 separate
# YAML steps into one, for skill-eval-main-baseline.yml.
#
# Unlike author-and-evaluate.sh (used by skill-eval-ci.yml, which tolerates
# a failure so the PR comment still shows something), this does NOT
# tolerate an author-app.sh failure: if authoring fails, this script fails,
# and every downstream step (manifest write, cache save, artifact upload)
# correctly gets skipped rather than caching a failed or incomplete
# baseline.
#
# Usage: author-and-evaluate-baseline.sh <plugin-dir> <out-dir> <scenario>
set -euo pipefail

PLUGIN_DIR="$1"
OUT_DIR="$2"
SCENARIO="$3"

export SKILL_PLUGIN_DIR="$PLUGIN_DIR"
bash ./eval-harness/eval_harness/app_builder/scripts/author-app.sh

AUTHORED_ARTIFACT="$(pwd)/eval-harness" \
SCENARIO="$SCENARIO" \
OUT_DIR="$OUT_DIR" \
PRD_SKILLS="$(pwd)/eval-harness/dataset/prd_skills.json" \
CASE_DIR="$(pwd)/eval-harness/eval_harness/evaluator/skill_invocation/skill_cases" \
bash ./eval-harness/eval_harness/evaluator/skill_invocation/scripts/eval-skill-use.sh
