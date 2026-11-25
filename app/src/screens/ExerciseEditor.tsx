// S19
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { db, type Equipment, type Exercise, type ExerciseType, type Laterality, type Muscle, type MovementPattern, type TrackedMetric } from '../data/schema';
import * as repo from '../data/repo';
import { Button, Chip, Field, Header, Page, SectionTitle, Toggle, confirmDialog, inputCls, toast } from '../components/ui';
import { ALL_EQUIPMENT, ALL_MUSCLES, EQUIPMENT_LABEL, MUSCLE_LABEL, TYPE_LABEL } from '../data/seed';

const PATTERNS: MovementPattern[] = ['horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull', 'squat', 'hinge', 'lunge', 'carry', 'isolation', 'core'];
const pretty = (s: string) => s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

export default function ExerciseEditor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [e, setE] = useState<Partial<Exercise>>({ name: params.get('name') ?? '', type: 'isolation_upper', pattern: 'isolation', laterality: 'bilateral', trackedMetric: 'weight_reps', primaryMuscles: [], secondaryMuscles: [], equipment: [], isBodyweight: false, bodyweightPct: 0, notes: '', aliases: [] });
  const [rest, setRest] = useState('');
  useEffect(() => { if (id) db.exercises.get(id).then((x) => { if (x) { setE(x); setRest(x.restOverrideSec ? String(x.restOverrideSec) : ''); } }); }, [id]);
  const set = <K extends keyof Exercise>(k: K, v: Exercise[K]) => setE((p) => ({ ...p, [k]: v }));
  const cycle = (m: Muscle) => {
    const p = e.primaryMuscles ?? [], s = e.secondaryMuscles ?? [];
    if (p.includes(m)) setE({ ...e, primaryMuscles: p.filter((x) => x !== m), secondaryMuscles: [...s, m] });
    else if (s.includes(m)) setE({ ...e, secondaryMuscles: s.filter((x) => x !== m) });
    else setE({ ...e, primaryMuscles: [...p, m] });
  };
  const save = async () => {
    if (!e.name?.trim()) { toast('Name it first'); return; }
    if (!e.primaryMuscles?.length) { toast('Pick at least one main muscle'); return; }
    const r = parseInt(rest, 10);
    const saved = await repo.saveExercise({ ...e, name: e.name.trim(), restOverrideSec: Number.isFinite(r) && r > 0 ? r : null, equipment: e.equipment?.length ? e.equipment : ['bodyweight'] } as Exercise);
    toast(id ? 'Saved' : 'Exercise created');
    if (id) nav(-1); else nav(`/exercise/${saved.id}`, { replace: true });
  };
  const builtIn = !!id && e.isCustom === 0;
  return (
    <>
      <Header title={id ? 'Edit exercise' : 'New exercise'} back right={<Button size="sm" variant="primary" onClick={save}>Save</Button>} />
      <Page>
        <div className="space-y-4">
          <Field label="Name"><input className={inputCls} value={e.name} onChange={(ev) => set('name', ev.target.value)} disabled={builtIn} autoFocus={!id} /></Field>
          {builtIn ? <p className="text-xs text-muted">Built-in exercise: you can change notes and rest, not the basics.</p> : null}
          {!builtIn ? <>
            <Field label="Type"><select className={inputCls} value={e.type} onChange={(ev) => set('type', ev.target.value as ExerciseType)}>{Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Movement"><select className={inputCls} value={e.pattern} onChange={(ev) => set('pattern', ev.target.value as MovementPattern)}>{PATTERNS.map((p) => <option key={p} value={p}>{pretty(p)}</option>)}</select></Field>
              <Field label="Sides"><select className={inputCls} value={e.laterality} onChange={(ev) => set('laterality', ev.target.value as Laterality)}>{['bilateral', 'unilateral', 'asymmetrical', 'both'].map((p) => <option key={p} value={p}>{pretty(p)}</option>)}</select></Field>
            </div>
            <Field label="Track"><select className={inputCls} value={e.trackedMetric} onChange={(ev) => set('trackedMetric', ev.target.value as TrackedMetric)}><option value="weight_reps">Weight × reps</option><option value="reps">Reps only</option><option value="time">Time (seconds)</option></select></Field>
            <div>
              <SectionTitle>Muscles: tap once = main, twice = also works, three times = off</SectionTitle>
              <div className="flex flex-wrap gap-1.5">
                {ALL_MUSCLES.map((m) => {
                  const p = e.primaryMuscles?.includes(m), s = e.secondaryMuscles?.includes(m);
                  return <Chip key={m} on={p || s} onClick={() => cycle(m)} className={s ? 'opacity-70' : ''}>{p ? 'Main · ' : s ? 'Also · ' : ''}{MUSCLE_LABEL[m]}</Chip>;
                })}
              </div>
            </div>
            <div>
              <SectionTitle>Equipment</SectionTitle>
              <div className="flex flex-wrap gap-1.5">
                {ALL_EQUIPMENT.map((q) => <Chip key={q} on={e.equipment?.includes(q)} onClick={() => set('equipment', e.equipment?.includes(q) ? e.equipment.filter((x) => x !== q) : [...(e.equipment ?? []), q] as Equipment[])}>{EQUIPMENT_LABEL[q]}</Chip>)}
              </div>
            </div>
            <Toggle label="Bodyweight exercise" hint="Your body is the main load (dips, pull-ups…)" checked={!!e.isBodyweight} onChange={(v) => setE({ ...e, isBodyweight: v, bodyweightPct: v ? e.bodyweightPct || 1 : 0 })} />
            {e.isBodyweight ? <Field label="Share of bodyweight moved (%)" hint="Push-up ≈ 65, dip or pull-up = 100"><input className={inputCls} inputMode="numeric" value={Math.round((e.bodyweightPct ?? 0) * 100)} onChange={(ev) => set('bodyweightPct', Math.min(100, Number(ev.target.value.replace(/\D/g, '')) || 0) / 100)} /></Field> : null}
            <Field label="Other names" hint="Comma separated, helps search"><input className={inputCls} value={(e.aliases ?? []).join(', ')} onChange={(ev) => set('aliases', ev.target.value.split(',').map((x) => x.trim()).filter(Boolean))} /></Field>
          </> : null}
          <Field label="Rest between sets (seconds)" hint="Blank = your default for this type"><input className={inputCls} inputMode="numeric" value={rest} onChange={(ev) => setRest(ev.target.value.replace(/\D/g, ''))} /></Field>
          <Field label="Notes"><textarea className={`${inputCls} h-24 py-2`} value={e.notes} onChange={(ev) => set('notes', ev.target.value)} placeholder="Cues, setup, seat position" /></Field>
        </div>
        {id && !builtIn ? (
          <Button variant="ghost" className="mt-8 text-danger" onClick={async () => {
            if (!(await confirmDialog({ title: 'Delete this exercise?', body: 'If it’s in your history it will be hidden instead, so your charts stay intact.', ok: 'Delete', danger: true }))) return;
            const r = await repo.deleteExercise(id); toast(r === 'archived' ? 'Hidden (it’s in your history)' : 'Deleted'); nav('/settings/exercises', { replace: true });
          }}><Trash2 size={16} />Delete exercise</Button>
        ) : null}
      </Page>
    </>
  );
}
