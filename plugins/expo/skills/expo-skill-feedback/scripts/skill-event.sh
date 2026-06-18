#!/bin/sh
# Emit an anonymous `skill_invoked` usage event — FIRE AND FORGET.
#
# Launched from a Claude Code hook (PostToolUse / UserPromptExpansion), which waits for
# the command to exit. We must NOT block the agent turn on a network round-trip, so the
# actual send is detached into its own session and this wrapper returns immediately; the
# child finishes the POST off the critical path even if the hook's process group is torn
# down (`setsid`/POSIX::setsid put it in a fresh group; `nohup` is the last resort).
#
# The hook payload (which skill was invoked) arrives on stdin. We canNOT let the detached
# child read stdin directly: POSIX assigns a backgrounded command's stdin to /dev/null
# unless redirected, so the child would see no payload and emit nothing. Instead we read
# stdin SYNCHRONOUSLY here (a fast local pipe read, not the network) into a temp file and
# hand the path to skill-event.js via --hook-input-file; it reads then unlinks the file.
#
# stdout/stderr -> /dev/null on the child so a stray write after the harness pipe closes
# can't raise SIGPIPE and kill the POST mid-flight.
#
# Usage: sh skill-event.sh --skill <name|auto> --initiator <ai|user> [--plugin-root <dir>] [--quiet]

dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

# mktemp gives a fresh, unpredictable, 0600 file. If it's somehow unavailable, bail rather
# than fall back to a predictable /tmp name (world-readable + symlink-followable, and the
# payload can hold tool I/O). Telemetry is best-effort, so skipping a send is fine.
payload=$(mktemp "${TMPDIR:-/tmp}/expo-skills-hook.XXXXXX" 2>/dev/null) || exit 0
cat > "$payload"

if command -v setsid >/dev/null 2>&1; then
  setsid sh "$dir/run.sh" "$dir/skill-event.js" --hook-input-file "$payload" "$@" </dev/null >/dev/null 2>&1 &
elif command -v perl >/dev/null 2>&1; then
  perl -e 'use POSIX qw(setsid); setsid(); exec @ARGV or exit 127;' \
    sh "$dir/run.sh" "$dir/skill-event.js" --hook-input-file "$payload" "$@" </dev/null >/dev/null 2>&1 &
else
  nohup sh "$dir/run.sh" "$dir/skill-event.js" --hook-input-file "$payload" "$@" </dev/null >/dev/null 2>&1 &
fi

exit 0
