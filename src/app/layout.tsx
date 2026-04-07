import type { Metadata, Viewport } from 'next';
import { Hanken_Grotesk, League_Spartan, JetBrains_Mono, Ma_Shan_Zheng } from 'next/font/google';
import { I18nProvider } from '@/i18n';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { themeScript } from '@/components/Theme';
import en from '@/i18n/en';
import '@/styles/globals.css';
import '@/styles/landing.css';
import '@/styles/tools.css';

const body = Hanken_Grotesk({ subsets: ['latin'], variable: '--f-body', display: 'swap' });
const display = League_Spartan({ subsets: ['latin'], variable: '--f-display', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--f-mono', display: 'swap' });
const zh = Ma_Shan_Zheng({ weight: '400', subsets: ['latin'], variable: '--f-zh', display: 'swap', preload: false });

export const metadata: Metadata = {
  metadataBase: new URL('https://studybuddy.arafatcodes.dev'),
  title: { default: en.meta.title, template: '%s · Study Buddy' },
  description: en.meta.description,
  icons: { icon: '/icon.svg' },
  openGraph: { title: en.meta.title, description: en.meta.description, type: 'website' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#e8e9ee' },
    { media: '(prefers-color-scheme: dark)', color: '#1d1f25' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${body.variable} ${display.variable} ${mono.variable} ${zh.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <I18nProvider>
          <Navbar />
          <main className="main">{children}</main>
          <Footer />
        </I18nProvider>
      </body>
    </html>
  );
}
