#!/usr/bin/env node
// Submit a `skill_invoked` event to PostHog — fire-and-forget.
//
// Invoked two ways, both cross-platform (plain `node`, no shell wrapper, so it runs the
// same on macOS / Linux / Windows):
//   1. From Claude Code hooks (../../../hooks/hooks.json) as
//      `node skill-event.cjs --skill auto --initiator <ai|user> --plugin-root <dir> --detach --quiet`.
//      The foreground process reads the hook payload from stdin, resolves which skill ran,
//      runs the cheap local gates, then — for `--detach` — re-launches a DETACHED copy of
//      itself to do the network POST and returns immediately, so the agent turn never blocks.
//   2. Directly (that detached child, or manual / --dry-run testing) with a resolved
//      `--skill <name>`, which builds the event and sends it inline.

const fs = require("fs");
const path = require("path");

const {
  POSTHOG_PROJECT_API_KEY,
  SOURCE,
  telemetryActive,
  telemetryConfigured,
  detectHarness,
  platformProps,
  telemetryIdentity,
  sendToPosthog,
} = require("./telemetry_common.cjs");

const EVENT = "skill_invoked";

function parseArgs(argv) {
  const args = { skill: "", agentHarness: "", initiator: "", pluginRoot: "", dryRun: false, quiet: false, detach: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const next = () => argv[++i] || "";
    switch (flag) {
      case "--skill": args.skill = next(); break;
      case "--agent-harness": args.agentHarness = next(); break;
      case "--initiator": args.initiator = next(); break;
      case "--plugin-root": args.pluginRoot = next(); break;
      case "--detach": args.detach = true; break;
      case "--dry-run": args.dryRun = true; break;
      case "--quiet": args.quiet = true; break;
      default: break; // ignore unknown flags
    }
  }
  return args;
}

// Read the hook payload from stdin (fd 0) and parse it as JSON. Only used to resolve
// `--skill auto` in the foreground hook process; the detached sender is handed the
// already-resolved name and never touches stdin.
function readHookInput() {
  try {
    if (process.stdin.isTTY) return {};
    const raw = (fs.readFileSync(0, "utf8") || "").trim(); // fd 0 = stdin
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

// Resolve the invoked skill name from the hook payload. The name arrives in different
// fields across payload shapes, so check every plausible location:
//   - Claude Code Skill tool:        tool_input.skill        (e.g. "expo:eas-observe")
//   - Claude Code /slash command:    command_name            (UserPromptExpansion)
//   - other payload shapes:          tool_input.skill_name, top-level skill / skill_name
// Namespaced names must be OURS: "expo:<skill>" keeps the final segment, any other
// namespace is dropped — another plugin's "foo:expo-ui" must not count as ours, and
// skillBelongsToPlugin() can't tell name collisions apart. Bare names stay permissive
// and are scoped by skillBelongsToPlugin() downstream.
function skillFromHook(hookInput) {
  const ti = hookInput && typeof hookInput.tool_input === "object" && hookInput.tool_input ? hookInput.tool_input : {};
  const raw = String(
    ti.skill || ti.skill_name || hookInput.command_name || hookInput.skill || hookInput.skill_name || ""
  ).trim().replace(/^\//, ""); // tolerate a leading "/" from slash-command payloads
  if (!raw.includes(":")) return raw;
  const sep = raw.lastIndexOf(":");
  return raw.slice(0, sep) === "expo" ? raw.slice(sep + 1) : "";
}

function pluginRootFor(args) {
  // Self-derive from this script's location: <root>/skills/expo-skill-feedback/scripts.
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

// Re-launch this script DETACHED to perform the network POST off the agent's critical
// path — the cross-platform equivalent of `node skill-event.cjs … &`. We pass the already
// resolved `--skill <name>` (not "auto") and drop `--detach`, so the child sends inline and
// never reads stdin or re-detaches. It runs under the same runtime that launched us
// (process.execPath = node or bun) and inherits our env (CLAUDECODE, EXPO_SKILLS_*, …).
// windowsHide avoids a console-window flash on Windows; failures are ignored (best-effort).
function spawnDetachedSend(skill, args) {
  try {
    const { spawn } = require("child_process");
    const childArgs = [__filename, "--skill", skill, "--quiet"];
    if (args.initiator.trim()) childArgs.push("--initiator", args.initiator.trim());
    if (args.agentHarness.trim()) childArgs.push("--agent-harness", args.agentHarness.trim());
    const child = spawn(process.execPath, childArgs, { detached: true, stdio: "ignore", windowsHide: true });
    child.unref();
  } catch {
    // best-effort: if the child can't be spawned, skip the send rather than block
  }
}

async function main(argv) {
  const args = parseArgs(argv);

  // Resolve which skill ran. `--skill auto` means "read it from the hook payload on
  // stdin" — which must happen HERE, in the foreground hook process, because a detached
  // child's stdin is /dev/null.
  let skill = args.skill.trim();
  if (skill === "auto") skill = skillFromHook(readHookInput());

  // Cheap, local, no-network gates: decide up front whether anything will be sent, so the
  // common "not an Expo skill / opted out" cases cost nothing and never spawn a child.
  if (!skill) return 0;                                            // not a skill invocation
  if (!args.dryRun && !telemetryActive()) return 0;                // opt-in: off until enabled (dry-run inspects regardless)
  if (!telemetryConfigured() && !args.dryRun) return 0;            // no key in this build (e.g. a fork) -> inert
  if (!skillBelongsToPlugin(skill, pluginRootFor(args))) return 0; // not one of ours

  // Hook path: hand the network POST to a detached copy of ourselves so the turn never
  // blocks on it, then return immediately. (--dry-run stays inline so it can be inspected.)
  if (args.detach && !args.dryRun) {
    spawnDetachedSend(skill, args);
    return 0;
  }

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
