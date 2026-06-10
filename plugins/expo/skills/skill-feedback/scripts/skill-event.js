#!/usr/bin/env node
// Submit a `skill_invoked` event to PostHog.
//
// Fires from two Claude Code hooks (see ../../../hooks/hooks.json):
//   - PostToolUse[Skill]   -> the AI invoked a skill        (--initiator ai)
//   - UserPromptExpansion  -> a user ran a /slash command   (--initiator user)
// Reads the hook payload from stdin; never blocks (exits 0 under --quiet).

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const {
  POSTHOG_PROJECT_API_KEY,
  SOURCE,
  SCHEMA_VERSION,
  telemetryDisabled,
  telemetryConfigured,
  detectHarness,
  platformProps,
  maybeShowFirstRunNotice,
  shortHash,
  stableStringify,
  telemetryIdentity,
  sendToPosthog,
} = require("./telemetry_common.js");

const EVENT = "skill_invoked";

function parseArgs(argv) {
  const args = { skill: "", agentHarness: "", initiator: "", pluginRoot: "", dryRun: false, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const next = () => argv[++i] || "";
    switch (flag) {
      case "--skill": args.skill = next(); break;
      case "--agent-harness": args.agentHarness = next(); break;
      case "--initiator": args.initiator = next(); break;
      case "--plugin-root": args.pluginRoot = next(); break;
      case "--dry-run": args.dryRun = true; break;
      case "--quiet": args.quiet = true; break;
      default: break; // ignore unknown flags
    }
  }
  return args;
}

function readHookInput() {
  try {
    if (process.stdin.isTTY) return {};
    const raw = fs.readFileSync(0, "utf8").trim(); // fd 0 = stdin
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
//   - Codex / future skill hooks:    tool_input.skill_name, top-level skill / skill_name
// Codex mirrors Claude's hook event names (parity tracker openai/codex#21753) and aliases
// CLAUDE_PLUGIN_ROOT, so the existing hooks fire there unchanged once Codex enables plugin
// hooks — this resolver just has to tolerate whatever field the payload uses for the name.
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
function skillBelongsToPlugin(skill, pluginRoot) {
  if (!skill || !pluginRoot) return false;
  try { return fs.existsSync(path.join(pluginRoot, "skills", skill, "SKILL.md")); }
  catch { return false; }
}

function eventPayload(skill, args, hookInput) {
  const agentHarness = args.agentHarness.trim() || detectHarness();
  const initiator = args.initiator.trim();
  const timestamp = new Date().toISOString();
  const sessionIdHash = shortHash(hookInput.session_id);
  const [distinctId, identityProperties] = telemetryIdentity(agentHarness, { createInstallation: !args.dryRun });

  const insertSource = stableStringify({
    skill, event: EVENT, agent_harness: agentHarness, initiator,
    session_id_hash: sessionIdHash, timestamp,
  });

  const properties = {
    $process_person_profile: false,
    $insert_id: `${EVENT}:` + crypto.createHash("sha256").update(insertSource).digest("hex").slice(0, 32),
    source: SOURCE,
    schema_version: SCHEMA_VERSION,
    skill,
    agent_harness: agentHarness,
    ...(initiator ? { initiator } : {}),
    ...platformProps(),
    ...identityProperties,
  };
  if (sessionIdHash) properties.session_id_hash = sessionIdHash;

  return { api_key: POSTHOG_PROJECT_API_KEY, event: EVENT, distinct_id: distinctId, timestamp, properties };
}

async function main(argv) {
  const args = parseArgs(argv);
  if (telemetryDisabled()) return 0;
  if (!telemetryConfigured() && !args.dryRun) return 0; // no key set -> fully inert
  const hookInput = readHookInput();

  let skill = args.skill.trim();
  if (skill === "auto") skill = skillFromHook(hookInput);
  if (!skill) return 0;                                   // not a skill invocation
  if (!skillBelongsToPlugin(skill, pluginRootFor(args))) return 0; // not one of ours

  const payload = eventPayload(skill, args, hookInput);

  if (args.dryRun) {
    console.log(JSON.stringify({ ...payload, api_key: "phc_..." }, null, 2));
    return 0;
  }

  maybeShowFirstRunNotice();
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
