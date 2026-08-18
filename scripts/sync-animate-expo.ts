#!/usr/bin/env bun

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const UPSTREAM_REPOSITORY = "emilkowalski/skills";
const UPSTREAM_SKILL_DIRECTORY = "skills/animate-expo";
const LOCAL_SKILL_DIRECTORY = "plugins/expo/skills/expo-animation";
const DEFAULT_REF = "main";
const HEADING = "# Building Animations in Expo";
const ATTRIBUTION =
  "This skill was created in collaboration with [Emil Kowalski](https://github.com/emilkowalski) and can also be found in the [emilkowalski/skills](https://github.com/emilkowalski/skills) repository, along with other useful animation skills.";
const FEEDBACK = `## Submitting Feedback
If you encounter errors, misleading or outdated information in this skill, report it so Expo can improve:
\`\`\`bash
npx --yes submit-expo-feedback@latest --category skills --subject "expo-animation" "<actionable feedback>"
\`\`\`
Only submit when you have something specific and actionable to report. Include as much relevant context as possible.
If an AI agent repeatedly failed or the user had to take over an Expo task, load the expo-skill-feedback skill and follow its eval-candidate flow instead of reusing the command above.`;
const USAGE = `Usage: bun scripts/sync-animate-expo.ts [options]

Sync Emil Kowalski's animate-expo skill into the Expo repository while preserving
the Expo-specific skill name, category metadata, attribution, and feedback block.

Options:
  --check       Report drift without writing files.
  --ref <ref>   Sync from an upstream branch, tag, or commit (default: main).
  -h, --help    Show this help.`;

type Options = {
  check: boolean;
  ref: string;
};

function fail(message: string): never {
  console.error(`${message}\n\n${USAGE}`);
  process.exit(1);
}

function parseOptions(args: string[]): Options {
  let check = false;
  let ref = DEFAULT_REF;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--check") {
      check = true;
    } else if (arg === "--ref") {
      const value = args[index + 1];
      if (!value || value.startsWith("-")) fail("--ref requires a value.");
      ref = value;
      index += 1;
    } else if (arg === "-h" || arg === "--help") {
      console.log(USAGE);
      process.exit(0);
    } else {
      fail(`Unknown option: ${arg}`);
    }
  }

  return { check, ref };
}

function normalize(contents: string): string {
  return `${contents.replace(/\r\n/g, "\n").trimEnd()}\n`;
}

async function fetchUpstream(path: string, ref: string): Promise<string> {
  const url = new URL(
    `https://api.github.com/repos/${UPSTREAM_REPOSITORY}/contents/${path}`,
  );
  url.searchParams.set("ref", ref);

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.raw+json",
    "User-Agent": "expo-skills-sync",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(
      `Could not fetch ${path} at ${ref}: ${response.status} ${response.statusText}`,
    );
  }

  return normalize(await response.text());
}

function extractVersion(path: string): string {
  if (!existsSync(path)) return "1.0.0";
  return (
    readFileSync(path, "utf8").match(/^version:\s*(.+?)\s*$/m)?.[1] ?? "1.0.0"
  );
}

function renderSkill(upstream: string, version: string): string {
  const match = upstream.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match)
    throw new Error("Upstream SKILL.md does not have valid frontmatter.");

  const description = match[1].match(/^description:\s*(.+?)\s*$/m)?.[1];
  if (!description)
    throw new Error("Upstream SKILL.md is missing its description.");

  const body = match[2].trim();
  if (!body.startsWith(HEADING)) {
    throw new Error(`Upstream SKILL.md must start with \"${HEADING}\".`);
  }
  const bodyAfterHeading = body.slice(HEADING.length).replace(/^\n+/, "");

  return normalize(`---
name: expo-animation
description: Framework (OSS). ${description}
version: ${version}
license: MIT
---

${HEADING}

${ATTRIBUTION}

${bodyAfterHeading}

${FEEDBACK}`);
}

function updateFile(path: string, expected: string, check: boolean): boolean {
  const current = existsSync(path)
    ? readFileSync(path, "utf8").replace(/\r\n/g, "\n")
    : "";
  if (current === expected) return false;

  if (!check) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, expected);
  }
  return true;
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const localDirectory = resolve(repositoryRoot, LOCAL_SKILL_DIRECTORY);
  const localSkillPath = resolve(localDirectory, "SKILL.md");

  const [upstreamSkill, upstreamRecipes, upstreamLicense] = await Promise.all([
    fetchUpstream(`${UPSTREAM_SKILL_DIRECTORY}/SKILL.md`, options.ref),
    fetchUpstream(`${UPSTREAM_SKILL_DIRECTORY}/RECIPES.md`, options.ref),
    fetchUpstream("LICENSE", options.ref),
  ]);

  const expectedFiles = new Map([
    [
      localSkillPath,
      renderSkill(upstreamSkill, extractVersion(localSkillPath)),
    ],
    [resolve(localDirectory, "RECIPES.md"), upstreamRecipes],
    [resolve(localDirectory, "LICENSE"), upstreamLicense],
  ]);
  const changed = [...expectedFiles].filter(([path, expected]) =>
    updateFile(path, expected, options.check),
  );

  if (changed.length === 0) {
    console.log(
      `expo-animation is up to date with ${UPSTREAM_REPOSITORY}@${options.ref}.`,
    );
    return;
  }

  for (const [path] of changed) {
    console.log(
      `${options.check ? "Out of date" : "Updated"}: ${path.slice(repositoryRoot.length + 1)}`,
    );
  }
  if (options.check) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
