#!/usr/bin/env bash
# Configures the (private, token-scoped) eval-harness submodule fetch and
# initializes it. Shared by every job that needs eval-harness -- author,
# eval, and the fingerprint step -- so this repeats as a 1-line script call
# instead of 3 lines of inline YAML in every one of them.
set -euo pipefail

git config --global url."https://x-access-token:${EVAL_HARNESS_ACCESS_TOKEN}@github.com/".insteadOf "https://github.com/"
git submodule update --init eval-harness
