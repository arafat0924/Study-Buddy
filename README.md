# Study Buddy

Free file tools for students — **https://studybuddy.arafatcodes.dev**

| Tool | What it does |
|---|---|
| **Admission Documents** | Upload up to 10 JPG / PNG / PDF files, pick output formats and a max size per file (or for all), rename, then download `jpg.zip`, `png.zip`, `pdf.zip` or everything. |
| **PDF Tools** | Merge, split (every page or by ranges), rotate, delete and drag-reorder pages from PDFs and images. Original pages are copied, so text stays selectable. |
| **Scan to PDF** | Phone photos → 4-corner perspective crop → Magic / Grayscale / B&W filter → one A4, Letter or fit-to-photo PDF. |
| **Presentation Shuffle** | Course groups → fair (crypto-random) presentation order → grades → styled Excel export. Saved locally, survives refresh. |

Everything runs **in the browser** — no server, no uploads. Available in English, বাংলা and 中文, light and dark.

## Stack

Next.js 16 (static export) · React 19 · pdf-lib · pdf.js · fflate · UPNG.js · dnd-kit · motion · xlsx-js-style

## Develop

```bash
npm install      # also copies the pdf.js worker into /public
npm run dev      # http://localhost:3000
npm run build    # static site in /out
```

## Deploy (Netlify)

`netlify.toml` is included: build command `npm run build`, publish directory `out`.
For the subdomain, add `studybuddy.arafatcodes.dev` as a custom domain in Netlify, then create a DNS record
`CNAME studybuddy → <site-name>.netlify.app` wherever `arafatcodes.dev` is managed.

## Size limits

Limits use decimal units (1 MB = 1,000,000 bytes) and aim ~3% under the limit, so files pass portals that count either way.
JPEGs use a quality binary search, then shrink dimensions if needed; PNGs are colour-quantised; oversized PDFs are first re-saved
losslessly and only rasterised if that is still too big. If a target is impossible, the smallest achievable file is returned with a warning.

---

Developed by [Arafat](https://arafatcodes.dev)
