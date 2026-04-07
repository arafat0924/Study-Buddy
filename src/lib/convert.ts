// Admission Documents: one input file → any mix of JPG / PNG / PDF outputs under a size limit.
import { closePdf, openPdf, renderPage } from './pdfjs';
import {
  SAFETY, buildImagePdf, fileToCanvas, jpegToTarget, pageForImage, pdfOverhead, pngToTarget, u8, type PdfImagePage,
} from './encode';
import { nextFrame, type Kind } from './files';

export type Fmt = 'jpg' | 'png' | 'pdf';
export const FORMATS: Fmt[] = ['jpg', 'png', 'pdf'];

export type OutFile = {
  fmt: Fmt;
  name: string;
  blob: Blob;
  /** Could not get under the limit — this is the smallest version we could make. */
  over: boolean;
  /** The original file was already fine, so it was copied untouched. */
  kept: boolean;
};

export type ConvertOptions = { formats: Fmt[]; maxBytes: number | null; base: string };

/** Long side used when turning PDF pages into images (~170–240 dpi for A4). */
const PAGE_PX = 2000;

export async function convertFile(
  file: File,
  kind: Kind,
  { formats, maxBytes, base }: ConvertOptions,
  onStep?: (label: string) => void,
): Promise<OutFile[]> {
  const limit = maxBytes ? Math.floor(maxBytes * SAFETY) : null;
  const fits = (size: number) => limit === null || size <= limit;
  const want = new Set(formats);
  const out: OutFile[] = [];

  if (kind === 'pdf') {
    const data = await file.arrayBuffer();
    const doc = await openPdf(data);
    const n = doc.numPages;
    const pageName = (i: number, ext: string) => `${base}${n > 1 ? `_p${i}` : ''}.${ext}`;

    // PDF → PDF: keep the original if it fits; then try a lossless re-save (keeps text selectable);
    // only if that is still too big are pages turned into compressed images.
    let needRasterPdf = false;
    if (want.has('pdf')) {
      onStep?.('PDF');
      if (fits(file.size)) out.push({ fmt: 'pdf', name: `${base}.pdf`, blob: file, over: false, kept: true });
      else {
        let resaved: Uint8Array | null = null;
        try {
          const { PDFDocument } = await import('pdf-lib');
          const pl = await PDFDocument.load(data, { ignoreEncryption: true, updateMetadata: false });
          resaved = await pl.save({ useObjectStreams: true });
        } catch { /* fall through to raster */ }
        if (resaved && fits(resaved.byteLength)) {
          out.push({ fmt: 'pdf', name: `${base}.pdf`, blob: new Blob([resaved as BlobPart], { type: 'application/pdf' }), over: false, kept: false });
        } else needRasterPdf = true;
      }
    }

    const pdfPages: PdfImagePage[] = [];
    let rasterOver = false;
    const budget = limit ? Math.max(8000, Math.floor((limit - pdfOverhead(n)) / n)) : null;
    const px = n > 12 ? 1500 : PAGE_PX;

    if (want.has('jpg') || want.has('png') || needRasterPdf) {
      for (let i = 1; i <= n; i++) {
        onStep?.(`${i}/${n}`);
        await nextFrame();
        const { canvas, widthPt, heightPt } = await renderPage(doc, i, px);
        if (want.has('jpg')) {
          const r = await jpegToTarget(canvas, limit);
          out.push({ fmt: 'jpg', name: pageName(i, 'jpg'), blob: r.blob, over: r.over, kept: false });
        }
        if (want.has('png')) {
          const r = await pngToTarget(canvas, limit);
          out.push({ fmt: 'png', name: pageName(i, 'png'), blob: r.blob, over: r.over, kept: false });
        }
        if (needRasterPdf) {
          const r = await jpegToTarget(canvas, budget, 0.85);
          rasterOver ||= r.over;
          pdfPages.push({ bytes: await u8(r.blob), kind: 'jpg', wPt: widthPt, hPt: heightPt });
        }
        canvas.width = canvas.height = 0; // free memory early (matters on phones)
      }
    }
    if (needRasterPdf) {
      const bytes = await buildImagePdf(pdfPages);
      out.unshift({
        fmt: 'pdf', name: `${base}.pdf`, blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }),
        over: rasterOver || !fits(bytes.byteLength), kept: false,
      });
    }
    await closePdf(doc);
    return sortOut(out);
  }

  // ---- Image input (JPG / PNG) ----
  const canvas = await fileToCanvas(file);

  if (want.has('jpg')) {
    onStep?.('JPG');
    if (kind === 'jpg' && fits(file.size)) out.push({ fmt: 'jpg', name: `${base}.jpg`, blob: file, over: false, kept: true });
    else {
      const r = await jpegToTarget(canvas, limit);
      out.push({ fmt: 'jpg', name: `${base}.jpg`, blob: r.blob, over: r.over, kept: false });
    }
  }

  if (want.has('png')) {
    onStep?.('PNG');
    await nextFrame();
    if (kind === 'png' && fits(file.size)) out.push({ fmt: 'png', name: `${base}.png`, blob: file, over: false, kept: true });
    else {
      const r = await pngToTarget(canvas, limit);
      out.push({ fmt: 'png', name: `${base}.png`, blob: r.blob, over: r.over, kept: false });
    }
  }

  if (want.has('pdf')) {
    onStep?.('PDF');
    await nextFrame();
    const { wPt, hPt } = pageForImage(canvas.width, canvas.height);
    const room = limit === null ? null : limit - pdfOverhead(1);
    let page: PdfImagePage;
    let over = false;
    if (kind === 'jpg' && (room === null || file.size <= room) && canvas.width * canvas.height < 16_000_000) {
      // The original JPEG fits as-is: embed its exact bytes (no quality loss). pdf-lib reads EXIF-free pixel data,
      // so only do this when the photo is not rotated by EXIF (canvas matches the raw size).
      page = { bytes: await u8(file), kind: 'jpg', wPt, hPt };
      if (await hasExifRotation(file)) {
        const r = await jpegToTarget(canvas, room, 0.95);
        page = { bytes: await u8(r.blob), kind: 'jpg', wPt, hPt };
        over = r.over;
      }
    } else if (kind === 'png' && room === null) {
      page = { bytes: await u8(file), kind: 'png', wPt, hPt };
    } else {
      const r = await jpegToTarget(canvas, room);
      page = { bytes: await u8(r.blob), kind: 'jpg', wPt, hPt };
      over = r.over;
    }
    const bytes = await buildImagePdf([page]);
    out.push({
      fmt: 'pdf', name: `${base}.pdf`, blob: new Blob([bytes as BlobPart], { type: 'application/pdf' }),
      over: over || !fits(bytes.byteLength), kept: false,
    });
  }

  canvas.width = canvas.height = 0;
  return sortOut(out);
}

const ORDER: Record<Fmt, number> = { jpg: 0, png: 1, pdf: 2 };
const sortOut = (o: OutFile[]) => o.sort((a, b) => ORDER[a.fmt] - ORDER[b.fmt]);

/** True if the JPEG carries an EXIF orientation other than "normal" (phone photos often do). */
async function hasExifRotation(file: Blob): Promise<boolean> {
  const v = new DataView(await file.slice(0, 128 * 1024).arrayBuffer());
  if (v.getUint16(0) !== 0xffd8) return false;
  let off = 2;
  while (off + 4 < v.byteLength) {
    const marker = v.getUint16(off);
    const len = v.getUint16(off + 2);
    if (marker === 0xffe1 && v.getUint32(off + 4) === 0x45786966) {
      const tiff = off + 10;
      const le = v.getUint16(tiff) === 0x4949;
      const ifd = tiff + v.getUint32(tiff + 4, le);
      const count = v.getUint16(ifd, le);
      for (let i = 0; i < count; i++) {
        const e = ifd + 2 + i * 12;
        if (e + 10 > v.byteLength) return false;
        if (v.getUint16(e, le) === 0x0112) return v.getUint16(e + 8, le) > 1;
      }
      return false;
    }
    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) return false;
    off += 2 + len;
  }
  return false;
}
