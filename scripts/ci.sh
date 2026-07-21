#!/usr/bin/env bash
# Consolidated shell CI helper for skill-eval-ci.yml and
# skill-eval-main-baseline.yml. One file, one function per responsibility,
# called via `bash scripts/ci.sh <function> [args...]` -- see scripts/ci.py
# for the Python-side counterpart these two workflows also depend on.
#
# Deliberately does NOT set -e/-u/pipefail at the top level: author_and_evaluate
# needs to tolerate a failing author-app.sh (see its own comment below), so
# functions that DO need strict-failure semantics wrap their own body in a
# `(set -euo pipefail; ...)` subshell instead of relying on a global option.

# Configures the (private, token-scoped) eval-harness submodule fetch and
# initializes it. Called by every function below that needs eval-harness.
fetch_eval_harness() {
  (
    set -euo pipefail
    git config --global url."https://x-access-token:${EVAL_HARNESS_ACCESS_TOKEN}@github.com/".insteadOf "https://github.com/"
    git submodule update --init eval-harness
  )
}

# Extracts main's skill content (or uses the current checkout directly),
# fetches eval-harness, and prints the fingerprint JSON for it.
#
# Usage: fingerprint_main_content extract|checkout
#   extract:  git-archive origin/main's plugins/expo into /tmp/plugins-main
#             (for PR-side jobs, checked out on the PR's own commit).
#   checkout: use $(pwd)/plugins/expo directly (skill-eval-main-baseline.yml,
#             already checked out on main).
#
# Requires PRD, PRD_ID, SCENARIO, AGENT, AGENT_MODEL, EVAL_HARNESS_ACCESS_TOKEN
# in env (already set as job env vars / repo secrets).
fingerprint_main_content() {
  (
    set -euo pipefail
    local mode="$1"
    local skill_dir

    if [ "$mode" = "extract" ]; then
      # Must run before fetch_eval_harness's url.insteadOf rewrite: this
      # fetch is against THIS repo (origin) and needs eas/checkout's own
      # working credentials, not the EVAL_HARNESS_ACCESS_TOKEN rewrite
      # installed for the unrelated, private eval-harness submodule fetch.
      git fetch origin main
      mkdir -p /tmp/plugins-main
      git archive origin/main plugins/expo | tar -x -C /tmp/plugins-main
      skill_dir="/tmp/plugins-main/plugins/expo"
    elif [ "$mode" = "checkout" ]; then
      skill_dir="$(pwd)/plugins/expo"
    else
      echo "usage: fingerprint_main_content extract|checkout" >&2
      exit 2
    fi

    fetch_eval_harness

    python3 scripts/ci.py fingerprint \
      --skill-dir "$skill_dir" \
      --harness-dir eval-harness \
      --prd "eval-harness/${PRD}" \
      --prd-skills eval-harness/dataset/prd_skills.json \
      --prd-id "${PRD_ID}" \
      --scenario "${SCENARIO}" \
      --agent "${AGENT}" \
      --model "${AGENT_MODEL:-sonnet}"
  )
}

# Prints "true" or "false" for whether the given bundle dir is a valid,
# matching cache restore. Never exits non-zero itself -- the caller always
# gets a clean true/false regardless of which way the underlying verify
# call went (missing dir, bad manifest, fingerprint mismatch, or a genuine
# hit all collapse to a plain boolean here).
#
# Usage: check_cache_hit <bundle-dir> <expected-fingerprint>
check_cache_hit() {
  local bundle_dir="$1"
  local fingerprint="$2"
  if python3 scripts/ci.py bundle verify --bundle-dir "$bundle_dir" --expect-fingerprint "$fingerprint" >/dev/null 2>&1; then
    echo true
  else
    echo false
  fi
}

# Produces OUT_DIR/metrics.json for skill-eval-ci.yml's combined
# author+evaluate job: either copies a cache hit, or authors and evaluates
# directly in this job's own workspace (no tar/artifact round-trip --
# eval-skill-use.sh's --authored-artifact accepts a plain directory, so
# authoring and evaluating in the same job needs no packaging step at all).
# Then prints the parsed fields as shell assignments for the caller to
# `eval` before set-output-ing each one.
#
# Tolerates an author-app.sh or eval-skill-use.sh failure (no `set -e`) so
# the PR comment still shows *something* (ci.py print-outputs' own "no
# report"/"?" fallbacks) rather than the job aborting silently.
# author_and_evaluate_baseline is the strict sibling used by
# skill-eval-main-baseline.yml, where a failed baseline must never be
# cached or promoted.
#
# Usage: author_and_evaluate <cache_hit> <cached-dir> <plugin-dir> <out-dir> <scenario> <tarball>
#   cached-dir: only used when cache_hit is "true"; pass "-" otherwise.
#   tarball: also packages OUT_DIR into this path, so the caller doesn't
#     need a separate "Package skill-eval report" step.
author_and_evaluate() {
  local cache_hit="$1"
  local cached_dir="$2"
  local plugin_dir="$3"
  local out_dir="$4"
  local scenario="$5"
  local tarball="$6"

  if [ "$cache_hit" = "true" ]; then
    cp -r "$cached_dir" "$out_dir"
  else
    fetch_eval_harness

    export SKILL_PLUGIN_DIR="$plugin_dir"
    bash ./eval-harness/eval_harness/app_builder/scripts/author-app.sh

    AUTHORED_ARTIFACT="$(pwd)/eval-harness" \
    SCENARIO="$scenario" \
    OUT_DIR="$out_dir" \
    PRD_SKILLS="$(pwd)/eval-harness/dataset/prd_skills.json" \
    CASE_DIR="$(pwd)/eval-harness/eval_harness/evaluator/skill_invocation/skill_cases" \
    bash ./eval-harness/eval_harness/evaluator/skill_invocation/scripts/eval-skill-use.sh
  fi

  tar -czf "$tarball" "$out_dir" 2>/dev/null || true
  python3 scripts/ci.py print-outputs "$out_dir/metrics.json"
}

# Runs author-app.sh then eval-skill-use.sh directly into OUT_DIR -- no
# tarball round-trip needed, since skill-eval-main-baseline.yml evaluates in
# the same job workspace it just authored in.
#
# Unlike author_and_evaluate, this DOES NOT tolerate an author-app.sh
# failure: if authoring fails, this fails, and every downstream step
# (manifest write, cache save, artifact upload) correctly gets skipped
# rather than caching a failed or incomplete baseline.
#
# Usage: author_and_evaluate_baseline <plugin-dir> <out-dir> <scenario>
author_and_evaluate_baseline() {
  (
    set -euo pipefail
    local plugin_dir="$1"
    local out_dir="$2"
    local scenario="$3"

    export SKILL_PLUGIN_DIR="$plugin_dir"
    bash ./eval-harness/eval_harness/app_builder/scripts/author-app.sh

    AUTHORED_ARTIFACT="$(pwd)/eval-harness" \
    SCENARIO="$scenario" \
    OUT_DIR="$out_dir" \
    PRD_SKILLS="$(pwd)/eval-harness/dataset/prd_skills.json" \
    CASE_DIR="$(pwd)/eval-harness/eval_harness/evaluator/skill_invocation/skill_cases" \
    bash ./eval-harness/eval_harness/evaluator/skill_invocation/scripts/eval-skill-use.sh
  )
}

"$@"
