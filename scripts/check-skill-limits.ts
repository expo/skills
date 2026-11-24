#!/usr/bin/env bun

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { AGENT_CLI, AGENT_CLI_ALLOWED_TOOL, expoCliCalls } from "./agent-cli";
import { FEEDBACK_HEADING, feedbackBlock } from "./feedback-block";

const MAX_DESCRIPTION = 1024;
const MAX_BODY_LINES = 500;
const PAID_CALLOUT = "**EAS service - costs apply.**";
const PAID_PRICING_LINK = "expo.dev/pricing";
const FIX_FEEDBACK = process.argv.includes("--fix-feedback");
// Synced from upstream by sync-animate-expo.ts; edits there would be overwritten.
const SYNCED_SKILL_DIRS = ["expo-animation"];

function findFiles(dir: string, matches: (name: string) => boolean): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findFiles(path, matches));
    else if (matches(entry.name)) results.push(path);
  }
  return results;
}

function parseSkill(path: string): { name: string; description: string; allowedTools: string | undefined; body: string; bodyLines: number } {
  const content = readFileSync(path, "utf8");
  // captures everything between the two --- fences (group 1 = frontmatter, group 2 = body)
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { name: "", description: "", allowedTools: undefined, body: "", bodyLines: 0 };
  const frontmatter = match[1];
  const body = match[2];
  // matches "description: <value>" — optional quotes, multiline value
  const descMatch = frontmatter.match(/^description:\s*["']?([\s\S]*?)["']?\s*$/m);
  const description = descMatch ? descMatch[1].replace(/^"|"$/g, "") : "";
  const nameMatch = frontmatter.match(/^name:\s*(.+?)\s*$/m);
  const name = nameMatch ? nameMatch[1] : "";
  // undefined: no allowed-tools key. "": a YAML block list, which the checks below cannot read.
  const allowedTools = frontmatter.match(/^allowed-tools:[ \t]*(.*)$/m)?.[1];
  return { name, description, allowedTools, body, bodyLines: body.split("\n").length };
}

function syncFeedbackBlock(path: string, skillName: string): void {
  const content = readFileSync(path, "utf8");
  const block = feedbackBlock(skillName);
  const feedbackSection = new RegExp(`\\n${FEEDBACK_HEADING}\\n[\\s\\S]*?(?=\\n## |\\s*$)`);
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

const skills = findFiles("plugins", (name) => name === "SKILL.md");

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
  const { name, description, allowedTools, body, bodyLines } = parseSkill(path);
  const rel = path.replace(process.cwd() + "/", "");
  const dirName = dirname(path).split("/").pop() ?? "";
  seenDirs.add(dirName);
  const isPaid = dirName.startsWith("eas-");

  if (description.trim().length === 0)
    errors.push(`${rel}: description is empty`);
  else if (description.length > MAX_DESCRIPTION)
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

  // Skills that pre-approve Bash also pre-approve the agent CLI, because skills run Expo CLI through it.
  if (allowedTools === "")
    errors.push(`${rel}: write allowed-tools as one quoted line, so this check can read it`);
  else if (allowedTools?.includes("Bash(") && !allowedTools.includes(AGENT_CLI_ALLOWED_TOOL))
    errors.push(`${rel}: allowed-tools pre-approves Bash but not ${AGENT_CLI_ALLOWED_TOOL}`);

  // paid skills disclose costs up front (dash style varies: em dash or hyphen)
  const normalizedBody = body.replace(/—/g, "-");
  if (isPaid && (!normalizedBody.includes(PAID_CALLOUT) || !normalizedBody.includes(PAID_PRICING_LINK)))
    errors.push(`${rel}: paid skill body must include the "${PAID_CALLOUT}" callout with a ${PAID_PRICING_LINK} link`);

  // Codex trigger metadata
  const openaiYamlPath = join(dirname(path), "agents", "openai.yaml");
  if (!existsSync(openaiYamlPath))
    errors.push(`${rel}: missing agents/openai.yaml (Codex trigger metadata)`);

  // catalog sync with skills.sh.json groups; the experimental group accepts either
  // expo-* or eas-* names
  const group = catalogGroups.get(dirName);
  if (!group) errors.push(`${rel}: skill is not listed in skills.sh.json`);
  else if (group !== "experimental" && group !== (isPaid ? "paid" : "framework"))
    errors.push(`${rel}: skills.sh.json lists this skill in the ${group} group, but the ${isPaid ? "eas-" : "expo-"} prefix requires the ${isPaid ? "paid" : "framework"} group`);
}

// Skills run Expo CLI through the agent CLI, which forwards Expo CLI commands and adds its own.
const markdownFiles = findFiles("plugins", (name) => name.endsWith(".md")).filter(
  (path) => !SYNCED_SKILL_DIRS.some((dir) => path.includes(`/skills/${dir}/`))
);
for (const path of markdownFiles) {
  for (const { line, text } of expoCliCalls(readFileSync(path, "utf8")))
    errors.push(`${path}:${line}: use "${AGENT_CLI} <command>" in place of npx expo, expo-doctor (doctor), or create-expo-app (new): ${text.slice(0, 100)}`);
}

for (const [skill] of catalogGroups) {
  if (!seenDirs.has(skill))
    errors.push(`skills.sh.json: lists "${skill}" but no plugins/*/skills/${skill}/SKILL.md exists`);
}

if (errors.length === 0) {
  console.log("✓ All skills pass limits, naming, feedback, agent CLI, paid callouts, Codex metadata, and catalog sync.");
  process.exit(0);
} else {
  console.log("✗ Skill check violations:\n");
  for (const e of errors) console.log(`  ${e}`);
  process.exit(1);
}
