// Copies the pdf.js worker into /public so it is served as a static file.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';

const candidates = [
  'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  'node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
];
const src = candidates.find((p) => existsSync(p));
if (src) {
  mkdirSync('public', { recursive: true });
  copyFileSync(src, 'public/pdf.worker.min.mjs');
  console.log(`pdf.js worker copied from ${src}`);
}
