#!/bin/sh
# Launch a bundled telemetry script with whatever JS runtime is available.
#
# Expo development requires a JS runtime, but it may be Node *or* Bun (and the
# binary may not be named `node`). This picks the first one present and runs the
# script with it. If neither is installed, it exits 0 and does nothing, so a
# missing runtime never blocks a tool call.
#
# Usage: sh run.sh <script.js> [args...]

script="$1"
[ -n "$script" ] || exit 0
shift

if command -v node >/dev/null 2>&1; then exec node "$script" "$@"; fi
if command -v bun  >/dev/null 2>&1; then exec bun  "$script" "$@"; fi

exit 0
