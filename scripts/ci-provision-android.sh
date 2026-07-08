#!/usr/bin/env bash
# Provision an Android emulator with Expo Go for CI machines that ship no AVD
# (EAS linux-*-nested-virtualization workers provide KVM but no AVD/system
# image). Idempotent + best-effort: ensures a system image + AVD exist, boots a
# headless emulator, and installs the SDK-matched Expo Go (host.exp.exponent)
# APK. The snapshot script then reuses the running, provisioned emulator.
#
# Usage: ci-provision-android.sh <sdk>    # <sdk> like "57" or "57.0.0"
# Env:
#   EXPO_SKILL_EVAL_ANDROID_API   API level for the system image (default 34)
#   EXPO_SKILL_EVAL_GPU           emulator -gpu mode (default swiftshader_indirect;
#                                 software rendering is the reliable choice on a
#                                 headless Linux worker)
set -uo pipefail

SDK="${1:?usage: ci-provision-android.sh <sdk>}"
[[ "$SDK" =~ ^[0-9]+$ ]] && SDK="${SDK}.0.0"
API="${EXPO_SKILL_EVAL_ANDROID_API:-34}"
IMAGE="system-images;android-${API};google_apis;x86_64"
AVD_NAME="eval"
GPU="${EXPO_SKILL_EVAL_GPU:-swiftshader_indirect}"

SDK_ROOT="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
find_tool() {
  local name="$1"; shift
  command -v "$name" 2>/dev/null && return 0
  local p
  for p in "$@"; do [[ -x "$p" ]] && { echo "$p"; return 0; }; done
  return 1
}
ADB="$(find_tool adb "$SDK_ROOT/platform-tools/adb")" \
  || { echo "[provision-android] adb not found (set ANDROID_HOME)" >&2; exit 1; }
EMULATOR="$(find_tool emulator "$SDK_ROOT/emulator/emulator")" \
  || { echo "[provision-android] emulator binary not found" >&2; exit 1; }
SDKMANAGER="$(find_tool sdkmanager \
  "$SDK_ROOT/cmdline-tools/latest/bin/sdkmanager" \
  "$SDK_ROOT/cmdline-tools/bin/sdkmanager" \
  "$SDK_ROOT/tools/bin/sdkmanager")" || SDKMANAGER=""
AVDMANAGER="$(find_tool avdmanager \
  "$SDK_ROOT/cmdline-tools/latest/bin/avdmanager" \
  "$SDK_ROOT/cmdline-tools/bin/avdmanager" \
  "$SDK_ROOT/tools/bin/avdmanager")" || AVDMANAGER=""

# Ensure a system image + AVD exist.
if ! "$EMULATOR" -list-avds 2>/dev/null | grep -q .; then
  if [[ -n "$SDKMANAGER" ]]; then
    echo "[provision-android] installing $IMAGE" >&2
    yes | "$SDKMANAGER" --licenses >/dev/null 2>&1 || true
    "$SDKMANAGER" "platform-tools" "emulator" "$IMAGE" >/dev/null 2>&1 || true
  fi
  if [[ -n "$AVDMANAGER" ]]; then
    echo "[provision-android] creating AVD $AVD_NAME" >&2
    echo "no" | "$AVDMANAGER" create avd -n "$AVD_NAME" -k "$IMAGE" --device pixel --force >/dev/null 2>&1 \
      || echo "no" | "$AVDMANAGER" create avd -n "$AVD_NAME" -k "$IMAGE" --force >/dev/null 2>&1 || true
  fi
fi
"$EMULATOR" -list-avds 2>/dev/null | grep -q . \
  || { echo "[provision-android] no AVD available and none could be created" >&2; exit 1; }

# Boot a headless emulator if no device is attached.
if ! "$ADB" devices | awk 'NR>1 && $2=="device"' | grep -q .; then
  AVD="$("$EMULATOR" -list-avds | head -1)"
  echo "[provision-android] booting emulator avd=$AVD gpu=$GPU" >&2
  "$ADB" start-server >/dev/null 2>&1 || true
  nohup "$EMULATOR" -avd "$AVD" -no-boot-anim -no-window -no-audio \
    -gpu "$GPU" -no-snapshot -accel auto </dev/null >/dev/null 2>&1 &
  disown
  "$ADB" wait-for-device
  BOOT_DEADLINE=$((SECONDS + 420))
  until [[ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; do
    ((SECONDS > BOOT_DEADLINE)) && { echo "[provision-android] emulator boot timed out" >&2; exit 1; }
    sleep 3
  done
  echo "[provision-android] emulator booted" >&2
fi

PKG=host.exp.exponent

# Root lets us seed Expo Go's SharedPreferences to disable the dev menu. The
# google_apis system image is rootable (google_apis_playstore is not). `adb root`
# restarts adbd, so the connection drops — wait for it to come back.
"$ADB" root >/dev/null 2>&1 || true
"$ADB" wait-for-device
IS_ROOT=$([ "$("$ADB" shell id -u 2>/dev/null | tr -d '\r')" = "0" ] && echo 1 || echo 0)

if "$ADB" shell pm list packages 2>/dev/null | grep -q "$PKG"; then
  echo "[provision-android] Expo Go already installed" >&2
else
  # Parse the versions API with node (present after nvm), not jq (not guaranteed).
  URL="$(curl -fsSL https://api.expo.dev/v2/versions/latest | node -e \
    'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).data.sdkVersions[process.argv[1]].androidClientUrl||"")}catch(e){}})' \
    "$SDK")"
  if [[ -z "$URL" || "$URL" == "null" ]]; then
    echo "[provision-android] no androidClientUrl for SDK $SDK" >&2
    exit 1
  fi
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  echo "[provision-android] downloading Expo Go APK: $URL" >&2
  curl -fsSL "$URL" -o "$TMP/expo-go.apk"
  "$ADB" install -r "$TMP/expo-go.apk" && echo "[provision-android] installed Expo Go APK" >&2
fi

# Seed Expo Go's SharedPreferences to suppress the dev-menu onboarding + FAB +
# show-at-launch so they don't cover screenshots. Prefs flush from an in-memory
# cache on commit, so the app must be stopped while we write them.
"$ADB" shell am force-stop "$PKG" || true
if [[ "$IS_ROOT" != "1" ]] && "$ADB" shell run-as "$PKG" true 2>&1 | grep -qi "not debuggable"; then
  echo "[provision-android] not root and Expo Go not debuggable — skipping dev-menu disable" >&2
else
  if [[ "$IS_ROOT" == "1" ]]; then "$ADB" shell mkdir -p "/data/data/$PKG/shared_prefs"
  else "$ADB" shell run-as "$PKG" mkdir -p shared_prefs; fi
  write_prefs() {  # XML on stdin -> the app's shared_prefs/<name>
    if [[ "$IS_ROOT" == "1" ]]; then "$ADB" shell "cat > /data/data/$PKG/shared_prefs/$1"
    else "$ADB" shell "run-as $PKG sh -c 'cat > shared_prefs/$1'"; fi
  }
  # Onboarding lives in Expo Go's own store; finished also stops the auto-open.
  write_prefs "$PKG.SharedPreferences.xml" <<'EOF'
<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <boolean name="is_onboarding_finished" value="true" />
</map>
EOF
  # FAB + show-at-launch live in the shared expo-dev-menu store (default true on
  # Android, fires on first launch — seed false).
  write_prefs "expo.modules.devmenu.sharedpreferences.xml" <<'EOF'
<?xml version='1.0' encoding='utf-8' standalone='yes' ?>
<map>
    <boolean name="showFab" value="false" />
    <boolean name="showsAtLaunch" value="false" />
</map>
EOF
  # Root writes land as root:root with the wrong SELinux label — hand them back
  # to the app's uid and relabel, or the app can't read them.
  if [[ "$IS_ROOT" == "1" ]]; then
    OWNER=$("$ADB" shell stat -c '%u:%g' "/data/data/$PKG" | tr -d '\r')
    "$ADB" shell chown -R "$OWNER" "/data/data/$PKG/shared_prefs"
    "$ADB" shell restorecon -R "/data/data/$PKG/shared_prefs"
  fi
  echo "[provision-android] disabled Expo Go dev-menu onboarding + FAB" >&2
fi
