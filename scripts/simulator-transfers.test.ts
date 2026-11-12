import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const skill = join(import.meta.dir, "../plugins/expo/skills/eas-simulator");
const logs = readFileSync(join(skill, "references/logs-and-crashes.md"), "utf8");
const preview = logs.match(/API=\$\(node -e '\n([\s\S]*?)\n\s*\}\);'/)![1] + "\n});";
const id = "03d5dfcf-736c-475a-8730-af039c3f4d06";
const otherId = "13d5dfcf-736c-475a-8730-af039c3f4d06";
const origin = "https://storage.example.test:8443";
const url = `${origin}/movie.mp4?signature=PRIVATE_FIXTURE`;
const session = { id, status: "IN_PROGRESS", platform: "IOS", remoteConfig: { previewApiUrl: url } };

describe("Binding simulator previews to the requested session", () => {
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

});

const { downloadRecording } = require("../plugins/expo/skills/eas-simulator/scripts/download-recording.cjs");
const record = { id, artifacts: [{ id: "chosen", downloadUrl: url }] };
const storageOrigin = "https://signed.example.test";
const signedUrl = `${storageOrigin}/capture.mp4?signature=PRIVATE_FIXTURE`;
const video = Buffer.from("0000ftypisomVIDEO_FIXTURE");

describe("Downloading simulator recordings", () => {
  let directory: string;
  let outputPath: string;
  let requested: string[];
  let options: Record<string, string>;
  const request = async (url: string, init: RequestInit) => {
    requested.push(url);
    expect(init.redirect).toBe("manual");
    return url === signedUrl ? new Response(video) : new Response(null, {
      status: 302, headers: { location: signedUrl },
    });
  };

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "sim-record-test-"));
    outputPath = join(directory, "capture.mp4");
    requested = [];
    options = { sessionId: id, artifactId: "chosen", artifactOrigin: origin, storageOrigin, outputPath };
  });

  afterEach(() => rmSync(directory, { recursive: true, force: true }));

  it("should follow a verified storage redirect and save the recording privately", async () => {
    await downloadRecording(record, options, request);
    expect(requested).toEqual([url, signedUrl]);
    expect(readFileSync(outputPath)).toEqual(video);
    expect(statSync(outputPath).mode & 0o777).toBe(0o600);
  });

  it("should handle a file type header split across streamed chunks", async () => {
    await downloadRecording(record, options, async () => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(video.subarray(0, 6));
        controller.enqueue(video.subarray(6));
        controller.close();
      },
    })));
    expect(readFileSync(outputPath)).toEqual(video);
  });

  it.each([
    { ...record, id: otherId }, { ...record, id: [id] }, { artifacts: record.artifacts },
    { id, artifacts: [] }, { id, artifacts: [record.artifacts[0], record.artifacts[0]] },
    { id, artifacts: [null] },
  ])("should reject an unrelated or ambiguous recording before making a request (%j)", async payload => {
    await expect(downloadRecording(payload, options, request)).rejects.toThrow("Recording recovery failed");
    expect(requested).toEqual([]);
    expect(existsSync(outputPath)).toBe(false);
  });

  it.each([
    "http://storage.example.test:8443/movie.mp4", "https://foreign.test/movie.mp4",
    "https://storage.example.test/movie.mp4", `${url}#fragment`,
    "https://user:password@storage.example.test:8443/movie.mp4", `${url}\u0000`, `${url}\u00a0`,
  ])("should reject unsafe initial recording destinations (%s)", async downloadUrl => {
    await expect(downloadRecording({ id, artifacts: [{ id: "chosen", downloadUrl }] }, options, request))
      .rejects.toThrow("Recording recovery failed");
    expect(requested).toEqual([]);
  });

  it.each([
    "https://foreign.test/PRIVATE_FIXTURE", "http://signed.example.test/PRIVATE_FIXTURE",
    `${signedUrl}#fragment`, "https://user:password@signed.example.test/PRIVATE_FIXTURE", "",
  ])("should reject an unverified redirect before requesting its destination (%s)", async location => {
    await expect(downloadRecording(record, options, async (url: string) => {
      requested.push(url);
      return new Response(null, { status: 302, headers: { location } });
    })).rejects.toThrow("Recording recovery failed");
    expect(requested).toEqual([url]);
    expect(existsSync(outputPath)).toBe(false);
  });

  it("should stop a redirect loop without writing a recording", async () => {
    await expect(downloadRecording(record, options, async (url: string) => {
      requested.push(url);
      return new Response(null, { status: 302, headers: { location: "/loop" } });
    })).rejects.toThrow("Recording recovery failed");
    expect(requested).toHaveLength(6);
    expect(existsSync(outputPath)).toBe(false);
  });

  it.each([new Response("<html>redirect response</html>"), new Response(""),
    new Response("missing", { status: 404 }), new Response(video, { status: 206 })])
    ("should reject unsuccessful or non-video responses without saving a recording (%j)", async response => {
      await expect(downloadRecording(record, options, async () => response)).rejects.toThrow("Recording recovery failed");
      expect(existsSync(outputPath)).toBe(false);
    });

  it("should remove a partial recording and keep transfer errors private", async () => {
    let reads = 0;
    const body = new ReadableStream({
      pull(controller) {
        if (reads++ === 0) controller.enqueue(video);
        else controller.error(new Error("PRIVATE_FIXTURE"));
      },
    });
    await expect(downloadRecording(record, options, async () => new Response(body)))
      .rejects.toThrow(/^Recording recovery failed; verify the session, storage origins, and recording before retrying\.$/);
    expect(existsSync(outputPath)).toBe(false);
  });

  it("should preserve an existing output", async () => {
    writeFileSync(outputPath, "EXISTING_CAPTURE");
    await expect(downloadRecording(record, options, request)).rejects.toThrow("Recording recovery failed");
    expect(readFileSync(outputPath, "utf8")).toBe("EXISTING_CAPTURE");
  });

  it("should keep malformed session data out of command output", () => {
    const result = spawnSync("node", [join(skill, "scripts/download-recording.cjs"),
      id, "chosen", origin, storageOrigin, outputPath], { input: "PRIVATE_FIXTURE", encoding: "utf8" });
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).not.toContain("PRIVATE_FIXTURE");
  });
});
