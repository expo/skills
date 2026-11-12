#!/usr/bin/env bun

import { execFileSync } from "node:child_process";
import { constants, copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";

type RunCommand = (command: string, args: string[], options: { cwd: string }) => string;
type Options = { repoRoot?: string; outputPath?: string; profilePath?: string; runCommand?: RunCommand };
type ReviewCase = { description: string; prompt: string; tools_triggered?: string; expected_behavior?: string };
type SubmissionProfile = {
  name: string; version: string; displayName: string; shortDescription: string; mcpUrl: string;
  review: { test_cases: { positive: ReviewCase[]; negative: ReviewCase[] } };
};

const packagePaths = ["plugin.json", "mcp.json", "README.md", "assets", "skills"];
const textExtensions = /\.(md|json|ya?ml|[cm]?[jt]s|tsx|jsx|sh)$/;
const latestPackage = /(?<![\w./:@-])((?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*)@latest(?![\w./-])/g;
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
const runCommand: RunCommand = (command, args, options) => execFileSync(command, args, {
  ...options, stdio: "pipe", encoding: "utf8", timeout: 60_000, maxBuffer: 16 * 1024 * 1024,
});

function readProfile(path: string): SubmissionProfile {
  const profile = JSON.parse(readFileSync(path, "utf8"));
  const nonempty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
  const cases = profile?.review?.test_cases;
  if (typeof profile?.name !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(profile.name) ||
      typeof profile.version !== "string" || !versionPattern.test(profile.version) ||
      !nonempty(profile.displayName) || !nonempty(profile.shortDescription) ||
      [...profile.shortDescription].length > 30 || typeof profile.mcpUrl !== "string") {
    throw new Error("Invalid ChatGPT submission profile: check the name, version, listing text, and MCP URL.");
  }
  const endpoint = new URL(profile.mcpUrl);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.hash) {
    throw new Error("The submission MCP URL must use HTTPS without credentials or a fragment.");
  }
  for (const [group, count] of [["positive", 5], ["negative", 3]] as const) {
    const entries = cases?.[group];
    if (!Array.isArray(entries) || entries.length !== count || entries.some(entry =>
      !nonempty(entry?.description) || !nonempty(entry?.prompt) ||
      (group === "positive" && (!nonempty(entry.tools_triggered) || !nonempty(entry.expected_behavior))))) {
      throw new Error(`The submission profile requires exactly ${count} complete ${group} review cases.`);
    }
  }
  if ("test_credentials" in profile.review || "reviewer_instructions" in profile.review) {
    throw new Error("Keep reviewer credentials and instructions in the secure dashboard, outside the submission profile.");
  }
  return profile;
}

export function createChatgptPlugin(options: Options = {}) {
  const repoRoot = resolve(options.repoRoot ?? join(import.meta.dir, ".."));
  const run = options.runCommand ?? runCommand;
  const manifest = JSON.parse(readFileSync(join(repoRoot, "plugins/expo/plugin.json"), "utf8"));
  if (manifest.name !== "expo" || typeof manifest.version !== "string" || !versionPattern.test(manifest.version)) {
    throw new Error("Expected an Expo manifest with a valid plugin version.");
  }
  const profile = readProfile(resolve(repoRoot, options.profilePath ?? "scripts/chatgpt-submission.json"));
  const outputPath = resolve(repoRoot, options.outputPath ?? `.context/${profile.name}-plugin-${profile.version}-chatgpt.zip`);
  if (existsSync(outputPath)) throw new Error(`Output already exists: ${outputPath}`);
  const tracked = run("git", ["ls-files", "-z", "--", ...packagePaths.map(path => `plugins/expo/${path}`)], { cwd: repoRoot });
  const files = tracked.split("\0").filter(Boolean).map(path => {
    if (!path.startsWith("plugins/expo/") || /[\x00-\x1f\x7f]/.test(path) || path.split("/").includes("..")) {
      throw new Error("Invalid tracked package path.");
    }
    return path.slice("plugins/expo/".length);
  });
  if (!files.includes("plugin.json") || !files.includes("mcp.json") || !files.some(path => /^skills\/[^/]+\/SKILL\.md$/.test(path))) {
    throw new Error("The tracked package must include its manifest, MCP configuration, and skills.");
  }

  manifest.name = profile.name;
  manifest.version = profile.version;
  const openai = (manifest.extensions ??= {})["com.openai"] ??= {};
  openai.interface = { ...openai.interface, displayName: profile.displayName, shortDescription: profile.shortDescription };
  delete openai.interface.screenshots;
  openai.review = profile.review;
  const mcp = JSON.parse(readFileSync(join(repoRoot, "plugins/expo/mcp.json"), "utf8"));
  if (!mcp.mcpServers?.expo || Object.keys(mcp.mcpServers).length !== 1) {
    throw new Error("Plugin-level review cases require exactly one Expo MCP server.");
  }
  mcp.mcpServers.expo = { ...mcp.mcpServers.expo, type: "streamable-http", url: profile.mcpUrl };

  const packageRoot = realpathSync(join(repoRoot, "plugins/expo"));
  const stage = mkdtempSync(join(tmpdir(), "expo-chatgpt-plugin-"));
  const versions = new Map<string, string>();
  try {
    for (const file of files) {
      const sourcePath = join(repoRoot, "plugins/expo", file);
      const stat = lstatSync(sourcePath);
      if (!stat.isFile()) throw new Error(`Package entry must be a regular file: ${file}`);
      if (!realpathSync(sourcePath).startsWith(packageRoot + sep)) {
        throw new Error(`Package entry resolves outside the plugin: ${file}`);
      }
      let contents = readFileSync(sourcePath);
      if (file === "plugin.json") contents = Buffer.from(JSON.stringify(manifest, null, 2) + "\n");
      if (file === "mcp.json") contents = Buffer.from(JSON.stringify(mcp, null, 2) + "\n");
      if (textExtensions.test(file)) {
        const text = contents.toString("utf8").replace(latestPackage, (specifier, name: string) => {
          // Preserve the command forms verified in the submission scan.
          if (name === "submit-expo-feedback") return specifier;
          if (name === "create-expo-app") return name;
          if (!versions.has(name)) {
            let version: unknown;
            try {
              version = JSON.parse(run("npm", ["view", specifier, "version", "--json"], { cwd: repoRoot }));
            } catch {
              throw new Error(`Could not resolve ${specifier} with npm view.`);
            }
            if (typeof version !== "string" || !versionPattern.test(version)) {
              throw new Error(`npm view returned an invalid version for ${specifier}.`);
            }
            versions.set(name, version);
          }
          return `${name}@${versions.get(name)}`;
        });
        contents = Buffer.from(text);
      }
      const target = join(stage, file);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, contents, { mode: stat.mode & 0o777 });
    }
    const archive = join(stage, "plugin.zip");
    run("zip", ["-q", "-X", archive, ...files], { cwd: stage });
    mkdirSync(dirname(outputPath), { recursive: true });
    copyFileSync(archive, outputPath, constants.COPYFILE_EXCL);
    return { outputPath, versions: Object.fromEntries(versions), fileCount: files.length };
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  let outputPath: string | undefined;
  let profilePath: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--output" && outputPath === undefined && args[i + 1] && !args[i + 1].startsWith("--")) {
      outputPath = args[++i];
    } else if (args[i] === "--profile" && profilePath === undefined && args[i + 1] && !args[i + 1].startsWith("--")) {
      profilePath = args[++i];
    } else {
      console.error("Usage: bun scripts/create-chatgpt-plugin.ts [--profile <json-path>] [--output <zip-path>]");
      process.exit(1);
    }
  }
  try {
    const result = createChatgptPlugin({ outputPath, profilePath });
    for (const [name, version] of Object.entries(result.versions)) console.log(`${name}@latest -> ${name}@${version}`);
    console.log(`Created ${result.outputPath} (${result.fileCount} files).`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Plugin packaging failed.");
    process.exit(1);
  }
}
