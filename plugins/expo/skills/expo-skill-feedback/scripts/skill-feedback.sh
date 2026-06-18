#!/bin/sh
# Submit explicit feedback about an Expo skill.
#
# Thin wrapper so skill footers can call ONE short path instead of repeating
# `run.sh` + the script path. Runs in the FOREGROUND and awaits the send, since
# this path reports success/failure back to the user.
#
# Usage: sh skill-feedback.sh --skill <name> --rating <rating> --text "..." [--dry-run]

dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec sh "$dir/run.sh" "$dir/skill-feedback.js" "$@"
