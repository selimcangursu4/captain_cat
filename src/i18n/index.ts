import { en } from './en';
import { tr, type I18nKey } from './tr';

export type Language = 'tr' | 'en';
export type { I18nKey };

const DICTIONARIES: Record<Language, Record<I18nKey, string>> = { tr, en };

let current: Language = 'tr';

export function setLanguage(language: Language): void {
  current = language;
}

export function getLanguage(): Language {
  return current;
}

/** Metni getirir; {ad} yer tutucularını params ile doldurur. */
export function t(key: I18nKey, params: Record<string, string | number> = {}): string {
  const template = DICTIONARIES[current][key] ?? tr[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
