import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { downloadRecording } from './download-recording.mjs';

async function fixture(t, handler) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'recording-recovery-test-'));
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  });
  return {
    dir,
    output: path.join(dir, 'capture.mp4'),
    env: {
      AGENT_DEVICE_DAEMON_BASE_URL: `http://127.0.0.1:${server.address().port}/agent-device`,
      AGENT_DEVICE_DAEMON_AUTH_TOKEN: 'test-token',
      AGENT_DEVICE_TENANT: 'test-tenant',
    },
  };
}

test('downloads through the authenticated base path, encoding the artifact id', async (t) => {
  const f = await fixture(t, (req, res) => {
    assert.equal(req.url, '/agent-device/artifacts/id%2Fwith%20spaces');
    assert.equal(req.headers.authorization, 'Bearer test-token');
    assert.equal(req.headers['x-agent-device-token'], 'test-token');
    assert.equal(req.headers['x-agent-device-tenant'], 'test-tenant');
    res.end('complete video bytes');
  });
  await downloadRecording({ ...f, artifactId: 'id/with spaces' });
  assert.equal(await readFile(f.output, 'utf8'), 'complete video bytes');
  assert.deepEqual(await readdir(f.dir), ['capture.mp4']);
});

test('a longer deadline allows a slow body; expiry removes partial output', async (t) => {
  const f = await fixture(t, (_req, res) => {
    res.write('first frames');
    setTimeout(() => res.end('last frames'), 200);
  });
  await assert.rejects(downloadRecording({ ...f, artifactId: 'slow', timeoutMs: 50 }), /timed out after 50 ms/);
  assert.deepEqual(await readdir(f.dir), []);
  await downloadRecording({ ...f, artifactId: 'slow', timeoutMs: 2000 });
  assert.equal(await readFile(f.output, 'utf8'), 'first frameslast frames');
});

test('keeps an existing output intact', async (t) => {
  const f = await fixture(t, (_req, res) => res.end('replacement'));
  await writeFile(f.output, 'original');
  await assert.rejects(downloadRecording({ ...f, artifactId: 'id' }), /Output already exists/);
  assert.equal(await readFile(f.output, 'utf8'), 'original');
  assert.deepEqual(await readdir(f.dir), ['capture.mp4']);
});

for (const status of [302, 401, 404]) {
  test(`HTTP ${status} fails without following redirects or publishing output`, async (t) => {
    let requests = 0;
    const f = await fixture(t, (_req, res) => {
      requests++;
      res.writeHead(status, { location: '/should-not-follow' });
      res.end('private diagnostic body');
    });
    await assert.rejects(downloadRecording({ ...f, artifactId: 'id' }), new RegExp(`HTTP ${status}`));
    assert.equal(requests, 1);
    assert.deepEqual(await readdir(f.dir), []);
  });
}

test('rejects missing remote config and invalid timeouts before downloading', async () => {
  await assert.rejects(downloadRecording({ artifactId: 'id', output: 'unused', env: {} }), /Missing remote daemon/);
  for (const timeoutMs of [0, -1, NaN, 1.5, 2147483648]) {
    await assert.rejects(downloadRecording({ artifactId: 'id', output: 'unused', timeoutMs }), /positive timeout/);
  }
});
