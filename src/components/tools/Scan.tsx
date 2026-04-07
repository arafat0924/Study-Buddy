'use client';

import { useEffect, useRef, useState } from 'react';
import {
  DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useI18n } from '@/i18n';
import Icon from '../Icon';
import DropZone from './DropZone';
import SizeSelect, { sizeBytes, type SizeValue } from './SizeSelect';
import { FULL, loadPhoto, processScan, type Filter, type Pt } from '@/lib/scan';
import { SAFETY, buildImagePdf, canvasToBlob, jpegToTarget, pageForImage, pdfOverhead, scaleCanvas, u8, type PaperSize } from '@/lib/encode';
import { detectKind, nextFrame, safeName, saveBlob, uid } from '@/lib/files';

type ScanPage = { id: string; url: string; corners: Pt[]; filter: Filter; rot: number; thumb: string | null };
const FILTERS: Filter[] = ['enhance', 'original', 'gray', 'bw'];

export default function Scan() {
  const { d } = useI18n();
  const s = d.scan;
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [paper, setPaper] = useState<PaperSize>('a4');
  const [size, setSize] = useState<SizeValue>({ key: 'none', customMB: '' });
  const [name, setName] = useState('scan');
  const [error, setError] = useState<string | null>(null);
  const sources = useRef(new Map<string, HTMLCanvasElement>());
  const results = useRef(new Map<string, HTMLCanvasElement>());
  const thumbs = useRef(new Map<string, string>());

  useEffect(() => () => {
    thumbs.current.forEach((u) => URL.revokeObjectURL(u));
    pages.forEach((p) => URL.revokeObjectURL(p.url));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const render = async (p: ScanPage) => {
    const src = sources.current.get(p.id);
    if (!src) return;
    await nextFrame();
    const out = processScan(src, p.corners, p.filter, p.rot);
    results.current.set(p.id, out);
    const small = scaleCanvas(out, Math.min(1, 360 / Math.max(out.width, out.height)), true);
    const url = URL.createObjectURL(await canvasToBlob(small, 'image/jpeg', 0.8));
    const old = thumbs.current.get(p.id);
    if (old) URL.revokeObjectURL(old);
    thumbs.current.set(p.id, url);
    setPages((ps) => ps.map((x) => (x.id === p.id ? { ...p, thumb: url } : x)));
  };

  const addFiles = async (files: File[]) => {
    setError(null);
    for (const file of files) {
      const kind = await detectKind(file);
      if (kind !== 'jpg' && kind !== 'png' && !file.type.startsWith('image/')) {
        setError(`${file.name}: ${d.common.badFile}`);
        continue;
      }
      setBusy(s.processing);
      try {
        const id = uid();
        const canvas = await loadPhoto(file);
        sources.current.set(id, canvas);
        const page: ScanPage = { id, url: URL.createObjectURL(file), corners: FULL.map((c) => [...c] as Pt), filter: 'enhance', rot: 0, thumb: null };
        setPages((ps) => [...ps, page]);
        await render(page);
      } catch {
        setError(`${file.name}: ${d.common.badFile}`);
      }
    }
    setBusy(null);
  };

  const update = async (p: ScanPage) => {
    setPages((ps) => ps.map((x) => (x.id === p.id ? p : x)));
    setBusy(s.processing);
    await render(p);
    setBusy(null);
  };

  const remove = (id: string) => {
    setPages((ps) => ps.filter((x) => x.id !== id));
    sources.current.delete(id);
    results.current.delete(id);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setPages((ps) => arrayMove(ps, ps.findIndex((x) => x.id === active.id), ps.findIndex((x) => x.id === over.id)));
  };

  const save = async () => {
    setBusy(d.common.working);
    try {
      const limit = sizeBytes(size);
      const max = limit ? Math.floor(limit * SAFETY) : null;
      const budget = max ? Math.max(10_000, Math.floor((max - pdfOverhead(pages.length)) / pages.length)) : null;
      const list = [];
      for (const p of pages) {
        const c = results.current.get(p.id);
        if (!c) continue;
        await nextFrame();
        const r = await jpegToTarget(c, budget, 0.88);
        list.push({ bytes: await u8(r.blob), kind: 'jpg' as const, ...pageForImage(c.width, c.height) });
      }
      const bytes = await buildImagePdf(list, paper);
      saveBlob(new Blob([bytes as BlobPart], { type: 'application/pdf' }), `${safeName(name, 'scan')}.pdf`);
    } catch (e) {
      console.error(e);
      setError(d.common.error);
    } finally {
      setBusy(null);
    }
  };

  const current = pages.find((p) => p.id === editing);

  return (
    <div className="page">
      <header className="page-head rise">
        <span className="privacy-pill"><Icon name="shield" />{d.common.privacy}</span>
        <h1 className="display">{s.title}</h1>
        <p>{s.subtitle}</p>
      </header>

      <div className="scan-add">
        <DropZone accept="image/jpeg,image/png,.jpg,.jpeg,.png" onFiles={addFiles} title={s.upload} hint={s.hint} icon="image" disabled={!!busy} compact />
      </div>

      {error && <div className="notice err" style={{ marginTop: 14 }}><Icon name="alert" />{error}</div>}

      {pages.length > 0 ? (
        <>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={pages.map((p) => p.id)} strategy={rectSortingStrategy}>
              <div className="page-grid scan-grid rise">
                {pages.map((p, i) => (
                  <ScanTile key={p.id} page={p} n={i + 1} onEdit={() => setEditing(p.id)} onRemove={() => remove(p.id)}
                    onRotate={() => update({ ...p, rot: (p.rot + 90) % 360 })} />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <div className="card scan-export">
            <div>
              <span className="label">{s.pageSize}</span>
              <div className="seg">
                {(['a4', 'letter', 'fit'] as PaperSize[]).map((k) => (
                  <button key={k} aria-pressed={paper === k} onClick={() => setPaper(k)}>{s.sizes[k]}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="label" htmlFor="scan-size">{s.maxSize}</label>
              <SizeSelect id="scan-size" value={size} onChange={setSize} />
            </div>
            <div className="org-name">
              <label className="label" htmlFor="scan-name">{d.common.fileName}</label>
              <div className="name-field">
                <input id="scan-name" className="field" value={name} onChange={(e) => setName(e.target.value)} />
                <span>.pdf</span>
              </div>
            </div>
            <button className="btn btn-primary btn-lg" onClick={save} disabled={!!busy}>
              <Icon name="download" /> {s.save}
            </button>
          </div>
        </>
      ) : (
        <p className="empty-hint">{s.empty}</p>
      )}

      {current && sources.current.get(current.id) && (
        <Editor
          page={current}
          src={sources.current.get(current.id)!}
          onClose={() => setEditing(null)}
          onApply={(p) => { setEditing(null); update(p); }}
        />
      )}
      {busy && <div className="toast glass"><span className="spin" />{busy}</div>}
    </div>
  );
}

function ScanTile({ page, n, onEdit, onRemove, onRotate }: { page: ScanPage; n: number; onEdit: () => void; onRemove: () => void; onRotate: () => void }) {
  const { d, t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 5 : undefined }}
      className={`tile${isDragging ? ' is-drag' : ''}`}>
      <div className="tile-img" {...attributes} {...listeners} onClick={onEdit} aria-label={`${t(d.common.page, { n })} — ${d.scan.edit}`}>
        {page.thumb ? <img src={page.thumb} alt="" draggable={false} /> : <span className="spin" />}
        <span className="tile-edit"><Icon name="edit" /></span>
      </div>
      <div className="tile-foot">
        <span className="tile-n">{n}</span>
        <span className="spacer" />
        <button className="tile-btn" onClick={onRotate} aria-label={d.common.rotateRight}><Icon name="rotR" /></button>
        <button className="tile-btn danger" onClick={onRemove} aria-label={d.common.remove}><Icon name="x" /></button>
      </div>
    </div>
  );
}

function Editor({ page, src, onClose, onApply }: { page: ScanPage; src: HTMLCanvasElement; onClose: () => void; onApply: (p: ScanPage) => void }) {
  const { d } = useI18n();
  const s = d.scan;
  const [corners, setCorners] = useState<Pt[]>(page.corners);
  const [filter, setFilter] = useState<Filter>(page.filter);
  const [rot, setRot] = useState(page.rot);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const small = useRef<HTMLCanvasElement | null>(null);

  if (!small.current) small.current = scaleCanvas(src, Math.min(1, 720 / Math.max(src.width, src.height)));

  // Live preview on a small copy (fast); the full-size page is processed on Apply.
  const lastUrl = useRef<string | null>(null);
  useEffect(() => {
    if (dragging !== null) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const out = processScan(small.current!, corners, filter, rot);
      const blob = await canvasToBlob(out, 'image/jpeg', 0.8);
      if (cancelled) return;
      if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
      lastUrl.current = URL.createObjectURL(blob);
      setPreview(lastUrl.current);
    }, 60);
    return () => { cancelled = true; clearTimeout(t); };
  }, [corners, filter, rot, dragging]);
  useEffect(() => () => { if (lastUrl.current) URL.revokeObjectURL(lastUrl.current); }, []);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', esc); document.body.style.overflow = ''; };
  }, [onClose]);

  const move = (e: React.PointerEvent, i: number) => {
    const r = imgRef.current!.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    setCorners((c) => c.map((p, k) => (k === i ? [x, y] : p)));
  };

  const poly = corners.map(([x, y]) => `${x * 100},${y * 100}`).join(' ');

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={s.edit}>
      <div className="modal-card glass">
        <div className="modal-head">
          <strong>{s.edit}</strong>
          <button className="btn btn-icon btn-sm btn-ghost" onClick={onClose} aria-label={d.common.close}><Icon name="x" /></button>
        </div>
        <div className="editor">
          <div className="crop-wrap">
            <div className="crop">
              <img ref={imgRef} src={page.url} alt="" draggable={false} />
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="crop-svg" aria-hidden="true">
                <polygon points={poly} />
              </svg>
              {corners.map(([x, y], i) => (
                <span
                  key={i}
                  className={`handle${dragging === i ? ' is-drag' : ''}`}
                  style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
                  onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); setDragging(i); }}
                  onPointerMove={(e) => dragging === i && move(e, i)}
                  onPointerUp={() => setDragging(null)}
                  onPointerCancel={() => setDragging(null)}
                  role="slider"
                  aria-label={`corner ${i + 1}`}
                  aria-valuenow={Math.round(x * 100)}
                />
              ))}
            </div>
            <p className="muted crop-hint">{s.corners}</p>
          </div>
          <div className="editor-side">
            <div className="preview">{preview ? <img src={preview} alt="" /> : <span className="spin" />}</div>
            <div>
              <span className="label">{s.filter}</span>
              <div className="seg seg-wrap">
                {FILTERS.map((f) => (
                  <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>{s.filters[f]}</button>
                ))}
              </div>
            </div>
            <div className="row">
              <button className="btn btn-sm" onClick={() => setRot((r) => (r + 270) % 360)} aria-label={d.common.rotateLeft}><Icon name="rotL" /></button>
              <button className="btn btn-sm" onClick={() => setRot((r) => (r + 90) % 360)} aria-label={d.common.rotateRight}><Icon name="rotR" /></button>
              <button className="btn btn-sm btn-ghost" onClick={() => setCorners(FULL.map((c) => [...c] as Pt))}>{s.resetCorners}</button>
            </div>
            <div className="row editor-actions">
              <button className="btn" onClick={onClose}>{d.common.cancel}</button>
              <button className="btn btn-primary" onClick={() => onApply({ ...page, corners, filter, rot })}>
                <Icon name="check" /> {s.applyEdit}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
