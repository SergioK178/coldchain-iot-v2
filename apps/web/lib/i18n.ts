'use client';

export type Locale = 'ru' | 'en';

const STORAGE_KEY = 'coldchain-locale';

export function getStoredLocale(): Locale {
  if (typeof window === 'undefined') return 'ru';
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'en' ? 'en' : 'ru';
}

export function setStoredLocale(locale: Locale): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, locale);
}
