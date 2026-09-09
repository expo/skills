#!/usr/bin/env node
// Recover an existing agent-device recording; run through eas simulator:exec.
import { createWriteStream } from 'node:fs';
import { link, mkdir, mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';

export async function downloadRecording({ artifactId, output, timeoutMs = 600000, env = process.env }) {
  if (!artifactId || !output || !Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2147483647) {
    throw new Error('Provide an artifact id, output path, and positive timeout in milliseconds (max 2147483647).');
  }
  const baseUrl = env.AGENT_DEVICE_DAEMON_BASE_URL?.trim();
  const token = env.AGENT_DEVICE_DAEMON_AUTH_TOKEN?.trim();
  if (!baseUrl || !token) throw new Error('Missing remote daemon environment; run through eas simulator:exec.');
  let endpoint;
  try {
    endpoint = new URL(baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  } catch {
    throw new Error('Invalid remote daemon URL.');
  }
  if (!['https:', 'http:'].includes(endpoint.protocol) || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    throw new Error('Expected an HTTP(S) daemon base URL without credentials, query, or fragment.');
  }
  // Append an encoded path component; never accept a caller-selected download host.
  endpoint.pathname += `artifacts/${encodeURIComponent(artifactId)}`;
  const destination = path.resolve(output);
  await mkdir(path.dirname(destination), { recursive: true });
  const temporaryDir = await mkdtemp(path.join(path.dirname(destination), '.recording-download-'));
  const temporaryFile = path.join(temporaryDir, 'recording');
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = { authorization: `Bearer ${token}`, 'x-agent-device-token': token };
    if (env.AGENT_DEVICE_TENANT?.trim()) headers['x-agent-device-tenant'] = env.AGENT_DEVICE_TENANT.trim();
    const response = await fetch(endpoint, { headers, redirect: 'manual', signal: controller.signal });
    if (response.status !== 200 || !response.body) {
      await response.body?.cancel();
      throw new Error(`Artifact download returned HTTP ${response.status}; check the original session and artifact id.`);
    }
    await pipeline(Readable.fromWeb(response.body), createWriteStream(temporaryFile, { flags: 'wx', mode: 0o600 }), { signal: controller.signal });
    // Same-filesystem link atomically publishes a complete file and fails if output exists.
    await link(temporaryFile, destination);
    return destination;
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`Artifact download timed out after ${timeoutMs} ms; retain the session and artifact id.`);
    if (error?.code === 'EEXIST') throw new Error('Output already exists; choose a new output path.');
    // Do not print fetch causes, response bodies, URLs, or credentials.
    if (error?.message?.startsWith('Artifact download returned HTTP ')) throw error;
    throw new Error('Artifact download failed; check connectivity, session status, and output permissions.');
  } finally {
    clearTimeout(deadline);
    await rm(temporaryDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [artifactId, output, flag, timeout, ...extra] = process.argv.slice(2);
  if (!artifactId || !output || extra.length || (flag !== undefined && (flag !== '--timeout-ms' || timeout === undefined))) {
    console.error('Usage: download-recording.mjs <artifact-id> <output> [--timeout-ms 600000]');
    process.exitCode = 1;
  } else {
    try {
      console.log(await downloadRecording({ artifactId, output, timeoutMs: timeout === undefined ? 600000 : Number(timeout) }));
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
