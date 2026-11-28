import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { detectInitialLocale, saveLocale, type Locale } from './locale.js';
import { en, type Translations } from './en.js';
import { es } from './es.js';

interface I18nContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: Translations;
}

const DICTIONARIES: Record<Locale, Translations> = { en, es };

const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  setLocale: () => {},
  t: en
});

interface I18nProviderProps {
  initialLocale?: Locale;
  children: ReactNode;
}

export function I18nProvider({ initialLocale, children }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(() => initialLocale ?? detectInitialLocale());

  const setLocale = (next: Locale) => {
    saveLocale(next);
    setLocaleState(next);
  };

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t: DICTIONARIES[locale] }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
