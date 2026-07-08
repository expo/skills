#!/usr/bin/env bash
# Provision an iOS simulator with Expo Go so the Expo Go snapshot path works on
# CI machines that ship no Expo Go (EAS macOS workers). Idempotent + best-effort:
# boots the newest available iPhone simulator if none is booted, then installs
# the SDK-matched Expo Go (bundle id host.exp.Exponent) unless already present.
# The snapshot script then reuses the booted, provisioned simulator.
#
# Usage: ci-provision-ios.sh <sdk>        # <sdk> like "57" or "57.0.0"
set -uo pipefail

SDK="${1:?usage: ci-provision-ios.sh <sdk>}"
[[ "$SDK" =~ ^[0-9]+$ ]] && SDK="${SDK}.0.0"

# Boot the newest available iPhone simulator if none is booted (same selection
# the snapshot script uses, so it reuses this device instead of booting another).
if ! xcrun simctl list devices booted | grep -q '(Booted)'; then
  UDID="$(xcrun simctl list devices available | grep 'iPhone' | tail -1 | grep -oE '[0-9A-F-]{36}')"
  [[ -z "$UDID" ]] && { echo "[provision-ios] no available iPhone simulator" >&2; exit 1; }
  echo "[provision-ios] booting simulator $UDID" >&2
  xcrun simctl boot "$UDID" || true
  xcrun simctl bootstatus "$UDID" || true
fi

if xcrun simctl get_app_container booted host.exp.Exponent >/dev/null 2>&1; then
  echo "[provision-ios] Expo Go already installed" >&2
  exit 0
fi

URL="$(curl -fsSL https://api.expo.dev/v2/versions/latest \
  | jq -r ".data.sdkVersions[\"$SDK\"].iosClientUrl")"
if [[ -z "$URL" || "$URL" == "null" ]]; then
  echo "[provision-ios] no iosClientUrl for SDK $SDK" >&2
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
echo "[provision-ios] downloading Expo Go: $URL" >&2
curl -fsSL "$URL" -o "$TMP/expo-go.tar.gz"
# The iOS client tarball is the .app bundle CONTENTS (Info.plist at the root),
# not a *.app wrapper — extract into a *.app dir and install that.
mkdir -p "$TMP/Exponent.app"
tar -xzf "$TMP/expo-go.tar.gz" -C "$TMP/Exponent.app"
xcrun simctl install booted "$TMP/Exponent.app"
echo "[provision-ios] installed Expo Go (host.exp.Exponent)" >&2
