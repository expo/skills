#!/usr/bin/env bun

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";

export type BareEasCommand = { line: number; text: string };

const runnableFences = new Set(["", "bash", "sh", "shell", "zsh", "console", "terminal", "yaml", "yml"]);
const shellExtensions = new Set([".sh", ".bash", ".zsh"]);
const commandPosition = /(?:^\s*(?:\$\s+)?|(?:&&|\|\||[;|]|\$\(|`)\s*|\b(?:then|do)\s+)(?:(?:if|elif|while|until)\s+)?(?:!\s+)?(?:env\s+)?(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*eas\s+[a-z][\w:-]*/;
const yamlCommand = /^\s*(?:-\s*)?(?:run|command):\s*(.*)$/;

function executableShellText(line: string): string {
  // Preserve command substitutions while hiding quoted arguments and comments from the command match.
  const text = line.split("");
  let quote: "'" | '"' | undefined;
  const substitutions: { end: ")" | "`"; returnQuote: typeof quote; depth: number }[] = [];

  for (let index = 0; index < line.length; index++) {
    const char = line[index];

    if (quote === "'") {
      text[index] = " ";
      if (char === "'") quote = undefined;
      continue;
    }
    if (char === "\\") {
      text[index] = " ";
      if (index + 1 < line.length) text[++index] = " ";
      continue;
    }
    if (quote === '"' && char === '"') {
      text[index] = " ";
      quote = undefined;
      continue;
    }
    if (quote === '"' && char !== "`" && line.slice(index, index + 2) !== "$(") {
      text[index] = " ";
      continue;
    }
    if (char === "'" || char === '"') {
      text[index] = " ";
      quote = char;
      continue;
    }
    if (line.slice(index, index + 2) === "$(") {
      substitutions.push({ end: ")", returnQuote: quote, depth: 0 });
      quote = undefined;
      index++;
      continue;
    }
    const currentSubstitution = substitutions.at(-1);
    if (char === "`") {
      if (currentSubstitution?.end === "`") {
        quote = currentSubstitution.returnQuote;
        substitutions.pop();
      } else {
        substitutions.push({ end: "`", returnQuote: quote, depth: 0 });
        quote = undefined;
      }
      continue;
    }
    if (char === "(" && currentSubstitution?.end === ")") currentSubstitution.depth++;
    if (char === ")" && currentSubstitution?.end === ")") {
      if (currentSubstitution.depth === 0) {
        quote = currentSubstitution.returnQuote;
        substitutions.pop();
      } else {
        currentSubstitution.depth--;
      }
      continue;
    }
    if (char === "#" && (index === 0 || /[\s;&|()]/.test(line[index - 1] as string))) {
      text.fill(" ", index);
      break;
    }
  }

  return text.join("");
}

function isBareCommand(line: string): boolean {
  if (line.trimStart().startsWith("#")) return false;
  let shell = yamlCommand.exec(line)?.[1]?.trim() ?? line;
  if (
    (shell.startsWith('"') && shell.lastIndexOf('"') > 0) ||
    (shell.startsWith("'") && shell.lastIndexOf("'") > 0)
  ) {
    const closingQuote = shell.lastIndexOf(shell[0] as string);
    if (/^\s*(?:#.*)?$/.test(shell.slice(closingQuote + 1))) {
      shell = shell.slice(1, closingQuote);
    }
  }
  return commandPosition.test(executableShellText(shell));
}

export function findBareEasCommands(content: string, filePath: string): BareEasCommand[] {
  const isMarkdown = extname(filePath) === ".md";
  if (!isMarkdown && !shellExtensions.has(extname(filePath))) return [];

  const findings: BareEasCommand[] = [];
  let fence: { marker: string; length: number; runnable: boolean } | undefined;
  for (const [index, line] of content.split(/\r?\n/).entries()) {
    if (isMarkdown) {
      const marker = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
      if (marker) {
        const sequence = marker[1] as string;
        if (!fence) {
          const language = (marker[2] as string).trim().split(/\s+/, 1)[0]?.toLowerCase() ?? "";
          fence = {
            marker: sequence[0] as string,
            length: sequence.length,
            runnable: runnableFences.has(language),
          };
          continue;
        }
        if (
          sequence[0] === fence.marker &&
          sequence.length >= fence.length &&
          !(marker[2] as string).trim()
        ) {
          fence = undefined;
          continue;
        }
      }
      if (!fence?.runnable) continue;
    }
    if (isBareCommand(line)) findings.push({ line: index + 1, text: line.trim() });
  }
  return findings;
}

function skillFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...skillFiles(path));
    else if (entry.isFile() && (entry.name.endsWith(".md") || shellExtensions.has(extname(entry.name)))) {
      files.push(path);
    }
  }
  return files;
}

if (import.meta.main) {
  const repoRoot = join(import.meta.dir, "..");
  const plugins = join(repoRoot, "plugins");
  const files = readdirSync(plugins, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => skillFiles(join(plugins, entry.name, "skills")))
    .sort();
  if (files.length === 0) throw new Error("No skill files found to check.");

  const findings = files.flatMap((file) =>
    findBareEasCommands(readFileSync(file, "utf8"), file).map(
      (finding) => `${relative(repoRoot, file)}:${finding.line}: ${finding.text}`
    )
  );
  if (findings.length) {
    console.error(
      "Use `npx --yes eas-cli@latest <command>` in runnable skill examples:\n" +
        findings.join("\n")
    );
    process.exitCode = 1;
  } else {
    console.log(`✓ No bare EAS CLI commands in ${files.length} skill files.`);
  }
}
