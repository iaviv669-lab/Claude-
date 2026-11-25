// S16: past workout, view + edit
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import { db, type Unit } from '../data/schema';
import * as repo from '../data/repo';
import { Button, Card, Field, Header, IconButton, Page, Sheet, Stat, confirmDialog, inputCls, toast } from '../components/ui';
import { fmtDuration } from '../lib/time';
import { fmtVolume, fmtWeight, parseNum, toKg } from '../lib/units';
import { isWorking } from '../lib/e1rm';

type Tree = NonNullable<Awaited<ReturnType<typeof repo.getSessionTree>>>;

export function SetList({ tree, unit, names, editable }: { tree: Tree; unit: Unit; names?: Map<string, string>; editable?: boolean }) {
  return (
    <div className="space-y-2">
      {tree.exercises.map(({ se, sets }) => (
        <Card key={se.id} className="p-3">
          <p className="mb-1 font-semibold">{names?.get(se.exerciseId) ?? '…'}</p>
          {se.notes ? <p className="mb-1 text-xs text-muted">{se.notes}</p> : null}
          <ol className="space-y-1">
            {sets.map((s, i) => <SetLine key={s.id} set={s} n={i + 1} unit={unit} editable={editable} />)}
          </ol>
        </Card>
      ))}
      {tree.exercises.length === 0 ? <p className="text-sm text-muted">No sets were logged.</p> : null}
    </div>
  );
}

function SetLine({ set, n, unit, editable }: { set: Tree['exercises'][0]['sets'][0]; n: number; unit: Unit; editable?: boolean }) {
  const [w, setW] = useState<string | null>(null);
  const [r, setR] = useState('');
  const tag = set.type === 'warmup' ? 'W' : set.type === 'drop' ? 'D' : set.type === 'myo' ? 'M' : set.type === 'failure' ? 'F' : String(n);
  const text = set.entries.map((e) => `${e.weightKg ? `${fmtWeight(e.weightKg, unit)} ${unit} × ` : ''}${e.reps ?? 0}${e.partialReps ? ` (+${e.partialReps}p)` : ''}`).join(' → ');
  if (w != null) {
    return (
      <li className="flex items-center gap-2">
        <span className="w-6 text-center text-xs text-muted">{tag}</span>
        <input aria-label="Weight" className={`${inputCls} h-9 w-20`} inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} />
        <span className="text-muted">×</span>
        <input aria-label="Reps" className={`${inputCls} h-9 w-16`} inputMode="numeric" value={r} onChange={(e) => setR(e.target.value)} />
        <Button size="sm" variant="primary" onClick={async () => {
          const wv = parseNum(w), rv = parseNum(r);
          await repo.updateSet(set.id, { entries: [{ ...set.entries[0], weightKg: wv == null ? null : toKg(wv, unit), reps: rv == null ? null : Math.round(rv) }, ...set.entries.slice(1)] });
          setW(null);
        }}>Save</Button>
        <IconButton label="Delete set" onClick={() => repo.removeSet(set.id)}><Trash2 size={16} /></IconButton>
      </li>
    );
  }
  return (
    <li className={`num flex items-center gap-2 text-sm ${isWorking(set) ? '' : 'text-muted'}`}>
      <span className="w-6 text-center text-xs text-muted">{tag}</span>
      <span className="flex-1">{text}{set.rir != null ? <span className="text-muted"> · {set.rir} RIR</span> : null}</span>
      {editable ? <IconButton label={`Edit set ${n}`} className="h-8 w-8" onClick={() => { setW(set.entries[0].weightKg != null ? fmtWeight(set.entries[0].weightKg, unit) : ''); setR(String(set.entries[0].reps ?? '')); }}><Pencil size={14} /></IconButton> : null}
    </li>
  );
}

export default function SessionDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const settings = useLiveQuery(() => db.settings.get('me'), []);
  const tree = useLiveQuery(() => repo.getSessionTree(id), [id]);
  const summary = useLiveQuery(() => repo.sessionSummary(id), [id, tree]);
  const names = useLiveQuery(async () => new Map((await db.exercises.toArray()).map((e) => [e.id, e.name])), []);
  const [editTime, setEditTime] = useState(false);
  const [date, setDate] = useState('');
  const [mins, setMins] = useState('');
  const unit = settings?.unit ?? 'kg';
  if (tree === undefined) return <div className="p-8 text-center text-muted">Loading…</div>;
  if (tree === null) return <><Header title="Workout" back="/history" /><Page><p className="text-muted">This workout was deleted.</p></Page></>;
  const s = tree.session;
  const toLocalInput = (ms: number) => { const d = new Date(ms); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  return (
    <>
      <Header title={s.name} back sub={new Date(s.startedAt).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
        right={<IconButton label="Delete workout" onClick={async () => {
          if (await confirmDialog({ title: 'Delete this workout?', body: 'Its sets will be removed from your history and charts.', ok: 'Delete', danger: true })) { await repo.deleteSession(id); toast('Workout deleted'); nav('/history', { replace: true }); }
        }}><Trash2 size={20} /></IconButton>} />
      <Page>
        {summary ? (
          <div className="flex gap-2">
            <Stat label="Duration" value={fmtDuration(summary.durationMs)} />
            <Stat label="Sets" value={summary.sets} />
            <Stat label="Volume" value={fmtVolume(summary.volumeKg, unit)} />
          </div>
        ) : null}
        <Button size="sm" variant="ghost" className="mt-2 text-accent" onClick={() => { setDate(toLocalInput(s.startedAt)); setMins(String(Math.round(repo.elapsedMs(s) / 60000))); setEditTime(true); }}><Pencil size={14} />Edit date & duration</Button>
        <div className="mt-4"><SetList tree={tree} unit={unit} names={names} editable /></div>
      </Page>
      <Sheet open={editTime} onClose={() => setEditTime(false)} title="Date & duration" footer={
        <Button variant="primary" block onClick={async () => { const start = new Date(date).getTime(); const m = parseNum(mins); if (!Number.isFinite(start) || m == null) { toast('Check the date and minutes'); return; } await repo.editSessionTimes(id, start, m * 60000); setEditTime(false); }}>Save</Button>
      }>
        <div className="space-y-4">
          <Field label="Started"><input type="datetime-local" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Duration (minutes)"><input inputMode="numeric" className={inputCls} value={mins} onChange={(e) => setMins(e.target.value)} /></Field>
        </div>
      </Sheet>
    </>
  );
}
