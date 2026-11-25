import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Plus, Search } from 'lucide-react';
import { db } from '../data/schema';
import { matchExercise } from '../data/repo';
import { Button, Chip, Header, Page, inputCls } from '../components/ui';
import { MUSCLE_LABEL } from '../data/seed';

export default function Exercises() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [mine, setMine] = useState(false);
  const all = useLiveQuery(() => db.exercises.toArray(), []);
  const used = useLiveQuery(async () => new Set((await db.setLogs.toArray()).map((s) => s.exerciseId)), []);
  const list = useMemo(() => (all ?? []).filter((e) => matchExercise(e, { q }) && (!mine || e.isCustom)).sort((a, b) => a.name.localeCompare(b.name)), [all, q, mine]);
  return (
    <>
      <Header title="Exercises" back right={<Button size="sm" variant="ghost" className="text-accent" onClick={() => nav('/exercise/new')}><Plus size={16} />New</Button>} />
      <Page>
        <div className="relative mb-2"><Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input className={`${inputCls} pl-10`} placeholder="Search" aria-label="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="mb-3 flex gap-2"><Chip on={!mine} onClick={() => setMine(false)}>All {all?.filter((e) => !e.archived).length}</Chip><Chip on={mine} onClick={() => setMine(true)}>Custom</Chip></div>
        <ul className="divide-y divide-border">
          {list.map((e) => (
            <li key={e.id}><button className="flex min-h-14 w-full items-center gap-3 py-2 text-left" onClick={() => nav(`/exercise/${e.id}`)}>
              <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{e.name}</span><span className="block truncate text-xs text-muted">{e.primaryMuscles.map((m) => MUSCLE_LABEL[m]).join(', ')}{e.isCustom ? ' · custom' : ''}{used?.has(e.id) ? ' · logged' : ''}</span></span>
              <ChevronRight size={18} className="text-muted" />
            </button></li>
          ))}
        </ul>
      </Page>
    </>
  );
}
