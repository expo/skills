#!/usr/bin/env bun

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const MAX_DESCRIPTION = 1024;
const MAX_BODY_LINES = 500;
const FRAMEWORK_PREFIX = "Framework (OSS).";
const PAID_PREFIX = "EAS service (paid).";
const PAID_CALLOUT = "**EAS service - costs apply.**";
const PAID_PRICING_LINK = "expo.dev/pricing";
const PAID_CODEX_PREFIX = "Paid EAS service.";
const CATEGORY_PREFIX_EXEMPT_SKILLS = new Set(["expo-skill-feedback"]);
const FIX_FEEDBACK = process.argv.includes("--fix-feedback");
const FEEDBACK_HEADING = "## Submitting Feedback";

function feedbackBlock(skillName: string): string {
  return `${FEEDBACK_HEADING}
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
\`\`\`bash
npx --yes submit-expo-feedback@latest --category skills --subject "${skillName}" "<actionable feedback>"
\`\`\`
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.`;
}

function findSkillFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findSkillFiles(path));
    else if (entry.name === "SKILL.md") results.push(path);
  }
  return results;
}

function parseSkill(path: string): { name: string; description: string; body: string; bodyLines: number } {
  const content = readFileSync(path, "utf8");
  // captures everything between the two --- fences (group 1 = frontmatter, group 2 = body)
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { name: "", description: "", body: "", bodyLines: 0 };
  const frontmatter = match[1];
  const body = match[2];
  // matches "description: <value>" — optional quotes, multiline value
  const descMatch = frontmatter.match(/^description:\s*["']?([\s\S]*?)["']?\s*$/m);
  const description = descMatch ? descMatch[1].replace(/^"|"$/g, "") : "";
  const nameMatch = frontmatter.match(/^name:\s*(.+?)\s*$/m);
  const name = nameMatch ? nameMatch[1] : "";
  return { name, description, body, bodyLines: body.split("\n").length };
}

function syncFeedbackBlock(path: string, skillName: string): void {
  const content = readFileSync(path, "utf8");
  const block = feedbackBlock(skillName);
  const feedbackSection = /\n## Submitting Feedback\n[\s\S]*?(?=\n## |\s*$)/;
  const withoutOldBlock = content.replace(feedbackSection, "").trimEnd();
  const updated = `${withoutOldBlock}\n\n${block}\n`;

  if (updated !== content) writeFileSync(path, updated);
}

function loadCatalogGroups(): Map<string, "framework" | "paid" | "experimental"> {
  const groups = new Map<string, "framework" | "paid" | "experimental">();
  const catalog = JSON.parse(readFileSync("skills.sh.json", "utf8"));
  for (const grouping of catalog.groupings ?? []) {
    const kind = grouping.title.startsWith("Framework")
      ? "framework"
      : grouping.title.startsWith("Experimental")
        ? "experimental"
        : "paid";
    for (const skill of grouping.skills ?? []) groups.set(skill, kind);
  }
  return groups;
}

const skills = findSkillFiles("plugins");

if (FIX_FEEDBACK) {
  for (const path of skills) {
    const { name } = parseSkill(path);
    if (name) syncFeedbackBlock(path, name);
  }
}

const catalogGroups = loadCatalogGroups();
const seenDirs = new Set<string>();
const errors: string[] = [];

for (const path of skills) {
  const { name, description, body, bodyLines } = parseSkill(path);
  const rel = path.replace(process.cwd() + "/", "");
  const dirName = dirname(path).split("/").pop() ?? "";
  seenDirs.add(dirName);
  const isPaid = dirName.startsWith("eas-");

  if (description.length > MAX_DESCRIPTION)
    errors.push(`${rel}: description ${description.length} chars (max ${MAX_DESCRIPTION})`);
  if (bodyLines > MAX_BODY_LINES)
    errors.push(`${rel}: body ${bodyLines} lines (max ${MAX_BODY_LINES})`);

  // naming: expo-* (framework) or eas-* (paid EAS service), frontmatter name matches directory
  if (!dirName.startsWith("expo-") && !dirName.startsWith("eas-"))
    errors.push(`${rel}: skill directory must be named expo-* or eas-* (got "${dirName}")`);
  if (name !== dirName)
    errors.push(`${rel}: frontmatter name "${name}" does not match directory "${dirName}"`);

  // Every installed skill carries the same actionable feedback instructions with its own name.
  if (!body.trimEnd().endsWith(feedbackBlock(name)))
    errors.push(`${rel}: missing canonical feedback block; run "bun scripts/check-skill-limits.ts --fix-feedback"`);

  // Category prefix on the always-loaded description. The cross-cutting feedback skill
  // spans framework, EAS, docs, CLI, and MCP feedback, so it has no category label.
  const expectedPrefix = isPaid ? PAID_PREFIX : FRAMEWORK_PREFIX;
  if (!CATEGORY_PREFIX_EXEMPT_SKILLS.has(name) && !description.startsWith(expectedPrefix))
    errors.push(`${rel}: description must start with "${expectedPrefix}"`);

  // paid skills disclose costs up front (dash style varies: em dash or hyphen)
  const normalizedBody = body.replace(/—/g, "-");
  if (isPaid && (!normalizedBody.includes(PAID_CALLOUT) || !normalizedBody.includes(PAID_PRICING_LINK)))
    errors.push(`${rel}: paid skill body must include the "${PAID_CALLOUT}" callout with a ${PAID_PRICING_LINK} link`);

  // Codex trigger metadata
  const openaiYamlPath = join(dirname(path), "agents", "openai.yaml");
  if (!existsSync(openaiYamlPath)) {
    errors.push(`${rel}: missing agents/openai.yaml (Codex trigger metadata)`);
  } else if (isPaid) {
    const yaml = readFileSync(openaiYamlPath, "utf8");
    const shortDesc = yaml.match(/^\s*short_description:\s*"?(.*?)"?\s*$/m)?.[1] ?? "";
    if (!shortDesc.startsWith(PAID_CODEX_PREFIX))
      errors.push(`${rel}: paid skill's openai.yaml short_description must start with "${PAID_CODEX_PREFIX}"`);
  }

  // catalog sync with skills.sh.json groups; the experimental group accepts either
  // prefix - the description label still enforces the free vs paid boundary
  const group = catalogGroups.get(dirName);
  if (!group) errors.push(`${rel}: skill is not listed in skills.sh.json`);
  else if (group !== "experimental" && group !== (isPaid ? "paid" : "framework"))
    errors.push(`${rel}: skills.sh.json lists this skill in the ${group} group, but the ${isPaid ? "eas-" : "expo-"} prefix requires the ${isPaid ? "paid" : "framework"} group`);
}

for (const [skill] of catalogGroups) {
  if (!seenDirs.has(skill))
    errors.push(`skills.sh.json: lists "${skill}" but no plugins/*/skills/${skill}/SKILL.md exists`);
}

if (errors.length === 0) {
  console.log("✓ All skills pass limits, naming, feedback, category labels, paid callouts, Codex metadata, and catalog sync.");
  process.exit(0);
} else {
  console.log("✗ Skill check violations:\n");
  for (const e of errors) console.log(`  ${e}`);
  process.exit(1);
}
