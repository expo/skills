import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const runner = join(import.meta.dir, "../plugins/expo/skills/eas-simulator/scripts/run-controller.cjs");
const id = "03d5dfcf-736c-475a-8730-af039c3f4d06";
const agent = { __typename: "AgentDeviceRunSessionRemoteConfig",
  agentDeviceRemoteSessionUrl: "https://device.example.test", agentDeviceRemoteSessionToken: "SESSION_FIXTURE" };
const session = { id, status: "IN_PROGRESS", platform: "IOS", remoteConfig: agent };
const spy = '#!' + process.execPath + '\n' +
  'process.stdout.write(JSON.stringify({args: process.argv.slice(2), env: process.env})); process.exit(Number(process.argv.at(-1)) || 0);\n';

function run(payload: unknown, controller = "agent-device", args = ["snapshot", "-i"]) {
  const directory = mkdtempSync(join(tmpdir(), "sim-controller-test-"));
  try {
    const command = join(directory, "npx");
    writeFileSync(command, spy);
    chmodSync(command, 0o700);
    return spawnSync("node", [runner, id, controller, ...(controller === "agent-device" ? [] : [command]), ...args], {
      input: JSON.stringify(payload), encoding: "utf8",
      env: { AGENT_DEVICE_BIN: command, HOME: directory, TMPDIR: directory, LANG: "C", PATH: `${directory}:${process.env.PATH}`, EXPO_TOKEN: "ACCOUNT_FIXTURE",
        OPENAI_API_KEY: "ACCOUNT_FIXTURE", AWS_SECRET_ACCESS_KEY: "ACCOUNT_FIXTURE", NPM_TOKEN: "ACCOUNT_FIXTURE", NODE_OPTIONS: "--max-old-space-size=96",
        APP_TEST_VALUE: "PROJECT_FIXTURE", AGENT_DEVICE_DAEMON_BASE_URL: "https://wrong.example.test",
        AGENT_DEVICE_DAEMON_AUTH_TOKEN: "STALE_FIXTURE", ARGENT_AUTH_TOKEN: "STALE_FIXTURE", APPIUM_URL: "https://wrong.example.test" },
    });
  } finally { rmSync(directory, { recursive: true }); }
}

describe("Running a simulator controller with scoped connection settings", () => {
  it("should pass only the verified agent-device session and omit unrelated credentials", () => {
    const result = run(session);
    expect(result.status).toBe(0);
    const child = JSON.parse(result.stdout);
    expect(child.args).toEqual(["snapshot", "-i"]);
    expect(child.env.AGENT_DEVICE_DAEMON_BASE_URL).toBe(agent.agentDeviceRemoteSessionUrl);
    expect(child.env.AGENT_DEVICE_DAEMON_AUTH_TOKEN).toBe("SESSION_FIXTURE");
    expect(result.stdout).not.toContain("ACCOUNT_FIXTURE");
    expect(result.stdout).not.toContain("PROJECT_FIXTURE");
    expect(result.stdout).not.toContain("STALE_FIXTURE");
    expect(child.env.NODE_OPTIONS).toBeUndefined();
    expect(child.env.PATH).toBeDefined();
  });

  it("should supply only Argent connection fields to a reviewed local executable", () => {
    const config = { __typename: "ArgentRunSessionRemoteConfig", toolsUrl: "https://argent.example.test", toolsAuthToken: "ARGENT_FIXTURE" };
    const result = run({ ...session, remoteConfig: config }, "argent", ["run", "screenshot", "--udid", "device-one"]);
    expect(result.status).toBe(0);
    const child = JSON.parse(result.stdout);
    expect(child.args).toEqual(["run", "screenshot", "--udid", "device-one"]);
    expect(child.env.ARGENT_TOOLS_URL).toBe(config.toolsUrl);
    expect(child.env.ARGENT_AUTH_TOKEN).toBe(config.toolsAuthToken);
    expect(child.env.AGENT_DEVICE_DAEMON_AUTH_TOKEN).toBeUndefined();
    expect(result.stdout).not.toContain("ACCOUNT_FIXTURE");
    expect(result.stdout).not.toContain("STALE_FIXTURE");
  });

  it("should supply typed Appium capabilities without inheriting project secrets", () => {
    const config = { __typename: "AppiumRunSessionRemoteConfig", appiumUrl: "https://appium.example.test", capabilities: { platformName: "iOS" } };
    const result = run({ ...session, remoteConfig: config }, "appium", ["--test", "checkout"]);
    expect(result.status).toBe(0);
    const child = JSON.parse(result.stdout);
    expect(child.env.APPIUM_URL).toBe(config.appiumUrl);
    expect(JSON.parse(child.env.APPIUM_CAPS)).toEqual(config.capabilities);
    expect(child.env.ARGENT_AUTH_TOKEN).toBeUndefined();
    expect(result.stdout).not.toContain("ACCOUNT_FIXTURE");
    expect(result.stdout).not.toContain("PROJECT_FIXTURE");
  });

  it.each([
    { ...session, id: "13d5dfcf-736c-475a-8730-af039c3f4d06" },
    { ...session, status: "STOPPED" }, { ...session, status: "STARTING" },
    { ...session, remoteConfig: null }, { ...session, remoteConfig: { ...agent, agentDeviceRemoteSessionToken: "" } },
    { ...session, remoteConfig: { ...agent, agentDeviceRemoteSessionUrl: "http://device.example.test" } },
  ])("should stop an unverified session before launching a client (%j)", (payload) => {
    const result = run(payload);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).not.toContain("SESSION_FIXTURE");
  });

  it("should reject an absent action or a different controller", () => {
    for (const result of [run(session, "agent-device", []), run(session, "appium", ["--test"])]) {
      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
    }
  });

  it("should refuse a relative alternative executable and preview-only sessions", () => {
    const payload = { ...session, remoteConfig: { __typename: "AppiumRunSessionRemoteConfig", appiumUrl: "https://appium.example.test", capabilities: {} } };
    const result = spawnSync("node", [runner, id, "appium", "client"], { input: JSON.stringify(payload), encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    const preview = run({ ...session, remoteConfig: { __typename: "WebPreviewOnlyRunSessionRemoteConfig", previewUrl: "https://preview.example.test" } }, "web-preview-only");
    expect(preview.status).toBe(1);
    expect(preview.stdout).toBe("");
  });

  it("should propagate a failed controller status", () => {
    expect(run(session, "agent-device", ["snapshot", "7"]).status).toBe(7);
  });

  it("should pass shell syntax as literal controller arguments", () => {
    const result = run(session, "agent-device", ["fill", "@e1", "$(false); `false` & value"]);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).args.at(-1)).toBe("$(false); `false` & value");
  });

  it.each([undefined, "relative-client"])("should reject an unavailable or relative installed controller (%j)", (binary) => {
    const result = spawnSync("node", [runner, id, "agent-device", "snapshot"], {
      input: JSON.stringify(session), encoding: "utf8",
      env: { PATH: process.env.PATH, ...(binary ? { AGENT_DEVICE_BIN: binary } : {}) },
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).not.toContain("SESSION_FIXTURE");
  });

  it("should reject malformed JSON without emitting it", () => {
    const result = spawnSync("node", [runner, id, "agent-device", "snapshot"], { input: "ACCOUNT_FIXTURE", encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).not.toContain("ACCOUNT_FIXTURE");
  });

  it.each([
    ["a successful action", 0, 0, true, false],
    ["a failed controller", 0, 7, true, false],
    ["a failed session query", 1, 0, false, false],
    ["a failed query after an earlier action", 1, 0, true, true],
  ])("should keep raw controller output private for %s", (_label, queryCode, controllerCode, called, priorAction) => {
    const directory = mkdtempSync(join(tmpdir(), "sim-private-output-test-"));
    try {
      const reference = readFileSync(join(import.meta.dir, "../plugins/expo/skills/eas-simulator/references/run-your-app.md"), "utf8");
      const preparation = reference.match(/```bash\n(set \+x\numask 077[\s\S]*?)\n```/)![1];
      writeFileSync(join(directory, "response"), JSON.stringify(session));
      writeFileSync(join(directory, "controller-exit"), String(controllerCode));
      writeFileSync(join(directory, "npx"), '#!/bin/bash\nSTUB_DIR=$(dirname "$0")\ncase "$*" in\n *simulator:get*) cat "$STUB_DIR/response"; echo ACCOUNT_FIXTURE >&2; exit "$QUERY_CODE";;\n *) echo called > "$STUB_DIR/called"; echo "RAW_FIXTURE $AGENT_DEVICE_DAEMON_AUTH_TOKEN"; echo SESSION_ERROR_FIXTURE >&2; exit "$(cat "$STUB_DIR/controller-exit")";;\nesac\n');
      chmodSync(join(directory, "npx"), 0o700);
      const earlier = priorAction ? '\nQUERY_CODE=0 sim_control snapshot -i || exit $?' : '';
      const result = spawnSync("bash", ["-x", "-c", preparation + earlier + '\nsim_control fill @e1 PRIVATE_INPUT_FIXTURE\nexit $?'], {
        cwd: directory, encoding: "utf8", env: { PATH: `${directory}:${process.env.PATH}`, HOME: directory,
          TMPDIR: directory, AGENT_DEVICE_BIN: join(directory, "npx"), SESSION_ID: id, SIM_RUN: runner, QUERY_CODE: String(queryCode) },
      });
      expect(result.status).toBe(queryCode || controllerCode);
      expect(existsSync(join(directory, "called"))).toBe(called);
      for (const secret of ["ACCOUNT_FIXTURE", "SESSION_FIXTURE", "RAW_FIXTURE", "SESSION_ERROR_FIXTURE", "PRIVATE_INPUT_FIXTURE"]) {
        expect(result.stdout + result.stderr).not.toContain(secret);
      }
      const outputs = readdirSync(directory).filter(name => name.startsWith("eas-sim-"));
      expect(outputs).toHaveLength(4);
      for (const name of outputs) expect(statSync(join(directory, name)).mode & 0o777).toBe(0o600);
      const stdout = readFileSync(join(directory, outputs.find(name => /^eas-sim-control\.[^.]+$/.test(name))!), "utf8");
      const stderr = readFileSync(join(directory, outputs.find(name => name.startsWith("eas-sim-control-error."))!), "utf8");
      expect(stdout).toBe(queryCode === 0 ? "RAW_FIXTURE SESSION_FIXTURE\n" : "");
      expect(stderr).toBe(queryCode === 0 ? "SESSION_ERROR_FIXTURE\n" : "");
    } finally { rmSync(directory, { recursive: true }); }
  });

  it.each([
    ["an existing session", "0", "0", false],
    ["a session created by this run", "1", "0", true],
    ["an existing session after a failed query", "0", "1", false],
  ])("should limit failure cleanup for %s to the run's ownership", (_label, created, queryCode, shouldStop) => {
    const directory = mkdtempSync(join(tmpdir(), "sim-ownership-test-"));
    try {
      const reference = readFileSync(join(import.meta.dir, "../plugins/expo/skills/eas-simulator/references/run-your-app.md"), "utf8");
      const loop = reference.match(/(READY=0\nfor[\s\S]*?\nfi)\n```/)![1];
      writeFileSync(join(directory, "response"), JSON.stringify({ ...session, status: "STARTING" }));
      writeFileSync(join(directory, "npx"), '#!/bin/bash\nSTUB_DIR=$(dirname "$0")\ncase "$*" in\n *simulator:get*) cat "$STUB_DIR/response"; echo ACCOUNT_FIXTURE >&2; exit "$QUERY_CODE";;\n *simulator:stop*) echo stop >> "$STUB_DIR/stopped";;\n *) exit 9;;\nesac\n');
      writeFileSync(join(directory, "sleep"), '#!/bin/bash\nexit 0\n');
      for (const command of ["npx", "sleep"]) chmodSync(join(directory, command), 0o700);
      const result = spawnSync("bash", ["-c", loop], {
        encoding: "utf8", env: { PATH: `${directory}:${process.env.PATH}`, HOME: directory,
          SESSION_ID: id, SESSION_CREATED_THIS_RUN: created, QUERY_CODE: queryCode,
          SIM_STATUS: join(import.meta.dir, "../plugins/expo/skills/eas-simulator/scripts/session-status.cjs"),
          SESSION_OUTPUT: join(directory, "out"), SESSION_ERROR: join(directory, "err") },
      });
      expect(result.status).toBe(1);
      expect(existsSync(join(directory, "stopped"))).toBe(shouldStop);
      expect(result.stdout + result.stderr).not.toContain("ACCOUNT_FIXTURE");
    } finally { rmSync(directory, { recursive: true }); }
  });
});
