#!/usr/bin/env bash
# Runs author-app.sh (unless CACHE_HIT is "true") and tars the result,
# printing "true"/"false" for whether a tarball worth uploading was
# produced. Combines what were 2 separate YAML steps (author + package)
# into one script + one step, cutting skill-eval-ci.yml's per-PRD
# boilerplate.
#
# Deliberately does not abort if author-app.sh fails (matching the original
# steps' `if: always()` on packaging, so a partial workspace is still
# available for postmortem debugging) -- but if packaging itself then also
# fails (e.g. because authoring never created the expected directories),
# this prints "false" rather than claiming something was packaged, which is
# stricter than the original (which would still attempt to upload a
# possibly-nonexistent tarball in that edge case).
#
# Usage: author-and-package.sh <cache_hit> <skill-plugin-dir> <tarball-path>
set -u

CACHE_HIT="$1"
PLUGIN_DIR="$2"
TARBALL="$3"

if [ "$CACHE_HIT" = "true" ]; then
  echo false
  exit 0
fi

export SKILL_PLUGIN_DIR="$PLUGIN_DIR"
bash ./eval-harness/eval_harness/app_builder/scripts/author-app.sh || true

if tar \
    --exclude 'eval-harness/agent-workspace/*/node_modules' \
    --exclude 'eval-harness/agent-workspace/*/.expo' \
    --exclude 'eval-harness/agent-workspace/*/.mcp.json' \
    -czf "$TARBALL" -C eval-harness agent-workspace eval-out 2>/dev/null; then
  echo true
else
  echo false
fi
