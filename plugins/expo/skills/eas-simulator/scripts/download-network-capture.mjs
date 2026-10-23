import { createWriteStream } from "node:fs";
import { chmod, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

async function readPreview() {
  process.stdin.setEncoding("utf8");
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  let payload;
  try {
    payload = JSON.parse(input);
  } catch {
    throw new Error("Expected simulator:get --json or a REST session response on stdin.");
  }
  const session = payload?.data ?? payload;
  if (!["IN_PROGRESS", "in-progress"].includes(session?.status) || !["IOS", "ios"].includes(session?.platform)) {
    throw new Error("HAR export requires an active iOS session. Check the original session ID.");
  }
  let url;
  try {
    url = new URL(session.remoteConfig?.previewApiUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
  } catch {
    throw new Error("No preview API URL. Private CLI output omits it; use the authenticated REST session response or browser download.");
  }
  const token = url.searchParams.get("token") ?? session.remoteConfig?.webPreviewToken ?? session.remoteConfig?.previewToken;
  if (!token) throw new Error("No preview token. Check the original session response.");
  url.searchParams.delete("token");
  url.hash = "";
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/network-capture.har`;
  return { url, token };
}

async function download(url, token, filePath) {
  const signal = AbortSignal.timeout(10 * 60_000);
  let response;
  try {
    response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal, redirect: "error" });
  } catch {
    throw new Error("HAR export could not be reached. Check the connection and retry.");
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    throw new Error(
      `HAR export failed (HTTP ${response.status}). Check capture state in the preview and fetch the original session again.`,
    );
  }
  const contentType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json" && contentType !== "application/har+json") {
    await response.body?.cancel().catch(() => {});
    throw new Error("HAR export did not return JSON. Check the original session and capture route.");
  }
  if (!response.body) throw new Error("HAR export returned no body.");
  try {
    await pipeline(
      Readable.fromWeb(response.body),
      createWriteStream(filePath, { flags: "wx", mode: 0o600 }),
      { signal },
    );
  } catch {
    throw new Error(
      "HAR download did not finish. Check disk space and the connection, then retry.",
    );
  }
}

async function main() {
  const { url, token } = await readPreview();
  const directory = await mkdtemp(join(tmpdir(), "eas-sim-har-"));
  const filePath = join(directory, "network-capture.har");
  try {
    await chmod(directory, 0o700);
    await download(url, token, filePath);
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
  console.log(filePath);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
