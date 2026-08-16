// Exercises scripts/check-plugin-version-bump.ts so a reviewer can verify the
// --help and --set-version options without hand-running each case.
//
// Usage: bun test scripts/check-plugin-version-bump.test.ts
//
// The --set-version cases write to the three plugin manifests. They are backed
// up before the suite and restored before every test and after the run, so each
// test starts from a pristine copy and any uncommitted edits you already had in
// those files survive the run.
//
// Every case compares against HEAD rather than origin/main, so the suite works
// in a clone that has never fetched the remote.

import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

const checkScript = "scripts/check-plugin-version-bump.ts";

const manifests = [
  "plugins/expo/.claude-plugin/plugin.json",
  "plugins/expo/.codex-plugin/plugin.json",
  "plugins/expo/.cursor-plugin/plugin.json",
];

process.chdir(join(import.meta.dir, ".."));

function runCheck(...args: string[]) {
  const result = Bun.spawnSync(["bun", checkScript, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });

  return {
    exitCode: result.exitCode,
    output: `${result.stdout.toString()}${result.stderr.toString()}`,
  };
}

function versionOf(manifest: string) {
  return JSON.parse(readFileSync(manifest, "utf8")).version as string;
}

// The base-ref version, not the working-tree one: it is what the script compares
// against, so the cases stay correct even when a manifest has local edits.
function baseVersionOf(manifest: string) {
  const contents = execFileSync("git", ["show", `HEAD:${manifest}`], { encoding: "utf8" });
  return JSON.parse(contents).version as string;
}

function bumpPatch(version: string, by: number) {
  const [major, minor, patch] = version.split(".");
  return `${major}.${minor}.${Number(patch) + by}`;
}

const baseVersion = baseVersionOf(manifests[0] as string);
const nextVersion = bumpPatch(baseVersion, 1);
const laterVersion = bumpPatch(baseVersion, 2);

let backupDir: string;

function backupOf(manifest: string) {
  return join(backupDir, `${basename(dirname(manifest))}.json`);
}

function changedLineCount(manifest: string) {
  const before = readFileSync(backupOf(manifest), "utf8").split("\n");
  const after = readFileSync(manifest, "utf8").split("\n");

  if (before.length !== after.length) {
    return Number.POSITIVE_INFINITY;
  }

  return before.filter((line, index) => line !== after[index]).length;
}

function restoreManifests() {
  for (const manifest of manifests) {
    copyFileSync(backupOf(manifest), manifest);
  }
}

beforeAll(() => {
  backupDir = mkdtempSync(join(tmpdir(), "plugin-version-bump-"));
  for (const manifest of manifests) {
    copyFileSync(manifest, backupOf(manifest));
  }
});

beforeEach(() => {
  restoreManifests();
});

afterAll(() => {
  restoreManifests();
  rmSync(backupDir, { recursive: true, force: true });
});

describe("--help", () => {
  test("prints usage", () => {
    const { exitCode, output } = runCheck("--help");

    expect(exitCode).toBe(0);
    expect(output).toContain("Usage: bun scripts/check-plugin-version-bump.ts");
  });

  test("-h is an alias", () => {
    const { exitCode, output } = runCheck("-h");

    expect(exitCode).toBe(0);
    expect(output).toContain("--set-version <ver>");
  });

  test("lists the manifests it writes", () => {
    const { output } = runCheck("--help");

    for (const manifest of manifests) {
      expect(output).toContain(manifest);
    }
  });
});

describe("argument errors", () => {
  test("rejects an unknown option", () => {
    const { exitCode, output } = runCheck("--bogus");

    expect(exitCode).toBe(1);
    expect(output).toContain("Unknown option: --bogus");
  });

  test("rejects a second positional argument", () => {
    const { exitCode, output } = runCheck("HEAD", "extra");

    expect(exitCode).toBe(1);
    expect(output).toContain("Unexpected argument: extra");
  });

  test("rejects --set-version with no value", () => {
    const { exitCode, output } = runCheck("--set-version");

    expect(exitCode).toBe(1);
    expect(output).toContain("requires a version argument");
  });

  test("rejects --set-version= with no value", () => {
    const { exitCode, output } = runCheck("--set-version=");

    expect(exitCode).toBe(1);
    expect(output).toContain("requires a version argument");
  });
});

describe("semver validation", () => {
  const invalidVersions = ["1.9", `v${nextVersion}`, "1.2.3.4", "01.2.3", `${nextVersion}.`];

  for (const version of invalidVersions) {
    test(`rejects "${version}"`, () => {
      const { exitCode, output } = runCheck("HEAD", "--set-version", version);

      expect(exitCode).toBe(1);
      expect(output).toContain("not a valid semver version");
    });
  }
});

describe("base-ref comparison", () => {
  test("rejects the version already on the base ref", () => {
    const { exitCode, output } = runCheck("HEAD", "--set-version", baseVersion);

    expect(exitCode).toBe(1);
    expect(output).toContain("is not greater than");
  });

  test("rejects a version below the base ref", () => {
    const { exitCode, output } = runCheck("HEAD", "--set-version", "0.0.1");

    expect(exitCode).toBe(1);
    expect(output).toContain("is not greater than");
  });

  test("leaves every manifest untouched when it rejects", () => {
    runCheck("HEAD", "--set-version", "0.0.1");

    for (const manifest of manifests) {
      expect(readFileSync(manifest, "utf8")).toBe(readFileSync(backupOf(manifest), "utf8"));
    }
  });
});

describe("--set-version", () => {
  test("writes the version to all three manifests", () => {
    const { exitCode, output } = runCheck("HEAD", "--set-version", nextVersion);

    expect(exitCode).toBe(0);
    expect(output).toContain(`All three plugin manifests are now at ${nextVersion}`);

    for (const manifest of manifests) {
      expect(versionOf(manifest)).toBe(nextVersion);
    }
  });

  test("changes exactly one line per manifest", () => {
    runCheck("HEAD", "--set-version", nextVersion);

    for (const manifest of manifests) {
      expect(changedLineCount(manifest)).toBe(1);
    }
  });

  test("reports no change when the version already matches", () => {
    runCheck("HEAD", "--set-version", nextVersion);
    const { exitCode, output } = runCheck("HEAD", "--set-version", nextVersion);

    expect(exitCode).toBe(0);
    expect(output).toContain(`Unchanged Claude: already ${nextVersion}`);
  });

  test("accepts the --set-version=<version> form", () => {
    const { exitCode, output } = runCheck("HEAD", `--set-version=${laterVersion}`);

    expect(exitCode).toBe(0);
    expect(output).toContain(`All three plugin manifests are now at ${laterVersion}`);
  });
});

describe("the check itself", () => {
  test("still produces its Markdown report", () => {
    const { exitCode, output } = runCheck("HEAD");

    expect([0, 1]).toContain(exitCode);
    expect(output).toContain("## Expo plugin version check");
  });
});
