#!/usr/bin/env bash
# Static gate for a generated Expo app: typecheck, lint, bundle.
#
# Usage: check-static.sh <project-path> [platforms-csv]
#   platforms-csv  Platforms to bundle-check with `expo export`,
#                  e.g. "ios,android" (default) or "ios,android,web".
#
# Prints [PASS]/[FAIL] per gate and exits non-zero if any gate fails.
# A passing export catches most import/syntax/missing-module errors
# without needing a device.
set -uo pipefail

PROJECT_PATH="${1:?usage: check-static.sh <project-path> [platforms-csv]}"
PLATFORMS="${2:-ios,android}"

cd "$PROJECT_PATH"
FAILED=0
LOG_DIR=".eval-static"
mkdir -p "$LOG_DIR"

run_gate() {
  local name="$1"
  shift
  if "$@" >"$LOG_DIR/$name.log" 2>&1; then
    echo "[PASS] $name"
  else
    echo "[FAIL] $name (log: $PROJECT_PATH/$LOG_DIR/$name.log)"
    tail -20 "$LOG_DIR/$name.log" | sed 's/^/        /'
    FAILED=1
  fi
}

run_gate tsc bunx tsc --noEmit

# Lint only files changed since the fixture commit - the pristine template has
# pre-existing lint errors that aren't the executor's fault. Falls back to a
# full `expo lint` when the project isn't a git repo.
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  CHANGED_FILES=()
  while IFS= read -r f; do
    [[ -f "$f" ]] && CHANGED_FILES+=("$f")
  done < <(
    {
      git diff --name-only HEAD -- '*.ts' '*.tsx' '*.js' '*.jsx'
      git ls-files --others --exclude-standard -- '*.ts' '*.tsx' '*.js' '*.jsx'
    } | sort -u
  )
  if ((${#CHANGED_FILES[@]})); then
    run_gate lint env CI=1 bunx eslint "${CHANGED_FILES[@]}"
  else
    echo "[SKIP] lint (no changed JS/TS files)"
  fi
else
  run_gate lint env CI=1 bunx expo lint
fi

EXPORT_ARGS=(export --output-dir "$LOG_DIR/export")
IFS=',' read -ra PLATFORM_LIST <<<"$PLATFORMS"
for p in "${PLATFORM_LIST[@]}"; do
  EXPORT_ARGS+=(--platform "$p")
done

# Run export; on failure, auto-install any unresolved native packages and retry once.
run_export() {
  rm -rf "$LOG_DIR/export"
  env CI=1 bunx expo "${EXPORT_ARGS[@]}" >"$LOG_DIR/export.log" 2>&1
}

EXPORT_EXIT=0
run_export || EXPORT_EXIT=$?

if [[ $EXPORT_EXIT -ne 0 ]]; then
  # Extract npm package names from "Unable to resolve module <pkg>" lines.
  MISSING=$(grep -oE "Unable to resolve module [^[:space:]]+" "$LOG_DIR/export.log" \
    | sed 's/Unable to resolve module //' | sed 's|/.*||' | sort -u || true)
  if [[ -n "$MISSING" ]]; then
    echo "        [auto-install] missing packages: $MISSING"
    # shellcheck disable=SC2086
    bunx expo install $MISSING >/dev/null 2>&1 || true
    EXPORT_EXIT=0
    run_export || EXPORT_EXIT=$?  # one retry
  fi
fi

if [[ $EXPORT_EXIT -eq 0 ]]; then
  echo "[PASS] export"
else
  echo "[FAIL] export (log: $PROJECT_PATH/$LOG_DIR/export.log)"
  tail -5 "$LOG_DIR/export.log" | sed 's/^/        /'
  FAILED=1
fi

exit "$FAILED"
