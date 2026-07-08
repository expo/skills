#!/usr/bin/env bash
# Run an Expo app on an iOS simulator and screenshot EVERY route by deep-linking
# to each one in turn. Metro is booted ONCE and reused across all routes.
#
# Usage: snapshot-routes-ios.sh <project-path> <out-dir> [port] [routes-csv] [settle]
#   out-dir     Directory for per-route screenshots: <out-dir>/<slug>.png.
#               The Metro log is written to <out-dir>/metro.log.
#   routes-csv  Comma-separated route paths, e.g. "/,/recipe/1,/settings".
#               Defaults to "/" (root only). "/" should be listed first.
#   settle      Seconds to wait after the FIRST (cold) route paints (default 8).
#
# Env:
#   EXPO_SKILL_EVAL_RUNNER = expo-go (default) | dev-build
#   EXPO_SKILL_EVAL_NAV_SETTLE = seconds to settle after each subsequent route
#     navigation (default 5 — the bundle is warm, only a transition is needed).
#
# Deep links: expo-go uses exp://127.0.0.1:<port>/--/<route>; dev-build uses the
# app's <scheme>://<route>. On the iOS Simulator a custom-scheme openurl can
# raise an "Open in <app>?" dialog on first use, so multi-route capture under
# dev-build is best-effort; Expo Go is the fully-supported path.
set -uo pipefail

PROJECT_PATH="${1:?usage: snapshot-routes-ios.sh <project-path> <out-dir> [port] [routes-csv] [settle]}"
OUT_DIR="${2:?usage: snapshot-routes-ios.sh <project-path> <out-dir> [port] [routes-csv] [settle]}"
PORT="${3:-8081}"
ROUTES_CSV="${4:-/}"
SETTLE="${5:-8}"
NAV_SETTLE="${EXPO_SKILL_EVAL_NAV_SETTLE:-5}"
RUNNER="${EXPO_SKILL_EVAL_RUNNER:-expo-go}"
if [[ "$RUNNER" == "dev-build" ]]; then
  BUNDLE_TIMEOUT="${EXPO_SKILL_EVAL_BUNDLE_TIMEOUT:-900}"
else
  BUNDLE_TIMEOUT="${EXPO_SKILL_EVAL_BUNDLE_TIMEOUT:-240}"
fi
LOG="$OUT_DIR/metro.log"

mkdir -p "$OUT_DIR"

# slug: "/" -> index, "/recipe/1" -> recipe-1, "/settings" -> settings
slug() {
  local r="${1#/}"
  r="${r//\//-}"
  r="${r%-}"
  [[ -z "$r" ]] && r="index"
  echo "$r"
}

SCHEME="$(node -e "try{var a=require('$PROJECT_PATH/app.json');console.log((a.expo&&a.expo.scheme)||'exposkilleval')}catch(e){console.log('exposkilleval')}" 2>/dev/null || echo 'exposkilleval')"
BUNDLE_ID="$(node -e "try{var a=require('$PROJECT_PATH/app.json');console.log((a.expo&&a.expo.ios&&a.expo.ios.bundleIdentifier)||'com.exposkilleval.fixture')}catch(e){console.log('com.exposkilleval.fixture')}" 2>/dev/null || echo 'com.exposkilleval.fixture')"

deeplink() {
  local route="$1"
  if [[ "$RUNNER" == "dev-build" ]]; then
    echo "${SCHEME}://${route#/}"
  else
    echo "exp://127.0.0.1:$PORT/--/${route#/}"
  fi
}

# Free the port up front so `expo start` binds the port we expect.
lsof -ti "tcp:$PORT" -sTCP:LISTEN 2>/dev/null | xargs kill -9 2>/dev/null || true

if ! xcrun simctl list devices booted | grep -q '(Booted)'; then
  UDID="$(xcrun simctl list devices available | grep 'iPhone' | tail -1 | grep -oE '[0-9A-F-]{36}')"
  if [[ -z "$UDID" ]]; then
    echo "error: no available iPhone simulator found" >&2
    exit 1
  fi
  echo "booting simulator $UDID..." >&2
  xcrun simctl boot "$UDID"
  open -a Simulator
  xcrun simctl bootstatus "$UDID"
fi

if [[ "$RUNNER" == "dev-build" ]]; then
  (cd "$PROJECT_PATH" && exec env -u CI bunx expo run:ios --port "$PORT") </dev/null >"$LOG" 2>&1 &
else
  # --go forces Expo Go even though the fixture has expo-dev-client installed
  # (without it, `expo start` prefers the dev client and fails with no dev build).
  (cd "$PROJECT_PATH" && exec env -u CI REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1 bunx expo start --port "$PORT" --ios --go) </dev/null >"$LOG" 2>&1 &
fi
METRO_PID=$!
cleanup() {
  kill "$METRO_PID" 2>/dev/null
  lsof -ti "tcp:$PORT" -sTCP:LISTEN 2>/dev/null | xargs kill -9 2>/dev/null || true
  wait "$METRO_PID" 2>/dev/null
}
trap cleanup EXIT

DEADLINE=$((SECONDS + BUNDLE_TIMEOUT))
STATUS=0

until curl -sf "http://localhost:$PORT/status" >/dev/null; do
  if ! kill -0 "$METRO_PID" 2>/dev/null || ((SECONDS > DEADLINE)); then
    echo "error: Metro did not come up. Log tail:" >&2
    tail -40 "$LOG" >&2
    exit 1
  fi
  sleep 2
done

# expo-go: wait for Expo Go to install, then start from a clean slate.
if [[ "$RUNNER" != "dev-build" ]]; then
  until xcrun simctl get_app_container booted host.exp.Exponent >/dev/null 2>&1; do
    if ((SECONDS > DEADLINE)); then
      echo "error: Expo Go was not installed on the simulator. Log tail:" >&2
      tail -40 "$LOG" >&2
      exit 1
    fi
    sleep 2
  done
  xcrun simctl terminate booted host.exp.Exponent 2>/dev/null || true
  sleep 2
fi

# Routes come from a model-emitted routes.json. Keep the deep link well-formed
# and consistent with the Android guard — real Expo Router paths only use these
# characters; reject anything else before building the URL.
SAFE_ROUTE_RE='^/?[A-Za-z0-9/_.-]*$'
IFS=',' read -ra ROUTES <<<"$ROUTES_CSV"
FIRST=1
for route in "${ROUTES[@]}"; do
  [[ -z "$route" ]] && continue
  if [[ ! "$route" =~ $SAFE_ROUTE_RE ]]; then
    echo "skipping route with unsafe characters: $route" >&2
    continue
  fi
  SLUG="$(slug "$route")"
  OUT="$OUT_DIR/$SLUG.png"
  URL="$(deeplink "$route")"
  echo "[route] $route -> $SLUG.png  ($URL)" >&2

  if [[ "$RUNNER" == "dev-build" && "$FIRST" == "1" && "$route" == "/" ]]; then
    # Relaunch the dev client at root via simctl launch (no "Open in?" dialog).
    xcrun simctl launch --terminate-running-process booted "$BUNDLE_ID" >/dev/null 2>&1 || true
  else
    xcrun simctl openurl booted "$URL" >/dev/null 2>&1 || true
  fi

  if [[ "$FIRST" == "1" ]]; then
    # First route pays the cold-bundle wait.
    until grep -q 'Bundled' "$LOG"; do
      if ! kill -0 "$METRO_PID" 2>/dev/null; then
        echo "error: Metro exited before bundling. Log tail:" >&2
        tail -40 "$LOG" >&2
        STATUS=1
        break
      fi
      if ((SECONDS > DEADLINE)); then
        echo "error: timed out after ${BUNDLE_TIMEOUT}s waiting for bundle. Log tail:" >&2
        tail -40 "$LOG" >&2
        STATUS=1
        break
      fi
      sleep 2
    done
    sleep "$SETTLE"
    FIRST=0
  else
    sleep "$NAV_SETTLE"
  fi

  xcrun simctl io booted screenshot "$OUT" || STATUS=1
  if [[ -f "$OUT" ]]; then
    sips -Z "${EXPO_SKILL_EVAL_MAX_DIM:-600}" "$OUT" >/dev/null 2>&1 || true
  fi
  echo "screenshot: $OUT" >&2
done

echo "metro log: $LOG"
exit "$STATUS"
