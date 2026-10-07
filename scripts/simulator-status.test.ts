import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const script = join(import.meta.dir, "../plugins/expo/skills/eas-simulator/scripts/session-status.cjs");
const id = "03d5dfcf-736c-475a-8730-af039c3f4d06";
const otherId = "13d5dfcf-736c-475a-8730-af039c3f4d06";
const config = {
  __typename: "AgentDeviceRunSessionRemoteConfig",
  agentDeviceRemoteSessionUrl: "https://device.example.test",
  agentDeviceRemoteSessionToken: "PRIVATE_FIXTURE",
};
const session = { id, status: "IN_PROGRESS", platform: "IOS", remoteConfig: config };

function run(input: unknown, controller?: string) {
  return spawnSync("node", [script, id, ...(controller ? [controller] : [])], {
    input: JSON.stringify(input), encoding: "utf8",
  });
}

describe("Verifying remote simulator readiness", () => {
  it("should report the identified live controller without exposing connection secrets", () => {
    const result = run({ ...session, name: "PRIVATE_FIXTURE", artifacts: ["PRIVATE_FIXTURE"] });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ id, status: "IN_PROGRESS", platform: "IOS", ready: true });
    expect(result.stdout).not.toContain("PRIVATE_FIXTURE");
    expect(result.stderr).toBe("");
  });

  it.each(["NEW", "QUEUED", "STARTING", "STOPPED", "ERRORED"])(
    "should keep a %s session unready even when stale credentials remain",
    (status) => {
      const result = run({ ...session, status });
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout).ready).toBe(false);
    },
  );

  it.each([
    null, {}, [], { ...config, agentDeviceRemoteSessionToken: "" },
    { ...config, agentDeviceRemoteSessionUrl: "http://device.example.test" },
    { ...config, agentDeviceRemoteSessionUrl: "https://user:PRIVATE_FIXTURE@device.example.test" },
    { ...config, __typename: "unknown" },
  ].map(value => [value]))("should keep an incomplete or unsafe controller config unready (%j)", (remoteConfig) => {
    const result = run({ ...session, remoteConfig });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).ready).toBe(false);
    expect(result.stdout).not.toContain("PRIVATE_FIXTURE");
  });

  it.each([
    { __typename: "ArgentRunSessionRemoteConfig", toolsUrl: "https://device.example.test", toolsAuthToken: "PRIVATE_FIXTURE" },
    { __typename: "AppiumRunSessionRemoteConfig", appiumUrl: "https://device.example.test", capabilities: {} },
    { __typename: "WebPreviewOnlyRunSessionRemoteConfig", previewUrl: "https://preview.example.test?token=PRIVATE_FIXTURE" },
    { __typename: "ServeSimRunSessionRemoteConfig", previewUrl: "https://preview.example.test" },
  ])("should recognize a supported alternative session config (%j)", (remoteConfig) => {
    const controller = remoteConfig.__typename === "ArgentRunSessionRemoteConfig" ? "argent" :
      remoteConfig.__typename === "AppiumRunSessionRemoteConfig" ? "appium" : "web-preview-only";
    const result = run({ ...session, platform: "ANDROID", remoteConfig }, controller);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).ready).toBe(true);
    expect(result.stdout).not.toContain("PRIVATE_FIXTURE");
  });

  it("should keep a session with a different controller unready", () => {
    const result = run(session, "appium");
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).ready).toBe(false);
  });

  it.each([
    null, [], {}, { ...session, id: otherId }, { ...session, id: [id] },
    { ...session, status: "PRIVATE_FIXTURE" }, { ...session, platform: "PRIVATE_FIXTURE" },
  ].map(value => [value]))("should reject a malformed or different session without echoing raw values (%j)", (input) => {
    const result = run(input);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).not.toContain("PRIVATE_FIXTURE");
  });

  it("should reject malformed JSON without echoing its contents", () => {
    const result = spawnSync("node", [script, id], { input: "PRIVATE_FIXTURE", encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).not.toContain("PRIVATE_FIXTURE");
  });

  it("should require a valid expected session ID", () => {
    for (const args of [[], ["PRIVATE_FIXTURE"], [id, otherId]]) {
      const result = spawnSync("node", [script, ...args], { input: JSON.stringify(session), encoding: "utf8" });
      expect(result.status).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).not.toContain("PRIVATE_FIXTURE");
    }
  });
});
