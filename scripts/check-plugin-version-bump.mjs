#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const baseRef = process.argv[2] ?? "origin/main";

const pluginManifests = [
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
];

const versionedPluginPaths = [
  "plugins/expo/skills/",
  "plugins/expo/.claude-plugin/plugin.json",
  "plugins/expo/.codex-plugin/plugin.json",
  "plugins/expo/.cursor-plugin/plugin.json",
  "plugins/expo/.mcp.json",
  "plugins/expo/mcp.json",
];

function runGit(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function getChangedFiles() {
  const output = runGit(["diff", "--name-only", `${baseRef}...HEAD`]);
  return output ? output.split("\n") : [];
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function readBaseJson(path) {
  try {
    return JSON.parse(runGit(["show", `${baseRef}:${path}`]));
  } catch {
    return null;
  }
}

function parseSemver(version) {
  if (typeof version !== "string") {
    return null;
  }

  const match = version.match(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/
  );

  if (!match) {
    return null;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4]?.split(".") ?? [],
  };
}

function compareIdentifiers(left, right) {
  const leftIsNumeric = /^\d+$/.test(left);
  const rightIsNumeric = /^\d+$/.test(right);

  if (leftIsNumeric && rightIsNumeric) {
    return Number(left) - Number(right);
  }

  if (leftIsNumeric) {
    return -1;
  }

  if (rightIsNumeric) {
    return 1;
  }

  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}

function compareSemver(leftVersion, rightVersion) {
  const left = parseSemver(leftVersion);
  const right = parseSemver(rightVersion);

  if (!left || !right) {
    throw new Error(`Cannot compare invalid semver values: ${leftVersion}, ${rightVersion}`);
  }

  for (const field of ["major", "minor", "patch"]) {
    if (left[field] !== right[field]) {
      return left[field] - right[field];
    }
  }

  if (left.prerelease.length === 0 && right.prerelease.length === 0) {
    return 0;
  }

  if (left.prerelease.length === 0) {
    return 1;
  }

  if (right.prerelease.length === 0) {
    return -1;
  }

  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = left.prerelease[index];
    const rightPart = right.prerelease[index];

    if (leftPart === undefined) {
      return -1;
    }

    if (rightPart === undefined) {
      return 1;
    }

    const comparison = compareIdentifiers(leftPart, rightPart);
    if (comparison !== 0) {
      return comparison;
    }
  }

  return 0;
}

function hasVersionedPluginChange(path) {
  return versionedPluginPaths.some((entry) =>
    entry.endsWith("/") ? path.startsWith(entry) : path === entry
  );
}

function formatVersionRows(rows) {
  return [
    "| Plugin | main | PR |",
    "| --- | --- | --- |",
    ...rows.map((row) => `| ${row.label} | ${row.baseVersion ?? "—"} | ${row.currentVersion ?? "—"} |`),
  ].join("\n");
}

function writeSummary(markdown) {
  const summaryPath = process.env.VERSION_CHECK_SUMMARY_PATH;
  if (!summaryPath) {
    return;
  }

  mkdirSync(dirname(summaryPath), { recursive: true });
  writeFileSync(summaryPath, `${markdown}\n`);
}

function complete(success, markdown) {
  writeSummary(markdown);
  console.log(markdown);
  process.exit(success ? 0 : 1);
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

const rows = pluginManifests.map((manifest) => ({
  ...manifest,
  baseVersion: readBaseJson(manifest.path)?.version,
  currentVersion: readJson(manifest.path)?.version,
}));

const errors = [];
const currentVersions = new Set(rows.map((row) => row.currentVersion));
const baseVersions = new Set(rows.map((row) => row.baseVersion));

for (const row of rows) {
  if (row.baseVersion === undefined) {
    errors.push(`${row.label} manifest is missing or has no version on main (${row.path}).`);
  } else if (!parseSemver(row.baseVersion)) {
    errors.push(`${row.label} has an invalid semver version on main: ${row.baseVersion}`);
  }

  if (row.currentVersion === undefined) {
    errors.push(`${row.label} manifest is missing or has no version in this PR (${row.path}).`);
  } else if (!parseSemver(row.currentVersion)) {
    errors.push(`${row.label} has an invalid semver version in this PR: ${row.currentVersion}`);
  }
}

if (baseVersions.size !== 1) {
  errors.push("The Claude, Codex, and Cursor plugin versions on main are not in sync.");
}

if (currentVersions.size !== 1) {
  errors.push("The Claude, Codex, and Cursor plugin versions in this PR must match.");
}

if (errors.length === 0) {
  for (const row of rows) {
    if (compareSemver(row.currentVersion, row.baseVersion) <= 0) {
      errors.push(`${row.label} version must be greater than main (${row.baseVersion}).`);
    }
  }
}

const changedList = versionedChanges.map((path) => `- \`${path}\``).join("\n");
const markdown = [
  "## Expo plugin version check",
  "",
  errors.length === 0
    ? "Passed. Versioned Expo plugin files changed and all plugin manifests were bumped together."
    : "Failed. Versioned Expo plugin files changed, so the Claude, Codex, and Cursor plugin manifests must all be bumped together.",
  "",
  formatVersionRows(rows),
  "",
  "Changed versioned files:",
  "",
  changedList,
  ...(errors.length === 0 ? [] : ["", "Required fixes:", "", ...errors.map((error) => `- ${error}`)]),
].join("\n");

complete(errors.length === 0, markdown);
