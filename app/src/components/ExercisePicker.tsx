import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Plus, Search } from 'lucide-react';
import { db, type Id, type Muscle } from '../data/schema';
import { matchExercise } from '../data/repo';
import { ALL_MUSCLES, EQUIPMENT_LABEL, MUSCLE_LABEL } from '../data/seed';
import { Button, Chip, Sheet, inputCls, toast } from './ui';
import { ExerciseFields, useExerciseDraft } from './ExerciseForm';

/** S06. Multi-select (or single when `single`) exercise picker. */
export function ExercisePicker({ open, onClose, onPick, single, title = 'Add exercises', gymId }: { open: boolean; onClose: () => void; onPick: (ids: Id[]) => void; single?: boolean; title?: string; gymId?: Id | null }) {
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const [gymOnly, setGymOnly] = useState(true);
  const [picked, setPicked] = useState<Id[]>([]);
  const [creating, setCreating] = useState<string | null>(null);
  const all = useLiveQuery(() => db.exercises.toArray(), []);
  const gym = useLiveQuery(() => (gymId ? db.gyms.get(gymId) : undefined), [gymId]);
  const list = useMemo(() => (all ?? [])
    .filter((e) => matchExercise(e, { q, muscles: muscle ? [muscle] : undefined, equipment: gym && gymOnly ? gym.equipment : undefined }))
    .sort((a, b) => b.isCustom - a.isCustom || a.name.localeCompare(b.name)), [all, q, muscle, gym, gymOnly]);
  const close = () => { setPicked([]); setQ(''); onClose(); };
  const toggle = (id: Id) => {
    if (single) { onPick([id]); close(); return; }
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };
  return (
    <Sheet open={open} onClose={close} title={title}
      footer={single ? undefined : (
        <Button variant="primary" block size="lg" disabled={!picked.length} onClick={() => { onPick(picked); close(); }}>
          {picked.length ? `Add ${picked.length} exercise${picked.length > 1 ? 's' : ''}` : 'Pick exercises'}
        </Button>
      )}>
      <div className="sticky -top-3 z-10 -mx-4 -mt-3 bg-surface px-4 pb-2 pt-3">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search exercises" aria-label="Search exercises" className={`${inputCls} pl-10`} />
        </div>
        <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
          {gym ? <Chip on={gymOnly} onClick={() => setGymOnly(!gymOnly)}>{gym.name} only</Chip> : null}
          <Chip on={!muscle} onClick={() => setMuscle(null)}>All muscles</Chip>
          {ALL_MUSCLES.filter((m) => m !== 'neck').map((m) => <Chip key={m} on={muscle === m} onClick={() => setMuscle(muscle === m ? null : m)}>{MUSCLE_LABEL[m]}</Chip>)}
        </div>
      </div>
      <button className="mb-1 flex min-h-12 w-full items-center gap-3 rounded-md px-2 text-left text-accent active:bg-surface-2" onClick={() => setCreating(q)}>
        <Plus size={20} /> <span className="font-semibold">{q ? `Create “${q}”` : 'Create custom exercise'}</span>
      </button>
      {all && list.length === 0 ? <p className="py-6 text-center text-sm text-muted">No exercises match. Try another word, or create it.</p> : null}
      <ul>
        {list.map((e) => {
          const on = picked.includes(e.id);
          return (
            <li key={e.id}>
              <button onClick={() => toggle(e.id)} aria-pressed={single ? undefined : on}
                className={`flex min-h-14 w-full items-center gap-3 rounded-md px-2 py-2 text-left active:bg-surface-2 ${on ? 'bg-accent-soft' : ''}`}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{e.name}{e.isCustom ? <span className="ml-2 text-xs font-normal text-muted">custom</span> : null}</span>
                  <span className="block truncate text-xs text-muted">{e.primaryMuscles.map((m) => MUSCLE_LABEL[m]).join(', ')} · {e.equipment.map((q) => EQUIPMENT_LABEL[q]).join(', ')}</span>
                </span>
                {!single ? <span className={`flex h-7 w-7 items-center justify-center rounded-full border ${on ? 'border-accent bg-accent text-on-accent' : 'border-border-input'}`}>{on ? <Check size={16} /> : <Plus size={16} />}</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
      {creating != null ? (
        <CreateExerciseSheet initialName={creating} onClose={() => setCreating(null)} onCreated={(id) => {
          setCreating(null);
          setQ('');
          if (single) { onPick([id]); close(); } else setPicked((p) => [...p, id]);
          toast(single ? 'Exercise created' : 'Exercise created and selected');
        }} />
      ) : null}
    </Sheet>
  );
}

/** Create a custom exercise on top of the picker, without leaving the current screen. */
function CreateExerciseSheet({ initialName, onClose, onCreated }: { initialName: string; onClose: () => void; onCreated: (id: Id) => void }) {
  const draft = useExerciseDraft(undefined, initialName);
  return (
    <Sheet open onClose={onClose} title="New exercise" footer={
      <Button variant="primary" block size="lg" onClick={async () => { const saved = await draft.save(); if (saved) onCreated(saved.id); }}>Create exercise</Button>
    }>
      <ExerciseFields draft={draft} autoFocus />
    </Sheet>
  );
}
