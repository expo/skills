#!/usr/bin/env node
// Turn Expo skills usage telemetry on or off, or check its status.
//
// Telemetry is OFF by default (opt-in) — nothing is sent until you enable it here or
// via EXPO_SKILLS_TELEMETRY=1. Usage:
//   node telemetry.cjs --status   # show whether telemetry is on/off and why
//   node telemetry.cjs --on       # enable  (writes the opt-in marker)
//   node telemetry.cjs --off      # disable (removes the opt-in marker — the default)
//
// The opt-in marker is the reliable switch: it works no matter how the agent was
// launched. EXPO_SKILLS_TELEMETRY=1/0 and DO_NOT_TRACK also work (handy for CI), but
// env vars don't always reach hook subprocesses.

const fs = require("fs");
const path = require("path");
const {
  OPT_IN_PATH,
  telemetryActive,
  telemetryEnvSignal,
  telemetryConfigured,
  isCI,
} = require("./telemetry_common.cjs");

// One-line explanation of the current state (mirrors telemetryActive()'s precedence).
function reason() {
  const env = telemetryEnvSignal();
  if (env === "off") return "env var (EXPO_SKILLS_TELEMETRY=0 / DO_NOT_TRACK)";
  if (isCI()) return "CI environment (telemetry never emits from CI)";
  if (env === "on") return "env var EXPO_SKILLS_TELEMETRY=1";
  if (safeExists(OPT_IN_PATH)) return `opt-in marker (${OPT_IN_PATH})`;
  return "default (opt-in — off until enabled)";
}

function safeExists(p) { try { return fs.existsSync(p); } catch { return false; } }

function printStatus() {
  const on = telemetryActive();
  if (on && !telemetryConfigured()) {
    console.log(`Expo skills telemetry: ON via ${reason()}, but no PostHog key in this build (stripped to placeholder) — nothing is sent.`);
  } else if (on) {
    console.log(`Expo skills telemetry: ON (anonymous) — ${reason()}. Turn off with: telemetry.cjs --off`);
  } else {
    console.log(`Expo skills telemetry: OFF — ${reason()}. Turn on with: telemetry.cjs --on (or EXPO_SKILLS_TELEMETRY=1)`);
  }
}

const cmd = process.argv[2];

if (cmd === "--on" || cmd === "--enable") {
  fs.mkdirSync(path.dirname(OPT_IN_PATH), { recursive: true, mode: 0o700 });
  fs.writeFileSync(OPT_IN_PATH, "Expo skills telemetry enabled by user.\n");
  console.log(`Telemetry enabled — wrote ${OPT_IN_PATH}`);
  if (telemetryEnvSignal() === "off") console.log("Note: an env var (EXPO_SKILLS_TELEMETRY=0 / DO_NOT_TRACK) still forces it OFF; unset it to send.");
  else if (isCI()) console.log("Note: this looks like CI, where telemetry stays OFF regardless.");
  console.log("Turn off any time with: telemetry.cjs --off");
} else if (cmd === "--off" || cmd === "--disable") {
  try { fs.rmSync(OPT_IN_PATH, { force: true }); } catch {}
  console.log("Telemetry off — removed the opt-in marker (off is the default).");
  if (telemetryEnvSignal() === "on") console.log("Note: EXPO_SKILLS_TELEMETRY=1 still forces it ON; unset it to stay off.");
} else if (cmd === "--status" || cmd === undefined) {
  printStatus();
} else {
  console.error(`Unknown option: ${cmd}\nUsage: telemetry.cjs [--status | --on | --off]`);
  process.exit(2);
}
