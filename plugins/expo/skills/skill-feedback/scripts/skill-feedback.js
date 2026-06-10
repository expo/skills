#!/usr/bin/env node
// Submit feedback about an Expo skill to PostHog.
//
// Usage:
//   node skill-feedback.js --skill <name> --rating <rating> --text "..." \
//     [--agent-harness <harness>] [--dry-run]

const crypto = require("crypto");

const {
  POSTHOG_PROJECT_API_KEY,
  SOURCE,
  SCHEMA_VERSION,
  telemetryDisabled,
  telemetryConfigured,
  detectHarness,
  platformProps,
  stableStringify,
  telemetryIdentity,
  sendToPosthog,
} = require("./telemetry_common.js");

const EVENT_NAME = "skill_feedback";
const RATINGS = ["useful", "confusing", "bug", "idea", "other"];
const MAX_FEEDBACK_CHARS = 4000;

function parseArgs(argv) {
  const args = { skill: "", rating: "", text: "", agentHarness: "", dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const next = () => argv[++i] || "";
    switch (flag) {
      case "--skill": args.skill = next(); break;
      case "--rating": args.rating = next(); break;
      case "--text": args.text = next(); break;
      case "--agent-harness": args.agentHarness = next(); break;
      case "--dry-run": args.dryRun = true; break;
      default: break;
    }
  }
  return args;
}

function eventPayload(args) {
  const feedback = args.text.trim().slice(0, MAX_FEEDBACK_CHARS);
  const skill = args.skill.trim();
  const agentHarness = args.agentHarness.trim() || detectHarness();

  if (!feedback) throw new Error("--text cannot be empty");
  if (!skill) throw new Error("--skill cannot be empty");
  if (!RATINGS.includes(args.rating)) throw new Error(`--rating must be one of: ${RATINGS.join(", ")}`);

  const timestamp = new Date().toISOString();
  const [distinctId, identityProperties] = telemetryIdentity(agentHarness, { createInstallation: !args.dryRun });
  const insertSource = stableStringify({ agent_harness: agentHarness, skill, rating: args.rating, feedback, timestamp });

  return {
    api_key: POSTHOG_PROJECT_API_KEY,
    event: EVENT_NAME,
    distinct_id: distinctId,
    timestamp,
    properties: {
      $process_person_profile: false,
      $insert_id: "skill_feedback:" + crypto.createHash("sha256").update(insertSource).digest("hex").slice(0, 32),
      source: SOURCE,
      schema_version: SCHEMA_VERSION,
      ...identityProperties,
      agent_harness: agentHarness,
      ...platformProps(),
      skill,
      rating: args.rating,
      feedback_text: feedback,
    },
  };
}

async function main(argv) {
  const args = parseArgs(argv);

  if (telemetryDisabled()) {
    console.error("skill-feedback: telemetry is disabled (opt-out file or EXPO_SKILLS_TELEMETRY/DO_NOT_TRACK); nothing sent. Re-enable with telemetry.js --on.");
    return 0;
  }
  if (!telemetryConfigured() && !args.dryRun) {
    console.error("skill-feedback: no PostHog key configured (placeholder); nothing sent. Set EXPO_SKILLS_POSTHOG_KEY or the key in telemetry_common.js.");
    return 0;
  }

  let payload;
  try {
    payload = eventPayload(args);
  } catch (err) {
    console.error(`skill-feedback: ${err.message}`);
    return 2;
  }

  if (args.dryRun) {
    console.log(JSON.stringify({ ...payload, api_key: "phc_..." }, null, 2));
    return 0;
  }

  try {
    await sendToPosthog(payload, { userAgent: "expo-skills/skill-feedback", timeoutMs: 10000 });
  } catch (err) {
    console.error(`skill-feedback: ${err.message}`);
    return 1;
  }

  console.log(`sent skill feedback: ${payload.properties.skill}`);
  return 0;
}

main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`skill-feedback: ${err && err.message ? err.message : err}`);
    process.exit(1);
  });
