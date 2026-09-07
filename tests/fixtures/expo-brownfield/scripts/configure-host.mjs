import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [sdk, configuration] = process.argv.slice(2);
if (!['55', '57'].includes(sdk) || !['Debug', 'Release'].includes(configuration)) {
  console.error('Usage: node scripts/configure-host.mjs <55|57> <Debug|Release>');
  process.exit(1);
}
const playground = join(root, '.build', `sdk-${sdk}`, 'isolated');
const producer = join(playground, 'producer');
const artifacts = join(producer, `artifacts-${configuration.toLowerCase()}`);
const packages = readdirSync(artifacts, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && existsSync(join(artifacts, entry.name, 'Package.swift')));
if (packages.length !== 1) throw new Error(`Expected exactly one generated Swift Package in ${artifacts}.`);
const packagePath = join(artifacts, packages[0].name);
const result = spawnSync('swift', ['package', 'dump-package'], { cwd: packagePath, encoding: 'utf8' });
if (result.error) throw result.error;
if (result.status !== 0) throw new Error(result.stderr);
const manifest = JSON.parse(result.stdout);
const products = manifest.products.filter(product => product.type.library).map(product => product.name);
if (!products.length) throw new Error('Generated package has no library products.');
const app = JSON.parse(readFileSync(join(producer, 'app.json'), 'utf8')).expo;
const host = join(playground, 'host');
mkdirSync(host, { recursive: true });
// Preserve playground edits when switching Debug/Release packages.
if (!existsSync(join(host, 'Sources'))) cpSync(join(root, 'ios', 'isolated', 'Sources'), join(host, 'Sources'), { recursive: true });
const deploymentTarget = sdk === '57' ? '16.4' : '15.1';
const spec = {
  name: 'BrownfieldHost',
  options: { deploymentTarget: { iOS: deploymentTarget } },
  settings: { base: { SWIFT_VERSION: '5.0', CODE_SIGNING_ALLOWED: 'NO', TARGETED_DEVICE_FAMILY: '1,2' } },
  packages: { BrownfieldRuntime: { path: packagePath } },
  targets: {
    BrownfieldHost: {
      type: 'application', platform: 'iOS', sources: ['Sources'],
      dependencies: products.map(product => ({ package: 'BrownfieldRuntime', product })),
      info: {
        path: 'Info.plist',
        properties: {
          UILaunchScreen: {},
          UIApplicationSceneManifest: { UIApplicationSupportsMultipleScenes: false },
          UISupportedInterfaceOrientations: ['UIInterfaceOrientationPortrait'],
          NSAppTransportSecurity: { NSAllowsLocalNetworking: true },
          BrownfieldMetroPort: app.ios.infoPlist.BrownfieldMetroPort,
        },
      },
      settings: { base: { PRODUCT_BUNDLE_IDENTIFIER: `dev.expo.skills.brownfield.sdk${sdk}.host` } },
    },
  },
};
writeFileSync(join(host, 'project.json'), JSON.stringify(spec, null, 2) + '\n');
const generated = spawnSync('xcodegen', ['generate', '--spec', 'project.json'], { cwd: host, stdio: 'inherit' });
if (generated.error) throw generated.error;
if (generated.status !== 0) throw new Error(`XcodeGen failed (${generated.status}).`);
console.log(`${host}/BrownfieldHost.xcodeproj now selects ${configuration}: ${products.join(', ')}`);
