// S20: a program is an ordered rotation of workout days (empty day = rest)
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, X } from 'lucide-react';
import { db, type Program } from '../data/schema';
import * as repo from '../data/repo';
import { DAY_NAMES } from '../data/templates';
import { Button, Card, Field, Header, IconButton, Page, SectionTitle, Sheet, MenuItem, confirmDialog, inputCls, toast } from '../components/ui';

export default function ProgramEditor() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const p = useLiveQuery(() => db.programs.get(id), [id]);
  const workouts = useLiveQuery(() => db.workouts.where('archived').equals(0).sortBy('name'), []);
  const [name, setName] = useState('');
  const [pickFor, setPickFor] = useState<number | null>(null);
  useEffect(() => { if (p) setName(p.name); }, [p?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (p === undefined) return <div className="p-8 text-center text-muted">Loading…</div>;
  if (!p) return <><Header title="Program" back="/" /><Page><p className="text-muted">Not found.</p></Page></>;
  const save = (patch: Partial<Program>) => repo.saveProgram({ ...p, ...patch });
  const byId = new Map((workouts ?? []).map((w) => [w.id, w]));
  return (
    <>
      <Header title="Program" back="/" right={p.active ? <span className="px-3 text-sm text-success">Active</span> : <Button size="sm" variant="primary" onClick={async () => { await repo.setActiveProgram(p.id); toast('Program is now active'); }}>Make active</Button>} />
      <Page>
        <Field label="Name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && save({ name: name.trim() })} /></Field>
        <SectionTitle>Days, in order. Repeats when it reaches the end.</SectionTitle>
        <div className="space-y-2">
          {p.days.map((d, i) => {
            const w = d ? byId.get(d) : undefined;
            return (
              <Card key={i} className="flex items-center gap-3 px-3 py-2">
                <span className="w-12 text-xs text-muted">{p.days.length === 7 ? DAY_NAMES[i] : `Day ${i + 1}`}</span>
                <button className="min-w-0 flex-1 text-left" onClick={() => (w ? nav(`/workout/${w.id}`) : setPickFor(i))}>
                  <span className={`block truncate ${w ? 'font-semibold' : 'text-muted'}`}>{w ? w.name : 'Rest day · tap to add a workout'}</span>
                </button>
                {w ? <IconButton label="Make this a rest day" onClick={() => save({ days: p.days.map((x, k) => (k === i ? null : x)) })}><X size={18} /></IconButton> : null}
                <IconButton label="Remove day" onClick={() => save({ days: p.days.filter((_, k) => k !== i) })}><Trash2 size={18} /></IconButton>
              </Card>
            );
          })}
        </div>
        <Button block className="mt-3" onClick={() => save({ days: [...p.days, null] })}><Plus size={18} />Add day</Button>
        <div className="mt-8 flex gap-2">
          {p.active ? <Button variant="ghost" onClick={() => repo.setActiveProgram(null)}>Stop using</Button> : null}
          <Button variant="ghost" className="text-danger" onClick={async () => {
            if (await confirmDialog({ title: 'Delete this program?', body: 'Its workouts stay in My workouts.', ok: 'Delete', danger: true })) { await repo.deleteProgram(p.id); nav('/', { replace: true }); }
          }}><Trash2 size={16} />Delete program</Button>
        </div>
      </Page>
      <Sheet open={pickFor != null} onClose={() => setPickFor(null)} title={`Day ${(pickFor ?? 0) + 1}`}>
        <MenuItem icon={<Plus size={20} />} onClick={() => { const i = pickFor; setPickFor(null); nav(`/workout/new?program=${p.id}&day=${i}`); }}>Build a new workout</MenuItem>
        {(workouts ?? []).map((w) => <MenuItem key={w.id} onClick={async () => { await save({ days: p.days.map((x, k) => (k === pickFor ? w.id : x)) }); await db.workouts.update(w.id, { programId: p.id }); setPickFor(null); }}>{w.name}</MenuItem>)}
      </Sheet>
    </>
  );
}
