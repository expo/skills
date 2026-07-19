#!/usr/bin/env node
// Backward-compatible adapter for the former bundled feedback transport.
//
// Usage:
//   node skill-feedback.cjs --skill <name> --rating <rating> --text "..." \
//     [--about skill|expo] [--agent-harness <harness>] [--dry-run]

const { spawnSync } = require("node:child_process");

const RATINGS = ["useful", "confusing", "bug", "idea", "other"];
const ABOUT_VALUES = ["skill", "expo"];
const MAX_FEEDBACK_CHARS = 4000;

function parseArgs(argv) {
  const args = { skill: "", rating: "", text: "", about: "skill", agentHarness: "", dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const next = () => argv[++i] || "";
    switch (flag) {
      case "--skill": args.skill = next(); break;
      case "--rating": args.rating = next(); break;
      case "--text": args.text = next(); break;
      case "--about": args.about = next(); break;
      case "--agent-harness": args.agentHarness = next(); break;
      case "--dry-run": args.dryRun = true; break;
      default: break;
    }
  }
  return args;
}

function feedbackInvocation(args, platform = process.platform) {
  const text = args.text.trim().slice(0, MAX_FEEDBACK_CHARS);
  const skill = args.skill.trim();
  const rating = args.rating.trim();
  const about = (args.about || "skill").trim() || "skill";
  const agentHarness = args.agentHarness.trim();

  if (!text) throw new Error("--text cannot be empty");
  if (!skill) throw new Error("--skill cannot be empty");
  if (!RATINGS.includes(rating)) throw new Error(`--rating must be one of: ${RATINGS.join(", ")}`);
  if (!ABOUT_VALUES.includes(about)) throw new Error(`--about must be one of: ${ABOUT_VALUES.join(", ")}`);

  const metadata = [`rating=${rating}`];
  if (about !== "skill") metadata.push(`about=${about}`);
  if (agentHarness) metadata.push(`agent-harness=${agentHarness}`);

  return {
    command: platform === "win32" ? "npx.cmd" : "npx",
    args: [
      "--yes",
      "submit-expo-feedback@latest",
      "--category",
      "skills",
      "--subject",
      skill,
      `[${metadata.join("; ")}] ${text}`,
    ],
  };
}

function main(argv, spawn = spawnSync) {
  const args = parseArgs(argv);
  let invocation;
  try {
    invocation = feedbackInvocation(args);
  } catch (err) {
    console.error(`skill-feedback: ${err.message}`);
    return 2;
  }

  if (args.dryRun) {
    console.log(JSON.stringify(invocation, null, 2));
    return 0;
  }

  const result = spawn(invocation.command, invocation.args, { stdio: "inherit" });
  if (result.error) {
    console.error(`skill-feedback: ${result.error.message}`);
    return 1;
  }
  return result.status ?? 1;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));

module.exports = { feedbackInvocation, main, parseArgs };
