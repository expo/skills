#!/usr/bin/env bun

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";

export type BareEasCommand = { line: number; text: string };

const runnableFences = new Set(["", "bash", "sh", "shell", "zsh", "console", "terminal", "yaml", "yml"]);
const shellExtensions = new Set([".sh", ".bash", ".zsh"]);
const commandBoundary = /(?:^\s*(?:\$\s+)?|(?:&&|\|\||[;|]|\$\(|`)\s*|\b(?:then|do)\s+)/;
const commandPrefix = /(?:(?:if|elif|while|until)\s+)?(?:!\s+)?(?:env\s+)?/;
const environmentAssignments = /(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*/;
const bareEas = /eas(?=$|[\s;&|()<>])/;
const commandPosition = new RegExp(
  [commandBoundary, commandPrefix, environmentAssignments, bareEas]
    .map((part) => part.source)
    .join("")
);
const yamlCommand = /^(\s*)(?:-\s+)?(?:run|command):\s*(.*)$/;

type Quote = "'" | '"';
type ShellState = {
  quote?: Quote;
  substitutions: { end: ")" | "`"; returnQuote?: Quote; depth: number }[];
};

function newShellState(): ShellState {
  return { substitutions: [] };
}

function executableShellText(line: string, state: ShellState): string {
  // Preserve command substitutions while hiding quoted arguments and comments from the command match.
  const text = line.split("");

  for (let index = 0; index < line.length; index++) {
    const char = line[index];

    if (state.quote === "'") {
      text[index] = " ";
      if (char === "'") state.quote = undefined;
      continue;
    }
    if (char === "\\") {
      text[index] = " ";
      if (index + 1 < line.length) text[++index] = " ";
      continue;
    }
    if (state.quote === '"' && char === '"') {
      text[index] = " ";
      state.quote = undefined;
      continue;
    }
    if (state.quote === '"' && char !== "`" && line.slice(index, index + 2) !== "$(") {
      text[index] = " ";
      continue;
    }
    if (char === "'" || char === '"') {
      text[index] = " ";
      state.quote = char;
      continue;
    }
    if (line.slice(index, index + 2) === "$(") {
      state.substitutions.push({ end: ")", returnQuote: state.quote, depth: 0 });
      state.quote = undefined;
      index++;
      continue;
    }
    const currentSubstitution = state.substitutions.at(-1);
    if (char === "`") {
      if (currentSubstitution?.end === "`") {
        state.quote = currentSubstitution.returnQuote;
        state.substitutions.pop();
      } else {
        state.substitutions.push({ end: "`", returnQuote: state.quote, depth: 0 });
        state.quote = undefined;
      }
      continue;
    }
    if (char === "(" && currentSubstitution?.end === ")") currentSubstitution.depth++;
    if (char === ")" && currentSubstitution?.end === ")") {
      if (currentSubstitution.depth === 0) {
        state.quote = currentSubstitution.returnQuote;
        state.substitutions.pop();
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

function unquoteYamlValue(value: string): string {
  const shell = value.trim();
  if (
    (shell.startsWith('"') && shell.lastIndexOf('"') > 0) ||
    (shell.startsWith("'") && shell.lastIndexOf("'") > 0)
  ) {
    const closingQuote = shell.lastIndexOf(shell[0] as string);
    if (/^\s*(?:#.*)?$/.test(shell.slice(closingQuote + 1))) {
      return shell.slice(1, closingQuote);
    }
  }
  return shell;
}

function isBareCommand(line: string, state: ShellState): boolean {
  return commandPosition.test(executableShellText(line, state));
}

export function findBareEasCommands(content: string, filePath: string): BareEasCommand[] {
  const isMarkdown = extname(filePath) === ".md";
  if (!isMarkdown && !shellExtensions.has(extname(filePath))) return [];

  const findings: BareEasCommand[] = [];
  let fence: { marker: string; length: number; language: string; runnable: boolean } | undefined;
  let shellState = newShellState();
  let yamlBlock: { indent: number; state: ShellState } | undefined;
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
            language,
            runnable: runnableFences.has(language),
          };
          shellState = newShellState();
          yamlBlock = undefined;
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
      if (fence.language === "yaml" || fence.language === "yml") {
        // YAML labels and metadata are inert; only run/command values contain shell code.
        const field = yamlCommand.exec(line);
        if (field) {
          yamlBlock = undefined;
          const value = (field[2] as string).trim();
          if (/^[|>][+-]?(?:\s+#.*)?$/.test(value)) {
            yamlBlock = { indent: (field[1] as string).length, state: newShellState() };
          } else if (isBareCommand(unquoteYamlValue(value), newShellState())) {
            findings.push({ line: index + 1, text: line.trim() });
          }
          continue;
        }
        if (yamlBlock && line.trim()) {
          if (line.length - line.trimStart().length > yamlBlock.indent) {
            if (isBareCommand(line, yamlBlock.state)) findings.push({ line: index + 1, text: line.trim() });
            continue;
          }
          yamlBlock = undefined;
        }
        continue;
      }
    }
    if (isBareCommand(line, shellState)) findings.push({ line: index + 1, text: line.trim() });
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
