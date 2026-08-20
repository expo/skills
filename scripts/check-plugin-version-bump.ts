#!/usr/bin/env bun

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { semver } from "bun";

type PluginManifest = {
  label: string;
  path: string;
};

type VersionRow = PluginManifest & {
  baseVersion: unknown;
  currentVersion: unknown;
};

const pluginManifests: PluginManifest[] = [
  {
    label: "Claude",
    path: "plugins/expo/.claude-plugin/plugin.json",
  },
  {
    label: "Codex",
    path: "plugins/expo/.codex-plugin/plugin.json",
  },
  {
    label: "Cursor",
    path: "plugins/expo/.cursor-plugin/plugin.json",
  },
  {
    label: "Grok",
    path: "plugins/expo/.grok-plugin/plugin.json",
  },
];

const versionedPluginPaths = [
  "plugins/expo/skills/",
  "plugins/expo/.claude-plugin/plugin.json",
  "plugins/expo/.codex-plugin/plugin.json",
  "plugins/expo/.cursor-plugin/plugin.json",
  "plugins/expo/.grok-plugin/plugin.json",
  "plugins/expo/.mcp.json",
  "plugins/expo/mcp.json",
];

const USAGE = `Usage: bun scripts/check-plugin-version-bump.ts [base-ref] [options]

Guards the rule that CI enforces: when any versioned Expo plugin file changes,
the Claude, Codex, Cursor, and Grok plugin manifests must all be bumped together
to the same version, and that version must be greater than the one on the base ref.

Versioned paths:
${versionedPluginPaths.map((path) => `  ${path}`).join("\n")}

Manifests:
${pluginManifests.map((manifest) => `  ${manifest.label.padEnd(7)}${manifest.path}`).join("\n")}

Arguments:
  base-ref              Git ref to compare against (default: origin/main).

Options:
  --set-version <ver>   Write <ver> as the version in all plugin manifests
                        instead of running the check. Must be valid semver and
                        greater than the version on the base ref.
  -h, --help            Print this help and exit.

Environment:
  VERSION_CHECK_SUMMARY_PATH  When set, the check writes its Markdown report to
                              this path as well as stdout.

Examples:
  bun scripts/check-plugin-version-bump.ts
  bun scripts/check-plugin-version-bump.ts origin/main
  bun scripts/check-plugin-version-bump.ts --set-version 1.9.10`;

function parseArgs(argv: string[]) {
  let baseRef: string | undefined;
  let setVersion: string | undefined;
  let help = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] as string;

    if (arg === "-h" || arg === "--help") {
      help = true;
    } else if (arg === "--set-version") {
      setVersion = argv[index + 1];
      index += 1;
      if (setVersion === undefined || setVersion.startsWith("-")) {
        fail("--set-version requires a version argument, for example --set-version 1.9.10");
      }
    } else if (arg.startsWith("--set-version=")) {
      setVersion = arg.slice("--set-version=".length);
      if (setVersion === "") {
        fail("--set-version requires a version argument, for example --set-version 1.9.10");
      }
    } else if (arg.startsWith("-")) {
      fail(`Unknown option: ${arg}`);
    } else if (baseRef === undefined) {
      baseRef = arg;
    } else {
      fail(`Unexpected argument: ${arg}`);
    }
  }

  return { baseRef: baseRef ?? "origin/main", setVersion, help };
}

function fail(message: string): never {
  console.error(`${message}\n\n${USAGE}`);
  process.exit(1);
}

function runGit(args: string[]) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function getChangedFiles() {
  const output = runGit(["diff", "--name-only", `${baseRef}...HEAD`]);
  return output ? output.split("\n") : [];
}

function readJson(path: string) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function readBaseJson(path: string) {
  try {
    return JSON.parse(runGit(["show", `${baseRef}:${path}`]));
  } catch {
    return null;
  }
}

// https://semver.org/#is-there-a-suggested-regular-expression-regex-to-check-a-semver-string
const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

function isSemver(version: unknown): version is string {
  return typeof version === "string" && SEMVER_PATTERN.test(version);
}

function hasVersionedPluginChange(path: string) {
  return versionedPluginPaths.some((entry) =>
    entry.endsWith("/") ? path.startsWith(entry) : path === entry
  );
}

function formatVersion(version: unknown) {
  return typeof version === "string" ? version : "—";
}

function formatVersionRows(rows: VersionRow[]) {
  return [
    "| Plugin | main | PR |",
    "| --- | --- | --- |",
    ...rows.map((row) => `| ${row.label} | ${formatVersion(row.baseVersion)} | ${formatVersion(row.currentVersion)} |`),
  ].join("\n");
}

function writeSummary(markdown: string) {
  const summaryPath = process.env.VERSION_CHECK_SUMMARY_PATH;
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

function writeManifestVersion(path: string, currentVersion: string, nextVersion: string) {
  const contents = readFileSync(path, "utf8");
  const versionEntry = new RegExp(`("version"\\s*:\\s*)"${currentVersion.replaceAll(".", "\\.")}"`);

  if (!versionEntry.test(contents)) {
    fail(`Could not find the version entry in ${path}.`);
  }

  writeFileSync(path, contents.replace(versionEntry, `$1"${nextVersion}"`));
}

function setVersions(nextVersion: string): never {
  if (!isSemver(nextVersion)) {
    fail(`"${nextVersion}" is not a valid semver version, for example 1.9.10 or 2.0.0-beta.1.`);
  }

  const updates = pluginManifests.map((manifest) => {
    const currentVersion = readJson(manifest.path)?.version;
    if (!isSemver(currentVersion)) {
      fail(`${manifest.label} manifest is missing a valid version (${manifest.path}).`);
    }

    const baseVersion = readBaseJson(manifest.path)?.version;
    if (isSemver(baseVersion) && semver.order(nextVersion, baseVersion) <= 0) {
      fail(
        `${nextVersion} is not greater than ${baseVersion} on ${baseRef}, so the ${manifest.label} plugin check would fail.`
      );
    }

    return { ...manifest, currentVersion };
  });

  for (const update of updates) {
    if (update.currentVersion === nextVersion) {
      console.log(`Unchanged ${update.label}: already ${nextVersion} (${update.path})`);
      continue;
    }

    writeManifestVersion(update.path, update.currentVersion, nextVersion);
    console.log(`Updated ${update.label}: ${update.currentVersion} → ${nextVersion} (${update.path})`);
  }

  console.log(`\nAll ${pluginManifests.length} plugin manifests are now at ${nextVersion}.`);
  process.exit(0);
}

const { baseRef, setVersion, help } = parseArgs(process.argv.slice(2));

if (help) {
  console.log(USAGE);
  process.exit(0);
}

if (setVersion !== undefined) {
  setVersions(setVersion);
}

const changedFiles = getChangedFiles();
const versionedChanges = changedFiles.filter(hasVersionedPluginChange);

if (versionedChanges.length === 0) {
  complete(
    true,
    [
      "## Expo plugin version check",
      "",
      "No versioned Expo plugin or skill files changed, so no plugin version bump is required.",
    ].join("\n")
  );
}

const rows: VersionRow[] = pluginManifests.map((manifest) => ({
  ...manifest,
  baseVersion: readBaseJson(manifest.path)?.version,
  currentVersion: readJson(manifest.path)?.version,
}));

const errors: string[] = [];
const currentVersions = new Set(rows.map((row) => row.currentVersion));
const baseVersions = new Set(rows.map((row) => row.baseVersion));

for (const row of rows) {
  if (row.baseVersion !== undefined && !isSemver(row.baseVersion)) {
    errors.push(`${row.label} has an invalid semver version on main: ${formatVersion(row.baseVersion)}`);
  }

  if (row.currentVersion === undefined) {
    errors.push(`${row.label} manifest is missing or has no version in this PR (${row.path}).`);
  } else if (!isSemver(row.currentVersion)) {
    errors.push(`${row.label} has an invalid semver version in this PR: ${formatVersion(row.currentVersion)}`);
  }
}

const presentBaseVersions = [...baseVersions].filter(isSemver);

if (new Set(presentBaseVersions).size > 1) {
  errors.push("The Claude, Codex, Cursor, and Grok plugin versions on main are not in sync.");
}

if (currentVersions.size !== 1) {
  errors.push("The Claude, Codex, Cursor, and Grok plugin versions in this PR must match.");
}

if (errors.length === 0) {
  const sharedBase = presentBaseVersions[0];
  for (const row of rows) {
    const base = isSemver(row.baseVersion) ? row.baseVersion : sharedBase;
    if (base === undefined || semver.order(row.currentVersion as string, base) <= 0) {
      errors.push(`${row.label} version must be greater than main (${formatVersion(base)}).`);
    }
  }
}

const changedList = versionedChanges.map((path) => `- \`${path}\``).join("\n");
const markdown = [
  "## Expo plugin version check",
  "",
  errors.length === 0
    ? "Passed. Versioned Expo plugin files changed and all plugin manifests were bumped together."
    : "Failed. Versioned Expo plugin files changed, so the Claude, Codex, Cursor, and Grok plugin manifests must all be bumped together.",
  "",
  formatVersionRows(rows),
  "",
  "Changed versioned files:",
  "",
  changedList,
  ...(errors.length === 0 ? [] : ["", "Required fixes:", "", ...errors.map((error) => `- ${error}`)]),
].join("\n");

complete(errors.length === 0, markdown);
