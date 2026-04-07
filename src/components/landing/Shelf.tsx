'use client';

import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useI18n } from '@/i18n';
import Icon from '../Icon';

const TYPES = ['pdf', 'jpg', 'png', 'jpeg', 'ppt', 'scan', 'zip'] as const;
type FileType = (typeof TYPES)[number];

const COLOR: Record<FileType, string> = {
  pdf: '#c8524d',
  jpg: '#d9a23d',
  png: '#4f86c6',
  jpeg: '#5f9479',
  ppt: '#d47236',
  scan: '#2a2c33',
  zip: '#8a78c8',
};

const LINKS: Record<FileType, { href: string; key: 'admission' | 'pdf' | 'scan' | 'shuffle' }[]> = {
  pdf: [{ href: '/admission-documents/', key: 'admission' }, { href: '/pdf-tools/', key: 'pdf' }],
  jpg: [{ href: '/admission-documents/', key: 'admission' }, { href: '/scan-to-pdf/', key: 'scan' }],
  jpeg: [{ href: '/admission-documents/', key: 'admission' }],
  png: [{ href: '/admission-documents/', key: 'admission' }],
  ppt: [{ href: '/presentation-shuffle/', key: 'shuffle' }],
  scan: [{ href: '/scan-to-pdf/', key: 'scan' }],
  zip: [{ href: '/admission-documents/', key: 'admission' }],
};

const HEIGHTS = [1, 0.9, 1.06, 0.94, 1, 0.86, 1.03, 0.92, 1.05, 0.9, 0.97, 1.02, 0.88, 0.95];
const ITEMS = HEIGHTS.map((h, i) => ({ id: i, type: TYPES[i % TYPES.length], h, solid: i < TYPES.length }));
const N = ITEMS.length;

const OPEN_MS = 5200;
type Phase = 'idle' | 'opening' | 'open' | 'closing';

export default function Shelf() {
  const { d } = useI18n();
  const stageRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(1100);
  const [active, setActive] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [auto, setAuto] = useState(true);
  const [pinnedPause, setPinnedPause] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [touch, setTouch] = useState(0); // bumps on every user interaction
  const first = useRef(true);

  // Measure the stage so the 3D geometry scales with the viewport.
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  // Respect reduced motion; pause when the tab or the shelf is not visible.
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setAuto(false); setPinnedPause(true); }
    const vis = () => setHidden(document.visibilityState !== 'visible');
    document.addEventListener('visibilitychange', vis);
    const io = new IntersectionObserver(([e]) => setHidden(!e.isIntersecting || document.visibilityState !== 'visible'), { threshold: 0.2 });
    if (sectionRef.current) io.observe(sectionRef.current);
    return () => { document.removeEventListener('visibilitychange', vis); io.disconnect(); };
  }, []);

  // Autoplay timeline: slide → open → read → close → next.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    if (phase === 'opening') t = setTimeout(() => setPhase('open'), 750);
    else if (auto && !hidden) {
      if (phase === 'idle') t = setTimeout(() => { first.current = false; setPhase('open'); }, first.current ? 1800 : 1100);
      else if (phase === 'open') t = setTimeout(() => setPhase('closing'), OPEN_MS);
      else if (phase === 'closing') t = setTimeout(() => { setPhase('idle'); setActive((a) => (a + 1) % N); }, 850);
    }
    return () => clearTimeout(t);
  }, [phase, auto, hidden, active]);

  // Resume autoplay a while after the last interaction (unless the user pressed pause).
  useEffect(() => {
    if (auto || pinnedPause || touch === 0) return;
    const t = setTimeout(() => setAuto(true), 15000);
    return () => clearTimeout(t);
  }, [auto, pinnedPause, touch]);

  const interact = useCallback(() => { setAuto(false); setTouch((n) => n + 1); }, []);
  const go = useCallback((delta: number) => {
    interact();
    setPhase('idle');
    setActive((a) => (a + delta + N) % N);
  }, [interact]);
  const pick = (i: number) => {
    interact();
    if (i === active) setPhase((p) => (p === 'open' ? 'idle' : 'opening'));
    else { setActive(i); setPhase('opening'); }
  };
  const close = useCallback(() => { interact(); setPhase('idle'); }, [interact]);
  const togglePlay = () => {
    if (auto) { setAuto(false); setPinnedPause(true); }
    else { setPinnedPause(false); setAuto(true); if (phase === 'opening') setPhase('idle'); }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, select')) return;
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, close]);

  // ---- Geometry -------------------------------------------------------------
  const mobile = width < 760;
  const s = Math.max(0.62, Math.min(1.05, width / 1100));
  const W = 200 * s, D = 46 * s, H = 275 * s, gap = 36 * s, sp = 5 * s;
  const fit = Math.floor((width / 2 - W / 2 - gap) / (D + sp));
  const visible = Math.max(2, Math.min(6, fit));
  const isOpen = phase === 'open';

  const openX = W * 0.45;

  const cur = ITEMS[active];
  const info = d.landing.files[cur.type];

  return (
    <section className={`shelf${isOpen ? ' is-open' : ''}`} ref={sectionRef} aria-roledescription="carousel">
      <div className="shelf-hero rise">
        <h1 className="display shelf-title">
          {d.landing.titleA} {d.landing.titleB}
        </h1>
        <p className="shelf-sub">{d.landing.subtitle}</p>
        <p className="shelf-caption" aria-live="polite">
          <span>{info.name}</span>
          <span className="dot" />
          <span>{info.full}</span>
        </p>
      </div>

      <div className="stage" ref={stageRef} style={{ '--s': s, height: H * 1.12 + 40 * s } as CSSProperties}>
        {ITEMS.map((it, i) => {
          let o = (((i - active) % N) + N) % N;
          if (o > N / 2) o -= N;
          const abs = Math.abs(o);
          const h = H * it.h;
          let transform: string;
          if (o === 0) {
            transform = isOpen
              ? `translate3d(${openX}px, ${-6 * s}px, ${100 * s}px) rotateY(0deg)`
              : `translate3d(0px, 0px, ${40 * s}px) rotateY(0deg)`;
          } else {
            const x = Math.sign(o) * (W / 2 + gap + (abs - 1) * (D + sp) + D / 2);
            transform = `translate3d(${x}px, 0px, ${-W / 2}px) rotateY(90deg)`;
          }
          const show = abs <= visible && !(isOpen && o !== 0);
          const style = {
            '--w': `${W}px`, '--h': `${h}px`, '--d': `${D}px`, '--c': COLOR[it.type],
            transform,
            '--o': show ? 1 : 0,
            '--od': isOpen && o !== 0 ? `${abs * 25}ms` : '0ms',
            zIndex: 20 - abs,
            pointerEvents: show ? 'auto' : 'none',
          } as CSSProperties;
          const f = d.landing.files[it.type];
          return (
            <div
              key={it.id}
              role="button"
              onKeyDown={(e) => { if (e.key === 'Enter') pick(i); }}
              className={`book${o === 0 ? ' is-active' : ''}${o === 0 && isOpen ? ' is-open' : ''}${it.solid ? ' solid' : ' paper'}`}
              style={style}
              onClick={() => pick(i)}
              aria-label={`${f.name} — ${f.full}`}
              tabIndex={abs <= visible ? 0 : -1}
            >
              <span className="lift" style={{ animationDelay: `${120 + abs * 70}ms` }}>
                <span className="cover">
                  <span className="cover-front">
                    <span className="cv-kicker">study buddy · file</span>
                    <span className="cv-type display">{f.name}</span>
                    <span className="cv-full">{f.full}</span>
                    <span className="cv-lines"><i /><i /><i /></span>
                    <span className="cv-ext mono">.{it.type}</span>
                  </span>
                  <span className="cover-back">
                    <span className="cv-kicker">from your device</span>
                    <span className="cb-name display">{f.name}</span>
                    <span className="cb-rule" />
                  </span>
                </span>
                <span className="inner-page">
                  <span className="cv-kicker">{f.name} · {f.full}</span>
                  <span className="ip-title display">{f.title}</span>
                  <span className="ip-body">{f.body}</span>
                  <span className="ip-links">
                    {LINKS[it.type].map((l) => (
                      <Link key={l.href} href={l.href} className="ip-link" onClick={(e) => e.stopPropagation()} tabIndex={o === 0 && isOpen ? 0 : -1}>
                        {d.landing.open[l.key]} <Icon name="arrowR" />
                      </Link>
                    ))}
                  </span>
                </span>
                <span className="f-spine">
                  <span className="sp-band" />
                  <span className="sp-text">{f.name}</span>
                  <span className="sp-sub">{f.full}</span>
                  <span className="sp-band" />
                </span>
                <span className="f-edge" />
                <span className="f-back" />
                <span className="f-top" />
              </span>
            </div>
          );
        })}

        <div className="plank" />
      </div>


      <div className="shelf-controls">
        <button className="btn btn-icon btn-sm" onClick={() => go(-1)} aria-label={d.landing.prev}><Icon name="chevL" /></button>
        <button className="btn btn-icon btn-sm" onClick={togglePlay} aria-label={auto ? d.landing.pause : d.landing.play}>
          <Icon name={auto ? 'pause' : 'play'} />
        </button>
        <button className="btn btn-icon btn-sm" onClick={() => go(1)} aria-label={d.landing.next}><Icon name="chevR" /></button>
      </div>
    </section>
  );
}
