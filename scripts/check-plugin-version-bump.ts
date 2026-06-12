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

const baseRef = process.argv[2] ?? "origin/main";

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
];

const versionedPluginPaths = [
  "plugins/expo/skills/",
  "plugins/expo/.claude-plugin/plugin.json",
  "plugins/expo/.codex-plugin/plugin.json",
  "plugins/expo/.cursor-plugin/plugin.json",
  "plugins/expo/.mcp.json",
  "plugins/expo/mcp.json",
];

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

function isSemver(version: unknown): version is string {
  if (typeof version !== "string") {
    return false;
  }

  try {
    return semver.satisfies(version, version);
  } catch {
    return false;
  }
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
  if (row.baseVersion === undefined) {
    errors.push(`${row.label} manifest is missing or has no version on main (${row.path}).`);
  } else if (!isSemver(row.baseVersion)) {
    errors.push(`${row.label} has an invalid semver version on main: ${formatVersion(row.baseVersion)}`);
  }

  if (row.currentVersion === undefined) {
    errors.push(`${row.label} manifest is missing or has no version in this PR (${row.path}).`);
  } else if (!isSemver(row.currentVersion)) {
    errors.push(`${row.label} has an invalid semver version in this PR: ${formatVersion(row.currentVersion)}`);
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
    if (semver.order(row.currentVersion as string, row.baseVersion as string) <= 0) {
      errors.push(`${row.label} version must be greater than main (${formatVersion(row.baseVersion)}).`);
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
