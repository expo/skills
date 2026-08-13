#!/usr/bin/env bash
# Exercises scripts/check-plugin-version-bump.ts so a reviewer can verify the
# --help and --set-version options without hand-running each case.
#
# Usage: bash scripts/test-plugin-version-bump.sh
#
# The --set-version cases write to the three plugin manifests. This script backs
# them up first and restores them on exit, so any uncommitted edits you already
# had in those files survive a run (including a failed one).
#
# Every case compares against HEAD rather than origin/main, so the script works
# in a clone that has never fetched the remote.

set -euo pipefail

SCRIPT="scripts/check-plugin-version-bump.ts"
MANIFESTS=(
  "plugins/expo/.claude-plugin/plugin.json"
  "plugins/expo/.codex-plugin/plugin.json"
  "plugins/expo/.cursor-plugin/plugin.json"
)

cd "$(dirname "$0")/.."

backup_dir="$(mktemp -d)"
trap 'for manifest in "${MANIFESTS[@]}"; do cp "$backup_dir/$(basename "$(dirname "$manifest")").json" "$manifest"; done; rm -rf "$backup_dir"' EXIT

for manifest in "${MANIFESTS[@]}"; do
  cp "$manifest" "$backup_dir/$(basename "$(dirname "$manifest")").json"
done

passed=0
failed=0

# Runs the script and checks its exit code and stdout+stderr against
# expectations. Usage: expect <name> <exit-code> <substring> [args...]
expect() {
  local name="$1" expected_code="$2" expected_text="$3"
  shift 3

  local output actual_code=0
  output="$(bun "$SCRIPT" "$@" 2>&1)" || actual_code=$?

  if [ "$actual_code" -ne "$expected_code" ]; then
    printf 'FAIL %s\n     expected exit %s, got %s\n' "$name" "$expected_code" "$actual_code"
    failed=$((failed + 1))
    return
  fi

  if [ -n "$expected_text" ] && [[ "$output" != *"$expected_text"* ]]; then
    printf 'FAIL %s\n     output did not contain: %s\n' "$name" "$expected_text"
    failed=$((failed + 1))
    return
  fi

  printf 'ok   %s\n' "$name"
  passed=$((passed + 1))
}

version_of() {
  grep -m1 '"version"' "$1" | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/'
}

# The base-ref version, not the working-tree one: it is what the script compares
# against, so the cases stay correct even when a manifest has local edits.
base_version_of() {
  git show "HEAD:$1" | grep -m1 '"version"' | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/'
}

current="$(base_version_of "${MANIFESTS[0]}")"
next="$(echo "$current" | awk -F. '{ print $1 "." $2 "." $3 + 1 }')"
later="$(echo "$current" | awk -F. '{ print $1 "." $2 "." $3 + 2 }')"

echo "Current version: $current — test bump targets: $next, $later"
echo

echo "# help"
expect "--help prints usage" 0 "Usage: bun scripts/check-plugin-version-bump.ts" --help
expect "-h prints usage" 0 "--set-version <ver>" -h
expect "help lists the manifests" 0 "plugins/expo/.cursor-plugin/plugin.json" --help

echo
echo "# argument errors"
expect "unknown option is rejected" 1 "Unknown option: --bogus" --bogus
expect "extra positional is rejected" 1 "Unexpected argument: extra" HEAD extra
expect "--set-version without a value" 1 "requires a version argument" --set-version
expect "--set-version= without a value" 1 "requires a version argument" --set-version=

echo
echo "# semver validation"
expect "two-part version" 1 "not a valid semver version" HEAD --set-version 1.9
expect "v-prefixed version" 1 "not a valid semver version" HEAD --set-version "v$next"
expect "four-part version" 1 "not a valid semver version" HEAD --set-version 1.2.3.4
expect "leading-zero version" 1 "not a valid semver version" HEAD --set-version 01.2.3
expect "trailing-dot version" 1 "not a valid semver version" HEAD --set-version "$next."

echo
echo "# base-ref comparison"
expect "same version as base is rejected" 1 "is not greater than" HEAD --set-version "$current"
expect "lower version is rejected" 1 "is not greater than" HEAD --set-version 0.0.1

backup_of() {
  echo "$backup_dir/$(basename "$(dirname "$1")").json"
}

echo
echo "# no manifest was written by a rejected case"
untouched=0
for manifest in "${MANIFESTS[@]}"; do
  cmp -s "$manifest" "$(backup_of "$manifest")" && untouched=$((untouched + 1))
done
if [ "$untouched" -eq "${#MANIFESTS[@]}" ]; then
  printf 'ok   rejected cases left the manifests untouched\n'
  passed=$((passed + 1))
else
  printf 'FAIL a rejected case modified a manifest\n'
  failed=$((failed + 1))
fi

echo
echo "# writing"
expect "bump is accepted" 0 "All three plugin manifests are now at $next" HEAD --set-version "$next"

written=0
for manifest in "${MANIFESTS[@]}"; do
  [ "$(version_of "$manifest")" = "$next" ] && written=$((written + 1))
done
if [ "$written" -eq "${#MANIFESTS[@]}" ]; then
  printf 'ok   all three manifests are at %s\n' "$next"
  passed=$((passed + 1))
else
  printf 'FAIL only %s of %s manifests were written\n' "$written" "${#MANIFESTS[@]}"
  failed=$((failed + 1))
fi

one_line_edits=0
for manifest in "${MANIFESTS[@]}"; do
  changed="$(diff "$(backup_of "$manifest")" "$manifest" | grep -c '^[<>]' || true)"
  [ "$changed" -eq 2 ] && one_line_edits=$((one_line_edits + 1))
done
if [ "$one_line_edits" -eq "${#MANIFESTS[@]}" ]; then
  printf 'ok   each manifest changed exactly one line\n'
  passed=$((passed + 1))
else
  printf 'FAIL only %s of %s manifests changed exactly one line\n' "$one_line_edits" "${#MANIFESTS[@]}"
  failed=$((failed + 1))
fi

expect "re-running the same version is a no-op" 0 "Unchanged Claude: already $next" HEAD --set-version "$next"
expect "--set-version= form is accepted" 0 "All three plugin manifests are now at $later" HEAD "--set-version=$later"

echo
echo "# the check itself still runs"
check_code=0
check_output="$(bun "$SCRIPT" HEAD 2>&1)" || check_code=$?
if [ "$check_code" -le 1 ] && [[ "$check_output" == *"## Expo plugin version check"* ]]; then
  printf 'ok   check against HEAD produced a report (exit %s)\n' "$check_code"
  passed=$((passed + 1))
else
  printf 'FAIL check against HEAD did not produce a report (exit %s)\n' "$check_code"
  failed=$((failed + 1))
fi

echo
printf '%s passed, %s failed\n' "$passed" "$failed"
[ "$failed" -eq 0 ]
