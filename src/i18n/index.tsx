'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import en, { type Dict } from './en';
import bn from './bn';
import zh from './zh';

export type Lang = 'en' | 'bn' | 'zh';
export const LANGS: { code: Lang; label: string; short: string }[] = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'bn', label: 'বাংলা', short: 'বাং' },
  { code: 'zh', label: '中文', short: '中' },
];
const DICTS: Record<Lang, Dict> = { en, bn, zh };
const KEY = 'sb-lang';

type Vars = Record<string, string | number>;
type Ctx = { lang: Lang; setLang: (l: Lang) => void; d: Dict; t: (s: string, vars?: Vars) => string };

const I18nContext = createContext<Ctx | null>(null);

/** Replaces {name} placeholders in a translated string. */
export function fill(s: string, vars?: Vars) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY) as Lang | null;
      if (saved && saved in DICTS) setLangState(saved);
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    if (lang === 'bn' && !document.getElementById('f-bn')) {
      const l = document.createElement('link');
      l.id = 'f-bn'; l.rel = 'stylesheet'; l.href = 'https://fonts.maateen.me/solaiman-lipi/font.css';
      document.head.appendChild(l);
    }
    document.title = DICTS[lang].meta.title;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(KEY, l); } catch {}
  }, []);

  const value = useMemo<Ctx>(() => ({ lang, setLang, d: DICTS[lang], t: fill }), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
