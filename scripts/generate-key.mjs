#!/usr/bin/env node
import { generateKeyPairSync } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';

const PRIVATE_KEY_PATH = 'key.pem';
const PUBLIC_KEY_PATH = 'key.pub.txt';

if (existsSync(PRIVATE_KEY_PATH)) {
  console.error(`Aborting: ${PRIVATE_KEY_PATH} already exists.`);
  console.error('The private key must never be overwritten. If you need a new key, delete it manually first.');
  process.exit(1);
}

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

writeFileSync(PRIVATE_KEY_PATH, privateKey);
console.error(`Private key written to ${PRIVATE_KEY_PATH} — add it to .gitignore and never commit it.`);

// Convert PEM public key to DER/spki and base64-encode it.
const publicKeyDer = publicKey
  .replace('-----BEGIN PUBLIC KEY-----', '')
  .replace('-----END PUBLIC KEY-----', '')
  .replace(/\s/g, '');

writeFileSync(PUBLIC_KEY_PATH, publicKeyDer);

console.log(publicKeyDer);
console.error('');
console.error('Add the line above as the "key" field in manifest.json.');
console.error(`It has also been saved to ${PUBLIC_KEY_PATH}.`);