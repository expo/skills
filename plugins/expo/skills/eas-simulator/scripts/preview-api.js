#!/usr/bin/env node
/**
 * Read an iOS EAS Simulator session's device log and crash reports from its preview server.
 *
 * Usage:
 *   node preview-api.js get <route> [query] [--id <session-id>]
 *   node preview-api.js watch [--seconds <n>] [--id <session-id>]
 *
 *   get    Print one route's JSON. Routes: /crashes, /crashes/<id>, /logs.
 *          e.g. `get /crashes`, `get /crashes/<id> key=2`, `get /logs "snapshot=1&follow=1&limit=500"`.
 *   watch  Hold the device log and print each crash event as one JSON line, for --seconds
 *          (default 300). Prints "holding the device log" on stderr once the hold is up.
 *
 * Run it from the Expo project directory. It reads the session's `previewApiUrl` from
 * `eas simulator:get --json` (the dotenv session unless --id is given). That URL carries the
 * session token; this script keeps it in the query and never prints it.
 * EAS_SIMULATOR_PREVIEW_API_URL overrides the lookup (for tests or a local serve-sim).
 */

'use strict';

const { spawnSync } = require('child_process');

const ROUTE = /^\/(crashes(\/[^/]+)?|logs)$/;
const DEFAULT_WATCH_SECONDS = 300;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const [name, inline] = arg.slice(2).split(/=(.*)/s);
    if (name !== 'id' && name !== 'seconds') fail(`Unknown flag --${name}.`);
    const value = inline ?? argv[(i += 1)];
    if (!value || value.startsWith('--')) fail(`--${name} needs a value.`);
    flags[name] = value;
  }
  return { command: positional[0], rest: positional.slice(1), flags };
}

function resolveApiUrl(sessionId) {
  if (process.env.EAS_SIMULATOR_PREVIEW_API_URL) return process.env.EAS_SIMULATOR_PREVIEW_API_URL;
  if (sessionId && !/^[\w-]+$/.test(sessionId)) fail(`--id ${sessionId} is not a session id.`);
  const args = ['--yes', 'eas-cli@latest', 'simulator:get', '--json'];
  if (sessionId) args.push('--id', sessionId);
  const result = spawnSync('npx', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    shell: process.platform === 'win32',
  });
  if (result.error) fail(`Could not start npx (${result.error.code ?? result.error.message}). Check that Node and npx are on PATH.`);
  if (result.status !== 0) {
    fail(
      'Could not read the session with `eas simulator:get --json`. Run this from the Expo project ' +
        'directory with a live session, or pass --id <session-id>.'
    );
  }
  let session;
  try {
    session = JSON.parse(result.stdout);
  } catch {
    fail('`eas simulator:get --json` did not print JSON. Upgrade eas-cli or run it by hand to see why.');
  }
  if (session.status !== 'IN_PROGRESS') fail(`The session is ${session.status}, not IN_PROGRESS. Start a new one.`);
  if (session.platform !== 'IOS') fail('Crash reports and the device log are iOS-only. Use `agent-device logs` on this session.');
  const url = session.remoteConfig?.previewApiUrl;
  if (!url) fail('This session has no preview API. Use `agent-device logs` for the device log.');
  return url;
}

function routeUrl(apiUrl, route, query) {
  const [path, inlineQuery] = route.split(/\?(.*)/s);
  const normalized = `/${path.replace(/^\/+|\/+$/g, '')}`;
  if (!ROUTE.test(normalized)) fail(`Unsupported route ${normalized}. Use /crashes, /crashes/<id>, or /logs.`);
  const url = new URL(apiUrl);
  url.pathname = `${url.pathname.replace(/\/+$/, '')}${normalized}`;
  for (const part of [inlineQuery, query]) {
    for (const [key, value] of new URLSearchParams(part ?? '')) url.searchParams.set(key, value);
  }
  return url;
}

function scrub(text, apiUrl) {
  const token = new URL(apiUrl).searchParams.get('token');
  return token ? text.split(token).join('REDACTED') : text;
}

function explainFailure(status) {
  if (status === 401) {
    return 'The preview server rejected the session token. Check that the session is still IN_PROGRESS and rerun.';
  }
  if (status === 404) {
    return 'A crash key or id may have aged out (list /crashes again), or the session predates these routes (use `agent-device logs`).';
  }
  return 'Check the route and query, and that the session is still IN_PROGRESS.';
}

async function get(apiUrl, route, query) {
  const url = routeUrl(apiUrl, route, query);
  let response;
  try {
    response = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch (error) {
    fail(`Could not reach the preview server for ${url.pathname}: ${error.message}. Check that the session is still running.`);
  }
  const body = scrub(await response.text(), apiUrl);
  if (!response.ok) fail(`GET ${url.pathname} returned ${response.status}: ${body.slice(0, 300)}\n${explainFailure(response.status)}`);
  console.log(body.trimEnd());
}

async function watch(apiUrl, seconds) {
  const limit = seconds === undefined ? DEFAULT_WATCH_SECONDS : Number(seconds);
  if (!Number.isFinite(limit) || limit <= 0) fail('--seconds must be a positive number.');
  const url = routeUrl(apiUrl, '/crashes', 'tail=1');
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  setTimeout(stop, limit * 1000).unref();

  let response;
  try {
    response = await fetch(url, { headers: { Accept: 'text/event-stream' }, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) return;
    fail(`Could not reach the preview server for /crashes: ${error.message}. Check that the session is still running.`);
  }
  if (!response.ok) fail(`GET /crashes returned ${response.status}.\n${explainFailure(response.status)}`);

  const decoder = new TextDecoder();
  let buffered = '';
  let holding = false;
  try {
    for await (const chunk of response.body) {
      buffered += decoder.decode(chunk, { stream: true }).replace(/\r\n?/g, '\n');
      const lines = buffered.split('\n');
      buffered = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        if (!holding) {
          holding = true;
          console.error('holding the device log');
        }
        console.log(scrub(line.slice(5).trim(), apiUrl));
      }
    }
  } catch (error) {
    if (!controller.signal.aborted) throw error;
  }
  if (!controller.signal.aborted) fail('The preview server closed the stream, so the device log is no longer held. Run watch again.');
}

async function main() {
  const { command, rest, flags } = parseArgs(process.argv.slice(2));
  if (command === 'get' && !rest[0]) fail('Usage: node preview-api.js get <route> [query]');
  if (command !== 'get' && command !== 'watch') {
    fail('Usage: node preview-api.js get <route> [query] | watch [--seconds <n>] [--id <session-id>]');
  }
  const apiUrl = resolveApiUrl(flags.id);
  if (command === 'get') await get(apiUrl, rest[0], rest[1]);
  else await watch(apiUrl, flags.seconds);
}

main().catch((error) => fail(error.message));
