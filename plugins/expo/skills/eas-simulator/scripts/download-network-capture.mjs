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
  let session;
  try {
    session = JSON.parse(input);
  } catch {
    throw new Error("Expected simulator:get --json output on stdin.");
  }
  if (session?.status !== "IN_PROGRESS" || session?.platform !== "IOS") {
    throw new Error("HAR export requires an active iOS session. Check the original session ID.");
  }
  let url;
  try {
    url = new URL(session.remoteConfig?.previewApiUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
  } catch {
    throw new Error("No valid preview API URL. Re-run simulator:get --json.");
  }
  const token = url.searchParams.get("token");
  if (!token) throw new Error("No preview token. Re-run simulator:get --json.");
  url.searchParams.delete("token");
  url.hash = "";
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/network-capture.har`;
  return { url, token };
}

async function download(url, token, filePath) {
  const signal = AbortSignal.timeout(10 * 60_000);
  let response;
  try {
    response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal });
  } catch {
    throw new Error("HAR export could not be reached. Check the connection and retry.");
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    throw new Error(
      `HAR export failed (HTTP ${response.status}). Check capture state in the preview and re-run simulator:get.`,
    );
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
