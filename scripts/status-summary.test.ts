import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const script = join(import.meta.dir, "../plugins/expo/skills/eas-app-stores/scripts/status-summary.cjs");
const id = "03d5dfcf-736c-475a-8730-af039c3f4d06";
const otherId = "13d5dfcf-736c-475a-8730-af039c3f4d06";
const job = { id, status: "FINISHED", platform: "IOS" };

function run(input: string, expectedId?: string) {
  return spawnSync("node", [script, ...(expectedId === undefined ? [] : [expectedId])], {
    input, encoding: "utf8",
  });
}

describe("Summarizing EAS release jobs", () => {
  it("should report a verified job and omit account details, signed URLs, and raw errors", () => {
    const input = {
      ...job, app: { id: otherId, ownerAccount: { name: "PRIVATE_FIXTURE" } },
      iosConfig: { appleIdUsername: "PRIVATE_FIXTURE" },
      artifacts: { buildUrl: "https://example.invalid?token=PRIVATE_FIXTURE" },
      logFiles: ["PRIVATE_FIXTURE"], error: { message: "PRIVATE_FIXTURE" },
      submittedBuild: { id: otherId }, gitCommitHash: "a".repeat(40),
    };
    const result = run(JSON.stringify(input), id);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      ...job, projectId: otherId, submittedBuildId: otherId, gitCommitHash: "a".repeat(40),
    });
    expect(result.stdout).not.toContain("PRIVATE_FIXTURE");
    expect(result.stderr).toBe("");
  });

  it("should summarize both platforms in a project-scoped list", () => {
    const result = run(JSON.stringify([job, { ...job, id: otherId, platform: "ANDROID", status: "IN_QUEUE" }]));
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toHaveLength(2);
  });

  it("should preserve an empty discovery list without inventing a job", () => {
    const result = run("[]");
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([]);
  });

  it("should show validated failure diagnostics without exposing the error message", () => {
    const failedJob = {
      ...job, status: "ERRORED",
      error: {
        errorCode: "APP_BUILD_FAILED",
        docsUrl: "https://docs.expo.dev/build-reference/troubleshooting/",
        message: "PRIVATE_FIXTURE",
      },
    };
    const result = run(JSON.stringify(failedJob), id);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      ...job, status: "ERRORED", errorCode: "APP_BUILD_FAILED",
      docsUrl: "https://docs.expo.dev/build-reference/troubleshooting/",
    });
    expect(result.stdout).not.toContain("PRIVATE_FIXTURE");
  });

  it.each([
    ["free-text error code", { errorCode: "PRIVATE_FIXTURE: bad credentials" }],
    ["untrusted docs host", { docsUrl: "https://docs.expo.dev.evil.invalid/PRIVATE_FIXTURE" }],
    ["tokenized docs link", { docsUrl: "https://docs.expo.dev/build-reference/?token=PRIVATE_FIXTURE" }],
    ["encoded docs path", { docsUrl: "https://docs.expo.dev/build-reference/%50RIVATE_FIXTURE" }],
  ])("should omit %s while keeping the failed job status", (_label, error) => {
    const result = run(JSON.stringify({ ...job, status: "ERRORED", error }));
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ ...job, status: "ERRORED" });
    expect(result.stdout).not.toContain("PRIVATE_FIXTURE");
  });

  it.each([
    ["malformed JSON", "PRIVATE_FIXTURE"],
    ["null response", "null"],
    ["missing fields", "{}"],
    ["invalid ID", JSON.stringify({ ...job, id: "PRIVATE_FIXTURE" })],
    ["array ID", JSON.stringify({ ...job, id: [id] })],
    ["invalid status", JSON.stringify({ ...job, status: "PRIVATE_FIXTURE" })],
    ["invalid platform", JSON.stringify({ ...job, platform: "WEB" })],
    ["invalid project ID", JSON.stringify({ ...job, app: { id: "PRIVATE_FIXTURE" } })],
    ["invalid submitted build", JSON.stringify({ ...job, submittedBuild: { id: [id] } })],
    ["invalid source hash", JSON.stringify({ ...job, gitCommitHash: "PRIVATE_FIXTURE" })],
    ["array source hash", JSON.stringify({ ...job, gitCommitHash: ["a".repeat(40)] })],
    ["mixed valid and invalid jobs", JSON.stringify([job, { status: "PRIVATE_FIXTURE" }])],
  ])("should reject %s without emitting raw or partial data", (_label, input) => {
    const result = run(input);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).not.toContain("PRIVATE_FIXTURE");
  });

  it("should reject a response belonging to a different requested job", () => {
    const result = run(JSON.stringify(job), otherId);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
  });

  it("should reject a list when a single identified job was requested", () => {
    const result = run(JSON.stringify([job]), id);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
  });
});
