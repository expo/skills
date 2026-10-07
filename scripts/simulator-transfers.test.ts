import { describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const skill = join(import.meta.dir, "../plugins/expo/skills/eas-simulator");
const controllers = readFileSync(join(skill, "references/controllers.md"), "utf8");
const logs = readFileSync(join(skill, "references/logs-and-crashes.md"), "utf8");
const recording = controllers.match(/node -e '\n([\s\S]*?)\n' "\$ARTIFACT_OUTPUT"/)![1].replace("<artifact-id>", "chosen");
const preview = logs.match(/API=\$\(node -e '\n([\s\S]*?)\n\s*\}\);'/)![1] + "\n});";
const id = "03d5dfcf-736c-475a-8730-af039c3f4d06";
const otherId = "13d5dfcf-736c-475a-8730-af039c3f4d06";
const origin = "https://storage.example.test:8443";
const url = `${origin}/movie.mp4?signature=PRIVATE_FIXTURE`;
const record = { id, artifacts: [{ id: "chosen", downloadUrl: url }] };
const session = { id, status: "IN_PROGRESS", platform: "IOS", remoteConfig: { previewApiUrl: url } };

function parseRecording(payload: unknown) {
  const directory = mkdtempSync(join(tmpdir(), "sim-record-test-"));
  try {
    const path = join(directory, "session.json");
    writeFileSync(path, JSON.stringify(payload));
    return spawnSync("node", ["-e", recording, path, origin, id], { encoding: "utf8" });
  } finally { rmSync(directory, { recursive: true }); }
}

describe("Binding simulator transfers to the requested session", () => {
  it("should select only the identified recording URL for the private curl pipe", () => {
    const result = parseRecording({ ...record, otherToken: "UNRELATED_SECRET" });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(`url = "${url}"\n`);
    expect(result.stdout).not.toContain("UNRELATED_SECRET");
  });

  it.each([
    { ...record, id: otherId }, { ...record, id: [id] }, { artifacts: record.artifacts },
    { id, artifacts: [] }, { id, artifacts: [record.artifacts[0], record.artifacts[0]] },
    { id, artifacts: [null] },
  ])("should reject an unrelated or ambiguous recording response (%j)", (payload) => {
    const result = parseRecording(payload);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).not.toContain("PRIVATE_FIXTURE");
  });

  it.each([
    "http://storage.example.test:8443/movie.mp4", "https://foreign.test/movie.mp4",
    "https://storage.example.test/movie.mp4", `${url}#fragment`,
    "https://user:password@storage.example.test:8443/movie.mp4", `${url}\u0000`, `${url}\u00a0`,
  ])("should reject unsafe recording destinations (%s)", (downloadUrl) => {
    const result = parseRecording({ id, artifacts: [{ id: "chosen", downloadUrl }] });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).not.toContain("PRIVATE_FIXTURE");
  });

  it("should select a verified live preview without emitting unrelated config", () => {
    const result = spawnSync("node", ["-e", preview, origin, id], {
      input: JSON.stringify({ ...session, otherToken: "UNRELATED_SECRET" }), encoding: "utf8",
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(url);
    expect(result.stdout).not.toContain("UNRELATED_SECRET");
  });

  it.each([
    { ...session, id: otherId }, { ...session, id: [id] }, { ...session, id: null },
    { ...session, status: "STOPPED" }, { ...session, platform: "ANDROID" },
    { ...session, remoteConfig: null },
    { ...session, remoteConfig: { previewApiUrl: `${url}#fragment` } },
    { ...session, remoteConfig: { previewApiUrl: `${url}\u0000` } },
  ])("should stop an invalid preview lookup before requesting its endpoint (%j)", (payload) => {
    const result = spawnSync("node", ["-e", preview, origin, id], {
      input: JSON.stringify(payload), encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).not.toContain("PRIVATE_FIXTURE");
  });

  it.each([
    ["successful download", record, "0", "0", true],
    ["failed transfer", record, "0", "22", false],
    ["wrong session", { ...record, id: otherId }, "0", "0", false],
    ["failed query", record, "1", "0", false],
  ] as const)("should keep %s private and preserve existing output files", (_label, payload, queryCode, curlCode, succeeds) => {
    const directory = mkdtempSync(join(tmpdir(), "sim-transfer-test-"));
    try {
      const script = controllers.match(/```bash\n(set \+x\numask 077[\s\S]*?)\n```/)![1]
        .replace("https://<verified-storage-hostname>", origin).replace("<artifact-id>", "chosen");
      writeFileSync(join(directory, "response"), JSON.stringify(payload));
      writeFileSync(join(directory, "capture.mp4"), "EXISTING_CAPTURE");
      writeFileSync(join(directory, "npx"), '#!/bin/bash\ncat "$FIXTURE_DIR/response"\necho PRIVATE_FIXTURE >&2\nexit "$QUERY_CODE"\n');
      writeFileSync(join(directory, "curl"), '#!/bin/bash\nprintf "%s\\n" "$@" > "$FIXTURE_DIR/args"\ncat > "$FIXTURE_DIR/config"\nwhile [ "$#" -gt 0 ]; do\n if [ "$1" = --output ]; then shift; printf VIDEO_FIXTURE > "$1"; fi\n shift\ndone\necho PRIVATE_FIXTURE >&2\nexit "$CURL_CODE"\n');
      for (const command of ["npx", "curl"]) chmodSync(join(directory, command), 0o700);
      const result = spawnSync("bash", ["-e", "-x", "-c", script], {
        cwd: directory, encoding: "utf8",
        env: { ...process.env, PATH: `${directory}:${process.env.PATH}`, TMPDIR: directory,
          FIXTURE_DIR: directory, QUERY_CODE: queryCode, CURL_CODE: curlCode, SESSION_ID: id },
      });
      expect(result.status === 0).toBe(succeeds);
      expect(result.stdout + result.stderr).not.toContain("PRIVATE_FIXTURE");
      expect(readFileSync(join(directory, "capture.mp4"), "utf8")).toBe("EXISTING_CAPTURE");
      const artifacts = join(directory, readdirSync(directory).find(name => name.startsWith("eas-sim-artifact."))!);
      expect(statSync(artifacts).mode & 0o777).toBe(0o700);
      expect(readdirSync(artifacts).includes("capture.mp4")).toBe(succeeds);
      if (succeeds) {
        expect(readFileSync(join(directory, "args"), "utf8")).not.toContain("PRIVATE_FIXTURE");
        expect(readFileSync(join(directory, "config"), "utf8")).toBe(`url = "${url}"\n`);
        expect(statSync(join(artifacts, "capture.mp4")).mode & 0o777).toBe(0o600);
      }
    } finally { rmSync(directory, { recursive: true }); }
  });
});
