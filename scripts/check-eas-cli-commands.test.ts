import { describe, expect, it } from "bun:test";

import { findBareEasCommands } from "./check-eas-cli-commands";

describe("Checking EAS CLI command examples", () => {
  it("should ignore prose, headings, comments, and non-shell examples", () => {
    const content = [
      "Use `eas build` to build your app.",
      "## `eas update`",
      "```bash",
      "# eas build --platform ios",
      "npx --yes eas-cli@latest build --platform ios",
      "```",
      "```tsx",
      "eas build",
      "```",
    ].join("\n");

    expect(findBareEasCommands(content, "SKILL.md")).toEqual([]);
  });

  it("should find direct commands in runnable Markdown fences with accurate lines", () => {
    const content = [
      "Intro",
      "```bash",
      "eas build --platform ios",
      "$ eas submit --platform ios",
      "```",
      "~~~sh",
      "if ! eas whoami; then",
      "  eas login",
      "fi",
      "~~~",
    ].join("\n");

    expect(findBareEasCommands(content, "SKILL.md")).toEqual([
      { line: 3, text: "eas build --platform ios" },
      { line: 4, text: "$ eas submit --platform ios" },
      { line: 7, text: "if ! eas whoami; then" },
      { line: 8, text: "eas login" },
    ]);
  });

  it("should find bare commands after shell operators and in YAML run fields", () => {
    const content = [
      "```yaml",
      "run: eas build --platform ios",
      "- command: eas submit",
      "```",
      "```sh",
      "npm install && eas update",
      "result=$(eas whoami)",
      "```",
    ].join("\n");

    expect(findBareEasCommands(content, "references/setup.md")).toEqual([
      { line: 2, text: "run: eas build --platform ios" },
      { line: 3, text: "- command: eas submit" },
      { line: 6, text: "npm install && eas update" },
      { line: 7, text: "result=$(eas whoami)" },
    ]);
  });

  it("should check skill shell scripts without requiring Markdown fences", () => {
    const content = [
      "#!/usr/bin/env bash",
      "# eas build",
      "npx --yes eas-cli@latest build",
      "eas submit",
    ].join("\n");

    expect(findBareEasCommands(content, "scripts/release.sh")).toEqual([
      { line: 4, text: "eas submit" },
    ]);
    expect(findBareEasCommands(content, "scripts/release.ts")).toEqual([]);
  });

  it("should find commands after environment assignments and in quoted YAML values", () => {
    const content = [
      "```bash",
      'EXPO_TOKEN="$TOKEN" eas build',
      'npm install && EXPO_TOKEN="$TOKEN" eas submit',
      'env EXPO_TOKEN="$TOKEN" eas update',
      "```",
      "```yaml",
      'run: "eas build"',
      "- command: 'eas submit'",
      "```",
    ].join("\n");

    expect(findBareEasCommands(content, "SKILL.md")).toEqual([
      { line: 2, text: 'EXPO_TOKEN="$TOKEN" eas build' },
      { line: 3, text: 'npm install && EXPO_TOKEN="$TOKEN" eas submit' },
      { line: 4, text: 'env EXPO_TOKEN="$TOKEN" eas update' },
      { line: 7, text: 'run: "eas build"' },
      { line: 8, text: "- command: 'eas submit'" },
    ]);
  });

  it("should ignore quoted text and trailing comments while checking substitutions", () => {
    const content = [
      "```sh",
      'echo "Use npm install && eas build"',
      "npx --yes eas-cli@latest build # then eas submit",
      "printf '%s' 'eas build'",
      'echo "$(eas whoami)"',
      'result=$(eas whoami) # eas submit',
      'echo "ignore && eas build" && EXPO_TOKEN="$TOKEN" eas submit',
      "```",
      "```yaml",
      'run: "echo eas build"',
      "```",
    ].join("\n");

    expect(findBareEasCommands(content, "SKILL.md")).toEqual([
      { line: 5, text: 'echo "$(eas whoami)"' },
      { line: 6, text: 'result=$(eas whoami) # eas submit' },
      { line: 7, text: 'echo "ignore && eas build" && EXPO_TOKEN="$TOKEN" eas submit' },
    ]);
  });

  it("should find bare CLI flags and version checks", () => {
    const content = [
      "```bash",
      "eas --version",
      "eas --help",
      "eas -V",
      "eas",
      "npx --yes eas-cli@latest --version",
      "```",
    ].join("\n");

    expect(findBareEasCommands(content, "SKILL.md")).toEqual([
      { line: 2, text: "eas --version" },
      { line: 3, text: "eas --help" },
      { line: 4, text: "eas -V" },
      { line: 5, text: "eas" },
    ]);
  });

  it("should check only executable YAML fields and their block values", () => {
    const content = [
      "```yaml",
      "name: eas build && eas submit",
      "description: eas --help",
      "steps:",
      "  - name: eas --version",
      "  - run: npx --yes eas-cli@latest build",
      "  - run: |",
      "      echo ready",
      "      eas build",
      "  - command: 'eas --help'",
      "```",
    ].join("\n");

    expect(findBareEasCommands(content, "SKILL.md")).toEqual([
      { line: 9, text: "eas build" },
      { line: 10, text: "- command: 'eas --help'" },
    ]);
  });

  it("should ignore shell text quoted across lines while checking later commands", () => {
    const shell = [
      'echo "To build the app, run:',
      'eas build"',
      "eas --version",
    ].join("\n");
    const content = ["```bash", shell, "```"].join("\n");

    expect(findBareEasCommands(content, "SKILL.md")).toEqual([
      { line: 4, text: "eas --version" },
    ]);
    expect(findBareEasCommands(shell, "scripts/example.sh")).toEqual([
      { line: 3, text: "eas --version" },
    ]);
  });
});
