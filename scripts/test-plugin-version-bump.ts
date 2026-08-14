#!/usr/bin/env bun

// Exercises scripts/check-plugin-version-bump.ts so a reviewer can verify the
// --help and --set-version options without hand-running each case.
//
// Usage: bun scripts/test-plugin-version-bump.ts
//
// The --set-version cases write to the three plugin manifests. This script backs
// them up first and restores them on exit, so any uncommitted edits you already
// had in those files survive a run (including a failed one).
//
// Every case compares against HEAD rather than origin/main, so the script works
// in a clone that has never fetched the remote.

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

const backupDir = mkdtempSync(join(tmpdir(), "plugin-version-bump-"));

let passed = 0;
let failed = 0;

function backupOf(manifest: string) {
  return join(backupDir, `${basename(dirname(manifest))}.json`);
}

function pass(name: string) {
  console.log(`ok   ${name}`);
  passed += 1;
}

function fail(name: string, detail: string) {
  console.log(`FAIL ${name}\n     ${detail}`);
  failed += 1;
}

function check(name: string, condition: boolean, detail: string) {
  if (condition) {
    pass(name);
  } else {
    fail(name, detail);
  }
}

function expect(name: string, expectedCode: number, expectedText: string, args: string[]) {
  const result = Bun.spawnSync(["bun", checkScript, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const output = `${result.stdout.toString()}${result.stderr.toString()}`;

  if (result.exitCode !== expectedCode) {
    fail(name, `expected exit ${expectedCode}, got ${result.exitCode}`);
    return;
  }

  if (!output.includes(expectedText)) {
    fail(name, `output did not contain: ${expectedText}`);
    return;
  }

  pass(name);
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
  rmSync(backupDir, { recursive: true, force: true });
}

for (const manifest of manifests) {
  copyFileSync(manifest, backupOf(manifest));
}

process.on("SIGINT", () => {
  restoreManifests();
  process.exit(130);
});

try {
  const current = baseVersionOf(manifests[0] as string);
  const next = bumpPatch(current, 1);
  const later = bumpPatch(current, 2);

  console.log(`Current version: ${current} — test bump targets: ${next}, ${later}\n`);

  console.log("# help");
  expect("--help prints usage", 0, "Usage: bun scripts/check-plugin-version-bump.ts", ["--help"]);
  expect("-h prints usage", 0, "--set-version <ver>", ["-h"]);
  expect("help lists the manifests", 0, "plugins/expo/.cursor-plugin/plugin.json", ["--help"]);

  console.log("\n# argument errors");
  expect("unknown option is rejected", 1, "Unknown option: --bogus", ["--bogus"]);
  expect("extra positional is rejected", 1, "Unexpected argument: extra", ["HEAD", "extra"]);
  expect("--set-version without a value", 1, "requires a version argument", ["--set-version"]);
  expect("--set-version= without a value", 1, "requires a version argument", ["--set-version="]);

  console.log("\n# semver validation");
  const invalidVersions = ["1.9", `v${next}`, "1.2.3.4", "01.2.3", `${next}.`];
  for (const version of invalidVersions) {
    expect(`rejects "${version}"`, 1, "not a valid semver version", [
      "HEAD",
      "--set-version",
      version,
    ]);
  }

  console.log("\n# base-ref comparison");
  expect("same version as base is rejected", 1, "is not greater than", [
    "HEAD",
    "--set-version",
    current,
  ]);
  expect("lower version is rejected", 1, "is not greater than", ["HEAD", "--set-version", "0.0.1"]);

  console.log("\n# no manifest was written by a rejected case");
  const untouched = manifests.filter(
    (manifest) => readFileSync(manifest, "utf8") === readFileSync(backupOf(manifest), "utf8")
  );
  check(
    "rejected cases left the manifests untouched",
    untouched.length === manifests.length,
    `${manifests.length - untouched.length} manifest(s) were modified`
  );

  console.log("\n# writing");
  expect("bump is accepted", 0, `All three plugin manifests are now at ${next}`, [
    "HEAD",
    "--set-version",
    next,
  ]);

  const written = manifests.filter((manifest) => versionOf(manifest) === next);
  check(
    `all three manifests are at ${next}`,
    written.length === manifests.length,
    `only ${written.length} of ${manifests.length} manifests were written`
  );

  const singleLineEdits = manifests.filter((manifest) => changedLineCount(manifest) === 1);
  check(
    "each manifest changed exactly one line",
    singleLineEdits.length === manifests.length,
    `only ${singleLineEdits.length} of ${manifests.length} manifests changed exactly one line`
  );

  expect("re-running the same version is a no-op", 0, `Unchanged Claude: already ${next}`, [
    "HEAD",
    "--set-version",
    next,
  ]);
  expect("--set-version= form is accepted", 0, `All three plugin manifests are now at ${later}`, [
    "HEAD",
    `--set-version=${later}`,
  ]);

  console.log("\n# the check itself still runs");
  const report = Bun.spawnSync(["bun", checkScript, "HEAD"], { stdout: "pipe", stderr: "pipe" });
  const reportOutput = `${report.stdout.toString()}${report.stderr.toString()}`;
  check(
    `check against HEAD produced a report (exit ${report.exitCode})`,
    report.exitCode <= 1 && reportOutput.includes("## Expo plugin version check"),
    `exit ${report.exitCode} with no report`
  );
} finally {
  restoreManifests();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
