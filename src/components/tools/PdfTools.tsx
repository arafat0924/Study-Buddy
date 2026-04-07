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
import { PasswordError, closePdf, openPdf, renderPage } from '@/lib/pdfjs';
import { canvasToBlob } from '@/lib/encode';
import { assemblePdf, parseRanges, type PageRef, type Source } from '@/lib/pdfops';
import { baseName, detectKind, makeZip, safeName, saveBlob, uid } from '@/lib/files';

const COLORS = ['#6e9bf2', '#e0864f', '#5fae86', '#c76ab0', '#d4b13d', '#8a78c8', '#4fb3c4', '#d9606a'];

type Page = PageRef & { thumb: string | null; landscape: boolean };

export default function PdfTools() {
  const { d, t } = useI18n();
  const p = d.pdf;
  const sources = useRef(new Map<string, Source>());
  const urls = useRef<string[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState('document');
  const [ranges, setRanges] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [, force] = useState(0);

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const addFiles = async (files: File[]) => {
    const errs: string[] = [];
    if (!pages.length && files[0]) setName(safeName(baseName(files[0].name)));
    for (const file of files) {
      const kind = await detectKind(file);
      if (!kind) { errs.push(t(d.admission.unsupported, { name: file.name })); continue; }
      const id = uid();
      const color = COLORS[sources.current.size % COLORS.length];
      const bytes = await file.arrayBuffer();
      setBusy(t(p.loading, { name: file.name }));
      try {
        if (kind === 'pdf') {
          const doc = await openPdf(bytes);
          sources.current.set(id, { id, name: file.name, kind, bytes, color });
          const fresh: Page[] = Array.from({ length: doc.numPages }, (_, i) => ({ id: uid(), src: id, index: i, rot: 0, thumb: null, landscape: false }));
          setPages((ps) => [...ps, ...fresh]);
          for (let i = 0; i < fresh.length; i++) {
            const { canvas } = await renderPage(doc, i + 1, 260);
            const url = URL.createObjectURL(await canvasToBlob(canvas, 'image/jpeg', 0.75));
            urls.current.push(url);
            const landscape = canvas.width > canvas.height;
            setPages((ps) => ps.map((x) => (x.id === fresh[i].id ? { ...x, thumb: url, landscape } : x)));
          }
          await closePdf(doc);
        } else {
          sources.current.set(id, { id, name: file.name, kind, bytes, color });
          const url = URL.createObjectURL(file);
          urls.current.push(url);
          const img = new Image();
          img.src = url;
          await img.decode().catch(() => {});
          setPages((ps) => [...ps, { id: uid(), src: id, index: 0, rot: 0, thumb: url, landscape: img.naturalWidth > img.naturalHeight }]);
        }
      } catch (e) {
        sources.current.delete(id);
        errs.push(`${file.name}: ${e instanceof PasswordError ? d.common.passwordPdf : d.common.badFile}`);
      }
    }
    setBusy(null);
    setErrors(errs);
    force((n) => n + 1);
  };

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const rotate = (ids: Set<string> | string[], delta: number) => {
    const set = new Set(ids);
    setPages((ps) => ps.map((x) => (set.has(x.id) ? { ...x, rot: (x.rot + delta + 360) % 360 } : x)));
  };
  const remove = (ids: Set<string> | string[]) => {
    const set = new Set(ids);
    setPages((ps) => ps.filter((x) => !set.has(x.id)));
    setSelected((s) => new Set([...s].filter((id) => !set.has(id))));
  };
  const clear = () => { setPages([]); setSelected(new Set()); sources.current.clear(); setErrors([]); setRanges(''); };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setPages((ps) => arrayMove(ps, ps.findIndex((x) => x.id === active.id), ps.findIndex((x) => x.id === over.id)));
  };

  const fileBase = safeName(name, 'document');
  const pdfBlob = (bytes: Uint8Array) => new Blob([bytes as BlobPart], { type: 'application/pdf' });

  const exportPages = async (list: Page[], suffix = '') => {
    setBusy(d.common.working);
    try {
      const bytes = await assemblePdf(list, sources.current);
      saveBlob(pdfBlob(bytes), `${fileBase}${suffix}.pdf`);
    } catch (e) {
      console.error(e);
      setErrors([d.common.error]);
    } finally { setBusy(null); }
  };

  const splitGroups = async (groups: number[][]) => {
    setBusy(d.common.working);
    try {
      const files: { name: string; blob: Blob }[] = [];
      for (const g of groups) {
        const bytes = await assemblePdf(g.map((n) => pages[n - 1]), sources.current);
        const label = g.length === 1 ? `${g[0]}` : `${g[0]}-${g[g.length - 1]}`;
        files.push({ name: `${fileBase}_${label}.pdf`, blob: pdfBlob(bytes) });
      }
      saveBlob(await makeZip(files), `${fileBase}_split.zip`);
    } catch (e) {
      console.error(e);
      setErrors([d.common.error]);
    } finally { setBusy(null); }
  };

  const parsed = ranges.trim() ? parseRanges(ranges, pages.length) : null;
  const rangesBad = ranges.trim() !== '' && !parsed;
  const sel = pages.filter((x) => selected.has(x.id));
  const disabled = !!busy || !pages.length;

  return (
    <div className="page">
      <header className="page-head rise">
        <span className="privacy-pill"><Icon name="shield" />{d.common.privacy}</span>
        <h1 className="display">{p.title}</h1>
        <p>{p.subtitle}</p>
      </header>

      <DropZone
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        onFiles={addFiles}
        title={p.dropTitle}
        hint={p.dropHint}
        icon="files"
        disabled={!!busy}
        compact={pages.length > 0}
      />

      {errors.map((e, i) => <div key={i} className="notice err" style={{ marginTop: 14 }}><Icon name="alert" />{e}</div>)}

      {pages.length > 0 && (
        <div className="org rise">
          <div className="org-bar card">
            <div className="row org-sel">
              <strong>{t(p.pagesCount, { n: pages.length })}</strong>
              {sel.length > 0 && <span className="muted">· {t(p.selected, { n: sel.length })}</span>}
              <span className="spacer" />
              <button className="btn btn-sm btn-ghost" onClick={() => setSelected(sel.length === pages.length ? new Set() : new Set(pages.map((x) => x.id)))}>
                {sel.length === pages.length ? d.common.selectNone : d.common.selectAll}
              </button>
              <button className="btn btn-sm" disabled={!sel.length} onClick={() => rotate(selected, -90)} aria-label={d.common.rotateLeft}><Icon name="rotL" /></button>
              <button className="btn btn-sm" disabled={!sel.length} onClick={() => rotate(selected, 90)} aria-label={d.common.rotateRight}><Icon name="rotR" /></button>
              <button className="btn btn-sm btn-danger" disabled={!sel.length} onClick={() => remove(selected)}><Icon name="trash" /> {p.deleteSelected}</button>
              <button className="btn btn-sm btn-ghost btn-danger" onClick={clear}><Icon name="x" /> {d.common.clear}</button>
            </div>
            <div className="legend">
              {[...new Set(pages.map((x) => x.src))].map((sid) => {
                const s = sources.current.get(sid);
                return s ? <span key={sid}><i style={{ background: s.color }} />{s.name}</span> : null;
              })}
            </div>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={pages.map((x) => x.id)} strategy={rectSortingStrategy}>
              <div className="page-grid">
                {pages.map((pg, i) => (
                  <Tile
                    key={pg.id}
                    page={pg}
                    n={i + 1}
                    color={sources.current.get(pg.src)?.color ?? '#999'}
                    selected={selected.has(pg.id)}
                    onToggle={() => toggle(pg.id)}
                    onRotate={() => rotate([pg.id], 90)}
                    onRemove={() => remove([pg.id])}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <div className="card org-export">
            <div className="org-name">
              <label className="label" htmlFor="pdf-name">{p.outName}</label>
              <div className="name-field">
                <input id="pdf-name" className="field" value={name} onChange={(e) => setName(e.target.value)} />
                <span>.pdf</span>
              </div>
            </div>
            <div className="org-actions">
              <button className="btn btn-primary" disabled={disabled} onClick={() => exportPages(pages)}>
                <Icon name="download" /> {p.merge}
              </button>
              <button className="btn" disabled={disabled || !sel.length} onClick={() => exportPages(sel, '_selected')}>
                <Icon name="check" /> {p.exportSelected}
              </button>
              <button className="btn" disabled={disabled} onClick={() => splitGroups(pages.map((_, i) => [i + 1]))}>
                <Icon name="scissors" /> {p.splitEach}
              </button>
            </div>
            <div className="org-ranges">
              <label className="label" htmlFor="pdf-ranges">{p.splitRanges}</label>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <input
                  id="pdf-ranges"
                  className="field"
                  placeholder={p.rangesPlaceholder}
                  value={ranges}
                  onChange={(e) => setRanges(e.target.value)}
                  aria-invalid={rangesBad}
                />
                <button className="btn" disabled={disabled || !parsed} onClick={() => parsed && splitGroups(parsed)}>
                  <Icon name="zip" /> ZIP
                </button>
              </div>
              <small className={rangesBad ? 'st-err' : 'muted'}>{rangesBad ? t(p.rangesInvalid, { n: pages.length }) : p.rangesHint}</small>
            </div>
          </div>
        </div>
      )}

      {busy && <div className="toast glass"><span className="spin" />{busy}</div>}
      {!pages.length && !busy && <p className="empty-hint">{p.empty}</p>}
    </div>
  );
}

function Tile({
  page, n, color, selected, onToggle, onRotate, onRemove,
}: {
  page: Page; n: number; color: string; selected: boolean;
  onToggle: () => void; onRotate: () => void; onRemove: () => void;
}) {
  const { d, t } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 5 : undefined };
  return (
    <div ref={setNodeRef} style={style} className={`tile${selected ? ' is-sel' : ''}${isDragging ? ' is-drag' : ''}`}>
      <div className="tile-img" {...attributes} {...listeners} onClick={onToggle} aria-label={`${t(d.common.page, { n })} — ${d.common.drag}`}>
        {page.thumb ? (
          <img src={page.thumb} alt="" draggable={false} style={{ transform: `rotate(${page.rot}deg)${page.rot % 180 && !page.landscape ? ' scale(.74)' : ''}` }} className={page.landscape ? 'is-land' : ''} />
        ) : <span className="spin" />}
        <span className="tile-check" aria-hidden="true"><Icon name="check" /></span>
      </div>
      <div className="tile-foot">
        <i className="tile-dot" style={{ background: color }} />
        <span className="tile-n">{n}</span>
        <span className="spacer" />
        <button className="tile-btn" onClick={onRotate} aria-label={d.common.rotateRight}><Icon name="rotR" /></button>
        <button className="tile-btn danger" onClick={onRemove} aria-label={d.common.remove}><Icon name="x" /></button>
      </div>
    </div>
  );
}
