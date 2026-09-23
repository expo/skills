import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = join(import.meta.dir, '../plugins/expo/skills/eas-simulator/scripts/preview-api.js');
const TOKEN = 'secret-session-token';
const NODE = Bun.spawnSync(['node', '-p', 'process.execPath']).stdout.toString().trim();
const tempDirs: string[] = [];

let server: ReturnType<typeof Bun.serve>;

function eventStream(frames: string[], keepOpen: boolean): Response {
  const body = new ReadableStream({
    start(controller) {
      for (const frame of frames) controller.enqueue(frame);
      if (!keepOpen) controller.close();
    },
  });
  return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });
}

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch(request) {
      const url = new URL(request.url);
      if (url.searchParams.get('token') !== TOKEN) return new Response('Unauthorized', { status: 401 });
      if (url.pathname.endsWith('/crashes/missing')) return new Response('not found', { status: 404 });
      if (request.headers.get('accept') === 'text/event-stream') {
        if (url.searchParams.get('tail') !== '1') return new Response('tail not held', { status: 400 });
        const frames = ['data: {"type":"meta"}\r\r', 'data: {"type":"list"}\n\n', 'data: {"type":"crash"}\n\n'];
        return eventStream(frames, url.pathname.startsWith('/open/'));
      }
      if (url.pathname.endsWith('/echo-token')) return Response.json({ execToken: TOKEN });
      return Response.json({ path: url.pathname, query: Object.fromEntries(url.searchParams) });
    },
  });
});

afterAll(() => {
  server.stop(true);
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

async function run(args: string[], env: Record<string, string> = {}) {
  const child = Bun.spawn([NODE, SCRIPT, ...args], {
    env: { ...process.env, EAS_SIMULATOR_PREVIEW_API_URL: '', ...env },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { stdout, stderr, code };
}

const apiUrl = (path = '/') => `http://127.0.0.1:${server.port}${path}?token=${TOKEN}`;
const stub = () => ({ EAS_SIMULATOR_PREVIEW_API_URL: apiUrl() });

describe('preview-api get', () => {
  test('calls the route with the session token and the extra query', async () => {
    const { stdout, code } = await run(['get', '/logs', 'snapshot=1&limit=5'], stub());

    expect(code).toBe(0);
    expect(JSON.parse(stdout)).toEqual({
      path: '/logs',
      query: { token: 'REDACTED', snapshot: '1', limit: '5' },
    });
  });

  test('merges a query written into the route', async () => {
    const { stdout } = await run(['get', '/logs?snapshot=1', 'limit=5'], stub());

    expect(JSON.parse(stdout).query).toEqual({ token: 'REDACTED', snapshot: '1', limit: '5' });
  });

  test('keeps a base path on the preview URL', async () => {
    const { stdout } = await run(['get', 'crashes/INC-1', 'key=2'], {
      EAS_SIMULATOR_PREVIEW_API_URL: apiUrl('/base/'),
    });

    expect(JSON.parse(stdout).path).toBe('/base/crashes/INC-1');
  });

  test('refuses routes other than crashes and logs', async () => {
    const { stdout, stderr, code } = await run(['get', '/api'], stub());

    expect(code).toBe(1);
    expect(stdout).toBe('');
    expect(stderr).toContain('Unsupported route /api');
  });

  test('never prints the token, even when a body contains it', async () => {
    const { stdout } = await run(['get', '/crashes/echo-token'], stub());

    expect(stdout).not.toContain(TOKEN);
    expect(JSON.parse(stdout).execToken).toBe('REDACTED');
  });

  test('explains a rejected token without printing it', async () => {
    const { stderr, code } = await run(['get', '/crashes'], {
      EAS_SIMULATOR_PREVIEW_API_URL: `http://127.0.0.1:${server.port}/?token=wrong-token`,
    });

    expect(code).toBe(1);
    expect(stderr).toContain('401');
    expect(stderr).toContain('rejected the session token');
    expect(stderr).not.toContain('wrong-token');
  });

  test('explains a missing crash', async () => {
    const { stderr, code } = await run(['get', '/crashes/missing'], stub());

    expect(code).toBe(1);
    expect(stderr).toContain('aged out');
    expect(stderr).not.toContain(TOKEN);
  });

  test('says the session may be gone when the server is unreachable', async () => {
    const { stderr, code } = await run(['get', '/crashes'], {
      EAS_SIMULATOR_PREVIEW_API_URL: `http://127.0.0.1:1/?token=${TOKEN}`,
    });

    expect(code).toBe(1);
    expect(stderr).toContain('Could not reach');
    expect(stderr).not.toContain(TOKEN);
  });
});

describe('preview-api flags', () => {
  test.each([
    [['watch', '--seconds', 'abc'], '--seconds must be a positive number'],
    [['watch', '--seconds', '0'], '--seconds must be a positive number'],
    [['get', '/crashes', '--id'], '--id needs a value'],
    [['get', '/crashes', '--device', 'x'], 'Unknown flag --device'],
  ])('rejects %p', async (args, message) => {
    const { stderr, code } = await run(args, stub());

    expect(code).toBe(1);
    expect(stderr).toContain(message);
  });
});

describe('preview-api watch', () => {
  test('holds the tail and prints each frame as one JSON line', async () => {
    const { stdout, stderr, code } = await run(['watch', '--seconds=1'], {
      EAS_SIMULATOR_PREVIEW_API_URL: apiUrl('/open/'),
    });

    expect(code).toBe(0);
    expect(stderr).toContain('holding the device log');
    expect(stdout.trim().split('\n').map((line) => JSON.parse(line).type)).toEqual(['meta', 'list', 'crash']);
  });

  test('fails when the server closes the stream before the time is up', async () => {
    const { stderr, code } = await run(['watch', '--seconds', '30'], stub());

    expect(code).toBe(1);
    expect(stderr).toContain('closed the stream');
  });
});

describe('preview-api session lookup', () => {
  function fakeNpx(session: object): string {
    const dir = mkdtempSync(join(tmpdir(), 'fake-npx-'));
    tempDirs.push(dir);
    const npx = join(dir, 'npx');
    writeFileSync(npx, `#!/bin/sh\necho "$@" > "${dir}/args"\ncat <<'JSON'\n${JSON.stringify(session)}\nJSON\n`);
    chmodSync(npx, 0o755);
    return dir;
  }

  const live = { status: 'IN_PROGRESS', platform: 'IOS', remoteConfig: { previewApiUrl: '' } };

  test('reads previewApiUrl from simulator:get and passes --id through', async () => {
    const dir = fakeNpx({ ...live, remoteConfig: { previewApiUrl: apiUrl() } });
    const { stdout, code } = await run(['get', '/crashes', '--id', 'session-1'], {
      PATH: `${dir}:${process.env.PATH}`,
    });

    expect(code).toBe(0);
    expect(JSON.parse(stdout).path).toBe('/crashes');
    expect(await Bun.file(join(dir, 'args')).text()).toBe('--yes eas-cli@latest simulator:get --json --id session-1\n');
  });

  test.each([
    [{ ...live, status: 'FINISHED' }, 'not IN_PROGRESS'],
    [{ ...live, platform: 'ANDROID' }, 'iOS-only'],
    [{ ...live, remoteConfig: {} }, 'no preview API'],
  ])('stops early for %p', async (session, message) => {
    const dir = fakeNpx(session);
    const { stderr, code } = await run(['get', '/crashes'], { PATH: `${dir}:${process.env.PATH}` });

    expect(code).toBe(1);
    expect(stderr).toContain(message);
  });

  test('rejects an --id that is not a session id', async () => {
    const { stderr, code } = await run(['get', '/crashes', '--id', 'a;rm -rf /']);

    expect(code).toBe(1);
    expect(stderr).toContain('is not a session id');
  });

  test('says when npx cannot be started', async () => {
    const { stderr, code } = await run(['get', '/crashes'], { PATH: '/nonexistent' });

    expect(code).toBe(1);
    expect(stderr).toContain('Could not start npx');
  });
});
