#!/usr/bin/env bun

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { FEEDBACK_HEADING, feedbackBlock } from "./feedback-block";

const MAX_DESCRIPTION = 1024;
const MAX_BODY_LINES = 500;
const PAID_CALLOUT = "**EAS service - costs apply.**";
const PAID_PRICING_LINK = "expo.dev/pricing";
const FIX_FEEDBACK = process.argv.includes("--fix-feedback");

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
  const feedbackSection = new RegExp(`\\n${FEEDBACK_HEADING}\\n[\\s\\S]*?(?=\\n## |\\s*$)`);
  const withoutOldBlock = content.replace(feedbackSection, "").trimEnd();
  const updated = `${withoutOldBlock}\n\n${block}\n`;

  if (updated !== content) writeFileSync(path, updated);
}

type CatalogGroup = "framework" | "paid" | "experimental";

function catalogGroupKind(title: string): CatalogGroup | undefined {
  if (title.startsWith("Framework")) return "framework";
  if (title.startsWith("Services")) return "paid";
  if (title.startsWith("Experimental")) return "experimental";
  return undefined;
}

function loadCatalogGroups(errors: string[]): Map<string, CatalogGroup> {
  const groups = new Map<string, CatalogGroup>();
  const catalog = JSON.parse(readFileSync("skills.sh.json", "utf8"));
  for (const grouping of catalog.groupings ?? []) {
    const kind = catalogGroupKind(grouping.title ?? "");
    if (!kind) {
      errors.push(`skills.sh.json: unknown group "${grouping.title}"; use Framework, Services, or Experimental`);
      continue;
    }
    for (const skill of grouping.skills ?? []) {
      // A second listing would decide which rules apply, so a paid skill could skip its callout.
      if (groups.has(skill)) errors.push(`skills.sh.json: "${skill}" is listed in more than one group`);
      else groups.set(skill, kind);
    }
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

const errors: string[] = [];
const catalogGroups = loadCatalogGroups(errors);
const seenDirs = new Set<string>();

for (const path of skills) {
  const { name, description, body, bodyLines } = parseSkill(path);
  const rel = path.replace(process.cwd() + "/", "");
  const dirName = dirname(path).split("/").pop() ?? "";
  seenDirs.add(dirName);
  const group = catalogGroups.get(dirName);

  if (description.trim().length === 0)
    errors.push(`${rel}: description is empty`);
  else if (description.length > MAX_DESCRIPTION)
    errors.push(`${rel}: description ${description.length} chars (max ${MAX_DESCRIPTION})`);
  if (bodyLines > MAX_BODY_LINES)
    errors.push(`${rel}: body ${bodyLines} lines (max ${MAX_BODY_LINES})`);

  if (!dirName.startsWith("expo-"))
    errors.push(`${rel}: skill directory must be named expo-* (got "${dirName}")`);
  if (name !== dirName)
    errors.push(`${rel}: frontmatter name "${name}" does not match directory "${dirName}"`);

  // Every installed skill carries the same actionable feedback instructions with its own name.
  if (!body.trimEnd().endsWith(feedbackBlock(name)))
    errors.push(`${rel}: missing canonical feedback block; run "bun scripts/check-skill-limits.ts --fix-feedback"`);

  // paid skills disclose costs up front (dash style varies: em dash or hyphen)
  const normalizedBody = body.replace(/—/g, "-");
  const hasPaidCallout = normalizedBody.includes(PAID_CALLOUT);
  if (group === "paid" && (!hasPaidCallout || !normalizedBody.includes(PAID_PRICING_LINK)))
    errors.push(`${rel}: paid skill body must include the "${PAID_CALLOUT}" callout with a ${PAID_PRICING_LINK} link`);
  if (group === "framework" && hasPaidCallout)
    errors.push(`${rel}: skill has the "${PAID_CALLOUT}" callout but skills.sh.json lists it in the framework group; move it to Services`);

  // Codex trigger metadata
  const openaiYamlPath = join(dirname(path), "agents", "openai.yaml");
  if (!existsSync(openaiYamlPath))
    errors.push(`${rel}: missing agents/openai.yaml (Codex trigger metadata)`);

  if (!group) errors.push(`${rel}: skill is not listed in skills.sh.json`);
}

for (const [skill] of catalogGroups) {
  if (!seenDirs.has(skill))
    errors.push(`skills.sh.json: lists "${skill}" but no plugins/*/skills/${skill}/SKILL.md exists`);
}

if (errors.length === 0) {
  console.log("✓ All skills pass limits, naming, feedback, paid callouts, Codex metadata, and catalog sync.");
  process.exit(0);
} else {
  console.log("✗ Skill check violations:\n");
  for (const e of errors) console.log(`  ${e}`);
  process.exit(1);
}
