#!/usr/bin/env node
// Submit a `skill_invoked` event to PostHog.
//
// Fires from two Claude Code hooks (see ../../../hooks/hooks.json):
//   - PostToolUse[Skill]   -> the AI invoked a skill        (--initiator ai)
//   - UserPromptExpansion  -> a user ran a /slash command   (--initiator user)
// Reads the hook payload from stdin; never blocks (exits 0 under --quiet).

const fs = require("fs");
const path = require("path");

const {
  POSTHOG_PROJECT_API_KEY,
  SOURCE,
  telemetryDisabled,
  telemetryConfigured,
  detectHarness,
  platformProps,
  telemetryIdentity,
  sendToPosthog,
} = require("./telemetry_common.cjs");

const EVENT = "skill_invoked";

function parseArgs(argv) {
  const args = { skill: "", agentHarness: "", initiator: "", pluginRoot: "", hookInputFile: "", dryRun: false, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const next = () => argv[++i] || "";
    switch (flag) {
      case "--skill": args.skill = next(); break;
      case "--agent-harness": args.agentHarness = next(); break;
      case "--initiator": args.initiator = next(); break;
      case "--plugin-root": args.pluginRoot = next(); break;
      case "--hook-input-file": args.hookInputFile = next(); break;
      case "--dry-run": args.dryRun = true; break;
      case "--quiet": args.quiet = true; break;
      default: break; // ignore unknown flags
    }
  }
  return args;
}

// Read the hook payload. The detaching wrapper (skill-event.sh) stashes stdin in a temp
// file and passes --hook-input-file, because a backgrounded process's stdin is /dev/null
// (POSIX), so the detached send can't read the pipe directly. We read that file then
// unlink it. With no file (foreground / direct invocation), fall back to stdin (fd 0).
function readHookInput(file) {
  try {
    let raw;
    if (file) {
      raw = fs.readFileSync(file, "utf8");
      try { fs.unlinkSync(file); } catch {}
    } else {
      if (process.stdin.isTTY) return {};
      raw = fs.readFileSync(0, "utf8"); // fd 0 = stdin
    }
    raw = (raw || "").trim();
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

// Resolve the invoked skill name from the hook payload. The name arrives in different
// fields across harnesses and payload shapes, so check every plausible location — the
// strict skillBelongsToPlugin() scoping downstream keeps this safe even when permissive
// (anything that isn't really one of our skills is dropped):
//   - Claude Code Skill tool:        tool_input.skill        (e.g. "expo:expo-observe")
//   - Claude Code /slash command:    command_name            (UserPromptExpansion)
//   - other payload shapes:          tool_input.skill_name, top-level skill / skill_name
// We check every plausible field so the resolver stays robust across payload shapes; the
// strict skillBelongsToPlugin() scoping below keeps it safe even when permissive.
// Plugin skills are namespaced (e.g. "expo:expo-observe") — keep the final segment.
function skillFromHook(hookInput) {
  const ti = hookInput && typeof hookInput.tool_input === "object" && hookInput.tool_input ? hookInput.tool_input : {};
  const raw = String(
    ti.skill || ti.skill_name || hookInput.command_name || hookInput.skill || hookInput.skill_name || ""
  ).trim().replace(/^\//, ""); // tolerate a leading "/" from slash-command payloads
  return raw.includes(":") ? raw.slice(raw.lastIndexOf(":") + 1) : raw;
}

function pluginRootFor(args) {
  // Self-derive from this script's location: <root>/skills/skill-feedback/scripts.
  return args.pluginRoot || path.resolve(__dirname, "..", "..", "..");
}

// Only emit for skills that belong to THIS plugin (so we never track other plugins'
// or the user's own skills). Confirms <pluginRoot>/skills/<skill>/SKILL.md exists.
// The skill name must be a single kebab-case segment — this also blocks path traversal
// (e.g. "../../x") from a malformed payload reaching path.join or the event property.
function skillBelongsToPlugin(skill, pluginRoot) {
  if (!skill || !pluginRoot) return false;
  if (!/^[a-z0-9][a-z0-9-]*$/.test(skill)) return false;
  try { return fs.existsSync(path.join(pluginRoot, "skills", skill, "SKILL.md")); }
  catch { return false; }
}

function eventPayload(skill, args) {
  const agentHarness = args.agentHarness.trim() || detectHarness();
  const initiator = args.initiator.trim();
  const timestamp = new Date().toISOString();
  const [distinctId, identityProperties] = telemetryIdentity(agentHarness, { createInstallation: !args.dryRun });

  const properties = {
    $process_person_profile: false,
    source: SOURCE,
    skill,
    agent_harness: agentHarness,
    ...(initiator ? { initiator } : {}),
    ...platformProps(),
    ...identityProperties,
  };

  return { api_key: POSTHOG_PROJECT_API_KEY, event: EVENT, distinct_id: distinctId, timestamp, properties };
}

async function main(argv) {
  const args = parseArgs(argv);
  // Read (and unlink) the hook payload FIRST so the temp file from skill-event.sh is
  // cleaned up on every path below, including the telemetry-off early returns. (It can
  // still be orphaned if no JS runtime starts at all; those are mode 0600 and OS-reaped.)
  const hookInput = readHookInput(args.hookInputFile);
  if (telemetryDisabled()) return 0;
  if (!telemetryConfigured() && !args.dryRun) return 0; // no key in this build (e.g. a fork) -> stay inert

  let skill = args.skill.trim();
  if (skill === "auto") skill = skillFromHook(hookInput);
  if (!skill) return 0;                                   // not a skill invocation
  if (!skillBelongsToPlugin(skill, pluginRootFor(args))) return 0; // not one of ours

  const payload = eventPayload(skill, args);

  if (args.dryRun) {
    console.log(JSON.stringify({ ...payload, api_key: "phc_..." }, null, 2));
    return 0;
  }

  try {
    await sendToPosthog(payload, { userAgent: "expo-skills/skill-event", timeoutMs: 3000 });
  } catch (err) {
    if (!args.quiet) console.error(`skill-event: ${err.message}`);
    return args.quiet ? 0 : 1;
  }

  if (!args.quiet) console.log(`sent ${EVENT}: ${payload.properties.skill} (${payload.properties.initiator || "?"})`);
  return 0;
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch(() => process.exit(0));
