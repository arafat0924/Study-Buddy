'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '@/i18n';
import Icon from '../Icon';
import DropZone from './DropZone';
import SizeSelect, { sameSize, sizeBytes, type SizeValue } from './SizeSelect';
import type { Fmt, OutFile } from '@/lib/convert';

const FORMATS: Fmt[] = ['jpg', 'png', 'pdf'];
import { baseName, detectKind, formatBytes, makeZip, safeName, saveBlob, uid, type Kind } from '@/lib/files';
import { PasswordError, closePdf, openPdf, renderPage } from '@/lib/pdfjs';
import { canvasToBlob } from '@/lib/encode';

const MAX_FILES = 10;
const FMT_LABEL: Record<Fmt, string> = { jpg: 'JPG', png: 'PNG', pdf: 'PDF' };

type Status = 'idle' | 'queued' | 'working' | 'done' | 'error';
type Output = OutFile & { suffix: string };
type Row = {
  id: string;
  file: File;
  kind: Kind;
  thumb: string | null;
  pages: number;
  name: string;
  size: SizeValue;
  formats: Fmt[];
  status: Status;
  step?: string;
  outputs?: Output[];
  error?: string;
};

const sameFormats = (a: Fmt[], b: Fmt[]) => a.length === b.length && a.every((f) => b.includes(f));

export default function Admission() {
  const { d, t } = useI18n();
  const a = d.admission;
  const [rows, setRows] = useState<Row[]>([]);
  const [global, setGlobal] = useState<{ size: SizeValue; formats: Fmt[] }>({
    size: { key: '1.5m', customMB: '' },
    formats: ['jpg', 'pdf'],
  });
  const [notices, setNotices] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const urls = useRef<string[]>([]);

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const patch = (id: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  /** Settings changed: drop old results so nothing stale gets downloaded. */
  const edit = (id: string, p: Partial<Row>) => patch(id, { ...p, status: 'idle', outputs: undefined, error: undefined });

  const addFiles = async (files: File[]) => {
    const msgs: string[] = [];
    const room = MAX_FILES - rows.length;
    if (files.length > room) msgs.push(t(a.tooMany, { n: files.length - Math.max(room, 0) }));
    const accepted: Row[] = [];
    for (const file of files.slice(0, Math.max(room, 0))) {
      const kind = await detectKind(file);
      if (!kind) { msgs.push(t(a.unsupported, { name: file.name })); continue; }
      accepted.push({
        id: uid(), file, kind, thumb: null, pages: 1,
        name: safeName(baseName(file.name)),
        size: { ...global.size },
        formats: [...global.formats],
        status: 'idle',
      });
    }
    setNotices(msgs);
    if (!accepted.length) return;
    setRows((rs) => [...rs, ...accepted]);

    // Thumbnails (and page counts for PDFs) load in the background.
    for (const r of accepted) {
      try {
        if (r.kind === 'pdf') {
          const doc = await openPdf(await r.file.arrayBuffer());
          const { canvas } = await renderPage(doc, 1, 180);
          const url = URL.createObjectURL(await canvasToBlob(canvas, 'image/jpeg', 0.8));
          urls.current.push(url);
          patch(r.id, { thumb: url, pages: doc.numPages });
          await closePdf(doc);
        } else {
          const url = URL.createObjectURL(r.file);
          urls.current.push(url);
          patch(r.id, { thumb: url });
        }
      } catch (e) {
        patch(r.id, { status: 'error', error: e instanceof PasswordError ? d.common.passwordPdf : d.common.badFile });
      }
    }
  };

  const applyAll = () =>
    setRows((rs) => rs.map((r) => ({ ...r, size: { ...global.size }, formats: [...global.formats], status: 'idle', outputs: undefined, error: undefined })));

  const run = async () => {
    const todo = rows.filter((r) => r.formats.length && !(r.status === 'error' && r.error === d.common.passwordPdf));
    if (!todo.length) return;
    setRunning(true);
    setProgress({ done: 0, total: todo.length });
    setRows((rs) => rs.map((r) => (todo.some((x) => x.id === r.id) ? { ...r, status: 'queued', outputs: undefined, error: undefined } : r)));
    const { convertFile } = await import('@/lib/convert');
    let done = 0;
    for (const r of todo) {
      patch(r.id, { status: 'working', step: '' });
      try {
        const base = safeName(r.name, 'document');
        const outs = await convertFile(r.file, r.kind, { formats: r.formats, maxBytes: sizeBytes(r.size), base }, (step) => patch(r.id, { step }));
        patch(r.id, { status: 'done', outputs: outs.map((o) => ({ ...o, suffix: o.name.slice(base.length) })) });
      } catch (e) {
        console.error(e);
        patch(r.id, { status: 'error', error: e instanceof PasswordError ? d.common.passwordPdf : d.common.error });
      }
      setProgress({ done: ++done, total: todo.length });
    }
    setRunning(false);
  };

  const outName = (r: Row, o: Output) => `${safeName(r.name, 'document')}${o.suffix}`;
  const results = useMemo(
    () => rows.flatMap((r) => (r.status === 'done' && r.outputs ? r.outputs.map((o) => ({ row: r, o })) : [])),
    [rows],
  );
  const countBy = (f: Fmt) => results.filter((x) => x.o.fmt === f).length;

  const downloadZip = async (fmt: Fmt | 'all') => {
    const picked = results.filter((x) => fmt === 'all' || x.o.fmt === fmt);
    const files = picked.map((x) => ({ name: (fmt === 'all' ? `${x.o.fmt}/` : '') + outName(x.row, x.o), blob: x.o.blob }));
    saveBlob(await makeZip(files), `documents-${fmt}.zip`);
  };

  const removeRow = (id: string) => setRows((rs) => rs.filter((r) => r.id !== id));
  const clear = () => { setRows([]); setNotices([]); setProgress({ done: 0, total: 0 }); };

  const totalSize = rows.reduce((s, r) => s + r.file.size, 0);
  const canRun = rows.some((r) => r.formats.length) && !running;
  const anyDone = results.length > 0;

  return (
    <div className="page">
      <header className="page-head rise">
        <span className="privacy-pill"><Icon name="shield" />{d.common.privacy}</span>
        <h1 className="display">{a.title}</h1>
        <p>{a.subtitle}</p>
      </header>

      {/* Apply-to-all bar */}
      <section className="card apply-bar rise" aria-label={a.applyAll}>
        <div className="apply-field">
          <label className="label" htmlFor="g-size">{a.maxSize}</label>
          <SizeSelect id="g-size" value={global.size} onChange={(size) => setGlobal((g) => ({ ...g, size }))} disabled={running} />
        </div>
        <div className="apply-field">
          <span className="label">{a.convertTo}</span>
          <div className="row" style={{ gap: 10 }}>
            {FORMATS.map((f) => (
              <label key={f} className="chip">
                <input
                  type="checkbox"
                  checked={global.formats.includes(f)}
                  disabled={running}
                  onChange={(e) => setGlobal((g) => ({ ...g, formats: e.target.checked ? [...g.formats, f] : g.formats.filter((x) => x !== f) }))}
                />
                <span className="box"><svg viewBox="0 0 24 24"><path d="M5 12.5 10 17.5 19 7" /></svg></span>
                {FMT_LABEL[f]}
              </label>
            ))}
          </div>
        </div>
        <div className="apply-go">
          <button className="btn" onClick={applyAll} disabled={!rows.length || running}>
            <Icon name="check" /> {a.applyAll}
          </button>
        </div>
        <p className="apply-hint">{a.applyAllHint} {a.sizeNote}</p>
      </section>

      {notices.length > 0 && (
        <div className="notices">
          {notices.map((n, i) => (
            <div key={i} className="notice warn"><Icon name="alert" />{n}</div>
          ))}
        </div>
      )}

      {rows.length < MAX_FILES && (
        <DropZone
          accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
          onFiles={addFiles}
          title={a.dropTitle}
          hint={a.dropHint}
          disabled={running}
          compact={rows.length > 0}
        />
      )}

      {rows.length > 0 && (
        <section className="batch rise">
          <div className="batch-meta">
            <span>{t(a.filesCount, { n: rows.length })}</span>
            <span className="dot" />
            <span>{t(a.totalSize, { size: formatBytes(totalSize) })}</span>
            <span className="spacer" />
            <button className="btn btn-sm btn-ghost btn-danger" onClick={clear} disabled={running}>
              <Icon name="trash" /> {d.common.clear}
            </button>
          </div>

          <div className="batch-table" role="table">
            <div className="bt-head" role="row">
              <span role="columnheader">#</span>
              <span role="columnheader">{a.file}</span>
              <span role="columnheader">{a.maxSize}</span>
              <span role="columnheader">{a.rename}</span>
              <span role="columnheader">{a.convertTo}</span>
              <span role="columnheader">{a.status}</span>
              <span role="columnheader"><span className="sr-only">{d.common.remove}</span></span>
            </div>

            {rows.map((r, i) => {
              const custom = !sameSize(r.size, global.size) || !sameFormats(r.formats, global.formats);
              return (
                <div key={r.id} className={`bt-row is-${r.status}`} role="row">
                  <span className="bt-num" role="cell">{i + 1}</span>

                  <div className="bt-file" role="cell">
                    <span className={`bt-thumb k-${r.kind}`}>
                      {r.thumb ? <img src={r.thumb} alt="" /> : <span className="spin" />}
                      <em>{r.kind.toUpperCase()}</em>
                    </span>
                    <span className="bt-file-txt">
                      <strong title={r.file.name}>{r.file.name}</strong>
                      <small>
                        {formatBytes(r.file.size)}
                        {r.kind === 'pdf' && ` · ${r.pages} ${d.common.pages}`}
                        {custom && <span className="badge">{a.customBadge}</span>}
                      </small>
                    </span>
                  </div>

                  <div className="bt-size" role="cell">
                    <span className="bt-label">{a.maxSize}</span>
                    <SizeSelect small value={r.size} onChange={(size) => edit(r.id, { size })} disabled={running} />
                  </div>

                  <div className="bt-name" role="cell">
                    <span className="bt-label">{a.rename}</span>
                    <input
                      className="field field-sm"
                      value={r.name}
                      disabled={running}
                      onChange={(e) => patch(r.id, { name: e.target.value })}
                      onBlur={(e) => patch(r.id, { name: safeName(e.target.value, baseName(r.file.name)) })}
                      aria-label={`${a.rename} ${i + 1}`}
                    />
                  </div>

                  <div className="bt-formats" role="cell">
                    <span className="bt-label">{a.convertTo}</span>
                    <div className="bt-chips">
                      {FORMATS.map((f) => (
                        <label key={f} className="chip chip-sm" title={f === r.kind ? `${a.compress} ${FMT_LABEL[f]}` : FMT_LABEL[f]}>
                          <input
                            type="checkbox"
                            checked={r.formats.includes(f)}
                            disabled={running}
                            onChange={(e) => edit(r.id, { formats: e.target.checked ? [...r.formats, f] : r.formats.filter((x) => x !== f) })}
                          />
                          <span className="box"><svg viewBox="0 0 24 24"><path d="M5 12.5 10 17.5 19 7" /></svg></span>
                          {f === r.kind ? <>{FMT_LABEL[f]}<i className="chip-tag">{a.compress}</i></> : FMT_LABEL[f]}
                        </label>
                      ))}
                    </div>
                    {r.kind === 'pdf' && r.pages > 1 && (r.formats.includes('jpg') || r.formats.includes('png')) && (
                      <small className="bt-note">{a.pdfPages}</small>
                    )}
                  </div>

                  <div className="bt-status" role="cell">
                    <RowStatus r={r} onSave={(o) => saveBlob(o.blob, outName(r, o))} />
                  </div>

                  <div className="bt-remove" role="cell">
                    <button className="btn btn-icon btn-sm btn-ghost btn-danger" onClick={() => removeRow(r.id)} disabled={running} aria-label={d.common.remove}>
                      <Icon name="x" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="batch-actions">
            <button className="btn btn-primary btn-lg" onClick={run} disabled={!canRun}>
              {running ? <span className="spin" style={{ borderTopColor: 'currentColor' }} /> : <Icon name="play" />}
              {running ? t(a.progress, { done: Math.min(progress.done + 1, progress.total), total: progress.total }) : anyDone ? a.rerun : a.run}
            </button>
            {anyDone && !running && (
              <div className="zip-row">
                {FORMATS.filter((f) => countBy(f) > 0).map((f) => (
                  <button key={f} className="btn" onClick={() => downloadZip(f)}>
                    <Icon name="zip" /> {t(a.zip, { fmt: FMT_LABEL[f] })} <span className="count">{countBy(f)}</span>
                  </button>
                ))}
                <button className="btn" onClick={() => downloadZip('all')}>
                  <Icon name="download" /> {a.allZip}
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {rows.length === 0 && <p className="empty-hint">{a.empty}</p>}
    </div>
  );
}

function RowStatus({ r, onSave }: { r: Row; onSave: (o: Output) => void }) {
  const { d, t } = useI18n();
  const a = d.admission;
  if (!r.formats.length) return <span className="st st-warn">{a.noFormat}</span>;
  if (r.status === 'queued') return <span className="st muted">…</span>;
  if (r.status === 'working') return <span className="st"><span className="spin" />{d.common.working} {r.step}</span>;
  if (r.status === 'error') return <span className="st st-err"><Icon name="alert" />{r.error}</span>;
  if (r.status === 'done' && r.outputs) {
    return (
      <ul className="outs">
        {r.outputs.map((o, i) => (
          <li key={i}>
            <button className={`out${o.over ? ' is-over' : ''}`} onClick={() => onSave(o)} title={`${d.common.download} ${r.name}${o.suffix}`}>
              <Icon name={o.over ? 'alert' : 'download'} />
              <span className="out-fmt">{FMT_LABEL[o.fmt]}{/_p(\d+)\./.exec(o.suffix) ? ` · ${t(d.common.page, { n: /_p(\d+)\./.exec(o.suffix)![1] })}` : ''}</span>
              <span className="out-size">{formatBytes(o.blob.size)}</span>
            </button>
            {o.over && <small className="st-warn">{t(a.overLimit, { size: formatBytes(o.blob.size) })}</small>}
            {o.kept && <small className="muted">{a.keptOriginal}</small>}
          </li>
        ))}
      </ul>
    );
  }
  return <span className="st muted">{d.common.ready}</span>;
}
