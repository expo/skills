export const AGENT_CLI = "npx --yes @expo/agent-cli@latest";

export const AGENT_CLI_ALLOWED_TOOL = `Bash(${AGENT_CLI} *)`;

// `npx|bunx expo <cmd>`, `npx expo-doctor`, `npx create-expo(-app)`, and `bun create expo`. A
// `<placeholder>` after `expo` is allowed, so prose can name the command that the agent CLI replaces.
// `(?![\w-])` ends a package name; `\b` would also match inside `create-expo-module`.
const EXPO_CLI_CALL =
  /\b(?:npx|bunx)\s+(?:--yes\s+|-y\s+)?(?:expo(?:@\S+)?\s+(?!<)|(?:expo-doctor|create-expo(?:-app)?)(?![\w-]))|\bbun\s+create\s+expo(?![\w-])/;

// Web commands stay on Expo CLI: `npx expo serve`, `npx expo start --web`, and `npx expo export` for web.
const WEB_EXPO_CLI_CALL = /\bnpx\s+expo\s+(?:serve\b|start\b.*\s--web\b|export\b.*(?:-p|--platform)\s+web\b)/;

export function expoCliCalls(markdown: string): { line: number; text: string }[] {
  return markdown
    .split("\n")
    .map((text, index) => ({ line: index + 1, text: text.trim() }))
    .filter(({ text }) => EXPO_CLI_CALL.test(text) && !WEB_EXPO_CLI_CALL.test(text));
}
