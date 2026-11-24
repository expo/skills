import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { feedbackBlock } from "./feedback-block";

const script = join(import.meta.dir, "check-skill-limits.ts");
const paidCallout = "> **EAS service - costs apply.** See https://expo.dev/pricing for plan limits.";

let root: string;

type Groups = { framework?: string[]; services?: string[]; experimental?: string[] };

function writeCatalog({ framework = [], services = [], experimental = [] }: Groups) {
  const groupings = [
    { title: "Framework (open source)", skills: framework },
    { title: "Services & paid distribution", skills: services },
    { title: "Experimental", skills: experimental },
  ];
  writeFileSync(join(root, "skills.sh.json"), JSON.stringify({ groupings }));
}

function writeSkill(name: string, { paid = false } = {}) {
  const dir = join(root, "plugins", "expo", "skills", name);
  mkdirSync(join(dir, "agents"), { recursive: true });
  writeFileSync(join(dir, "agents", "openai.yaml"), "interface:\n  display_name: \"Test\"\n");
  const body = [`# ${name}`, "", ...(paid ? [paidCallout, ""] : []), "Instructions.", "", feedbackBlock(name)];
  writeFileSync(join(dir, "SKILL.md"), `---\nname: ${name}\ndescription: Test skill.\n---\n${body.join("\n")}\n`);
}

function runCheck() {
  const result = spawnSync("bun", [script], { cwd: root, encoding: "utf8" });
  return { status: result.status, output: result.stdout + result.stderr };
}

describe("Checking skill catalog groups", () => {
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "skill-limits-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("should pass when framework and services skills are in their groups", () => {
    writeSkill("expo-router");
    writeSkill("expo-hosting", { paid: true });
    writeCatalog({ framework: ["expo-router"], services: ["expo-hosting"] });

    expect(runCheck().status).toBe(0);
  });

  it("should allow an experimental skill with or without the paid callout", () => {
    writeSkill("expo-free-preview");
    writeSkill("expo-paid-preview", { paid: true });
    writeCatalog({ experimental: ["expo-free-preview", "expo-paid-preview"] });

    expect(runCheck().status).toBe(0);
  });

  it("should reject a skill without the expo- prefix", () => {
    writeSkill("eas-hosting", { paid: true });
    writeCatalog({ services: ["eas-hosting"] });

    const { status, output } = runCheck();
    expect(status).toBe(1);
    expect(output).toContain('must be named expo-* (got "eas-hosting")');
  });

  it("should reject a skill that is missing from the catalog", () => {
    writeSkill("expo-router");
    writeCatalog({});

    const { status, output } = runCheck();
    expect(status).toBe(1);
    expect(output).toContain("expo-router/SKILL.md: skill is not listed in skills.sh.json");
  });

  it("should reject a services skill without the paid callout", () => {
    writeSkill("expo-hosting");
    writeCatalog({ services: ["expo-hosting"] });

    const { status, output } = runCheck();
    expect(status).toBe(1);
    expect(output).toContain("expo-hosting/SKILL.md: paid skill body must include");
  });

  it("should reject a framework skill that has the paid callout", () => {
    writeSkill("expo-hosting", { paid: true });
    writeCatalog({ framework: ["expo-hosting"] });

    const { status, output } = runCheck();
    expect(status).toBe(1);
    expect(output).toContain("lists it in the framework group; move it to Services");
  });

  it("should reject a services skill that is also listed in another group", () => {
    writeSkill("expo-hosting");
    writeCatalog({ services: ["expo-hosting"], experimental: ["expo-hosting"] });

    const { status, output } = runCheck();
    expect(status).toBe(1);
    expect(output).toContain('"expo-hosting" is listed in more than one group');
    expect(output).toContain("expo-hosting/SKILL.md: paid skill body must include");
  });

  it("should reject an unknown catalog group", () => {
    writeSkill("expo-router");
    writeFileSync(
      join(root, "skills.sh.json"),
      JSON.stringify({ groupings: [{ title: "Paid services", skills: ["expo-router"] }] }),
    );

    const { status, output } = runCheck();
    expect(status).toBe(1);
    expect(output).toContain('unknown group "Paid services"');
  });
});
