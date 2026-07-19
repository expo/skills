const assert = require("node:assert/strict");
const test = require("node:test");

const { feedbackInvocation, main, parseArgs } = require("./skill-feedback.cjs");

test("translates the legacy CLI to submit-expo-feedback", () => {
  const invocation = feedbackInvocation(parseArgs([
    "--skill", "expo-router",
    "--rating", "bug",
    "--about", "expo",
    "--agent-harness", "codex",
    "--text", "The command uses a removed option.",
  ]));

  assert.equal(invocation.command, "npx");
  assert.deepEqual(invocation.args, [
    "--yes",
    "submit-expo-feedback@latest",
    "--category",
    "skills",
    "--subject",
    "expo-router",
    "[rating=bug; about=expo; agent-harness=codex] The command uses a removed option.",
  ]);
});

test("uses npx.cmd on Windows", () => {
  const invocation = feedbackInvocation({
    skill: "expo-router",
    rating: "idea",
    text: "Add a troubleshooting example.",
    about: "skill",
    agentHarness: "",
  }, "win32");

  assert.equal(invocation.command, "npx.cmd");
});

test("dry-run validates without spawning", () => {
  let spawned = false;
  const originalLog = console.log;
  console.log = () => {};
  try {
    const code = main([
      "--skill", "expo-router",
      "--rating", "confusing",
      "--text", "The routing example is unclear.",
      "--dry-run",
    ], () => {
      spawned = true;
      return { status: 0 };
    });
    assert.equal(code, 0);
    assert.equal(spawned, false);
  } finally {
    console.log = originalLog;
  }
});

test("propagates the delegated command exit status", () => {
  const code = main([
    "--skill", "expo-router",
    "--rating", "bug",
    "--text", "The command fails.",
  ], () => ({ status: 7 }));

  assert.equal(code, 7);
});
