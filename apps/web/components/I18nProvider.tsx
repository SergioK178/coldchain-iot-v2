'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Locale } from '@/lib/i18n';
import { getStoredLocale, setStoredLocale } from '@/lib/i18n';
import { t as tFn } from '@/lib/translations';

type I18nContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Record<string, string>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('ru');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLocaleState(getStoredLocale());
    setMounted(true);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setStoredLocale(l);
    setLocaleState(l);
    if (typeof document !== 'undefined') document.documentElement.lang = l;
  }, []);

  useEffect(() => {
    if (mounted && typeof document !== 'undefined') document.documentElement.lang = locale;
  }, [mounted, locale]);

  const t = useCallback(
    (key: string, params?: Record<string, string>) => tFn(locale, key, params),
    [locale]
  );

  if (!mounted) {
    return (
      <I18nContext.Provider value={{ locale: 'ru', setLocale, t }}>
        {children}
      </I18nContext.Provider>
    );
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}
