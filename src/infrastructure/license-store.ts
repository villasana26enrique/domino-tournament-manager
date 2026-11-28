import { PRODUCTION_LICENSE_PUBLIC_KEY_B64URL } from './license-public-key.js';

export const PRO_LICENSE_STORAGE_KEY = 'dtm.pro_license.v1';

export interface VerifiedProLicense {
  v: 1;
  plan: 'pro';
  holder: string;
  issuedAt: string;
  id: string;
  note?: string;
}

export type LicenseFailureReason =
  | 'empty'
  | 'malformed'
  | 'unsupported_version'
  | 'invalid_signature'
  | 'crypto_unavailable';

export type LicenseVerificationResult =
  | { valid: true; normalizedKey: string; license: VerifiedProLicense }
  | { valid: false; reason: LicenseFailureReason };

export type LicenseState =
  | { tier: 'free'; license: null }
  | { tier: 'pro'; license: VerifiedProLicense };

function normalizeRawKey(rawKey: string): string {
  return rawKey.replace(/\s+/g, '').trim();
}

function decodeBase64UrlToBytes(b64Url: string): Uint8Array | null {
  if (!b64Url || !/^[A-Za-z0-9_-]+$/.test(b64Url)) {
    return null;
  }
  try {
    const padded = b64Url.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (b64Url.length % 4)) % 4);
    const binary = globalThis.atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

function parsePayload(payloadB64: string): VerifiedProLicense | null {
  const bytes = decodeBase64UrlToBytes(payloadB64);
  if (!bytes) return null;

  try {
    const jsonText = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const raw = JSON.parse(jsonText) as Record<string, unknown>;
    if (
      raw.v !== 1 ||
      raw.plan !== 'pro' ||
      typeof raw.holder !== 'string' ||
      raw.holder.trim().length === 0 ||
      typeof raw.issuedAt !== 'string' ||
      raw.issuedAt.trim().length === 0 ||
      typeof raw.id !== 'string' ||
      raw.id.trim().length === 0
    ) {
      return null;
    }

    const base: VerifiedProLicense = {
      v: 1,
      plan: 'pro',
      holder: raw.holder.trim(),
      issuedAt: raw.issuedAt.trim(),
      id: raw.id.trim()
    };
    if (typeof raw.note === 'string' && raw.note.trim().length > 0) {
      base.note = raw.note.trim();
    }
    return base;
  } catch {
    return null;
  }
}

function getSubtleCrypto(): SubtleCrypto | null {
  return globalThis.crypto?.subtle ?? null;
}

export async function verifyLicenseKey(
  rawKey: string,
  publicKeyB64Url: string = PRODUCTION_LICENSE_PUBLIC_KEY_B64URL
): Promise<LicenseVerificationResult> {
  const normalizedKey = normalizeRawKey(rawKey);
  if (!normalizedKey) {
    return { valid: false, reason: 'empty' };
  }

  const parts = normalizedKey.split('.');
  if (parts.length !== 3) {
    return { valid: false, reason: 'malformed' };
  }

  const [prefix, payloadB64, sigB64] = parts;
  if (!prefix || !payloadB64 || !sigB64 || !prefix.startsWith('DTM-PRO-')) {
    return { valid: false, reason: 'malformed' };
  }

  if (prefix !== 'DTM-PRO-1') {
    return { valid: false, reason: 'unsupported_version' };
  }

  const sigBytes = decodeBase64UrlToBytes(sigB64);
  const pubBytes = decodeBase64UrlToBytes(publicKeyB64Url);
  if (!sigBytes || sigBytes.length !== 64 || !pubBytes || pubBytes.length !== 32) {
    return { valid: false, reason: 'malformed' };
  }

  const subtle = getSubtleCrypto();
  if (!subtle) {
    return { valid: false, reason: 'crypto_unavailable' };
  }

  try {
    const publicKey = await subtle.importKey(
      'raw',
      new Uint8Array(pubBytes),
      'Ed25519',
      false,
      ['verify']
    );
    const messageBytes = new Uint8Array(new TextEncoder().encode(payloadB64));
    const isValid = await subtle.verify('Ed25519', publicKey, new Uint8Array(sigBytes), messageBytes);
    if (!isValid) {
      return { valid: false, reason: 'invalid_signature' };
    }
  } catch {
    return { valid: false, reason: 'invalid_signature' };
  }

  const license = parsePayload(payloadB64);
  if (!license) {
    return { valid: false, reason: 'malformed' };
  }

  return { valid: true, normalizedKey, license };
}

function resolveDefaultStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export interface LicenseStore {
  loadVerifiedLicense: () => Promise<LicenseState>;
  activateLicense: (rawKey: string) => Promise<LicenseVerificationResult>;
  clearLicense: () => void;
}

export function createLicenseStore(
  storage: Storage | null = resolveDefaultStorage(),
  publicKeyB64Url: string = PRODUCTION_LICENSE_PUBLIC_KEY_B64URL
): LicenseStore {
  return {
    async loadVerifiedLicense(): Promise<LicenseState> {
      if (!storage) return { tier: 'free', license: null };
      const raw = storage.getItem(PRO_LICENSE_STORAGE_KEY);
      if (!raw) return { tier: 'free', license: null };

      const verified = await verifyLicenseKey(raw, publicKeyB64Url);
      if (!verified.valid) {
        return { tier: 'free', license: null };
      }
      return { tier: 'pro', license: verified.license };
    },

    async activateLicense(rawKey: string): Promise<LicenseVerificationResult> {
      const result = await verifyLicenseKey(rawKey, publicKeyB64Url);
      if (result.valid && storage) {
        storage.setItem(PRO_LICENSE_STORAGE_KEY, result.normalizedKey);
      }
      return result;
    },

    clearLicense(): void {
      if (!storage) return;
      storage.removeItem(PRO_LICENSE_STORAGE_KEY);
    }
  };
}
