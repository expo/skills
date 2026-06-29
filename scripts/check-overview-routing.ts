#!/usr/bin/env bun

import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

const SKILLS_DIR = "plugins/expo/skills";
const ROUTER_SKILL = "expo-overview";
const ROUTER_PATH = join(SKILLS_DIR, ROUTER_SKILL, "SKILL.md");

function listSkillNames(): string[] {
  return readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name !== ROUTER_SKILL)
    .filter((name) => existsSync(join(SKILLS_DIR, name, "SKILL.md")))
    .sort();
}

function writeSummary(markdown: string) {
  const summaryPath = process.env.ROUTING_CHECK_SUMMARY_PATH;
  if (!summaryPath) {
    return;
  }

  mkdirSync(dirname(summaryPath), { recursive: true });
  writeFileSync(summaryPath, `${markdown}\n`);
}

function complete(success: boolean, markdown: string): never {
  writeSummary(markdown);
  console.log(markdown);
  process.exit(success ? 0 : 1);
}

const skillNames = listSkillNames();
const router = readFileSync(ROUTER_PATH, "utf8");

// A skill is "routed" when it appears as an inline-code token: `skill-name`.
const missing = skillNames.filter((name) => !router.includes(`\`${name}\``));

const markdown = [
  "## Expo overview routing check",
  "",
  missing.length === 0
    ? `Passed. All ${skillNames.length} skills are referenced in \`${ROUTER_PATH}\`.`
    : "Failed. New skills must be added to the `expo-overview` Skill Map so the router can dispatch to them.",
  ...(missing.length === 0
    ? []
    : [
        "",
        "Skills missing from the router:",
        "",
        ...missing.map((name) => `- \`${name}\``),
        "",
        `Add each one as an inline-code entry (\`\`${"skill-name"}\`\`) under a category in \`${ROUTER_PATH}\`.`,
      ]),
].join("\n");

complete(missing.length === 0, markdown);
