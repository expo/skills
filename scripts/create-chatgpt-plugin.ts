#!/usr/bin/env bun

import { execFileSync } from "node:child_process";
import { constants, copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";

type RunCommand = (command: string, args: string[], options: { cwd: string }) => string;
type Options = { repoRoot?: string; outputPath?: string; runCommand?: RunCommand };

const packagePaths = ["plugin.json", "mcp.json", "README.md", "assets", "skills"];
const textExtensions = /\.(md|json|ya?ml|[cm]?[jt]s|tsx|jsx|sh)$/;
const latestPackage = /(?<![\w./:@-])((?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*)@latest(?![\w./-])/g;
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
const runCommand: RunCommand = (command, args, options) => execFileSync(command, args, {
  ...options, stdio: "pipe", encoding: "utf8", timeout: 60_000, maxBuffer: 16 * 1024 * 1024,
});

export function createChatgptPlugin(options: Options = {}) {
  const repoRoot = resolve(options.repoRoot ?? join(import.meta.dir, ".."));
  const run = options.runCommand ?? runCommand;
  const manifest = JSON.parse(readFileSync(join(repoRoot, "plugins/expo/plugin.json"), "utf8"));
  if (manifest.name !== "expo" || typeof manifest.version !== "string" || !versionPattern.test(manifest.version)) {
    throw new Error("Expected an Expo manifest with a valid plugin version.");
  }
  const outputPath = resolve(repoRoot, options.outputPath ?? `.context/expo-plugin-${manifest.version}-chatgpt.zip`);
  if (existsSync(outputPath)) throw new Error(`Output already exists: ${outputPath}`);
  const tracked = run("git", ["ls-files", "-z", "--", ...packagePaths.map(path => `plugins/expo/${path}`)], { cwd: repoRoot });
  const files = tracked.split("\0").filter(Boolean).map(path => {
    if (!path.startsWith("plugins/expo/") || /[\x00-\x1f\x7f]/.test(path) || path.split("/").includes("..")) {
      throw new Error("Invalid tracked package path.");
    }
    return path.slice("plugins/expo/".length);
  });
  if (!files.includes("plugin.json") || !files.some(path => /^skills\/[^/]+\/SKILL\.md$/.test(path))) {
    throw new Error("The tracked package must include its manifest and skills.");
  }

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
      if (textExtensions.test(file)) {
        const text = contents.toString("utf8").replace(latestPackage, (specifier, name: string) => {
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
  if (args.length !== 0 && !(args.length === 2 && args[0] === "--output")) {
    console.error("Usage: bun scripts/create-chatgpt-plugin.ts [--output <zip-path>]");
    process.exit(1);
  }
  try {
    const result = createChatgptPlugin({ outputPath: args[1] });
    for (const [name, version] of Object.entries(result.versions)) console.log(`${name}@latest -> ${name}@${version}`);
    console.log(`Created ${result.outputPath} (${result.fileCount} files).`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Plugin packaging failed.");
    process.exit(1);
  }
}
