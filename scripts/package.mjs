#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { ZipArchive } from 'archiver';

const DIST_PATH = 'dist';
const MANIFEST_PATH = 'dist/manifest.json';
const PACKAGE_JSON_PATH = 'package.json';
const RELEASE_DIR = 'release';
const INSTALL_SOURCE = 'docs/RELEASE-INSTALL.md';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

if (!existsSync(DIST_PATH)) {
  console.error(`Error: ${DIST_PATH}/ directory not found. Run "npm run build" first.`);
  process.exit(1);
}

if (!existsSync(MANIFEST_PATH)) {
  console.error(`Error: ${MANIFEST_PATH} not found. Run "npm run build" first.`);
  process.exit(1);
}

const manifest = readJson(MANIFEST_PATH);
const pkg = readJson(PACKAGE_JSON_PATH);
const version = manifest.version;

if (version !== pkg.version) {
  console.warn(`WARNING: dist/manifest.json version (${version}) does not match package.json version (${pkg.version}).`);
  console.warn('Continuing anyway, but you should keep these in sync.');
}

if (!existsSync(INSTALL_SOURCE)) {
  console.error(`Error: ${INSTALL_SOURCE} not found. Create the tester install guide first.`);
  process.exit(1);
}

if (!existsSync(RELEASE_DIR)) {
  mkdirSync(RELEASE_DIR, { recursive: true });
}

const folderName = `jirawm-v${version}`;
const zipName = `${folderName}.zip`;
const zipPath = resolve(RELEASE_DIR, zipName);
const output = process.stdout;

const archive = new ZipArchive({ zlib: { level: 9 } });

// We cannot pipe directly to a file handle without creating it, so use a write stream.
import { createWriteStream } from 'node:fs';
const zipStream = createWriteStream(zipPath);

archive.on('warning', (err) => {
  if (err.code === 'ENOENT') {
    console.warn(`Warning: ${err.message}`);
  } else {
    throw err;
  }
});

archive.on('error', (err) => {
  console.error(`Error creating archive: ${err.message}`);
  process.exit(1);
});

archive.pipe(zipStream);

archive.directory(DIST_PATH, folderName);
archive.file(INSTALL_SOURCE, { name: `${folderName}/INSTALL.md` });

zipStream.on('close', () => {
  const bytes = statSync(zipPath).size;
  const kb = (bytes / 1024).toFixed(1);
  console.log(`Created ${zipPath} (${kb} KB)`);
});

archive.finalize();
