#!/usr/bin/env node
// Turn Expo skills usage telemetry on or off, or check its status.
//
// Usage:
//   node telemetry.js --status        # show whether telemetry is on/off and why
//   node telemetry.js --off           # disable (writes the opt-out file)
//   node telemetry.js --on            # re-enable (removes the opt-out file)
//
// The opt-out file is the reliable switch: it works no matter how the agent was
// launched. The DO_NOT_TRACK / EXPO_SKILLS_TELEMETRY env vars also disable
// telemetry (handy for CI), but env vars don't always reach hook subprocesses.

const fs = require("fs");
const path = require("path");
const { OPT_OUT_PATH, telemetryConfigured, isCI } = require("./telemetry_common.js");

function disabledByEnv() {
  const flag = String(process.env.EXPO_SKILLS_TELEMETRY || "").trim().toLowerCase();
  if (["0", "false", "off", "no"].includes(flag)) return "EXPO_SKILLS_TELEMETRY";
  const dnt = String(process.env.DO_NOT_TRACK || "").trim().toLowerCase();
  if (dnt && dnt !== "0" && dnt !== "false") return "DO_NOT_TRACK";
  return null;
}

function printStatus() {
  const byFile = fs.existsSync(OPT_OUT_PATH);
  const byEnv = disabledByEnv();
  const byCI = isCI();
  if (byFile || byEnv || byCI) {
    const reasons = [];
    if (byFile) reasons.push(`opt-out file (${OPT_OUT_PATH})`);
    if (byCI) reasons.push("CI environment");
    if (byEnv) reasons.push(`env var ${byEnv}`);
    console.log(`Expo skills telemetry: DISABLED — via ${reasons.join(" and ")}.`);
  } else if (!telemetryConfigured()) {
    console.log("Expo skills telemetry: ENABLED but NOT CONFIGURED — no PostHog key set (placeholder), so nothing is created or sent. Disable permanently with: telemetry.js --off");
  } else {
    console.log("Expo skills telemetry: ENABLED (anonymous). Disable with: telemetry.js --off");
  }
}

const cmd = process.argv[2];

if (cmd === "--off" || cmd === "--disable") {
  fs.mkdirSync(path.dirname(OPT_OUT_PATH), { recursive: true, mode: 0o700 });
  fs.writeFileSync(OPT_OUT_PATH, "Expo skills telemetry disabled by user.\n");
  console.log(`Telemetry disabled — wrote ${OPT_OUT_PATH}`);
  console.log("Re-enable any time with: telemetry.js --on");
} else if (cmd === "--on" || cmd === "--enable") {
  try { fs.rmSync(OPT_OUT_PATH, { force: true }); } catch {}
  const byEnv = disabledByEnv();
  console.log("Telemetry re-enabled — removed the opt-out file.");
  if (byEnv) console.log(`Note: still disabled by env var ${byEnv}; unset it to fully re-enable.`);
} else if (cmd === "--status" || cmd === undefined) {
  printStatus();
} else {
  console.error(`Unknown option: ${cmd}\nUsage: telemetry.js [--status | --off | --on]`);
  process.exit(2);
}
