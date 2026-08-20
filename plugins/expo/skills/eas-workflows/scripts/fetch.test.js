import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const scriptUrl = new URL('./fetch.js', import.meta.url);
const scriptPath = fileURLToPath(scriptUrl);

test('runs the command-line interface directly with Node', () => {
  const result = spawnSync(process.execPath, [scriptPath, '--help'], { encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Usage: fetch <url>/);
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
