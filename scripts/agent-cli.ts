export const AGENT_CLI = "npx --yes @expo/agent-cli@latest";

export const AGENT_CLI_ALLOWED_TOOL = `Bash(${AGENT_CLI} *)`;

// `npx|bunx expo <cmd>`, `npx expo-doctor`, `npx create-expo(-app)`, and `bun create expo`. A
// `<placeholder>` after `expo` is allowed, so prose can name the command that the agent CLI replaces.
// `(?![\w-])` ends a package name; `\b` would also match inside `create-expo-module`.
const EXPO_CLI_CALL =
  /\b(?:npx|bunx)\s+(?:--yes\s+|-y\s+)?(?:expo(?:@\S+)?\s+(?!<)|(?:expo-doctor|create-expo(?:-app)?)(?![\w-]))|\bbun\s+create\s+expo(?![\w-])/;

// Web commands stay on Expo CLI: `npx expo serve`, `npx expo start --web`, and `npx expo export` for web.
// Sticky, and the flags must stay inside the same command: no backtick, `&`, `;` or `|` in between.
const WEB_EXPO_CLI_CALL = /npx\s+expo\s+(?:serve\b|start\b[^`&;|]*\s--web\b|export\b[^`&;|]*(?:-p|--platform)\s+web\b)/y;

function isWebCall(text: string, index: number): boolean {
  WEB_EXPO_CLI_CALL.lastIndex = index;
  return WEB_EXPO_CLI_CALL.test(text);
}

// Each call on a line is judged on its own, so a web command does not hide another call next to it.
export function expoCliCalls(markdown: string): { line: number; text: string }[] {
  const calls = new RegExp(EXPO_CLI_CALL.source, "g");
  return markdown
    .split("\n")
    .map((text, index) => ({ line: index + 1, text: text.trim() }))
    .filter(({ text }) => [...text.matchAll(calls)].some(({ index }) => !isWebCall(text, index)));
}
