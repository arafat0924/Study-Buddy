// Lazy pdf.js loader — the library (~1 MB) only downloads when a PDF is actually opened.
import type { PDFDocumentProxy } from 'pdfjs-dist';

type PdfJs = typeof import('pdfjs-dist');
let loader: Promise<PdfJs> | null = null;

export function getPdfjs(): Promise<PdfJs> {
  if (!loader) {
    loader = import('pdfjs-dist/legacy/build/pdf.mjs').then((m) => {
      const lib = m as unknown as PdfJs;
      lib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      return lib;
    });
  }
  return loader;
}

export class PasswordError extends Error {
  constructor() { super('password'); this.name = 'PasswordError'; }
}

export async function openPdf(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  const pdfjs = await getPdfjs();
  try {
    // pdf.js transfers the buffer to its worker, so hand it a copy.
    return await pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) }).promise;
  } catch (e) {
    if ((e as Error)?.name === 'PasswordException') throw new PasswordError();
    throw e;
  }
}

/** Frees the worker-side document. */
export async function closePdf(doc: PDFDocumentProxy) {
  try { await doc.loadingTask.destroy(); } catch {}
}

/** Page size in PDF points (1/72 inch), honouring the page's own rotation. */
export async function pageSizePt(doc: PDFDocumentProxy, n: number) {
  const page = await doc.getPage(n);
  const vp = page.getViewport({ scale: 1 });
  return { w: vp.width, h: vp.height };
}

/**
 * Renders page `n` (1-based) onto a white canvas whose longest side is at most `maxLong` px.
 * `extraRotation` is added on top of the page's own rotation.
 */
export async function renderPage(doc: PDFDocumentProxy, n: number, maxLong: number, extraRotation = 0) {
  const page = await doc.getPage(n);
  const base = page.getViewport({ scale: 1, rotation: (page.rotate + extraRotation) % 360 });
  const scale = Math.min(maxLong / Math.max(base.width, base.height), 4);
  const viewport = page.getViewport({ scale, rotation: (page.rotate + extraRotation) % 360 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  await page.render({ canvas, viewport, background: '#ffffff' }).promise;
  page.cleanup();
  return { canvas, widthPt: base.width, heightPt: base.height };
}
