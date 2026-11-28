import { execFileSync } from 'node:child_process';
import { generateKeyPairSync, sign } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PRO_LICENSE_STORAGE_KEY,
  createLicenseStore,
  verifyLicenseKey
} from '../../src/infrastructure/license-store.js';

function createTestKeypair() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const rawPub = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
  return {
    publicKeyB64Url: rawPub.toString('base64url'),
    privatePem: privateKey.export({ format: 'pem', type: 'pkcs8' }).toString(),
    signPayload(payload: Record<string, unknown>): string {
      const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
      const sigB64 = sign(null, Buffer.from(payloadB64, 'utf8'), privateKey).toString('base64url');
      return `DTM-PRO-1.${payloadB64}.${sigB64}`;
    }
  };
}

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

describe('Offline Ed25519 Pro License Verification (TDD)', () => {
  it('verifies a valid Ed25519 Pro license key even with surrounding whitespace', async () => {
    const kp = createTestKeypair();
    const token = kp.signPayload({
      v: 1,
      plan: 'pro',
      holder: 'Club Los Cortijos',
      issuedAt: '2026-11-27',
      id: 'DTM-20261127-AAA111'
    });

    const result = await verifyLicenseKey(`  ${token.slice(0, 12)}\n${token.slice(12)}  `, kp.publicKeyB64Url);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.license.holder).toBe('Club Los Cortijos');
      expect(result.license.id).toBe('DTM-20261127-AAA111');
      expect(result.license.issuedAt).toBe('2026-11-27');
      expect(result.license.plan).toBe('pro');
    }
  });

  it('rejects empty, malformed, tampered payload, tampered signature, and wrong-key tokens', async () => {
    const kp = createTestKeypair();
    const otherKp = createTestKeypair();
    const valid = kp.signPayload({
      v: 1,
      plan: 'pro',
      holder: 'Enrique',
      issuedAt: '2026-11-27',
      id: 'DTM-TEST-001'
    });

    expect(await verifyLicenseKey('', kp.publicKeyB64Url)).toEqual({
      valid: false,
      reason: 'empty'
    });
    expect(await verifyLicenseKey('NOT-A-KEY', kp.publicKeyB64Url)).toEqual({
      valid: false,
      reason: 'malformed'
    });

    const parts = valid.split('.');
    const tamperedPayload = Buffer.from(
      JSON.stringify({
        v: 1,
        plan: 'pro',
        holder: 'Hacker',
        issuedAt: '2026-11-27',
        id: 'DTM-TEST-001'
      }),
      'utf8'
    ).toString('base64url');

    expect(
      await verifyLicenseKey(`DTM-PRO-1.${tamperedPayload}.${parts[2]}`, kp.publicKeyB64Url)
    ).toEqual({
      valid: false,
      reason: 'invalid_signature'
    });

    const tamperedSig = `${parts[2]!.slice(0, -4)}AAAA`;
    expect(
      await verifyLicenseKey(`DTM-PRO-1.${parts[1]}.${tamperedSig}`, kp.publicKeyB64Url)
    ).toEqual({
      valid: false,
      reason: 'invalid_signature'
    });

    expect(await verifyLicenseKey(valid, otherKp.publicKeyB64Url)).toEqual({
      valid: false,
      reason: 'invalid_signature'
    });
  });

  it('persists verified Pro state in storage and rejects tampered stored keys on reload', async () => {
    const kp = createTestKeypair();
    const storage = new MemoryStorage();
    const store = createLicenseStore(storage, kp.publicKeyB64Url);

    expect(await store.loadVerifiedLicense()).toEqual({ tier: 'free', license: null });

    const token = kp.signPayload({
      v: 1,
      plan: 'pro',
      holder: 'Vecinos El Cafetal',
      issuedAt: '2026-11-27',
      id: 'DTM-CAF-01'
    });

    const activation = await store.activateLicense(token);
    expect(activation.valid).toBe(true);
    expect(storage.getItem(PRO_LICENSE_STORAGE_KEY)).toBe(token);

    const reloaded = await store.loadVerifiedLicense();
    expect(reloaded.tier).toBe('pro');
    expect(reloaded.license?.holder).toBe('Vecinos El Cafetal');

    // Tamper stored key -> must downgrade cleanly back to Free
    storage.setItem(PRO_LICENSE_STORAGE_KEY, `${token.slice(0, -2)}XX`);
    expect(await store.loadVerifiedLicense()).toEqual({ tier: 'free', license: null });

    await store.activateLicense(token);
    store.clearLicense();
    expect(storage.getItem(PRO_LICENSE_STORAGE_KEY)).toBeNull();
    expect(await store.loadVerifiedLicense()).toEqual({ tier: 'free', license: null });
  });

  it('verifies license tokens issued by scripts/issue-license.mjs CLI', async () => {
    const kp = createTestKeypair();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dtm-lic-'));
    const pemPath = path.join(tmpDir, 'test-private.pem');
    fs.writeFileSync(pemPath, kp.privatePem, 'utf8');

    try {
      const issued = execFileSync(
        process.execPath,
        [
          path.resolve('scripts/issue-license.mjs'),
          '--name',
          'Enrique Villasana',
          '--note',
          'Vecinos',
          '--key',
          pemPath,
          '--raw'
        ],
        { encoding: 'utf8' }
      ).trim();

      const res = await verifyLicenseKey(issued, kp.publicKeyB64Url);
      expect(res.valid).toBe(true);
      if (res.valid) {
        expect(res.license.holder).toBe('Enrique Villasana');
        expect(res.license.note).toBe('Vecinos');
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
