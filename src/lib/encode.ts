// Size-targeted image encoding. Everything here runs on <canvas> in the browser.

/** Keep a small margin under every limit so files pass portals that count 1 MB as 1,048,576 or 1,000,000 bytes. */
export const SAFETY = 0.97;
/** Largest canvas area we create — iOS Safari refuses canvases above ~16.7 MP. */
const MAX_AREA = 16_000_000;

export type Encoded = { blob: Blob; over: boolean; width: number; height: number };

export function canvasToBlob(c: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), type, quality),
  );
}

export function newCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Draws `src` scaled by `factor` onto a new canvas; `white` paints a white background first (for JPEG). */
export function scaleCanvas(src: CanvasImageSource & { width: number; height: number }, factor: number, white = false) {
  const c = newCanvas(src.width * factor, src.height * factor);
  const ctx = c.getContext('2d')!;
  if (white) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

/** Loads an image file onto a canvas, applying EXIF rotation and capping the pixel count. */
export async function fileToCanvas(file: Blob) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const w = img.naturalWidth, h = img.naturalHeight;
    const f = Math.min(1, Math.sqrt(MAX_AREA / (w * h)));
    const c = newCanvas(w * f, h * f);
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Encodes a JPEG as close to (but under) `maxBytes` as possible:
 * first the highest quality that fits (binary search), then smaller dimensions if even low quality is too big.
 */
export async function jpegToTarget(src: HTMLCanvasElement, maxBytes: number | null, maxQ = 0.92, minQ = 0.42): Promise<Encoded> {
  let canvas = scaleCanvas(src, 1, true);
  if (!maxBytes) {
    const blob = await canvasToBlob(canvas, 'image/jpeg', maxQ);
    return { blob, over: false, width: canvas.width, height: canvas.height };
  }
  let smallest: Encoded | null = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const hi = await canvasToBlob(canvas, 'image/jpeg', maxQ);
    if (hi.size <= maxBytes) return { blob: hi, over: false, width: canvas.width, height: canvas.height };
    const lo = await canvasToBlob(canvas, 'image/jpeg', minQ);
    if (!smallest || lo.size < smallest.blob.size) smallest = { blob: lo, over: true, width: canvas.width, height: canvas.height };
    if (lo.size <= maxBytes) {
      let best = lo, a = minQ, b = maxQ;
      for (let i = 0; i < 6; i++) {
        const q = (a + b) / 2;
        const blob = await canvasToBlob(canvas, 'image/jpeg', q);
        if (blob.size <= maxBytes) { best = blob; a = q; } else b = q;
      }
      return { blob: best, over: false, width: canvas.width, height: canvas.height };
    }
    if (Math.max(canvas.width, canvas.height) <= 240) break;
    // Too big even at low quality: shrink dimensions roughly in proportion to the overshoot.
    const factor = Math.min(0.9, Math.max(0.35, Math.sqrt(maxBytes / lo.size) * 0.95));
    canvas = scaleCanvas(canvas, factor, true);
  }
  return smallest!;
}

/** PNG stays lossless if it fits; otherwise colours are reduced (like TinyPNG), then dimensions. */
export async function pngToTarget(src: HTMLCanvasElement, maxBytes: number | null): Promise<Encoded> {
  let canvas = src;
  const full = await canvasToBlob(canvas, 'image/png');
  if (!maxBytes || full.size <= maxBytes) return { blob: full, over: false, width: canvas.width, height: canvas.height };
  const UPNG = (await import('upng-js')).default;
  let smallest: Encoded = { blob: full, over: true, width: canvas.width, height: canvas.height };
  for (let attempt = 0; attempt < 7; attempt++) {
    const { width: w, height: h } = canvas;
    const data = canvas.getContext('2d')!.getImageData(0, 0, w, h).data;
    let last = 0;
    for (const colors of [256, 128, 64]) {
      const buf: ArrayBuffer = UPNG.encode([data.buffer.slice(0)], w, h, colors);
      last = buf.byteLength;
      const blob = new Blob([buf], { type: 'image/png' });
      if (blob.size < smallest.blob.size) smallest = { blob, over: true, width: w, height: h };
      if (blob.size <= maxBytes) return { blob, over: false, width: w, height: h };
      if (blob.size > maxBytes * 2.2) break; // fewer colours will not close a gap this large
    }
    if (Math.max(w, h) <= 240) break;
    const factor = Math.min(0.88, Math.max(0.35, Math.sqrt(maxBytes / last) * 0.95));
    canvas = scaleCanvas(canvas, factor);
  }
  return smallest;
}

export type PdfImagePage = { bytes: Uint8Array; kind: 'jpg' | 'png'; wPt: number; hPt: number; rotate?: number };

/** A4 width for portrait images, A4 height (as width) for landscape — the page keeps the image's shape. */
export function pageForImage(wPx: number, hPx: number) {
  const wPt = wPx >= hPx ? 841.89 : 595.28;
  return { wPt, hPt: (wPt * hPx) / wPx };
}

const A4 = { w: 595.28, h: 841.89 };
const LETTER = { w: 612, h: 792 };
export type PaperSize = 'fit' | 'a4' | 'letter';

export async function buildImagePdf(pages: PdfImagePage[], paper: PaperSize = 'fit') {
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  doc.setProducer('Study Buddy');
  doc.setCreator('Study Buddy');
  for (const p of pages) {
    const img = p.kind === 'jpg' ? await doc.embedJpg(p.bytes) : await doc.embedPng(p.bytes);
    if (paper === 'fit') {
      const page = doc.addPage([p.wPt, p.hPt]);
      page.drawImage(img, { x: 0, y: 0, width: p.wPt, height: p.hPt });
    } else {
      const base = paper === 'a4' ? A4 : LETTER;
      const landscape = p.wPt > p.hPt;
      const pw = landscape ? base.h : base.w, ph = landscape ? base.w : base.h;
      const page = doc.addPage([pw, ph]);
      const f = Math.min(pw / p.wPt, ph / p.hPt);
      const w = p.wPt * f, h = p.hPt * f;
      page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
    }
  }
  return doc.save({ useObjectStreams: true });
}

/** Rough per-PDF overhead (header, xref, per-page objects) used when splitting a size budget across pages. */
export const pdfOverhead = (pages: number) => 2500 + pages * 700;

export const u8 = async (b: Blob) => new Uint8Array(await b.arrayBuffer());
