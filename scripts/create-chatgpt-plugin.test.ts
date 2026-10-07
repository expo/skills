import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createChatgptPlugin } from "./create-chatgpt-plugin";

describe("Creating ChatGPT plugin packages", () => {
  let repoRoot: string;
  let outputPath: string;
  let queries: string[];
  const files = ["plugin.json", "mcp.json", "README.md", "assets/icon.png", "skills/example/SKILL.md", "skills/example/scripts/helper.cjs"];
  const versions: Record<string, string> = { "eas-cli@latest": "24.11.0", "@expo/example@latest": "1.2.3", "create-expo-app@latest": "5.0.0" };
  const execute = (command: string, args: string[], options: { cwd: string }) => execFileSync(command, args, { ...options, encoding: "utf8" });
  const run = (command: string, args: string[], options: { cwd: string }) => {
    if (command === "git") return files.map(file => `plugins/expo/${file}`).join("\0") + "\0";
    if (command === "npm") {
      expect(args[0]).toBe("view");
      expect(args.slice(2)).toEqual(["version", "--json"]);
      queries.push(args[1]);
      return JSON.stringify(versions[args[1]]);
    }
    return execute(command, args, options);
  };
  const packaged = (file: string) => execFileSync("unzip", ["-p", outputPath, file], { encoding: "utf8" });

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), "expo packaging fixture "));
    outputPath = join(repoRoot, "output/plugin.zip");
    queries = [];
    for (const file of files) {
      const path = join(repoRoot, "plugins/expo", file);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, file.endsWith(".png") ? Buffer.from([0, 255, 128, 10]) : "unchanged\n");
    }
    writeFileSync(join(repoRoot, "plugins/expo/plugin.json"), JSON.stringify({ name: "expo", version: "1.14.0" }));
    writeFileSync(join(repoRoot, "plugins/expo/skills/example/SKILL.md"), 'npx --yes eas-cli@latest build\nnpx --yes eas-cli@latest whoami\nnpx @expo/example@latest\nnpx submit-expo-feedback@latest "feedback"\nnpx create-expo-app@latest\n');
    writeFileSync(join(repoRoot, "plugins/expo/README.md"), 'latest updates; https://example.test/eas-cli@latest; eas-cli@latest-beta; eas-cli@24.11.0; npm view <package>@latest version\n');
    chmodSync(join(repoRoot, "plugins/expo/skills/example/scripts/helper.cjs"), 0o755);
  });

  afterEach(() => rmSync(repoRoot, { recursive: true, force: true }));

  it("should pin unique npm packages while preserving source files, binary assets, and plugin version", () => {
    const before = new Map(files.map(file => [file, readFileSync(join(repoRoot, "plugins/expo", file))]));
    const result = createChatgptPlugin({ repoRoot, outputPath, runCommand: run });
    expect(queries).toEqual(["eas-cli@latest", "@expo/example@latest"]);
    expect(result.versions).toEqual({ "eas-cli": "24.11.0", "@expo/example": "1.2.3" });
    expect(packaged("skills/example/SKILL.md")).toContain("npx --yes eas-cli@24.11.0 build");
    expect(packaged("skills/example/SKILL.md")).toContain("@expo/example@1.2.3");
    expect(packaged("skills/example/SKILL.md")).toContain('npx submit-expo-feedback@latest "feedback"');
    expect(packaged("skills/example/SKILL.md")).toContain("npx create-expo-app\n");
    expect(packaged("skills/example/SKILL.md")).not.toContain("create-expo-app@latest");
    expect(packaged("README.md")).toBe(before.get("README.md")!.toString());
    expect(JSON.parse(packaged("plugin.json")).version).toBe("1.14.0");
    expect(execFileSync("unzip", ["-p", outputPath, "assets/icon.png"])).toEqual(before.get("assets/icon.png"));
    for (const file of files) expect(readFileSync(join(repoRoot, "plugins/expo", file))).toEqual(before.get(file));
  });

  it("should include only tracked portable plugin files from the working tree", () => {
    execute("git", ["init", "--quiet"], { cwd: repoRoot });
    execute("git", ["add", "plugins/expo"], { cwd: repoRoot });
    for (const file of ["hooks/hooks.json", ".claude-plugin/plugin.json", ".mcp.json", "assets/untracked.png", "chatgpt-app-submission.json"]) {
      const path = join(repoRoot, "plugins/expo", file);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, "excluded");
      if (!file.startsWith("assets/")) execute("git", ["add", path], { cwd: repoRoot });
    }
    createChatgptPlugin({ repoRoot, outputPath, runCommand: (command, args, options) => command === "npm" ? run(command, args, options) : execute(command, args, options) });
    expect(execFileSync("unzip", ["-Z1", outputPath], { encoding: "utf8" }).trim().split("\n").sort()).toEqual([...files].sort());
  });

  it("should preserve feedback and unversion scaffolding without querying npm for either", () => {
    const skill = join(repoRoot, "plugins/expo/skills/example/SKILL.md");
    const text = 'npx submit-expo-feedback@latest "feedback"\nnpx create-expo-app@latest\n';
    writeFileSync(skill, text);
    const result = createChatgptPlugin({ repoRoot, outputPath, runCommand: (command, args, options) => {
      if (command === "npm") throw new Error("these command forms need no version lookup");
      return run(command, args, options);
    } });
    expect(result.versions).toEqual({});
    expect(packaged("skills/example/SKILL.md")).toBe('npx submit-expo-feedback@latest "feedback"\nnpx create-expo-app\n');
    expect(readFileSync(skill, "utf8")).toBe(text);
  });

  it("should preserve an existing output without querying npm", () => {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, "existing passing package");
    expect(() => createChatgptPlugin({ repoRoot, outputPath, runCommand: run })).toThrow("Output already exists");
    expect(readFileSync(outputPath, "utf8")).toBe("existing passing package");
    expect(queries).toEqual([]);
  });

  it.each(['null', '[]', '"latest"'])("should fail without creating a ZIP when npm returns an invalid version (%s)", response => {
    expect(() => createChatgptPlugin({ repoRoot, outputPath, runCommand: (command, args, options) => command === "npm" ? response : run(command, args, options) })).toThrow("invalid version");
    expect(existsSync(outputPath)).toBe(false);
  });

  it("should report a failed metadata query without exposing its raw error or publishing an archive", () => {
    const resolve = () => createChatgptPlugin({ repoRoot, outputPath, runCommand: (command, args, options) => {
      if (command === "npm") throw new Error("PRIVATE_REGISTRY_FIXTURE");
      return run(command, args, options);
    } });
    expect(resolve).toThrow("Could not resolve eas-cli@latest with npm view.");
    try { resolve(); } catch (error) { expect(String(error)).not.toContain("PRIVATE_REGISTRY_FIXTURE"); }
    expect(existsSync(outputPath)).toBe(false);
  });

  it("should keep a real npm subprocess error out of the packaging transcript", () => {
    execute("git", ["init", "--quiet"], { cwd: repoRoot });
    execute("git", ["add", "plugins/expo"], { cwd: repoRoot });
    const bin = join(repoRoot, "bin");
    mkdirSync(bin);
    writeFileSync(join(bin, "npm"), '#!/bin/sh\nprintf "%s\\n" PRIVATE_REGISTRY_FIXTURE >&2\nexit 1\n', { mode: 0o755 });
    const program = `import { createChatgptPlugin } from ${JSON.stringify(join(import.meta.dir, "create-chatgpt-plugin.ts"))};
      try { createChatgptPlugin(${JSON.stringify({ repoRoot, outputPath })}); }
      catch (error) { console.error(error.message); process.exitCode = 1; }`;
    const result = spawnSync(process.execPath, ["--eval", program], {
      encoding: "utf8", env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Could not resolve eas-cli@latest with npm view.");
    expect(result.stdout + result.stderr).not.toContain("PRIVATE_REGISTRY_FIXTURE");
    expect(existsSync(outputPath)).toBe(false);
  });

  it("should reject symbolic links in tracked package files", () => {
    const path = join(repoRoot, "plugins/expo/assets/icon.png");
    rmSync(path);
    symlinkSync(join(repoRoot, "plugins/expo/plugin.json"), path);
    expect(() => createChatgptPlugin({ repoRoot, outputPath, runCommand: run })).toThrow("regular file");
    expect(existsSync(outputPath)).toBe(false);
  });

  it("should reject a parent symbolic link that exposes files outside the plugin", () => {
    const path = join(repoRoot, "plugins/expo/assets");
    const outside = join(repoRoot, "private-assets");
    mkdirSync(outside);
    writeFileSync(join(outside, "icon.png"), "private fixture");
    rmSync(path, { recursive: true });
    symlinkSync(outside, path);
    expect(() => createChatgptPlugin({ repoRoot, outputPath, runCommand: run })).toThrow("outside the plugin");
    expect(existsSync(outputPath)).toBe(false);
  });
});
