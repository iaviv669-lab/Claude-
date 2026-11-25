// S05: build / edit a saved workout
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Link2, Link2Off, MoreVertical, Plus, Trash2 } from 'lucide-react';
import { db, newId } from '../data/schema';
import * as repo from '../data/repo';
import { Button, Empty, Field, Header, IconButton, MenuItem, Page, Sheet, confirmDialog, inputCls, toast } from '../components/ui';
import { ExercisePicker } from '../components/ExercisePicker';
import { MUSCLE_LABEL } from '../data/seed';

export default function Builder() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const settings = useLiveQuery(() => db.settings.get('me'), []);
  const gyms = useLiveQuery(() => db.gyms.toArray(), []);
  const exs = useLiveQuery(async () => new Map((await db.exercises.toArray()).map((e) => [e.id, e])), []);
  const [name, setName] = useState('');
  const [gymId, setGymId] = useState<string | null>(null);
  const [items, setItems] = useState<repo.ItemDraft[]>([]);
  const [loaded, setLoaded] = useState(!id);
  const [picker, setPicker] = useState(false);
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [edit, setEdit] = useState<number | null>(null);
  const programId = params.get('program');

  useEffect(() => {
    if (!id) return;
    repo.getWorkout(id).then((w) => {
      if (!w) return;
      setName(w.workout.name); setGymId(w.workout.gymId);
      setItems(w.items.map(({ id: iid, exerciseId, supersetGroup, targetSets, repMin, repMax, targetRir, restSec }) => ({ id: iid, exerciseId, supersetGroup, targetSets, repMin, repMax, targetRir, restSec })));
      setLoaded(true);
    });
  }, [id]);
  useEffect(() => { if (!id && settings && gymId == null) setGymId(settings.activeGymId); }, [id, settings, gymId]);

  const move = (i: number, d: -1 | 1) => setItems((it) => { const a = [...it]; [a[i], a[i + d]] = [a[i + d], a[i]]; return repo.normaliseSupersets(a); });
  const superset = (i: number, j: number) => setItems((it) => { const a = it.map((x) => ({ ...x })); const g = a[i].supersetGroup ?? a[j].supersetGroup ?? newId(); a[i].supersetGroup = g; a[j].supersetGroup = g; return a; });
  const save = async () => {
    if (!name.trim()) { toast('Give the workout a name'); return; }
    if (!items.length) { toast('Add at least one exercise'); return; }
    const wid = await repo.saveWorkout({ id, name: name.trim(), gymId, ...(programId ? { programId } : {}) }, items);
    if (programId) {
      const p = await db.programs.get(programId);
      if (p) { const days = [...p.days]; const slot = Number(params.get('day') ?? days.indexOf(null)); if (slot >= 0 && slot < days.length) days[slot] = wid; else days.push(wid); await repo.saveProgram({ ...p, days }); }
      nav(`/program/${programId}`, { replace: true });
    } else nav(`/workout/${wid}`, { replace: true });
    toast('Workout saved');
  };
  if (!loaded) return <div className="p-8 text-center text-muted">Loading…</div>;
  const it = menuFor != null ? items[menuFor] : null;
  const ed = edit != null ? items[edit] : null;

  return (
    <>
      <Header title={id ? 'Edit workout' : 'New workout'} back right={<Button variant="primary" size="sm" onClick={save}>Save</Button>} />
      <Page>
        <div className="space-y-4">
          <Field label="Name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Upper A, Leg day" autoFocus={!id} /></Field>
          {gyms && gyms.length > 1 ? (
            <Field label="Gym"><select className={inputCls} value={gymId ?? ''} onChange={(e) => setGymId(e.target.value || null)}>{gyms.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></Field>
          ) : null}
        </div>
        <div className="mb-2 mt-6 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{items.length} exercise{items.length === 1 ? '' : 's'}</h2>
          <Button size="sm" variant="ghost" className="text-accent" onClick={() => setPicker(true)}><Plus size={16} />Add</Button>
        </div>
        {items.length === 0 ? <Empty title="No exercises yet" body="Add the movements for this workout. You can set sets and reps for each." action={<Button variant="primary" onClick={() => setPicker(true)}><Plus size={18} />Add exercises</Button>} /> : null}
        <ol className="space-y-1">
          {items.map((x, i) => {
            const e = exs?.get(x.exerciseId);
            const linkedPrev = i > 0 && x.supersetGroup && items[i - 1].supersetGroup === x.supersetGroup;
            return (
              <li key={x.id ?? `${x.exerciseId}-${i}`} className={`flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 ${linkedPrev ? '-mt-1 rounded-t-none border-t-0' : ''}`}>
                {x.supersetGroup ? <Link2 size={16} className="text-accent" aria-label="Superset" /> : <span className="num w-4 text-center text-xs text-muted">{i + 1}</span>}
                <button className="min-w-0 flex-1 text-left" onClick={() => setEdit(i)}>
                  <p className="truncate font-semibold">{e?.name ?? '…'}</p>
                  <p className="num text-xs text-muted">{x.targetSets} × {x.repMin === x.repMax ? x.repMin : `${x.repMin}–${x.repMax}`}{x.targetRir != null ? ` · ${x.targetRir} RIR` : ''}{x.restSec ? ` · rest ${Math.floor(x.restSec / 60)}:${String(x.restSec % 60).padStart(2, '0')}` : ''}</p>
                </button>
                <IconButton label={`Options for ${e?.name ?? 'exercise'}`} onClick={() => setMenuFor(i)}><MoreVertical size={18} /></IconButton>
              </li>
            );
          })}
        </ol>
        {id ? (
          <Button variant="ghost" className="mt-8 text-danger" onClick={async () => {
            if (await confirmDialog({ title: 'Delete this workout?', body: 'Past sessions stay in your history.', ok: 'Delete', danger: true })) { await repo.deleteWorkout(id); nav('/', { replace: true }); }
          }}><Trash2 size={16} />Delete workout</Button>
        ) : null}
      </Page>

      <ExercisePicker open={picker} onClose={() => setPicker(false)} gymId={gymId} onPick={(ids) => setItems((a) => [...a, ...ids.map(repo.defaultItem)])} />

      <Sheet open={it != null} onClose={() => setMenuFor(null)} title={it ? exs?.get(it.exerciseId)?.name ?? '' : ''}>
        {it && menuFor != null ? (
          <>
            {it.supersetGroup
              ? <MenuItem icon={<Link2Off size={20} />} onClick={() => { setItems((a) => repo.normaliseSupersets(a.map((x, k) => (k === menuFor ? { ...x, supersetGroup: null } : x)))); setMenuFor(null); }}>Remove from superset</MenuItem>
              : <>
                  {menuFor > 0 ? <MenuItem icon={<Link2 size={20} />} onClick={() => { superset(menuFor, menuFor - 1); setMenuFor(null); }}>Superset with the one above</MenuItem> : null}
                  {menuFor < items.length - 1 ? <MenuItem icon={<Link2 size={20} />} onClick={() => { superset(menuFor, menuFor + 1); setMenuFor(null); }}>Superset with the one below</MenuItem> : null}
                </>}
            {menuFor > 0 ? <MenuItem icon={<ArrowUp size={20} />} onClick={() => { move(menuFor, -1); setMenuFor(null); }}>Move up</MenuItem> : null}
            {menuFor < items.length - 1 ? <MenuItem icon={<ArrowDown size={20} />} onClick={() => { move(menuFor, 1); setMenuFor(null); }}>Move down</MenuItem> : null}
            <MenuItem icon={<Trash2 size={20} />} danger onClick={() => { setItems((a) => repo.normaliseSupersets(a.filter((_, k) => k !== menuFor))); setMenuFor(null); }}>Remove</MenuItem>
          </>
        ) : null}
      </Sheet>

      {ed && edit != null ? <TargetsSheet item={ed} name={exs?.get(ed.exerciseId)?.name ?? ''} muscles={(exs?.get(ed.exerciseId)?.primaryMuscles ?? []).map((m) => MUSCLE_LABEL[m]).join(', ')}
        onClose={() => setEdit(null)} onSave={(patch) => { setItems((a) => a.map((x, k) => (k === edit ? { ...x, ...patch } : x))); setEdit(null); }} /> : null}
    </>
  );
}

function TargetsSheet({ item, name, muscles, onClose, onSave }: { item: repo.ItemDraft; name: string; muscles: string; onClose: () => void; onSave: (p: Partial<repo.ItemDraft>) => void }) {
  const [sets, setSets] = useState(String(item.targetSets));
  const [lo, setLo] = useState(String(item.repMin));
  const [hi, setHi] = useState(String(item.repMax));
  const [rir, setRir] = useState(item.targetRir == null ? '' : String(item.targetRir));
  const [rest, setRest] = useState(item.restSec == null ? '' : String(item.restSec));
  const n = (s: string, d: number) => { const v = parseInt(s, 10); return Number.isFinite(v) && v >= 0 ? v : d; };
  return (
    <Sheet open onClose={onClose} title={name} footer={<Button variant="primary" block onClick={() => {
      const a = Math.max(1, n(lo, 8)), b = Math.max(a, n(hi, a));
      onSave({ targetSets: Math.min(20, Math.max(1, n(sets, 3))), repMin: a, repMax: b, targetRir: rir === '' ? null : Math.min(5, n(rir, 2)), restSec: rest === '' ? null : n(rest, 90) });
    }}>Save targets</Button>}>
      <p className="mb-3 text-sm text-muted">{muscles}</p>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Sets"><input className={inputCls} inputMode="numeric" value={sets} onChange={(e) => setSets(e.target.value)} /></Field>
        <Field label="Min reps"><input className={inputCls} inputMode="numeric" value={lo} onChange={(e) => setLo(e.target.value)} /></Field>
        <Field label="Max reps"><input className={inputCls} inputMode="numeric" value={hi} onChange={(e) => setHi(e.target.value)} /></Field>
        <Field label="Target RIR" hint="Reps left in the tank"><input className={inputCls} inputMode="numeric" value={rir} placeholder="–" onChange={(e) => setRir(e.target.value)} /></Field>
        <Field label="Rest (sec)" hint="Blank = default"><input className={inputCls} inputMode="numeric" value={rest} placeholder="auto" onChange={(e) => setRest(e.target.value)} /></Field>
      </div>
    </Sheet>
  );
}
