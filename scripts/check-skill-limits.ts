#!/usr/bin/env bun

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MAX_DESCRIPTION = 1024;
const MAX_BODY_LINES = 500;

function findSkillFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findSkillFiles(path));
    else if (entry.name === "SKILL.md") results.push(path);
  }
  return results;
}

function parseSkill(path: string): { description: string; bodyLines: number } {
  const content = readFileSync(path, "utf8");
  // captures everything between the two --- fences (group 1 = frontmatter, group 2 = body)
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { description: "", bodyLines: 0 };
  const frontmatter = match[1];
  const body = match[2];
  // matches "description: <value>" — optional quotes, multiline value
  const descMatch = frontmatter.match(/^description:\s*["']?([\s\S]*?)["']?\s*$/m);
  const description = descMatch ? descMatch[1].replace(/^"|"$/g, "") : "";
  return { description, bodyLines: body.split("\n").length };
}

const skills = findSkillFiles("plugins");
const errors: string[] = [];

for (const path of skills) {
  const { description, bodyLines } = parseSkill(path);
  const rel = path.replace(process.cwd() + "/", "");
  if (description.length > MAX_DESCRIPTION)
    errors.push(`${rel}: description ${description.length} chars (max ${MAX_DESCRIPTION})`);
  if (bodyLines > MAX_BODY_LINES)
    errors.push(`${rel}: body ${bodyLines} lines (max ${MAX_BODY_LINES})`);
}

if (errors.length === 0) {
  console.log("✓ All skills pass description and body limits.");
  process.exit(0);
} else {
  console.log("✗ Skill limit violations:\n");
  for (const e of errors) console.log(`  ${e}`);
  process.exit(1);
}
