import type { CoreLocale } from '../core/index.js';

export type Locale = CoreLocale;

export const LOCALE_STORAGE_KEY = 'domino_tm_locale_v1';

interface MinimalStorage {
  getItem: (key: string) => string | null;
}

interface DetectLocaleInput {
  storage?: MinimalStorage | null;
  languages?: readonly string[];
  language?: string;
}

export function detectInitialLocale(input?: DetectLocaleInput): Locale {
  const storage =
    input?.storage !== undefined
      ? input.storage
      : typeof window !== 'undefined' && window.localStorage
        ? window.localStorage
        : null;

  try {
    const saved = storage?.getItem(LOCALE_STORAGE_KEY);
    if (saved === 'en' || saved === 'es') {
      return saved;
    }
  } catch {
    // Ignore storage read failures in restricted environments
  }

  const browserLanguages: readonly string[] =
    input?.languages ??
    (input?.language ? [input.language] : undefined) ??
    (typeof navigator !== 'undefined'
      ? navigator.languages && navigator.languages.length > 0
        ? navigator.languages
        : navigator.language
          ? [navigator.language]
          : []
      : []);

  for (const lang of browserLanguages) {
    const normalized = lang.trim().toLowerCase();
    if (normalized === 'es' || normalized.startsWith('es-')) {
      return 'es';
    }
    if (normalized === 'en' || normalized.startsWith('en-')) {
      return 'en';
    }
  }

  // English is the canonical fallback for unsupported or unspecified browser locales
  return 'en';
}

export function saveLocale(locale: Locale): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Ignore storage write failures
  }
}
