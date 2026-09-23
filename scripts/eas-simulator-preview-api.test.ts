import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = join(import.meta.dir, '../plugins/expo/skills/eas-simulator/scripts/preview-api.js');
const TOKEN = 'secret-session-token';

let server: ReturnType<typeof Bun.serve>;
let seen: URL[] = [];

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    fetch(request) {
      const url = new URL(request.url);
      seen.push(url);
      if (url.searchParams.get('token') !== TOKEN) return new Response('Unauthorized', { status: 401 });
      if (url.pathname.endsWith('/missing')) return new Response('not found', { status: 404 });
      if (url.pathname.endsWith('/crashes') && request.headers.get('accept') === 'text/event-stream') {
        const frames = [
          { type: 'meta', meta: { status: 'watching' } },
          { type: 'list', crashes: [] },
          { type: 'crash', record: { id: 'INC-1' } },
        ];
        const body = new ReadableStream({
          start(controller) {
            for (const frame of frames) controller.enqueue(`data: ${JSON.stringify(frame)}\n\n`);
          },
        });
        return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });
      }
      return Response.json({ path: url.pathname, query: Object.fromEntries(url.searchParams) });
    },
  });
});

afterAll(() => server.stop(true));

async function run(args: string[], env: Record<string, string> = {}) {
  seen = [];
  const child = Bun.spawn(['node', SCRIPT, ...args], {
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

describe('preview-api get', () => {
  test('calls the route with the session token and the extra query', async () => {
    const { stdout, code } = await run(['get', '/logs', 'snapshot=1&limit=5'], {
      EAS_SIMULATOR_PREVIEW_API_URL: apiUrl(),
    });

    expect(code).toBe(0);
    expect(JSON.parse(stdout)).toEqual({
      path: '/logs',
      query: { token: TOKEN, snapshot: '1', limit: '5' },
    });
  });

  test('keeps a base path on the preview URL', async () => {
    const { stdout } = await run(['get', 'crashes/INC-1', 'key=2'], {
      EAS_SIMULATOR_PREVIEW_API_URL: apiUrl('/base/'),
    });

    expect(JSON.parse(stdout).path).toBe('/base/crashes/INC-1');
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

  test('points to agent-device logs when a crash route is missing', async () => {
    const { stderr, code } = await run(['get', '/crashes/missing'], {
      EAS_SIMULATOR_PREVIEW_API_URL: apiUrl(),
    });

    expect(code).toBe(1);
    expect(stderr).toContain('agent-device logs');
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

describe('preview-api watch', () => {
  test('holds the tail and prints each frame as one JSON line', async () => {
    const { stdout, code } = await run(['watch', '--seconds', '1'], {
      EAS_SIMULATOR_PREVIEW_API_URL: apiUrl(),
    });

    expect(code).toBe(0);
    expect(stdout.trim().split('\n').map((line) => JSON.parse(line).type)).toEqual([
      'meta',
      'list',
      'crash',
    ]);
    expect(seen[0]?.searchParams.get('tail')).toBe('1');
  });
});

describe('preview-api session lookup', () => {
  function fakeNpx(printed: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'fake-npx-'));
    const npx = join(dir, 'npx');
    writeFileSync(npx, `#!/bin/sh\necho "$@" > "${dir}/args"\ncat <<'JSON'\n${printed}\nJSON\n`);
    chmodSync(npx, 0o755);
    return dir;
  }

  test('reads previewApiUrl from simulator:get and passes --id through', async () => {
    const dir = fakeNpx(JSON.stringify({ remoteConfig: { previewApiUrl: apiUrl() } }));
    const { stdout, code } = await run(['get', '/crashes', '--id', 'session-1'], {
      PATH: `${dir}:${process.env.PATH}`,
    });

    expect(code).toBe(0);
    expect(JSON.parse(stdout).path).toBe('/crashes');
    expect(await Bun.file(join(dir, 'args')).text()).toBe(
      '--yes eas-cli@latest simulator:get --json --id session-1\n'
    );
  });

  test('explains a session without a preview API', async () => {
    const dir = fakeNpx(JSON.stringify({ remoteConfig: { __typename: 'AgentDeviceRunSessionRemoteConfig' } }));
    const { stderr, code } = await run(['get', '/crashes'], { PATH: `${dir}:${process.env.PATH}` });

    expect(code).toBe(1);
    expect(stderr).toContain('no preview API');
  });
});
