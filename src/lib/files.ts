// Small file helpers shared by every tool.
import { zipSync } from 'fflate';

export type Kind = 'jpg' | 'png' | 'pdf';

/** Identifies JPG / PNG / PDF from the file's first bytes (falls back to the extension). */
export async function detectKind(file: File): Promise<Kind | null> {
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpg';
  if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) return 'png';
  if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) return 'pdf';
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') return 'jpg';
  if (ext === 'png') return 'png';
  if (ext === 'pdf') return 'pdf';
  return null;
}

/** Decimal units, like upload portals: 1 MB = 1,000,000 bytes. */
export function formatBytes(n: number) {
  if (n < 1000) return `${n} B`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)} KB`;
  return `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')} MB`;
}

export function baseName(name: string) {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(0, i) : name;
}

/** Makes a string safe to use as a file name on Windows, macOS, Android and iOS. */
export function safeName(name: string, fallback = 'file') {
  const s = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/\s+/g, ' ').trim().replace(/^\.+/, '').slice(0, 120);
  return s || fallback;
}

/** Appends " (2)", " (3)" … so no two names in a set collide (case-insensitive). */
export function uniqueNamer() {
  const used = new Set<string>();
  return (name: string) => {
    const dot = name.lastIndexOf('.');
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    let out = name;
    for (let i = 2; used.has(out.toLowerCase()); i++) out = `${stem} (${i})${ext}`;
    used.add(out.toLowerCase());
    return out;
  };
}

export async function makeZip(files: { name: string; blob: Blob }[]) {
  const unique = uniqueNamer();
  const entries: Record<string, [Uint8Array, { level: 0 }]> = {};
  for (const f of files) entries[unique(f.name)] = [new Uint8Array(await f.blob.arrayBuffer()), { level: 0 }];
  // Images and PDFs are already compressed, so store them without deflating (fast, same size).
  const zipped = zipSync(entries);
  return new Blob([zipped as BlobPart], { type: 'application/zip' });
}

export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/** Lets the browser paint between heavy steps so the UI stays responsive. */
export const nextFrame = () => new Promise<void>((r) => setTimeout(r, 0));
