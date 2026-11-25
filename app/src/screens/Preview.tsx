// S07
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { Copy, Link2, Pencil, Play } from 'lucide-react';
import { db, type Muscle } from '../data/schema';
import * as repo from '../data/repo';
import { Button, Card, Header, IconButton, Page, SectionTitle, Stat, confirmDialog, toast } from '../components/ui';
import { MUSCLE_LABEL } from '../data/seed';

export default function Preview() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const data = useLiveQuery(() => repo.getWorkout(id), [id]);
  const exs = useLiveQuery(async () => new Map((await db.exercises.toArray()).map((e) => [e.id, e])), []);
  const active = useLiveQuery(repo.getActiveSession, []);
  const settings = useLiveQuery(() => db.settings.get('me'), []);
  const typical = useLiveQuery(() => repo.typicalDurationMs(id), [id]);
  if (data === undefined) return <div className="p-8 text-center text-muted">Loading…</div>;
  if (data === null) return <><Header title="Workout" back="/" /><Page><p className="text-muted">This workout doesn’t exist any more.</p></Page></>;
  const { workout, items } = data;
  const muscles = new Map<Muscle, number>();
  for (const it of items) for (const m of exs?.get(it.exerciseId)?.primaryMuscles ?? []) muscles.set(m, (muscles.get(m) ?? 0) + it.targetSets);
  const sets = items.reduce((a, i) => a + i.targetSets, 0);
  // rough estimate: 40 s per set plus rest
  const estMin = Math.round(items.reduce((a, it) => {
    const e = exs?.get(it.exerciseId);
    const rest = it.restSec ?? e?.restOverrideSec ?? (e && settings ? settings.restDefaults[e.type] ?? 90 : 90);
    return a + it.targetSets * (40 + rest);
  }, 0) / 60);
  const start = async () => {
    if (active && active.workoutId !== id) {
      if (!(await confirmDialog({ title: 'A workout is already running', body: `Resume “${active.name}” instead?`, ok: 'Resume' }))) return;
    }
    await repo.startSession(id);
    nav('/session');
  };
  return (
    <>
      <Header title={workout.name} back right={<>
        <IconButton label="Duplicate" onClick={async () => { const nid = await repo.duplicateWorkout(id); toast('Copied'); if (nid) nav(`/workout/${nid}/edit`); }}><Copy size={20} /></IconButton>
        <IconButton label="Edit" onClick={() => nav(`/workout/${id}/edit`)}><Pencil size={20} /></IconButton>
      </>} />
      <Page>
        <div className="flex gap-2"><Stat label="Exercises" value={items.length} /><Stat label="Sets" value={sets} /><Stat label={typical ? 'Usually' : 'About'} value={`${typical ? Math.round(typical / 60000) : estMin} min`} sub={typical ? 'from your past sessions' : 'estimate'} /></div>
        <SectionTitle>Targets</SectionTitle>
        <div className="flex flex-wrap gap-1.5">
          {[...muscles.entries()].sort((a, b) => b[1] - a[1]).map(([m, n]) => <span key={m} className="rounded-full bg-surface-2 px-3 py-1 text-xs">{MUSCLE_LABEL[m]} <span className="num text-muted">{n}</span></span>)}
        </div>
        <SectionTitle>Exercises</SectionTitle>
        <div className="space-y-1">
          {items.map((it) => (
            <Card key={it.id} className="flex items-center gap-3 px-3 py-2">
              {it.supersetGroup ? <Link2 size={16} className="text-accent" /> : null}
              <div className="min-w-0 flex-1"><p className="truncate font-semibold">{exs?.get(it.exerciseId)?.name}</p><p className="num text-xs text-muted">{it.targetSets} sets · {it.repMin === it.repMax ? it.repMin : `${it.repMin}–${it.repMax}`} reps{it.targetRir != null ? ` · ${it.targetRir} RIR` : ''}</p></div>
            </Card>
          ))}
        </div>
      </Page>
      <div className="fixed inset-x-0 bottom-20 z-20 px-4"><div className="mx-auto max-w-app"><Button variant="primary" size="lg" block onClick={start}><Play size={20} />{active?.workoutId === id ? 'Resume workout' : 'Start workout'}</Button></div></div>
    </>
  );
}
