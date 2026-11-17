import { expect, test } from "bun:test";
import { AGENT_CLI, expoCliCalls } from "./agent-cli";

test.each([
  "npx expo install expo-image",
  "bunx expo start --clear",
  "Run `npx expo@latest prebuild --clean` first.",
  "npx --yes expo export -p web",
  "npx expo-doctor",
  "npx create-expo-app@latest my-app",
  'allowed-tools: "Bash(npx expo *)"',
])("flags %p", (line) => {
  expect(expoCliCalls(line)).toEqual([{ line: 1, text: line }]);
});

test.each([
  `${AGENT_CLI} install expo-image`,
  "where you would run `npx expo <command>`",
  "npx expo-brownfield build:ios --debug",
  "bunx expo-modules expand ./ios",
  "npx create-expo-module@latest my-module",
  "The default `create-expo-app` template puts `app/` at the root.",
  "Metrics are collected from real builds, not from `expo start`.",
])("allows %p", (line) => {
  expect(expoCliCalls(line)).toEqual([]);
});

test("reports line numbers", () => {
  expect(expoCliCalls("ok\nnpx expo start\nok").map(({ line }) => line)).toEqual([2]);
});
