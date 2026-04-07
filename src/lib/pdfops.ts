// Page-level PDF assembly with pdf-lib: copies original pages (text stays selectable, nothing is re-rendered).
import type { PDFDocument as PDFDoc, PDFPage } from 'pdf-lib';
import { pageForImage } from './encode';

export type SourceKind = 'pdf' | 'jpg' | 'png';
export type Source = { id: string; name: string; kind: SourceKind; bytes: ArrayBuffer; color: string };
export type PageRef = { id: string; src: string; index: number; rot: number };

export async function assemblePdf(pages: PageRef[], sources: Map<string, Source>): Promise<Uint8Array> {
  const { PDFDocument, degrees } = await import('pdf-lib');
  const out = await PDFDocument.create();
  out.setProducer('Study Buddy');
  out.setCreator('Study Buddy');

  // Copy all pages needed from each source in one call, so shared fonts/images are not duplicated.
  const copied = new Map<string, PDFPage>(); // key: `${src}:${index}`
  const bySource = new Map<string, number[]>();
  for (const p of pages) bySource.set(p.src, [...(bySource.get(p.src) ?? []), p.index]);

  for (const [srcId, indices] of bySource) {
    const s = sources.get(srcId)!;
    if (s.kind === 'pdf') {
      const doc = await PDFDocument.load(s.bytes, { ignoreEncryption: true });
      const unique = [...new Set(indices)];
      const cps = await out.copyPages(doc, unique);
      unique.forEach((idx, i) => copied.set(`${srcId}:${idx}`, cps[i]));
    }
  }

  const images = new Map<string, Awaited<ReturnType<PDFDoc['embedJpg']>>>();
  for (const p of pages) {
    const s = sources.get(p.src)!;
    if (s.kind === 'pdf') {
      // copyPages returns one object per index, so a page used twice must be copied again.
      let page = copied.get(`${p.src}:${p.index}`);
      if (!page) {
        const doc = await PDFDocument.load(s.bytes, { ignoreEncryption: true });
        [page] = await out.copyPages(doc, [p.index]);
      } else copied.delete(`${p.src}:${p.index}`);
      page.setRotation(degrees((page.getRotation().angle + p.rot) % 360));
      out.addPage(page);
    } else {
      let img = images.get(s.id);
      if (!img) {
        img = s.kind === 'jpg' ? await out.embedJpg(s.bytes) : await out.embedPng(s.bytes);
        images.set(s.id, img);
      }
      const { wPt, hPt } = pageForImage(img.width, img.height);
      const page = out.addPage([wPt, hPt]);
      page.drawImage(img, { x: 0, y: 0, width: wPt, height: hPt });
      page.setRotation(degrees(p.rot % 360));
    }
  }
  return out.save({ useObjectStreams: true });
}

/** Parses "1-3, 5, 7-9" into page-number groups; returns null if anything is out of 1..max. */
export function parseRanges(input: string, max: number): number[][] | null {
  const parts = input.split(/[,;，、\s]+/).map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return null;
  const groups: number[][] = [];
  for (const part of parts) {
    const m = /^(\d+)(?:\s*[-–—~]\s*(\d+))?$/.exec(part);
    if (!m) return null;
    const a = +m[1], b = m[2] ? +m[2] : a;
    if (a < 1 || b < 1 || a > max || b > max) return null;
    const step = a <= b ? 1 : -1;
    const g: number[] = [];
    for (let i = a; i !== b + step; i += step) g.push(i);
    groups.push(g);
  }
  return groups;
}
