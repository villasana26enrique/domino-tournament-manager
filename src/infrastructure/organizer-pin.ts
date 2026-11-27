export const ORGANIZER_PIN_STORAGE_KEY = 'domino_tm_organizer_pin_v1';

export interface PinStorageAdapter {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export interface OrganizerPinStore {
  hasPin: () => boolean;
  setPin: (pin: string) => void;
  verifyPin: (pin: string) => boolean;
  clearPin: (currentPin: string) => boolean;
}

interface StoredPinRecord {
  version: 1;
  salt: string;
  hash: string;
}

let saltSequence = 0;

/** Validates that the PIN is 4 to 6 numeric digits. Returns null if valid, otherwise an error message. */
export function validatePinFormat(pin: string): string | null {
  const trimmed = pin.trim();
  if (!/^\d{4,6}$/.test(trimmed)) {
    return 'El PIN debe tener entre 4 y 6 dígitos numéricos (sin espacios ni letras).';
  }
  return null;
}

function generateSaltHex(): string {
  saltSequence += 1;
  const bytes = new Uint8Array(12);
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    let seed = (Date.now() ^ (saltSequence * 0x9e3779b9)) >>> 0;
    for (let i = 0; i < bytes.length; i++) {
      seed = Math.imul(seed ^ (seed >>> 13), 0x85ebca6b) >>> 0;
      bytes[i] = seed & 0xff;
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function hashPinWithSalt(salt: string, pin: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  const input = `${salt}::domino-pin::${pin}`;

  for (let round = 0; round < 512; round++) {
    const roundTag = `${round}:${input}`;
    for (let i = 0; i < roundTag.length; i++) {
      const c = roundTag.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
      h2 = Math.imul(h2 ^ ((c + round) & 0xff), 0x85ebca6b) >>> 0;
    }
    h1 ^= (h2 >>> 16) | (h2 << 16);
    h2 = Math.imul(h2 ^ (h1 >>> 13), 0xc2b2ae35) >>> 0;
  }

  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

function resolveDefaultStorage(): PinStorageAdapter {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  const memory = new Map<string, string>();
  return {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => {
      memory.set(key, value);
    },
    removeItem: (key) => {
      memory.delete(key);
    }
  };
}

function readStoredRecord(storage: PinStorageAdapter): StoredPinRecord | null {
  try {
    const raw = storage.getItem(ORGANIZER_PIN_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredPinRecord>;
    if (
      parsed.version !== 1 ||
      typeof parsed.salt !== 'string' ||
      parsed.salt.length === 0 ||
      typeof parsed.hash !== 'string' ||
      parsed.hash.length === 0
    ) {
      return null;
    }
    return {
      version: 1,
      salt: parsed.salt,
      hash: parsed.hash
    };
  } catch {
    return null;
  }
}

export function createOrganizerPinStore(
  storage: PinStorageAdapter = resolveDefaultStorage()
): OrganizerPinStore {
  return {
    hasPin(): boolean {
      return readStoredRecord(storage) !== null;
    },
    setPin(pin: string): void {
      const normalized = pin.trim();
      const validationError = validatePinFormat(normalized);
      if (validationError) {
        throw new Error(validationError);
      }
      const salt = generateSaltHex();
      const hash = hashPinWithSalt(salt, normalized);
      const record: StoredPinRecord = {
        version: 1,
        salt,
        hash
      };
      storage.setItem(ORGANIZER_PIN_STORAGE_KEY, JSON.stringify(record));
    },
    verifyPin(pin: string): boolean {
      const record = readStoredRecord(storage);
      if (!record) return false;
      const candidateHash = hashPinWithSalt(record.salt, pin.trim());
      return candidateHash === record.hash;
    },
    clearPin(currentPin: string): boolean {
      if (!this.verifyPin(currentPin)) {
        return false;
      }
      storage.removeItem(ORGANIZER_PIN_STORAGE_KEY);
      return true;
    }
  };
}
