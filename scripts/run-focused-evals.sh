#!/usr/bin/env bash
# EAS entrypoint. No model execution belongs in local development checks.
set -euo pipefail

[ "${SKILL_EVAL_REMOTE:-}" = 1 ] && [ -n "${CI:-}" ] || {
  echo "Submit .eas/workflows/skill-eval-focused.yml to run agents on EAS."
  exit 1
}

# Fetch our public baseline before the private-submodule credential rewrite.
git fetch origin main
baseline_root="$(mktemp -d)"
trap 'rm -rf "$baseline_root"' EXIT
git archive origin/main plugins/expo | tar -x -C "$baseline_root"
bash scripts/ci.sh fetch_eval_harness
bash scripts/ci.sh install_harness_deps
# Pin the runtime for both sides. The focused manifest also records --version.
export AGENT_CLI_VERSION="${AGENT_CLI_VERSION:-2.1.267}"
npm install -g "@anthropic-ai/claude-code@$AGENT_CLI_VERSION"

focused_cli=eval-harness/eval_harness/evaluator/skill_invocation/focused/main.ts
out="$(pwd)/focused-skill-eval"
mkdir -p "$out"
case_args=()
if [ "${FOCUSED_CASE:-pilot}" != all ]; then
  case_args=(--case "${FOCUSED_CASE:-pilot}")
fi

run_side() {
  local plugin="$1" destination="$2" skill_mode="${3:-with-expo}"
  # The explicit branch supports macOS Bash 3.2 as well as EAS Linux.
  if [ "${#case_args[@]}" -gt 0 ]; then
    bun "$focused_cli" run --plugin "$plugin" --out "$destination" \
      --model 'sonnet[1m]' --skill-mode "$skill_mode" --split "${FOCUSED_SPLIT:-development}" \
      --repetitions "${FOCUSED_REPETITIONS:-3}" "${case_args[@]}"
  else
    bun "$focused_cli" run --plugin "$plugin" --out "$destination" \
      --model 'sonnet[1m]' --skill-mode "$skill_mode" --split "${FOCUSED_SPLIT:-development}" \
      --repetitions "${FOCUSED_REPETITIONS:-3}"
  fi
}

if [ "${FOCUSED_EXPERIMENT:-catalog-value}" = catalog-value ]; then
  # One catalog, alternating presence/absence conditions inside each repetition.
  run_side "$(pwd)/plugins/expo" "$out" both
  exit $?
fi
[ "$FOCUSED_EXPERIMENT" = catalog-change ] || { echo "Unknown experiment" >&2; exit 2; }

main_status=0
candidate_status=0
run_side "$baseline_root/plugins/expo" "$out/main" || main_status=$?
run_side "$(pwd)/plugins/expo" "$out/candidate" || candidate_status=$?
if [ -f "$out/main/metrics.json" ] && [ -f "$out/candidate/metrics.json" ]; then
  bun "$focused_cli" compare --baseline "$out/main/metrics.json" \
    --candidate "$out/candidate/metrics.json" --out "$out"
fi
[ "$main_status" = 0 ] && [ "$candidate_status" = 0 ]
