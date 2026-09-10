import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [sdk, approach] = process.argv.slice(2);
if (!['55', '57'].includes(sdk) || !['integrated', 'isolated'].includes(approach)) {
  console.error('Usage: node scripts/prepare.mjs <55|57> <integrated|isolated>');
  process.exit(1);
}
const port = process.env.BROWNFIELD_METRO_PORT || '8097';
if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
  throw new Error('BROWNFIELD_METRO_PORT must be between 1 and 65535.');
}
const producer = join(root, '.build', `sdk-${sdk}`, approach, 'producer');
if (existsSync(producer)) {
  throw new Error(`Fixture already exists: ${producer}\nKeep working there, or move it aside before preparing again. Setup never overwrites a playground.`);
}

function run(command, args, cwd = producer) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', env: { ...process.env, CI: '1' } });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}). The partial fixture remains at ${producer}.`);
}

mkdirSync(producer, { recursive: true });
cpSync(join(root, 'app'), producer, { recursive: true });
cpSync(join(root, 'sdks', sdk), producer, { recursive: true });
const packagePath = join(producer, 'package.json');
const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'));
packageJson.scripts.start = `expo start --port ${port}`;
writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
writeFileSync(join(producer, 'app.json'), JSON.stringify({
  expo: {
    name: 'BrownfieldFixture',
    slug: 'brownfield-fixture',
    version: '1.0.0',
    ios: {
      bundleIdentifier: `dev.expo.skills.brownfield.sdk${sdk}.${approach}`,
      infoPlist: { BrownfieldMetroPort: port },
    },
    plugins: approach === 'isolated' ? [
      ['expo-brownfield', { ios: { targetName: 'MyBrownfield', bundleIdentifier: `dev.expo.skills.brownfield.sdk${sdk}.framework` } }],
    ] : [],
  },
}, null, 2) + '\n');

console.log(`Preparing SDK ${sdk} ${approach} fixture; Metro port ${port}.`);
console.log(`Native builds need an SDK-compatible Xcode (SDK 57: 26.4+). Output: ${producer}`);
run('npm', ['ci']);
run('npx', ['expo', 'prebuild', '--platform', 'ios', '--no-install']);
if (approach === 'integrated') {
  // Bootstrap a disposable native project, then install the handwritten SwiftUI host.
  // Real integrated hosts must merge native changes, never run prebuild over their source.
  cpSync(join(root, 'ios', 'integrated', 'HostApp.swift'), join(producer, 'ios', 'BrownfieldFixture', 'AppDelegate.swift'));
}
run('pod', ['install'], join(producer, 'ios'));
console.log(`Ready: ${producer}`);
if (approach === 'integrated') console.log('The generated native app now contains the handwritten host. Do not run prebuild over it.');
