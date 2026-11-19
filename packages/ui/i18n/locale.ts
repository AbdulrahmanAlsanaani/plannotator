/**
 * UI language (English / Arabic).
 *
 * The chosen locale is kept in Plannotator's settings storage (cookies by
 * default, so it survives the random port each session uses) and every
 * surface — plan review, code review, annotate — opens in the same language.
 * Arabic switches the whole document to right-to-left; code, diffs and
 * terminals are pinned back to left-to-right in theme.css.
 */
import { useSyncExternalStore } from 'react';
import { storage } from '../utils/storage';

export type Locale = 'en' | 'ar';

export const LOCALE_STORAGE_KEY = 'plannotator-locale';

const listeners = new Set<() => void>();

function readStored(): Locale {
  try {
    const v = storage.getItem(LOCALE_STORAGE_KEY);
    if (v === 'ar' || v === 'en') return v;
  } catch {
    /* storage unavailable */
  }
  return 'en';
}

let current: Locale = readStored();

export function getLocale(): Locale {
  return current;
}

export function isRtl(locale: Locale = current): boolean {
  return locale === 'ar';
}

/** Put `lang` and `dir` on <html> for the given locale. */
export function applyDocumentLocale(locale: Locale = current): void {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;
  el.setAttribute('lang', locale);
  el.setAttribute('dir', isRtl(locale) ? 'rtl' : 'ltr');
}

export function setLocale(next: Locale): void {
  if (next === current) return;
  current = next;
  try {
    storage.setItem(LOCALE_STORAGE_KEY, next);
  } catch {
    /* storage unavailable */
  }
  applyDocumentLocale(next);
  listeners.forEach((l) => l());
}

/** Re-read the stored locale (a host may swap the storage backend at startup). */
export function refreshLocaleFromStorage(): void {
  const v = readStored();
  if (v !== current) {
    current = v;
    listeners.forEach((l) => l());
  }
}

export function toggleLocale(): void {
  setLocale(current === 'ar' ? 'en' : 'ar');
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** React hook: the current locale, re-rendering on change. */
export function useLocale(): Locale {
  return useSyncExternalStore(subscribeLocale, getLocale, () => 'en' as Locale);
}
