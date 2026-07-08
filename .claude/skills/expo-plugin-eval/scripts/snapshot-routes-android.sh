#!/usr/bin/env bash
# Run an Expo app on an Android emulator and screenshot EVERY route by
# deep-linking to each one in turn. Metro is booted ONCE and reused.
#
# Usage: snapshot-routes-android.sh <project-path> <out-dir> [port] [routes-csv] [settle]
#   out-dir     Directory for per-route screenshots: <out-dir>/<slug>.png.
#               The Metro log is written to <out-dir>/metro.log.
#   routes-csv  Comma-separated route paths, e.g. "/,/recipe/1,/settings"
#               (default "/"; list "/" first).
#   settle      Seconds after the FIRST (cold) route paints (default 8).
#
# Env: EXPO_SKILL_EVAL_RUNNER = expo-go (default) | dev-build
#      EXPO_SKILL_EVAL_NAV_SETTLE = settle after each later route (default 5)
set -uo pipefail

PROJECT_PATH="${1:?usage: snapshot-routes-android.sh <project-path> <out-dir> [port] [routes-csv] [settle]}"
OUT_DIR="${2:?usage: snapshot-routes-android.sh <project-path> <out-dir> [port] [routes-csv] [settle]}"
PORT="${3:-8082}"
ROUTES_CSV="${4:-/}"
SETTLE="${5:-8}"
NAV_SETTLE="${EXPO_SKILL_EVAL_NAV_SETTLE:-5}"
RUNNER="${EXPO_SKILL_EVAL_RUNNER:-expo-go}"

log_step() { echo "[$(date '+%H:%M:%S')] [snapshot-routes-android] STEP: $*" >&2; }
EMULATOR_PID=""
emulator_alive() { [[ -n "$EMULATOR_PID" ]] && kill -0 "$EMULATOR_PID" 2>/dev/null; }

# See snapshot-android.sh: host GPU (Metal) by default; switch to "guest" if the
# emulator self-aborts under load. Avoid swiftshader_indirect (hangs on arm64).
# Overridable via env for CI (a headless x86_64 Linux worker needs software
# rendering, e.g. swiftshader_indirect, which is fine off arm64).
GPU_MODE="${EXPO_SKILL_EVAL_GPU:-host}"

if [[ "$RUNNER" == "dev-build" ]]; then
  BUNDLE_TIMEOUT="${EXPO_SKILL_EVAL_BUNDLE_TIMEOUT:-900}"
else
  BUNDLE_TIMEOUT="${EXPO_SKILL_EVAL_BUNDLE_TIMEOUT:-240}"
fi
LOG="$OUT_DIR/metro.log"

mkdir -p "$OUT_DIR"

slug() {
  local r="${1#/}"
  r="${r//\//-}"
  r="${r%-}"
  [[ -z "$r" ]] && r="index"
  echo "$r"
}

SCHEME="$(node -e "try{var a=require('$PROJECT_PATH/app.json');console.log((a.expo&&a.expo.scheme)||'exposkilleval')}catch(e){console.log('exposkilleval')}" 2>/dev/null || echo 'exposkilleval')"
APP_SLUG="$(node -e "try{var a=require('$PROJECT_PATH/app.json');console.log((a.expo&&(a.expo.slug||a.expo.name))||'fixture')}catch(e){console.log('fixture')}" 2>/dev/null || echo 'fixture')"
# expo-dev-client launcher scheme; loading via it connects the dev client to
# Metro (a bare `am start .MainActivity` only shows the launcher's search screen).
DEV_SCHEME="exp+${APP_SLUG}"

deeplink() {
  local route="$1"
  if [[ "$RUNNER" == "dev-build" ]]; then
    if [[ "$route" == "/" ]]; then
      echo "${DEV_SCHEME}://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A${PORT}"
    else
      echo "${SCHEME}://${route#/}"
    fi
  else
    echo "exp://127.0.0.1:$PORT/--/${route#/}"
  fi
}

lsof -ti "tcp:$PORT" -sTCP:LISTEN 2>/dev/null | xargs kill -9 2>/dev/null || true

find_sdk_tool() {
  local tool="$1" subdir="$2"
  if command -v "$tool" >/dev/null; then command -v "$tool"; return; fi
  local sdk
  for sdk in "${ANDROID_HOME:-}" "${ANDROID_SDK_ROOT:-}" "$HOME/Library/Android/sdk" "$HOME/Android/Sdk"; do
    if [[ -n "$sdk" && -x "$sdk/$subdir/$tool" ]]; then echo "$sdk/$subdir/$tool"; return; fi
  done
  return 1
}

ADB="$(find_sdk_tool adb platform-tools)" || { echo "error: adb not found (set ANDROID_HOME)" >&2; exit 1; }

# Recycle a wedged/offline emulator before the boot check (see snapshot-android.sh).
STALE="$("$ADB" devices | awk 'NR>1 && $1 ~ /^emulator-/ && $2!="device" {print $1}')"
if [[ -n "$STALE" ]]; then
  echo "recycling wedged emulator(s): $STALE" >&2
  for serial in $STALE; do "$ADB" -s "$serial" emu kill 2>/dev/null || true; done
  sleep 2
  if "$ADB" devices | awk 'NR>1 && $1 ~ /^emulator-/ && $2!="device"' | grep -q .; then
    pkill -9 -f qemu-system-aarch64 2>/dev/null || true
    "$ADB" kill-server 2>/dev/null || true; "$ADB" start-server 2>/dev/null || true; sleep 2
  fi
fi

CURRENT_GPU="$(ps aux | grep qemu-system-aarch64 | grep -v grep | grep -o -- '-gpu [a-z_]*' | awk '{print $2}' | head -1)"
if [[ -n "$CURRENT_GPU" && "$CURRENT_GPU" != "$GPU_MODE" ]]; then
  echo "GPU mismatch: running=$CURRENT_GPU required=$GPU_MODE — recycling emulator" >&2
  "$ADB" emu kill 2>/dev/null || true; sleep 2
  pkill -9 -f qemu-system-aarch64 2>/dev/null || true
  "$ADB" kill-server 2>/dev/null || true; "$ADB" start-server 2>/dev/null || true; sleep 2
fi

if ! "$ADB" devices | awk 'NR>1 && $2=="device"' | grep -q .; then
  EMULATOR="$(find_sdk_tool emulator emulator)" || { echo "error: no device attached and emulator binary not found" >&2; exit 1; }
  AVD="$("$EMULATOR" -list-avds | head -1)"
  if [[ -z "$AVD" ]]; then echo "error: no AVDs configured" >&2; exit 1; fi
  log_step "resetting adb server before cold boot"
  "$ADB" kill-server 2>/dev/null || true; "$ADB" start-server 2>/dev/null || true; sleep 1
  log_step "booting emulator avd=$AVD gpu=$GPU_MODE"
  nohup "$EMULATOR" -avd "$AVD" -no-boot-anim -gpu "$GPU_MODE" -no-snapshot </dev/null >/dev/null 2>&1 &
  disown
  EMULATOR_PID="$(pgrep -f "emulator.*-avd $AVD" | head -1)"
  "$ADB" wait-for-device
  until [[ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; do
    if [[ -n "$EMULATOR_PID" ]] && ! kill -0 "$EMULATOR_PID" 2>/dev/null; then
      echo "error: emulator pid=$EMULATOR_PID crashed during boot" >&2; exit 1
    fi
    sleep 2
  done
  log_step "emulator fully booted"
else
  EMULATOR_PID="$(pgrep -f qemu-system-aarch64 | head -1)"
  log_step "reusing running emulator pid=${EMULATOR_PID:-unknown}"
fi

if [[ "$RUNNER" == "dev-build" ]]; then
  (cd "$PROJECT_PATH" && exec env -u CI REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1 bunx expo run:android --port "$PORT") </dev/null >"$LOG" 2>&1 &
else
  # --go forces Expo Go even though the fixture has expo-dev-client installed
  # (without it, `expo start` prefers the dev client and fails with no dev build).
  (cd "$PROJECT_PATH" && exec env -u CI REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1 bunx expo start --port "$PORT" --android --go) </dev/null >"$LOG" 2>&1 &
fi
METRO_PID=$!
cleanup() {
  kill "$METRO_PID" 2>/dev/null
  lsof -ti "tcp:$PORT" -sTCP:LISTEN 2>/dev/null | xargs kill -9 2>/dev/null || true
  wait "$METRO_PID" 2>/dev/null
}
trap cleanup EXIT

APP_PKG="$(node -e "try{var a=require('$PROJECT_PATH/app.json');console.log((a.expo&&a.expo.android&&a.expo.android.package)||'com.exposkilleval.fixture')}catch(e){console.log('com.exposkilleval.fixture')}" 2>/dev/null || echo 'com.exposkilleval.fixture')"

DEADLINE=$((SECONDS + BUNDLE_TIMEOUT))
STATUS=0

log_step "waiting for Metro on port=$PORT"
until curl -sf "http://localhost:$PORT/status" >/dev/null; do
  if ! kill -0 "$METRO_PID" 2>/dev/null; then echo "error: Metro exited before coming up" >&2; tail -40 "$LOG" >&2; exit 1; fi
  if emulator_alive; then : ; elif [[ -n "$EMULATOR_PID" ]]; then echo "error: emulator crashed while waiting for Metro" >&2; exit 1; fi
  if ((SECONDS > DEADLINE)); then echo "error: timed out waiting for Metro" >&2; tail -40 "$LOG" >&2; exit 1; fi
  sleep 2
done

if [[ "$RUNNER" != "dev-build" ]]; then
  log_step "waiting for Expo Go install on device"
  until "$ADB" shell pm list packages 2>/dev/null | grep -q host.exp.exponent; do
    if ((SECONDS > DEADLINE)); then echo "error: Expo Go was not installed" >&2; tail -40 "$LOG" >&2; exit 1; fi
    sleep 2
  done
fi

log_step "setting up adb reverse tunnel port=$PORT"
"$ADB" reverse "tcp:$PORT" "tcp:$PORT"

# Stop any stale experience/app so the first deep link starts clean.
if [[ "$RUNNER" == "dev-build" ]]; then
  "$ADB" shell am force-stop "$APP_PKG" 2>/dev/null || true
else
  "$ADB" shell am force-stop host.exp.exponent 2>/dev/null || true
fi
sleep 2

# Routes come from a model-emitted routes.json. `adb shell am start -d "$URL"`
# forwards its args to the device's shell, which re-parses them, so a route
# containing shell metacharacters would be interpreted guest-side. Real Expo
# Router paths only use these characters — reject anything else.
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
  log_step "route $route -> $SLUG.png  ($URL)"

  # VIEW intent for every route: for dev build, "/" is the dev-launcher URL
  # (loads the app from Metro) and other routes are app-scheme deep links. (Was a
  # bare `am start .MainActivity` for "/", which only showed the launcher.)
  "$ADB" shell am start -W -a android.intent.action.VIEW -d "$URL" >/dev/null 2>&1 || true

  if [[ "$FIRST" == "1" ]]; then
    until grep -q 'Bundled' "$LOG"; do
      if ! kill -0 "$METRO_PID" 2>/dev/null; then echo "error: Metro exited before bundling" >&2; tail -40 "$LOG" >&2; STATUS=1; break; fi
      if emulator_alive; then : ; elif [[ -n "$EMULATOR_PID" ]]; then echo "error: emulator crashed while bundling" >&2; STATUS=1; break; fi
      if ((SECONDS > DEADLINE)); then echo "error: timed out waiting for bundle" >&2; tail -40 "$LOG" >&2; STATUS=1; break; fi
      sleep 2
    done
    sleep "$SETTLE"
    FIRST=0
  else
    sleep "$NAV_SETTLE"
  fi

  "$ADB" exec-out screencap -p >"$OUT" || STATUS=1
  if [[ -s "$OUT" ]]; then
    sips -Z "${EXPO_SKILL_EVAL_MAX_DIM:-600}" "$OUT" >/dev/null 2>&1 || true
  fi
  log_step "screenshot: $OUT"
done

echo "metro log: $LOG"
exit "$STATUS"
