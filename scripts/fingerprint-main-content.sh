#!/usr/bin/env bash
# Extracts main's skill content (or uses the current checkout directly),
# fetches the eval-harness submodule, and prints the fingerprint JSON for
# it. Shared by skill-eval-ci.yml's PR-side "_main" jobs and
# skill-eval-main-baseline.yml's trusted producer so this sequence exists in
# one checked-in file instead of being duplicated inline 6 times across two
# workflow files -- inline duplication of exactly this kind is what tripped
# EAS Workflows' workflow-file-size limit.
#
# Usage: fingerprint-main-content.sh extract|checkout
#   extract:  git-archive origin/main's plugins/expo into /tmp/plugins-main
#             (for PR-side jobs, which are checked out on the PR's own
#             commit and need main's content extracted separately).
#   checkout: use $(pwd)/plugins/expo directly (for skill-eval-main-baseline.yml,
#             which is already checked out on main).
#
# Requires PRD, PRD_ID, SCENARIO, AGENT, AGENT_MODEL, EVAL_HARNESS_ACCESS_TOKEN
# in env (already set as job env vars / repo secrets). Prints the
# fingerprint JSON to stdout.
set -euo pipefail

MODE="$1"

if [ "$MODE" = "extract" ]; then
  # Must run before the eval-harness url.insteadOf rewrite below: this
  # fetch is against THIS repo (origin), and needs eas/checkout's own
  # working credentials, not the EVAL_HARNESS_ACCESS_TOKEN rewrite installed
  # for the unrelated, private eval-harness submodule fetch.
  git fetch origin main
  mkdir -p /tmp/plugins-main
  git archive origin/main plugins/expo | tar -x -C /tmp/plugins-main
  SKILL_DIR="/tmp/plugins-main/plugins/expo"
elif [ "$MODE" = "checkout" ]; then
  SKILL_DIR="$(pwd)/plugins/expo"
else
  echo "usage: fingerprint-main-content.sh extract|checkout" >&2
  exit 2
fi

bash scripts/fetch-eval-harness.sh

python3 scripts/calculate-eval-fingerprint.py \
  --skill-dir "$SKILL_DIR" \
  --harness-dir eval-harness \
  --prd "eval-harness/${PRD}" \
  --prd-skills eval-harness/dataset/prd_skills.json \
  --prd-id "${PRD_ID}" \
  --scenario "${SCENARIO}" \
  --agent "${AGENT}" \
  --model "${AGENT_MODEL:-sonnet}"
