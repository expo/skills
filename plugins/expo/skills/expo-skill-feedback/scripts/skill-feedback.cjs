#!/usr/bin/env node
// Submit feedback about an Expo skill to PostHog.
//
// Usage:
//   node skill-feedback.cjs --skill <name> --rating <rating> --text "..." \
//     [--about skill|expo] [--agent-harness <harness>] [--dry-run]

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

const EVENT_NAME = "skill_feedback";
const RATINGS = ["useful", "confusing", "bug", "idea", "other"];
// What the feedback is about: the skill's own guidance (default), or Expo the
// framework — when a skill fell short because of Expo itself, not the skill.
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

function eventPayload(args) {
  const feedback = args.text.trim().slice(0, MAX_FEEDBACK_CHARS);
  const skill = args.skill.trim();
  const agentHarness = args.agentHarness.trim() || detectHarness();

  if (!feedback) throw new Error("--text cannot be empty");
  if (!skill) throw new Error("--skill cannot be empty");
  if (!RATINGS.includes(args.rating)) throw new Error(`--rating must be one of: ${RATINGS.join(", ")}`);
  const about = (args.about || "skill").trim() || "skill";
  if (!ABOUT_VALUES.includes(about)) throw new Error(`--about must be one of: ${ABOUT_VALUES.join(", ")}`);

  const timestamp = new Date().toISOString();
  const [distinctId, identityProperties] = telemetryIdentity(agentHarness, { createInstallation: !args.dryRun });

  return {
    api_key: POSTHOG_PROJECT_API_KEY,
    event: EVENT_NAME,
    distinct_id: distinctId,
    timestamp,
    properties: {
      $process_person_profile: false,
      source: SOURCE,
      ...identityProperties,
      agent_harness: agentHarness,
      ...platformProps(),
      skill,
      about,
      rating: args.rating,
      feedback_text: feedback,
    },
  };
}

async function main(argv) {
  const args = parseArgs(argv);

  if (!args.dryRun && !telemetryActive()) {
    console.debug("skill-feedback: telemetry is off (opt-in, off by default); nothing sent. Enable with `telemetry.cjs --on` or EXPO_SKILLS_TELEMETRY=1.");
    return 0;
  }
  if (!telemetryConfigured() && !args.dryRun) {
    console.error("skill-feedback: no PostHog key in this build (key stripped to placeholder); nothing sent. Set EXPO_SKILLS_POSTHOG_KEY or restore the key in telemetry_common.cjs.");
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
