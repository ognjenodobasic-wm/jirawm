import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = join(rootDir, 'manifest.json');
const packagePath = join(rootDir, 'package.json');

function bumpPatch(version) {
  const [major, minor, patch] = version.split('.').map((n) => parseInt(n, 10));
  return `${major}.${minor}.${patch + 1}`;
}

try {
  const manifestRaw = readFileSync(manifestPath, 'utf8');
  const packageRaw = readFileSync(packagePath, 'utf8');

  const manifest = JSON.parse(manifestRaw);
  const pkg = JSON.parse(packageRaw);

  const oldVersion = manifest.version;
  const newVersion = bumpPatch(oldVersion);

  manifest.version = newVersion;
  pkg.version = newVersion;

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');

  console.log(`Version bumped: ${oldVersion} -> ${newVersion}`);
} catch (err) {
  console.error('Failed to bump version:', err);
  process.exit(1);
}
