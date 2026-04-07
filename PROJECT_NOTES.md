# Study Buddy — Project Notes

Handoff notes so the next session can pick up immediately. Last updated: 2026-11-17.

## Status

- **Branch:** `study-buddy` (branched from `main`). **Nothing is committed yet**; all work sits in the working tree.
- Old Vite app files (TrustMeBruh, FIFA page, AI Studio boilerplate) are staged as deleted on this branch.
- The type check (`npx tsc --noEmit`) passes. `npm run build` produces the static site in `out/`.
- The user reviewed it and was very happy, especially with the neumorphic button effects.
- **Next step:** the user has some *minor issues* to report (not yet received). Wait for their list, then fix, re-test, and ask before committing or pushing.

## What the project is

**Study Buddy**: free file tools for students, hosted at **studybuddy.arafatcodes.dev** (Netlify free tier, subdomain of the user's portfolio arafatcodes.dev). Everything runs **in the browser**: no server, no uploads.

| Route | Tool |
|---|---|
| `/` | Landing page: a 3D CSS "file shelf" (PDF, JPG, PNG, JPEG, PPT, SCAN, ZIP books) that slides, opens like a book, and shows a glass info panel. Inspired by the user's reference video `demo ui.mp4` (gitignored). Tool cards and a privacy band sit below. |
| `/admission-documents/` | Batch converter: up to **10** JPG/PNG/PDF files. Excel-like table: File, Max size, Rename, Convert to (JPG/PNG/PDF, where the file's own format is labeled "Compress"), Status. An "Apply to all" bar sets size and formats; rows can override them (shown with a "custom" badge). Downloads: `documents-jpg.zip`, `-png.zip`, `-pdf.zip`, `-all.zip` (folders inside). |
| `/pdf-tools/` | Page organizer: add PDFs or images, drag to reorder (dnd-kit), rotate, delete, select. Save as one PDF, selected pages to PDF, split every page (ZIP), split by ranges like `1-3, 5`. Uses pdf-lib `copyPages`, so text stays selectable. |
| `/scan-to-pdf/` | Camera or upload, a 4-corner perspective crop editor with live preview, filters Magic / Original / Grayscale / B&W, rotate, drag to reorder. Exports A4 / Letter / fit-to-photo with an optional max size. |
| `/presentation-shuffle/` | Port of the original course tool. The demo data is removed. Saved in localStorage (`sb-shuffle-v1`). Editing groups keeps the order and grades. Shuffle uses `crypto.getRandomValues`. Excel export includes grades and styled headers. |

Navbar: minimal glass pill (links), plus a language button (EN / বাং / 中) and a theme toggle in the top-right; on mobile, a menu sheet. Footer: "Developed by **Arafat**" linking to https://arafatcodes.dev.

## User's preferences (design and product)

- Minimalist. **Neumorphic** buttons, inputs and cards (soft raised/pressed shadows) from their reference image. Glassmorphism for panels and the navbar.
- Reference sites: arafatcodes.dev (warm ash grays, Hanken Grotesk) and aigc.arafatcodes.dev (lit center, dark corners, Lexend).
- Accent color is soft blue `#6e9bf2`. Light theme bg `#e8e9ee`, dark theme bg `#1d1f25`.
- Fonts: Hanken Grotesk (body), Instrument Serif (display/titles, italic "Buddy"), JetBrains Mono, Hind Siliguri (Bengali), Noto Sans SC (Chinese).
- Must work well on phone, tablet and desktop. The user explicitly allowed different phone layouts.
- Three languages, with English as default. The Bengali and Chinese strings were written by Claude and **should be reviewed by a native speaker**.
- Only **free, client-side** libraries; no VPS.

## Stack

Next.js 16.4 (App Router, `output: 'export'`, `trailingSlash: true`) · React 19 · TypeScript 5.9 (pinned: TS 7 breaks Next) · plain CSS (no Tailwind) · pdf-lib · pdfjs-dist 6 (legacy build, lazy-loaded) · fflate · upng-js · @dnd-kit · motion · xlsx-js-style (lazy-loaded).

## File map

```
src/app/                    layout.tsx (fonts, providers, theme no-flash script), page.tsx, one folder per tool (page.tsx = metadata + client component)
src/components/
  Navbar.tsx, Footer.tsx, Icon.tsx (inline line icons), Theme.tsx (light/dark, localStorage 'sb-theme')
  landing/Shelf.tsx         3D shelf + autoplay state machine (idle → open → closing → next)
  landing/Landing.tsx       shelf + tool cards
  tools/Admission.tsx, PdfTools.tsx, Scan.tsx, Shuffle.tsx
  tools/DropZone.tsx, SizeSelect.tsx (size presets, decimal MB)
src/lib/
  files.ts     detectKind (magic bytes), formatBytes, safeName, uniqueNamer, makeZip, saveBlob
  encode.ts    jpegToTarget (quality binary search, then downscale), pngToTarget (UPNG quantize), buildImagePdf, pageForImage
  convert.ts   Admission pipeline: one file → JPG/PNG/PDF outputs under a limit
  pdfjs.ts     lazy pdf.js loader, openPdf (PasswordError), renderPage, closePdf (v6: doc.loadingTask.destroy())
  pdfops.ts    assemblePdf (merge/split/rotate), parseRanges
  scan.ts      homography warp, background-normalized "Magic"/B&W filters, rotate
src/i18n/      en.ts (source of truth, `Dict` type), bn.ts, zh.ts, index.tsx (provider, localStorage 'sb-lang', t() with {var} fill)
src/styles/    globals.css (tokens + neumorphic primitives), landing.css, tools.css
scripts/       copy-pdf-worker.mjs (postinstall → public/pdf.worker.min.mjs), flatten-rsc.mjs (postbuild, see gotchas)
netlify.toml   build `npm run build`, publish `out`
```

## Key technical decisions

- **Size limits:** 1 MB = 1,000,000 bytes, and every limit is multiplied by `SAFETY = 0.97` so files pass portals that count in either 1,000,000 or 1,048,576 bytes.
- **Untouched originals:** a file in the same format that is already under the limit is kept untouched (`kept: true`, shown as "already under the limit").
- **PDF over the limit:** first a lossless pdf-lib re-save; only if that is still too big are pages rasterized to JPEG (per-page byte budget). Impossible targets return the smallest file achieved, with a warning (`over: true`).
- **Multi-page PDF → JPG/PNG:** one image per page, named `name_p1.jpg`, etc.
- **EXIF:** images are decoded with an `<img>` element (applies EXIF rotation). The JPG→PDF fast path embeds the original bytes only when there is no EXIF rotation (`hasExifRotation`).
- **Canvas cap:** canvases are capped at 16 MP for iOS Safari.
- **Defaults (chosen by Claude, user can change):** new Admission rows start at 1.5 MB with JPG + PDF output. Scan defaults to the Magic filter and A4.

## Gotchas found and fixed

1. **3D shelf:** never put `opacity` on a `preserve-3d` element (it flattens it). Fading is done on the leaf faces via the `--o` / `--od` CSS variables. The `.lift` animation uses `fill-mode: backwards` so it doesn't block the hover transform.
2. **Next 16 static export:** it writes payloads as `__next.<route>/__PAGE__.txt`, but the client fetches `__next.<route>.__PAGE__.txt`, which caused 404s on prefetch. `scripts/flatten-rsc.mjs` (runs inside `npm run build`) writes the flat copies.
3. **pdf.js v6:** use `render({ canvas, viewport, background })`, `isEvalSupported` is gone, and `destroy()` lives on `doc.loadingTask`.
4. **Rotated thumbnails:** in PDF Tools, a rotated portrait thumbnail is scaled to 0.74 so it stays inside its tile.
5. **Letter-spacing:** wide letter-spacing on uppercase labels breaks Bengali conjuncts, so it's reduced for `lang="bn"` / `lang="zh"` (end of globals.css).
6. **Navbar background:** the navbar uses `--nav-bg` (more opaque than `--glass`) so it stays readable over scrolled content.

## How it was tested

Headless Chrome via puppeteer-core (installed in the session scratchpad, not in the project). A tiny static server served `out/`. Fixtures were generated with PIL and pdf-lib: a 4032×3024 photo with EXIF orientation 6, a 1 MB PNG, a 3-page text PDF, a 3.4 MB image PDF, and a skewed, shadowed paper photo. Verified:

- **Admission:** all outputs under 1 MB, EXIF rotation correct, ZIP contents and PDF page sizes valid.
- **PDF Tools:** merge kept the rotation (7 pages); range split works.
- **Scan:** produced an A4 PDF.
- **Shuffle:** order and grades survive an edit and a page reload; Excel export works.
- **Visuals:** screenshots checked in light/dark, desktop/mobile, and en/bn/zh. No page errors.

To re-test, recreate a similar script; the scratchpad from that session may be gone.

## Ideas discussed, not built yet

- Exact-pixel photo and signature maker (e.g. 300×300 passport photo, white background).
- "Combine selected rows into one PDF" in Admission Documents.
- HEIC (iPhone) input via `heic2any`.
- Automatic paper edge detection in Scan.
- Optional "stitch all PDF pages into one tall image" mode.
- Random group maker, presentation timer, cover-page generator, citation generator (DOI → Crossref API), CGPA converter.

## Deploy checklist (when the user approves)

1. Commit on `study-buddy`, merge or open a PR to `main` (remote: github.com/arafat0924/TrustMeBruh). Only do this when asked.
2. In Netlify, create a new site from the repo. The build settings come from `netlify.toml`, and Node 22 is set.
3. Add the custom domain `studybuddy.arafatcodes.dev`, then add DNS `CNAME studybuddy → <site>.netlify.app`. HTTPS is automatic.
