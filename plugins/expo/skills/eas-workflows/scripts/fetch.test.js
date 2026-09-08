import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const scriptUrl = new URL('./fetch.js', import.meta.url);
const scriptPath = fileURLToPath(scriptUrl);

test('runs the command-line interface directly with Node', () => {
  const result = spawnSync(process.execPath, [scriptPath, '--help'], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Usage: fetch <url>/);
});

test('fetches content through a symlinked skill directory', async (t) => {
  const fixtureDirectory = await mkdtemp(join(tmpdir(), 'eas-workflows-fetch-'));
  t.after(() => rm(fixtureDirectory, { recursive: true, force: true }));

  const skillDirectory = join(fixtureDirectory, 'original skill');
  await mkdir(skillDirectory);
  await copyFile(scriptPath, join(skillDirectory, 'fetch.js'));
  await copyFile(new URL('./package.json', import.meta.url), join(skillDirectory, 'package.json'));

  const installedDirectory = join(fixtureDirectory, 'installed skill');
  await symlink(skillDirectory, installedDirectory, process.platform === 'win32' ? 'junction' : 'dir');

  const result = spawnSync(
    process.execPath,
    [join(installedDirectory, 'fetch.js'), 'data:text/plain,workflow-schema'],
    { encoding: 'utf8' }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'workflow-schema\n');
});

test('does not execute the command-line interface when imported', () => {
  const result = spawnSync(
    process.execPath,
    ['--input-type=module', '--eval', `await import(${JSON.stringify(scriptUrl.href)})`],
    { encoding: 'utf8' }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
});

test('can be imported when an eval argument is not a file', () => {
  const result = spawnSync(
    process.execPath,
    ['--input-type=module', '--eval', `await import(${JSON.stringify(scriptUrl.href)})`, 'not-an-entrypoint'],
    { encoding: 'utf8' }
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
});
