// Exercises scripts/check-skill-limits.ts so the body-line cap is checked
// against real skill files, not only against the ones this repository happens
// to ship.
//
// Usage: bun test scripts/check-skill-limits.test.ts
//
// Every case runs the script against a throwaway workspace -- a minimal
// plugins/ tree plus skills.sh.json -- so the check never sees (or writes to)
// this repository's own skills.

import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const checkScript = join(import.meta.dir, "check-skill-limits.ts");
const SKILL_NAME = "expo-fixture";
const workspaces: string[] = [];

function runCheck(cwd: string, ...args: string[]) {
  const result = Bun.spawnSync(["bun", checkScript, ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  return {
    exitCode: result.exitCode,
    output: `${result.stdout.toString()}${result.stderr.toString()}`,
  };
}

function skillPath(dir: string) {
  return join(dir, "plugins", "expo", "skills", SKILL_NAME, "SKILL.md");
}

// The number of lines a skill body really has: the body is everything after
// the closing frontmatter fence, so it carries the file's trailing newline
// and that newline does not start a line of its own.
function bodyLineCount(content: string) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return 0;
  return match[2].replace(/\n$/, "").split("\n").length;
}

// A workspace holding one minimal but otherwise valid skill.
function createWorkspace() {
  const dir = mkdtempSync(join(tmpdir(), "skill-limits-"));
  workspaces.push(dir);

  const skillDir = join(dir, "plugins", "expo", "skills", SKILL_NAME);
  mkdirSync(join(skillDir, "agents"), { recursive: true });
  writeFileSync(
    join(skillDir, "agents", "openai.yaml"),
    "display_name: Expo Fixture\nshort_description: A fixture skill.\ndefault_prompt: Use $expo-fixture\n"
  );
  writeFileSync(
    join(dir, "skills.sh.json"),
    `${JSON.stringify(
      { groupings: [{ title: "Framework", skills: [SKILL_NAME] }] },
      null,
      2
    )}\n`
  );
  writeFileSync(
    skillPath(dir),
    `---\nname: ${SKILL_NAME}\ndescription: Fixture skill for the body-line cap check.\n---\n\n# Fixture\n`
  );

  // --fix-feedback installs the canonical feedback block, so the fixture
  // satisfies every rule the check enforces besides the line cap.
  runCheck(dir, "--fix-feedback");

  return dir;
}

// Pad the body to exactly `total` lines, keeping the feedback block last.
function setBodyLines(dir: string, total: number) {
  const path = skillPath(dir);
  const content = readFileSync(path, "utf8");
  const [head, tail] = content.split("## Submitting Feedback");
  const filler = Math.max(total - bodyLineCount(content), 0);
  writeFileSync(
    path,
    `${head}${"filler line\n".repeat(filler)}## Submitting Feedback${tail}`
  );
}

afterAll(() => {
  for (const dir of workspaces) rmSync(dir, { recursive: true, force: true });
});

describe("body line cap", () => {
  test("accepts a body of exactly 500 lines", () => {
    const dir = createWorkspace();
    setBodyLines(dir, 500);

    const result = runCheck(dir);
    expect(result.output).not.toContain("lines (max 500)");
    expect(result.exitCode).toBe(0);
  });

  test("rejects a body of 501 lines", () => {
    const dir = createWorkspace();
    setBodyLines(dir, 501);

    const result = runCheck(dir);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("body 501 lines (max 500)");
  });
});
