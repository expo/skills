#!/usr/bin/env bash
# Run an Expo app's web target and screenshot EVERY route. The dev server is
# started ONCE; each route is just a URL (http://localhost:<port>/<route>), so
# Playwright navigates and screenshots each in turn.
#
# Usage: snapshot-routes-web.sh <project-path> <out-dir> [port] [routes-csv] [settle]
#   out-dir     <out-dir>/<slug>.png per route; Metro log at <out-dir>/metro.log.
#   routes-csv  Comma-separated routes, e.g. "/,/recipe/1,/settings" (default "/").
#   settle      Seconds to wait for each route to paint (default 8).
set -uo pipefail

PROJECT_PATH="${1:?usage: snapshot-routes-web.sh <project-path> <out-dir> [port] [routes-csv] [settle]}"
OUT_DIR="${2:?usage: snapshot-routes-web.sh <project-path> <out-dir> [port] [routes-csv] [settle]}"
PORT="${3:-8081}"
ROUTES_CSV="${4:-/}"
SETTLE="${5:-8}"
SERVER_TIMEOUT="${EXPO_SKILL_EVAL_BUNDLE_TIMEOUT:-240}"
LOG="$OUT_DIR/metro.log"

mkdir -p "$OUT_DIR"

slug() {
  local r="${1#/}"
  r="${r//\//-}"
  r="${r%-}"
  [[ -z "$r" ]] && r="index"
  echo "$r"
}

lsof -ti "tcp:$PORT" -sTCP:LISTEN 2>/dev/null | xargs kill -9 2>/dev/null || true

bunx playwright install chromium >/dev/null 2>&1 || true

(cd "$PROJECT_PATH" && exec env -u CI bunx expo start --port "$PORT" --web) </dev/null >"$LOG" 2>&1 &
METRO_PID=$!
cleanup() {
  kill "$METRO_PID" 2>/dev/null
  lsof -ti "tcp:$PORT" -sTCP:LISTEN 2>/dev/null | xargs kill -9 2>/dev/null || true
  wait "$METRO_PID" 2>/dev/null
}
trap cleanup EXIT

DEADLINE=$((SECONDS + SERVER_TIMEOUT))
until curl -sf "http://localhost:$PORT" >/dev/null; do
  if ! kill -0 "$METRO_PID" 2>/dev/null || ((SECONDS > DEADLINE)); then
    echo "error: web dev server did not come up. Log tail:" >&2
    tail -40 "$LOG" >&2
    exit 1
  fi
  sleep 2
done

# Routes come from a model-emitted routes.json. Keep the URL well-formed and
# consistent with the Android guard — real Expo Router paths only use these
# characters; reject anything else before building the URL.
SAFE_ROUTE_RE='^/?[A-Za-z0-9/_.-]*$'
IFS=',' read -ra ROUTES <<<"$ROUTES_CSV"
STATUS=0
for route in "${ROUTES[@]}"; do
  [[ -z "$route" ]] && continue
  if [[ ! "$route" =~ $SAFE_ROUTE_RE ]]; then
    echo "skipping route with unsafe characters: $route" >&2
    continue
  fi
  SLUG="$(slug "$route")"
  OUT="$OUT_DIR/$SLUG.png"
  URL="http://localhost:$PORT/${route#/}"
  echo "[route] $route -> $SLUG.png  ($URL)" >&2
  bunx playwright screenshot \
    --browser chromium \
    --viewport-size "390,844" \
    --wait-for-timeout "$((SETTLE * 1000))" \
    "$URL" "$OUT" || STATUS=1
  if [[ -f "$OUT" ]]; then
    sips -Z "${EXPO_SKILL_EVAL_MAX_DIM:-600}" "$OUT" >/dev/null 2>&1 || true
  fi
done

echo "metro log: $LOG"
exit "$STATUS"
