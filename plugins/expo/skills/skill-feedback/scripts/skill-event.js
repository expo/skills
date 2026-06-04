#!/usr/bin/env node
// Submit skill lifecycle telemetry (skill_read, skill_activated) to PostHog.
//
// Runs from Claude Code hooks. Reads the hook payload from stdin (when present)
// and never blocks: on any error it exits 0 under --quiet.

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
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
  parseContext,
  telemetryIdentity,
  sendToPosthog,
} = require("./telemetry_common.js");

const EVENTS = ["skill_read", "skill_activated"];

function parseArgs(argv) {
  const args = {
    skill: "",
    event: "",
    agentHarness: "",
    modelConfig: "unknown",
    context: [],
    pluginRoot: "",
    dryRun: false,
    quiet: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const next = () => argv[++i] || "";
    switch (flag) {
      case "--skill": args.skill = next(); break;
      case "--event": args.event = next(); break;
      case "--agent-harness": args.agentHarness = next(); break;
      case "--model-config": args.modelConfig = next(); break;
      case "--context": args.context.push(next()); break;
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

function hookFilePath(hookInput) {
  const toolInput = hookInput.tool_input;
  if (!toolInput || typeof toolInput !== "object") return "";
  return String(toolInput.file_path || toolInput.path || "").trim();
}

function skillFromFilePath(filePath) {
  if (!filePath) return "";
  const parts = filePath.replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts[parts.length - 1] !== "SKILL.md") return "";
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] !== "skills") continue;
    if (i + 2 < parts.length && parts[i + 2] === "SKILL.md") return parts[i + 1];
    if (i + 3 < parts.length && parts[i + 3] === "SKILL.md") return parts[i + 2];
  }
  return "";
}

// Only emit skill_read for files that live under this plugin, so we never
// track SKILL.md reads from unrelated plugins or projects.
function isUnderPluginRoot(filePath, pluginRoot) {
  if (!pluginRoot) return true;
  const resolve = (p) => {
    try { return fs.realpathSync(path.resolve(p)); } catch { return path.resolve(p); }
  };
  const file = resolve(filePath);
  const root = resolve(pluginRoot);
  return file === root || file.startsWith(root + path.sep);
}

function resolveEvent(args) {
  if (args.event) return args.event;
  throw new Error("--event is required");
}

function eventPayload(args, hookInput) {
  const eventName = resolveEvent(args);
  let skill = args.skill.trim();
  if (eventName === "skill_read" && skill === "auto") {
    skill = skillFromFilePath(hookFilePath(hookInput));
  }

  const agentHarness = args.agentHarness.trim() || detectHarness();
  const modelConfig = args.modelConfig.trim() || "unknown";

  if (!skill) throw new Error("--skill cannot be empty");
  if (!EVENTS.includes(eventName)) throw new Error(`--event must be one of: ${EVENTS.join(", ")}`);

  const timestamp = new Date().toISOString();
  const sessionIdHash = shortHash(hookInput.session_id);
  const [distinctId, identityProperties] = telemetryIdentity(agentHarness, {
    createInstallation: !args.dryRun,
  });

  const insertSource = stableStringify({
    skill,
    event: eventName,
    agent_harness: agentHarness,
    model_config: modelConfig,
    session_id_hash: sessionIdHash,
    timestamp,
  });

  const properties = {
    $process_person_profile: false,
    $insert_id: `${eventName}:` + crypto.createHash("sha256").update(insertSource).digest("hex").slice(0, 32),
    source: SOURCE,
    schema_version: SCHEMA_VERSION,
    skill,
    agent_harness: agentHarness,
    model_config: modelConfig,
    ...platformProps(),
    ...identityProperties,
  };
  if (sessionIdHash) properties.session_id_hash = sessionIdHash;

  const context = parseContext(args.context);
  if (Object.keys(context).length) properties.context = context;

  return {
    api_key: POSTHOG_PROJECT_API_KEY,
    event: eventName,
    distinct_id: distinctId,
    timestamp,
    properties,
  };
}

function activationMarkerPath(skill, sessionIdHash) {
  const markerId = crypto.createHash("sha256").update(`${skill}:${sessionIdHash}`).digest("hex").slice(0, 24);
  return path.join(os.tmpdir(), `expo-skills-activated-${markerId}`);
}

// skill_activated should fire once per skill per session. Use an atomic marker
// file so concurrent hook calls don't double-send.
function shouldSendActivation(args, hookInput, dryRun) {
  if (resolveEvent(args) !== "skill_activated") return false;
  const sessionIdHash = shortHash(hookInput.session_id);
  if (!sessionIdHash) return true;
  if (dryRun) return true;

  const marker = activationMarkerPath(args.skill.trim(), sessionIdHash);
  try {
    const fd = fs.openSync(marker, "wx", 0o600);
    try { fs.writeFileSync(fd, new Date().toISOString()); } finally { fs.closeSync(fd); }
    return true;
  } catch (err) {
    if (err && err.code === "EEXIST") return false;
    return true;
  }
}

async function main(argv) {
  const args = parseArgs(argv);
  if (telemetryDisabled()) return 0;
  if (!telemetryConfigured() && !args.dryRun) return 0; // no key set → fully inert
  const hookInput = readHookInput();

  let payload;
  try {
    const eventName = resolveEvent(args);

    if (eventName === "skill_read" && args.skill.trim() === "auto") {
      const filePath = hookFilePath(hookInput);
      if (!skillFromFilePath(filePath)) return 0;
      // Default the plugin root to this script's location (<root>/skills/skill-feedback/scripts).
      const pluginRoot = args.pluginRoot || path.resolve(__dirname, "..", "..", "..");
      if (!isUnderPluginRoot(filePath, pluginRoot)) return 0;
    }

    if (eventName === "skill_activated" && !shouldSendActivation(args, hookInput, args.dryRun)) {
      if (!args.quiet) console.log(`skill-event: skipped duplicate activation event for ${args.skill}`);
      return 0;
    }

    payload = eventPayload(args, hookInput);
  } catch (err) {
    if (!args.quiet) console.error(`skill-event: ${err.message}`);
    return 2;
  }

  if (args.dryRun) {
    console.log(JSON.stringify({ ...payload, api_key: "phc_..." }, null, 2));
    return 0;
  }

  maybeShowFirstRunNotice();
  try {
    await sendToPosthog(payload, { userAgent: "expo-skills/skill-event", timeoutMs: 5000 });
  } catch (err) {
    if (!args.quiet) console.error(`skill-event: ${err.message}`);
    return args.quiet ? 0 : 1;
  }

  if (!args.quiet) console.log(`sent ${payload.event}: ${payload.properties.skill}`);
  return 0;
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch(() => process.exit(0));
