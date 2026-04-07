import type { SVGProps } from 'react';

// Minimal 1.6px line icons (24×24), drawn to match the site's quiet style.
const P: Record<string, string> = {
  logo: 'M5 4.5h9.5L19 9v10.5H5zM14.5 4.5V9H19M8.5 13h7M8.5 16h4.5',
  upload: 'M12 15V4M7.5 8.5 12 4l4.5 4.5M4.5 15v3.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V15',
  download: 'M12 4v11M7.5 10.5 12 15l4.5-4.5M4.5 15v3.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V15',
  trash: 'M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10.5 11v5M13.5 11v5',
  x: 'M6 6l12 12M18 6 6 18',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12.5 10 17.5 19 7',
  shield: 'M12 3.5 19 6v5.5c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6z M9 12l2 2 4-4',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4',
  moon: 'M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z',
  globe: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM3.5 12h17M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5s-1.1 6.1-3.4 8.5c-2.3-2.4-3.4-5.2-3.4-8.5s1.1-6.1 3.4-8.5z',
  menu: 'M4.5 8h15M4.5 16h15',
  arrowR: 'M5 12h14M13 6l6 6-6 6',
  arrowL: 'M19 12H5M11 6l-6 6 6 6',
  chevL: 'M14.5 6 8.5 12l6 6',
  chevR: 'M9.5 6l6 6-6 6',
  chevU: 'M6 14.5 12 8.5l6 6',
  chevD: 'M6 9.5l6 6 6-6',
  rotL: 'M4.5 9.5A8 8 0 1 1 6 16M4.5 4.5v5h5',
  rotR: 'M19.5 9.5A8 8 0 1 0 18 16M19.5 4.5v5h-5',
  shuffle: 'M4 7h3.5c4.5 0 4.5 10 9 10H20M4 17h3.5c1.6 0 2.6-1.3 3.4-3M13.1 10c.8-1.7 1.8-3 3.4-3H20M17.5 4.5 20 7l-2.5 2.5M17.5 14.5 20 17l-2.5 2.5',
  camera: 'M4 8.5A1.5 1.5 0 0 1 5.5 7h2.3L9.5 4.5h5L16.2 7h2.3A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5zM12 9.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
  image: 'M4.5 5.5h15v13h-15zM4.5 15.5l4-4 3.5 3.5 2.5-2.5 5 5M15.5 9.5a1 1 0 1 0 0-.01',
  file: 'M6 3.5h8l4 4v13H6zM14 3.5v4h4',
  files: 'M8 6.5V3.5h7.5l4 4V17H16M4.5 7h8l3.5 3.5v10h-11.5z',
  pdf: 'M6 3.5h8l4 4v13H6zM14 3.5v4h4M9 12.5h6M9 15.5h6M9 9.5h2',
  scan: 'M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M4 12h16',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.3a3.5 3.5 0 0 1 0 6.4M17.5 14.3c2 .8 3.5 3 3.5 5.7',
  crown: 'M4 17.5h16M5 15 3.8 7l4.7 3.5L12 5l3.5 5.5L20.2 7 19 15z',
  sheet: 'M5 4.5h14v15H5zM5 9.5h14M5 14.5h14M10 4.5v15',
  grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
  alert: 'M12 4 21 19.5H3zM12 10v4M12 17h.01',
  info: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 11v5M12 8h.01',
  pause: 'M9 6v12M15 6v12',
  play: 'M8 5.5v13l10-6.5z',
  zip: 'M6 3.5h8l4 4v13H6zM14 3.5v4h4M11 6h1.5M11 8.5h1.5M11 11h1.5M10.5 13.5h2.5v3h-2.5z',
  edit: 'M4.5 19.5l1-4.5L15 5.5l3.5 3.5L9 18.5zM13 7.5l3.5 3.5',
  scissors: 'M7 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM7 19.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM9 8.5 19.5 18M9 15.5 19.5 6',
};

export type IconName = keyof typeof P;

export default function Icon({ name, ...rest }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d={P[name]} />
    </svg>
  );
}
