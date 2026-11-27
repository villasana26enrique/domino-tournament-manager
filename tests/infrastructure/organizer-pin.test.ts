import { describe, expect, it } from 'vitest';
import {
  ORGANIZER_PIN_STORAGE_KEY,
  createOrganizerPinStore,
  validatePinFormat
} from '../../src/infrastructure/organizer-pin.js';

function createMemoryStorage(): {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  dump: () => Record<string, string>;
} {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
    dump: () => Object.fromEntries(data.entries())
  };
}

describe('Organizer PIN Store (TDD — Phase 5)', () => {
  it('validates 4 to 6 numeric digit PINs and rejects invalid formats', () => {
    expect(validatePinFormat('1234')).toBeNull();
    expect(validatePinFormat('001234')).toBeNull();
    expect(validatePinFormat('123')).not.toBeNull();
    expect(validatePinFormat('1234567')).not.toBeNull();
    expect(validatePinFormat('12ab')).not.toBeNull();
    expect(validatePinFormat('12 34')).not.toBeNull();
    expect(validatePinFormat('')).not.toBeNull();
  });

  it('stores salted hash (never plain-text), verifies PIN, and requires correct PIN to clear', () => {
    const storage = createMemoryStorage();
    const store = createOrganizerPinStore(storage);

    expect(store.hasPin()).toBe(false);
    expect(store.verifyPin('2468')).toBe(false);

    store.setPin('2468');
    expect(store.hasPin()).toBe(true);

    const rawStored = storage.dump()[ORGANIZER_PIN_STORAGE_KEY];
    expect(rawStored).toBeDefined();
    expect(rawStored).not.toContain('2468');

    expect(store.verifyPin('2468')).toBe(true);
    expect(store.verifyPin('0000')).toBe(false);

    expect(store.clearPin('0000')).toBe(false);
    expect(store.hasPin()).toBe(true);

    expect(store.clearPin('2468')).toBe(true);
    expect(store.hasPin()).toBe(false);
  });

  it('handles corrupted storage JSON gracefully without crashing', () => {
    const storage = createMemoryStorage();
    storage.setItem(ORGANIZER_PIN_STORAGE_KEY, '{corrupted-json');
    const store = createOrganizerPinStore(storage);

    expect(store.hasPin()).toBe(false);
    expect(store.verifyPin('1234')).toBe(false);
  });
});
