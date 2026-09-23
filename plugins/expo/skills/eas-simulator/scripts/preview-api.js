#!/usr/bin/env node
/**
 * Read an iOS EAS Simulator session's device log and crash reports from its preview server.
 *
 * Usage:
 *   node preview-api.js get <route> [query] [--id <session-id>]
 *   node preview-api.js watch [--seconds <n>] [--id <session-id>]
 *
 *   get    Print one route's JSON, e.g. `get /crashes`, `get /crashes/<id> key=2`,
 *          `get /logs "snapshot=1&follow=1&limit=500"`.
 *   watch  Hold the device log with a `/crashes?tail=1` stream and print each frame as one JSON
 *          line, until interrupted or for `--seconds`. Start it before reproducing a crash.
 *
 * Run it from the Expo project directory. It reads the session's `previewApiUrl` from
 * `eas simulator:get --json` (the dotenv session unless `--id` is given). That URL carries the
 * session token; this script keeps it in the query and never prints it.
 * EAS_SIMULATOR_PREVIEW_API_URL overrides the lookup (for tests or a local serve-sim).
 */

'use strict';

const { spawnSync } = require('child_process');

function fail(message) {
  console.error(message);
  process.exit(1);
}

function redact(url) {
  const copy = new URL(url);
  if (copy.searchParams.has('token')) copy.searchParams.set('token', 'REDACTED');
  return copy.toString();
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--id' || arg === '--seconds') flags[arg.slice(2)] = argv[(i += 1)];
    else positional.push(arg);
  }
  return { command: positional[0], rest: positional.slice(1), flags };
}

function resolveApiUrl(sessionId) {
  if (process.env.EAS_SIMULATOR_PREVIEW_API_URL) return process.env.EAS_SIMULATOR_PREVIEW_API_URL;
  const args = ['--yes', 'eas-cli@latest', 'simulator:get', '--json'];
  if (sessionId) args.push('--id', sessionId);
  const result = spawnSync('npx', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  if (result.status !== 0) {
    fail(
      'Could not read the session with `eas simulator:get --json`. Run this from the Expo project ' +
        'directory with a live session (`simulator:get` shows IN_PROGRESS), or pass --id <session-id>.'
    );
  }
  let url;
  try {
    url = JSON.parse(result.stdout).remoteConfig?.previewApiUrl;
  } catch {
    fail('`eas simulator:get --json` did not print JSON. Upgrade eas-cli or run it by hand to see why.');
  }
  if (!url) {
    fail(
      'This session has no preview API (no remoteConfig.previewApiUrl). Crash reports and the ' +
        'device log need an iOS session with a browser preview; use `agent-device logs` instead.'
    );
  }
  return url;
}

function routeUrl(apiUrl, route, query) {
  const url = new URL(apiUrl);
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/${route.replace(/^\/+/, '')}`;
  for (const [key, value] of new URLSearchParams(query ?? '')) url.searchParams.set(key, value);
  return url;
}

function explainFailure(status, route) {
  if (status === 401) {
    return 'The preview server rejected the session token. Start a fresh session or rerun from the ' +
      'project directory so simulator:get returns the current preview URL.';
  }
  if (status === 404 && /^\/?(crashes|logs)/.test(route)) {
    return "This session's preview server has no such route. It may predate crash reports and the " +
      'device log (use `agent-device logs`), or a crash key or id aged out (list /crashes again).';
  }
  return 'Check the route and query, and that the session is still IN_PROGRESS.';
}

async function get(apiUrl, route, query) {
  if (!route) fail('Usage: node preview-api.js get <route> [query]');
  const url = routeUrl(apiUrl, route, query);
  let response;
  try {
    response = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch (error) {
    fail(`Could not reach ${redact(url)}: ${error.message}. Check that the session is still running.`);
  }
  const body = await response.text();
  if (!response.ok) {
    fail(`GET ${redact(url)} returned ${response.status}: ${body.slice(0, 300)}\n${explainFailure(response.status, route)}`);
  }
  process.stdout.write(body.endsWith('\n') ? body : `${body}\n`);
}

async function watch(apiUrl, seconds) {
  const url = routeUrl(apiUrl, '/crashes', 'tail=1');
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  if (seconds) setTimeout(stop, Number(seconds) * 1000).unref();

  let response;
  try {
    response = await fetch(url, { headers: { Accept: 'text/event-stream' }, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) return;
    fail(`Could not reach ${redact(url)}: ${error.message}. Check that the session is still running.`);
  }
  if (!response.ok) {
    fail(`GET ${redact(url)} returned ${response.status}.\n${explainFailure(response.status, '/crashes')}`);
  }
  const decoder = new TextDecoder();
  let buffered = '';
  try {
    for await (const chunk of response.body) {
      buffered += decoder.decode(chunk, { stream: true });
      let end;
      while ((end = buffered.indexOf('\n\n')) !== -1) {
        const frame = buffered.slice(0, end);
        buffered = buffered.slice(end + 2);
        const data = frame
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trimStart())
          .join('\n');
        if (data) process.stdout.write(`${data}\n`);
      }
    }
  } catch (error) {
    if (!controller.signal.aborted) throw error;
  }
}

async function main() {
  const { command, rest, flags } = parseArgs(process.argv.slice(2));
  if (command !== 'get' && command !== 'watch') {
    fail('Usage: node preview-api.js get <route> [query] | watch [--seconds <n>] [--id <session-id>]');
  }
  const apiUrl = resolveApiUrl(flags.id);
  if (command === 'get') await get(apiUrl, rest[0], rest[1]);
  else await watch(apiUrl, flags.seconds);
}

main().catch((error) => fail(error.message));
