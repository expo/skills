#!/usr/bin/env bash
# Prints "true" or "false" for whether the given bundle dir is a valid,
# matching cache restore. Never exits non-zero itself -- the caller always
# gets a clean true/false to set-output regardless of which way the
# validate-result-bundle.py verify call went (missing dir, bad manifest,
# fingerprint mismatch, or a genuine hit all collapse to a plain boolean
# here).
#
# Usage: check-cache-hit.sh <bundle-dir> <expected-fingerprint>
set -u

BUNDLE_DIR="$1"
FINGERPRINT="$2"

if python3 scripts/validate-result-bundle.py verify --bundle-dir "$BUNDLE_DIR" --expect-fingerprint "$FINGERPRINT" >/dev/null 2>&1; then
  echo true
else
  echo false
fi
