export const AGENT_CLI = "npx --yes @expo/agent-cli@latest";

export const AGENT_CLI_ALLOWED_TOOL = `Bash(${AGENT_CLI} *)`;

// `npx expo <cmd>`, `bunx expo <cmd>`, `npx expo-doctor`, `npx create-expo-app`. A `<placeholder>`
// after `expo` is allowed, so prose can name the command that the agent CLI replaces.
const EXPO_CLI_CALL = /\b(?:npx|bunx)\s+(?:--yes\s+|-y\s+)?(?:expo(?:@\S+)?\s+(?!<)|expo-doctor\b|create-expo-app\b)/;

export function expoCliCalls(markdown: string): { line: number; text: string }[] {
  return markdown
    .split("\n")
    .map((text, index) => ({ line: index + 1, text: text.trim() }))
    .filter(({ text }) => EXPO_CLI_CALL.test(text));
}
