'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useI18n } from '@/i18n';
import Icon from '../Icon';
import { saveBlob, uid } from '@/lib/files';

type Member = { id: string; name: string };
type GroupInput = { id: string; leader: string; members: Member[] };
type Group = { id: string; no: number; leader: string; members: string[]; grade: string };
type State = {
  course: string;
  teacher: string;
  topic: string;
  inputs: GroupInput[];
  view: 'edit' | 'result';
  order: Group[];
  shuffledAt: number | null;
};

const KEY = 'sb-shuffle-v1';
const emptyGroup = (): GroupInput => ({ id: uid(), leader: '', members: [{ id: uid(), name: '' }] });
const initial = (): State => ({ course: '', teacher: '', topic: '', inputs: [emptyGroup()], view: 'edit', order: [], shuffledAt: null });

/** Unbiased random integer in [0, n) from the browser's cryptographic RNG. */
function randInt(n: number) {
  const limit = Math.floor(0x1_0000_0000 / n) * n;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf); while (buf[0] >= limit);
  return buf[0] % n;
}
function fairShuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function Shuffle() {
  const { d, t } = useI18n();
  const s = d.shuffle;
  const [st, setSt] = useState<State>(initial);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [focusId, setFocusId] = useState<string | null>(null);
  const focusRef = useRef<HTMLInputElement | null>(null);

  // Persist everything locally so a refresh in the middle of class loses nothing.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSt({ ...initial(), ...JSON.parse(raw) });
    } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {}
  }, [st, loaded]);
  useEffect(() => { if (focusId) { focusRef.current?.focus(); setFocusId(null); } }, [focusId]);

  const set = (p: Partial<State>) => setSt((x) => ({ ...x, ...p }));
  const setInputs = (fn: (g: GroupInput[]) => GroupInput[]) => setSt((x) => ({ ...x, inputs: fn(x.inputs) }));

  const addMember = (gid: string) => {
    const id = uid();
    setInputs((gs) => gs.map((g) => (g.id === gid ? { ...g, members: [...g.members, { id, name: '' }] } : g)));
    setFocusId(id);
  };

  const save = () => {
    setError('');
    const valid: Group[] = [];
    st.inputs.forEach((g, i) => {
      let leader = g.leader.trim();
      let members = g.members.map((m) => m.name.trim()).filter(Boolean);
      if (!leader && !members.length) return;
      if (!leader) { leader = members[0]; members = members.slice(1); }
      valid.push({ id: g.id, no: i + 1, leader, members, grade: '' });
    });
    if (!valid.length) { setError(s.errorEmpty); return; }

    // Editing keeps the existing order and grades; new groups join at the end, removed ones disappear.
    const byId = new Map(valid.map((g) => [g.id, g]));
    const kept = st.order.filter((g) => byId.has(g.id)).map((g) => ({ ...byId.get(g.id)!, grade: g.grade }));
    const keptIds = new Set(kept.map((g) => g.id));
    const order = [...kept, ...valid.filter((g) => !keptIds.has(g.id))];
    set({ order, view: 'result' });
  };

  const shuffle = () => set({ order: fairShuffle(st.order), shuffledAt: Date.now() });
  const reset = () => { if (confirm(s.resetConfirm)) { setSt(initial()); setError(''); } };

  const exportExcel = async () => {
    const XLSX = await import('xlsx-js-style');
    const x = s.xl;
    const border = { top: { style: 'thin', color: { rgb: 'D0D4DE' } }, bottom: { style: 'thin', color: { rgb: 'D0D4DE' } }, left: { style: 'thin', color: { rgb: 'D0D4DE' } }, right: { style: 'thin', color: { rgb: 'D0D4DE' } } };
    const label = { font: { bold: true, color: { rgb: '6B6E7A' } } };
    const head = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '17181C' } }, alignment: { horizontal: 'center', vertical: 'center' }, border };
    const cell = (v: string | number, extra: object = {}) => ({ v, t: typeof v === 'number' ? 'n' : 's', s: { alignment: { vertical: 'top', wrapText: true }, border, ...extra } });
    const rows: unknown[][] = [
      [{ v: x.details, t: 's', s: { font: { bold: true, sz: 14 } } }],
      [{ v: x.course, t: 's', s: label }, st.course],
      [{ v: x.title, t: 's', s: label }, st.topic],
      [{ v: x.teacher, t: 's', s: label }, st.teacher],
      [{ v: x.date, t: 's', s: label }, new Date().toLocaleDateString()],
      [],
      [x.no, x.group, x.members, x.grade].map((h) => ({ v: h, t: 's', s: head })),
      ...st.order.map((g, i) => [
        cell(i + 1, { alignment: { horizontal: 'center', vertical: 'top' } }),
        cell(t(s.group, { n: g.no })),
        cell([`${g.leader} (${x.leader})`, ...g.members].join('\n')),
        cell(g.grade, { alignment: { horizontal: 'center', vertical: 'top' } }),
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 8 }, { wch: 14 }, { wch: 42 }, { wch: 10 }];
    ws['!rows'] = rows.map((_, i) => (i >= 7 ? { hpt: 16 * (1 + st.order[i - 7].members.length) } : {}));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Order');
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    const file = `${(st.course || 'presentation').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_')}_order.xlsx`;
    saveBlob(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), file);
  };

  return (
    <div className="page">
      <header className="page-head rise">
        <h1 className="display">{s.title}</h1>
        <p>{s.subtitle}</p>
      </header>

      {st.view === 'edit' ? (
        <div className="shuffle-edit rise">
          <section className="card">
            <h2 className="sec-title"><Icon name="info" />{s.course}</h2>
            <div className="course-grid">
              <div className="span-2">
                <label className="label" htmlFor="sh-course">{s.courseName}</label>
                <input id="sh-course" className="field" placeholder={s.courseNamePh} value={st.course} onChange={(e) => set({ course: e.target.value })} />
              </div>
              <div>
                <label className="label" htmlFor="sh-teacher">{s.teacher}</label>
                <input id="sh-teacher" className="field" placeholder={s.teacherPh} value={st.teacher} onChange={(e) => set({ teacher: e.target.value })} />
              </div>
              <div className="span-3">
                <label className="label" htmlFor="sh-topic">{s.topic}</label>
                <input id="sh-topic" className="field" placeholder={s.topicPh} value={st.topic} onChange={(e) => set({ topic: e.target.value })} />
              </div>
            </div>
          </section>

          <h2 className="sec-title out"><Icon name="users" />{s.groups}</h2>
          <div className="group-list">
            <AnimatePresence initial={false}>
              {st.inputs.map((g, gi) => (
                <motion.section
                  key={g.id}
                  className="card group-card"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  layout
                >
                  <div className="group-head">
                    <h3>{t(s.group, { n: gi + 1 })}</h3>
                    {st.inputs.length > 1 && (
                      <button className="btn btn-icon btn-sm btn-ghost btn-danger" onClick={() => setInputs((gs) => gs.filter((x) => x.id !== g.id))} aria-label={s.removeGroup}>
                        <Icon name="trash" />
                      </button>
                    )}
                  </div>
                  <label className="label" htmlFor={`l-${g.id}`}><Icon name="crown" className="label-ico" /> {s.leader}</label>
                  <input id={`l-${g.id}`} className="field" placeholder={s.leaderPh} value={g.leader}
                    onChange={(e) => setInputs((gs) => gs.map((x) => (x.id === g.id ? { ...x, leader: e.target.value } : x)))} />
                  <span className="label" style={{ marginTop: 16 }}>{s.members}</span>
                  <div className="member-list">
                    {g.members.map((m, mi) => (
                      <div key={m.id} className="member-row">
                        <span className="member-n">{mi + 1}</span>
                        <input
                          ref={m.id === focusId ? focusRef : undefined}
                          className="field field-sm"
                          placeholder={s.memberPh}
                          value={m.name}
                          onChange={(e) => setInputs((gs) => gs.map((x) => (x.id === g.id ? { ...x, members: x.members.map((y) => (y.id === m.id ? { ...y, name: e.target.value } : y)) } : x)))}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMember(g.id); } }}
                        />
                        <button className="btn btn-icon btn-sm btn-ghost btn-danger" disabled={g.members.length === 1}
                          onClick={() => setInputs((gs) => gs.map((x) => (x.id === g.id ? { ...x, members: x.members.filter((y) => y.id !== m.id) } : x)))}
                          aria-label={d.common.remove}>
                          <Icon name="x" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button className="btn btn-sm btn-ghost add-member" onClick={() => addMember(g.id)}><Icon name="plus" /> {s.addMember}</button>
                </motion.section>
              ))}
            </AnimatePresence>
          </div>

          <div className="row" style={{ justifyContent: 'space-between', marginTop: 18 }}>
            <button className="btn" onClick={() => setInputs((gs) => [...gs, emptyGroup()])}><Icon name="plus" /> {s.addGroup}</button>
            <button className="btn btn-ghost btn-danger btn-sm" onClick={reset}>{s.reset}</button>
          </div>

          {error && <div className="notice err" style={{ marginTop: 18 }}><Icon name="alert" />{error}</div>}
          <button className="btn btn-primary btn-lg save-groups" onClick={save}><Icon name="check" /> {s.save}</button>
        </div>
      ) : (
        <div className="shuffle-result rise">
          <div className="card shuffle-bar">
            <button className="btn" onClick={() => set({ view: 'edit' })}><Icon name="arrowL" /> {s.edit}</button>
            <div className="shuffle-mid">
              <button className="btn btn-primary btn-lg" onClick={shuffle}><Icon name="shuffle" /> {s.shuffle}</button>
              <small className="muted">
                {st.shuffledAt ? t(s.lastShuffle, { time: new Date(st.shuffledAt).toLocaleTimeString() }) : s.notShuffled}
              </small>
            </div>
            <button className="btn" onClick={exportExcel}><Icon name="sheet" /> {s.export}</button>
          </div>

          {(st.course || st.topic || st.teacher) && (
            <div className="course-line">
              {st.course && <strong>{st.course}</strong>}
              {st.topic && <span>{st.topic}</span>}
              {st.teacher && <span className="muted">{st.teacher}</span>}
            </div>
          )}

          <div className="order-grid">
            {st.order.map((g, i) => (
              <motion.article key={g.id} layout transition={{ type: 'spring', stiffness: 260, damping: 26 }} className="card order-card">
                <div className="order-head">
                  <span className="order-no">{i + 1}</span>
                  <h3>{t(s.group, { n: g.no })}</h3>
                  <label className="grade">
                    <span>{s.grade}</span>
                    <input className="field field-sm" value={g.grade} placeholder="—"
                      onChange={(e) => set({ order: st.order.map((x) => (x.id === g.id ? { ...x, grade: e.target.value } : x)) })} />
                  </label>
                </div>
                <ul className="order-members">
                  <li className="is-leader"><Icon name="crown" /><span>{g.leader}</span><em>{s.leader}</em></li>
                  {g.members.map((m, mi) => <li key={mi}><i /><span>{m}</span></li>)}
                </ul>
              </motion.article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
