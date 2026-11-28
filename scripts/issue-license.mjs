#!/usr/bin/env node
import { createPrivateKey, randomBytes, sign } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const options = {
    name: '',
    note: '',
    key: path.join(repoRoot, '.keys/ed25519-private.pem'),
    issuedAt: new Date().toISOString().slice(0, 10),
    id: '',
    raw: false
  };

  const tokens = argv.slice(2);
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === '--raw') {
      options.raw = true;
      continue;
    }
    const next = tokens[i + 1];
    if (token === '--name' && next !== undefined) {
      options.name = next;
      i += 1;
    } else if (token === '--note' && next !== undefined) {
      options.note = next;
      i += 1;
    } else if (token === '--key' && next !== undefined) {
      options.key = path.resolve(next);
      i += 1;
    } else if (token === '--issued-at' && next !== undefined) {
      options.issuedAt = next;
      i += 1;
    } else if (token === '--id' && next !== undefined) {
      options.id = next;
      i += 1;
    }
  }
  return options;
}

const opts = parseArgs(process.argv);
const holder = opts.name.trim();
if (!holder) {
  console.error('Usage: npm run license:issue -- --name "Holder Name" [--note "Optional note"]');
  process.exit(1);
}

if (!fs.existsSync(opts.key)) {
  console.error(
    `Private key file not found: ${opts.key}\nRun "npm run license:keygen -- --write-public-key" first.`
  );
  process.exit(1);
}

const dateStamp = opts.issuedAt.replace(/[^0-9]/g, '').slice(0, 8) || '20260101';
const licenseId = opts.id.trim() || `DTM-${dateStamp}-${randomBytes(3).toString('hex').toUpperCase()}`;

const payload = {
  v: 1,
  plan: 'pro',
  holder,
  issuedAt: opts.issuedAt,
  id: licenseId,
  ...(opts.note.trim() ? { note: opts.note.trim() } : {})
};

const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
const privatePem = fs.readFileSync(opts.key, 'utf8');
const privateKey = createPrivateKey(privatePem);
const sigB64 = sign(null, Buffer.from(payloadB64, 'utf8'), privateKey).toString('base64url');

const token = `DTM-PRO-1.${payloadB64}.${sigB64}`;

if (opts.raw) {
  process.stdout.write(`${token}\n`);
} else {
  console.log('');
  console.log('=== Domino Tournament Manager — Pro License ===');
  console.log(`Holder:    ${holder}`);
  console.log(`ID:        ${licenseId}`);
  console.log(`Issued at: ${opts.issuedAt}`);
  if (payload.note) {
    console.log(`Note:      ${payload.note}`);
  }
  console.log('');
  console.log(token);
  console.log('');
}
