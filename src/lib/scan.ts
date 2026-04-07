// Scan to PDF image pipeline: perspective crop → scanner filter → rotation. Pure canvas, no libraries.
import { newCanvas } from './encode';

export type Pt = [number, number];
export type Filter = 'original' | 'enhance' | 'gray' | 'bw';
export const FULL: Pt[] = [[0, 0], [1, 0], [1, 1], [0, 1]];

const SRC_MAX = 3000; // long side of the working copy of the photo
const OUT_MAX = 2200; // long side of the finished page (~190 dpi on A4)

/** Loads a photo (EXIF-rotated by the browser) into a working canvas. */
export async function loadPhoto(file: Blob) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const f = Math.min(1, SRC_MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const c = newCanvas(img.naturalWidth * f, img.naturalHeight * f);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Projective map from the unit square onto quad p0..p3 (Heckbert's square-to-quad). */
function squareToQuad(q: Pt[]) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let g = 0, h = 0;
  const den = dx1 * dy2 - dx2 * dy1;
  if ((Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) && Math.abs(den) > 1e-12) {
    g = (dx3 * dy2 - dx2 * dy3) / den;
    h = (dx1 * dy3 - dx3 * dy1) / den;
  }
  const a = x1 - x0 + g * x1, b = x3 - x0 + h * x3, c = x0;
  const d = y1 - y0 + g * y1, e = y3 - y0 + h * y3, f = y0;
  return (u: number, v: number): Pt => {
    const w = g * u + h * v + 1;
    return [(a * u + b * v + c) / w, (d * u + e * v + f) / w];
  };
}

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Straightens the region inside `corners` (normalised 0..1, clockwise from top-left) into a rectangle. */
export function warp(src: HTMLCanvasElement, corners: Pt[]) {
  const W = src.width, H = src.height;
  const q = corners.map(([x, y]) => [x * W, y * H] as Pt);
  const isFull = corners.every((p, i) => Math.abs(p[0] - FULL[i][0]) < 1e-4 && Math.abs(p[1] - FULL[i][1]) < 1e-4);
  let ow = Math.max(dist(q[0], q[1]), dist(q[3], q[2]));
  let oh = Math.max(dist(q[0], q[3]), dist(q[1], q[2]));
  const f = Math.min(1, OUT_MAX / Math.max(ow, oh));
  ow = Math.max(1, Math.round(ow * f));
  oh = Math.max(1, Math.round(oh * f));

  if (isFull) {
    const c = newCanvas(ow, oh);
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, ow, oh);
    return c;
  }

  const sd = src.getContext('2d')!.getImageData(0, 0, W, H).data;
  const out = newCanvas(ow, oh);
  const octx = out.getContext('2d')!;
  const od = octx.createImageData(ow, oh);
  const o = od.data;
  const map = squareToQuad(q);
  for (let j = 0; j < oh; j++) {
    const v = (j + 0.5) / oh;
    for (let i = 0; i < ow; i++) {
      let [x, y] = map((i + 0.5) / ow, v);
      x = Math.min(W - 1.001, Math.max(0, x - 0.5));
      y = Math.min(H - 1.001, Math.max(0, y - 0.5));
      const xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi;
      const p00 = (yi * W + xi) * 4, p10 = p00 + 4, p01 = p00 + W * 4, p11 = p01 + 4;
      const k = (j * ow + i) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const top = sd[p00 + ch] + (sd[p10 + ch] - sd[p00 + ch]) * fx;
        const bot = sd[p01 + ch] + (sd[p11 + ch] - sd[p01 + ch]) * fx;
        o[k + ch] = top + (bot - top) * fy;
      }
      o[k + 3] = 255;
    }
  }
  octx.putImageData(od, 0, 0);
  return out;
}

/**
 * Estimates the paper's brightness everywhere (shadows, uneven light) from bright pixels in a coarse grid.
 * Dividing by it turns the paper white while keeping ink dark.
 */
function backgroundMap(lum: Float32Array, w: number, h: number) {
  const cell = Math.max(8, Math.ceil(Math.max(w, h) / 40));
  const gw = Math.ceil(w / cell), gh = Math.ceil(h / cell);
  const grid = new Float32Array(gw * gh);
  const hist = new Uint32Array(64);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      hist.fill(0);
      let n = 0;
      const x1 = Math.min(w, (gx + 1) * cell), y1 = Math.min(h, (gy + 1) * cell);
      for (let y = gy * cell; y < y1; y += 2) {
        for (let x = gx * cell; x < x1; x += 2) { hist[Math.min(63, lum[y * w + x] >> 2)]++; n++; }
      }
      // 90th percentile of the cell ≈ paper brightness (ignores the darker ink).
      let acc = 0, b = 63;
      const target = n * 0.1;
      for (; b > 0; b--) { acc += hist[b]; if (acc >= target) break; }
      grid[gy * gw + gx] = b * 4 + 2;
    }
  }
  // Smooth the grid so the correction has no visible blocks.
  const sm = new Float32Array(grid.length);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      let s = 0, c = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = gx + dx, y = gy + dy;
        if (x >= 0 && y >= 0 && x < gw && y < gh) { s += grid[y * gw + x]; c++; }
      }
      sm[gy * gw + gx] = Math.max(60, s / c);
    }
  }
  return (x: number, y: number) => {
    const fx = Math.min(gw - 1, Math.max(0, x / cell - 0.5)), fy = Math.min(gh - 1, Math.max(0, y / cell - 0.5));
    const x0 = fx | 0, y0 = fy | 0, x1 = Math.min(gw - 1, x0 + 1), y1 = Math.min(gh - 1, y0 + 1);
    const tx = fx - x0, ty = fy - y0;
    const a = sm[y0 * gw + x0] + (sm[y0 * gw + x1] - sm[y0 * gw + x0]) * tx;
    const b = sm[y1 * gw + x0] + (sm[y1 * gw + x1] - sm[y1 * gw + x0]) * tx;
    return a + (b - a) * ty;
  };
}

export function applyFilter(c: HTMLCanvasElement, filter: Filter) {
  if (filter === 'original') return c;
  const ctx = c.getContext('2d')!;
  const { width: w, height: h } = c;
  const img = ctx.getImageData(0, 0, w, h);
  const p = img.data;
  const lum = new Float32Array(w * h);
  for (let i = 0, k = 0; k < lum.length; i += 4, k++) lum[k] = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];

  if (filter === 'gray') {
    for (let i = 0, k = 0; k < lum.length; i += 4, k++) p[i] = p[i + 1] = p[i + 2] = lum[k];
  } else {
    const bg = backgroundMap(lum, w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const k = y * w + x, i = k * 4;
        const scale = 255 / bg(x, y);
        if (filter === 'bw') {
          const n = lum[k] * scale; // 255 = paper
          const v = Math.max(0, Math.min(255, (n - 150) * 5.1)); // soft threshold 150–200 keeps edges smooth
          p[i] = p[i + 1] = p[i + 2] = v;
        } else {
          for (let ch = 0; ch < 3; ch++) {
            let v = p[i + ch] * scale;
            v = (v - 28) * (255 / (238 - 28)); // levels: deepen ink, push paper to white
            p[i + ch] = v < 0 ? 0 : v > 255 ? 255 : v;
          }
        }
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function rotateCanvas(c: HTMLCanvasElement, deg: number) {
  const r = ((deg % 360) + 360) % 360;
  if (!r) return c;
  const swap = r === 90 || r === 270;
  const out = newCanvas(swap ? c.height : c.width, swap ? c.width : c.height);
  const ctx = out.getContext('2d')!;
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((r * Math.PI) / 180);
  ctx.drawImage(c, -c.width / 2, -c.height / 2);
  return out;
}

export function processScan(src: HTMLCanvasElement, corners: Pt[], filter: Filter, rot: number) {
  return rotateCanvas(applyFilter(warp(src, corners), filter), rot);
}
