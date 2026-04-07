'use client';

import { useI18n } from '@/i18n';

export default function Footer() {
  const { d } = useI18n();
  return (
    <footer className="footer">
      <span>
        {d.footer.developedBy}{' '}
        <a href="https://arafatcodes.dev" target="_blank" rel="noopener">Arafat</a>
      </span>
      <span>{d.footer.private}</span>
    </footer>
  );
}
