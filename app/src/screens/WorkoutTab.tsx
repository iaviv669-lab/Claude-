import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ClipboardList, Play, Plus, Zap } from 'lucide-react';
import { db } from '../data/schema';
import { getActiveSession, nextProgramWorkout, startSession } from '../data/repo';
import { Button, Card, Empty, Header, Page, SectionTitle } from '../components/ui';
import { Wordmark } from '../components/Logo';
import { fmtDate } from '../lib/time';

export function WorkoutTab() {
  const nav = useNavigate();
  const active = useLiveQuery(getActiveSession, []);
  const workouts = useLiveQuery(() => db.workouts.where('archived').equals(0).sortBy('name'), []);
  const items = useLiveQuery(() => db.workoutItems.toArray(), []);
  const programs = useLiveQuery(() => db.programs.where('archived').equals(0).toArray(), []);
  const program = programs?.find((p) => p.active);
  const next = useLiveQuery(async () => (program ? nextProgramWorkout(program) : null), [program?.id, program?.updatedAt]);
  const lastByWorkout = useLiveQuery(async () => {
    const m = new Map<string, string>();
    for (const s of await db.sessions.where('status').equals('completed').sortBy('startedAt')) if (s.workoutId) m.set(s.workoutId, s.localDate);
    return m;
  }, []);
  const count = (id: string) => items?.filter((i) => i.workoutId === id).length ?? 0;
  const byId = new Map((workouts ?? []).map((w) => [w.id, w]));
  const loose = (workouts ?? []).filter((w) => !w.programId);

  return (
    <>
      <Header title={<span className="block pl-2 text-accent"><Wordmark height={24} /></span>} />
      <Page>
        {active ? (
          <Card className="mb-4 border-accent bg-accent-soft">
            <p className="text-sm text-muted">In progress</p>
            <p className="text-lg">{active.name}</p>
            <Button variant="primary" className="mt-3" block onClick={() => nav('/session')}><Play size={18} />Resume</Button>
          </Card>
        ) : null}

        {program ? (
          <>
            <SectionTitle right={<button className="text-sm text-accent" onClick={() => nav(`/program/${program.id}`)}>Edit</button>}>{program.name}</SectionTitle>
            <div className="space-y-2">
              {program.days.map((d, i) => {
                const w = d ? byId.get(d) : undefined;
                const isNext = d && d === next;
                return w ? (
                  <Card as="button" key={i} onClick={() => nav(`/workout/${w.id}`)} className={`flex w-full items-center gap-3 ${isNext ? 'border-accent' : ''}`}>
                    <span className="w-10 text-xs text-muted">Day {i + 1}</span>
                    <span className="flex-1"><span className="block font-semibold">{w.name}</span><span className="text-xs text-muted">{count(w.id)} exercises{lastByWorkout?.get(w.id) ? ` · last ${fmtDate(lastByWorkout.get(w.id)!)}` : ''}</span></span>
                    {isNext ? <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-on-accent">Next</span> : <ChevronRight size={18} className="text-muted" />}
                  </Card>
                ) : (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted"><span className="w-10 text-xs">Day {i + 1}</span>Rest</div>
                );
              })}
            </div>
          </>
        ) : null}

        <SectionTitle right={<button className="flex items-center gap-1 text-sm text-accent" onClick={() => nav('/workout/new')}><Plus size={16} />New</button>}>My workouts</SectionTitle>
        {workouts && loose.length === 0 && !program ? (
          <Empty icon={<ClipboardList size={32} />} title="No saved workouts yet" body="Save the workouts you repeat, or just start a quick one and add exercises as you go."
            action={<div className="flex gap-2"><Button onClick={() => nav('/workout/new')}><Plus size={18} />New workout</Button><Button variant="primary" onClick={async () => { await startSession(null, 'Quick workout'); nav('/session'); }}><Zap size={18} />Quick start</Button></div>} />
        ) : (
          <div className="space-y-2">
            {loose.map((w) => (
              <Card as="button" key={w.id} onClick={() => nav(`/workout/${w.id}`)} className="flex w-full items-center gap-3">
                <span className="flex-1"><span className="block font-semibold">{w.name}</span><span className="text-xs text-muted">{count(w.id)} exercises{lastByWorkout?.get(w.id) ? ` · last ${fmtDate(lastByWorkout.get(w.id)!)}` : ''}</span></span>
                <ChevronRight size={18} className="text-muted" />
              </Card>
            ))}
            {!active ? <Button block className="mt-2" onClick={async () => { await startSession(null, 'Quick workout'); nav('/session'); }}><Zap size={18} />Quick workout</Button> : null}
          </div>
        )}

        {programs && programs.filter((p) => !p.active).length ? (
          <>
            <SectionTitle>Programs</SectionTitle>
            <div className="space-y-2">
              {programs.filter((p) => !p.active).map((p) => (
                <Card as="button" key={p.id} onClick={() => nav(`/program/${p.id}`)} className="flex w-full items-center"><span className="flex-1 font-semibold">{p.name}</span><ChevronRight size={18} className="text-muted" /></Card>
              ))}
            </div>
          </>
        ) : null}
      </Page>
    </>
  );
}
