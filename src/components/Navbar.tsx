'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { LANGS, useI18n } from '@/i18n';
import { useTheme } from './Theme';
import Icon from './Icon';

export const NAV = [
  { href: '/admission-documents/', key: 'admission' },
  { href: '/pdf-tools/', key: 'pdf' },
  { href: '/scan-to-pdf/', key: 'scan' },
  { href: '/presentation-shuffle/', key: 'shuffle' },
] as const;

const norm = (p: string) => (p.endsWith('/') ? p : p + '/');

export default function Navbar() {
  const { d, lang, setLang } = useI18n();
  const { theme, toggle } = useTheme();
  const path = norm(usePathname() || '/');
  const [menu, setMenu] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMenu(false); setLangOpen(false); }, [path]);

  useEffect(() => {
    if (!langOpen) return;
    const off = (e: PointerEvent) => { if (!langRef.current?.contains(e.target as Node)) setLangOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setLangOpen(false); };
    document.addEventListener('pointerdown', off);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', off); document.removeEventListener('keydown', esc); };
  }, [langOpen]);

  const current = LANGS.find((l) => l.code === lang)!;

  return (
    <>
      <header className="nav">
        <nav className="nav-pill" aria-label="Main">
          <Link href="/" className="brand" aria-label="Study Buddy — home">
            <span className="brand-mark"><Icon name="logo" /></span>
            Study Buddy
          </Link>
          <div className="nav-links">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={`nav-link${path === n.href ? ' is-active' : ''}`}>
                {d.nav[n.key]}
              </Link>
            ))}
          </div>
        </nav>

        <div className="nav-tools">
          <div className="lang-menu" ref={langRef}>
            <button
              className="nav-round"
              onClick={() => setLangOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={langOpen}
              aria-label={d.nav.language}
            >
              <Icon name="globe" />
              {current.short}
            </button>
            {langOpen && (
              <div className="lang-pop glass" role="menu">
                {LANGS.map((l) => (
                  <button
                    key={l.code}
                    role="menuitem"
                    aria-current={l.code === lang}
                    onClick={() => { setLang(l.code); setLangOpen(false); }}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="nav-round" onClick={toggle} aria-label={d.nav.theme} title={d.nav.theme}>
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
          <button
            className="nav-round nav-menu-btn"
            onClick={() => setMenu((m) => !m)}
            aria-expanded={menu}
            aria-label={d.nav.menu}
          >
            <Icon name={menu ? 'x' : 'menu'} />
          </button>
        </div>
      </header>

      {menu && (
        <div className="mobile-sheet glass">
          <Link href="/" className={path === '/' ? 'is-active' : ''}>{d.nav.home}</Link>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={path === n.href ? 'is-active' : ''}>
              {d.nav[n.key]}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
