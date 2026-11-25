// S21
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, Plus } from 'lucide-react';
import { db, type GymProfile, type Unit } from '../data/schema';
import * as repo from '../data/repo';
import { Button, Card, Chip, Field, Header, Page, SectionTitle, Segmented, Sheet, inputCls, toast } from '../components/ui';
import { ALL_EQUIPMENT, EQUIPMENT_LABEL } from '../data/seed';
import { fromKg, toKg } from '../lib/units';

export default function Gyms() {
  const gyms = useLiveQuery(() => db.gyms.toArray(), []);
  const s = useLiveQuery(() => db.settings.get('me'), []);
  const [edit, setEdit] = useState<Partial<GymProfile> | null>(null);
  return (
    <>
      <Header title="Gyms & equipment" back right={<Button size="sm" variant="ghost" className="text-accent" onClick={() => setEdit({ name: '', unit: s?.unit ?? 'kg', ...repo.GYM_PRESETS['Full gym'], ...repo.plateDefaults(s?.unit ?? 'kg') })}><Plus size={16} />Add</Button>} />
      <Page>
        <p className="mb-4 text-sm text-muted">Exercise suggestions, swaps and the plate calculator use the equipment and plates of the gym you’re training at.</p>
        <div className="space-y-2">
          {gyms?.map((g) => (
            <Card key={g.id} className="flex items-center gap-3">
              <button className="min-w-0 flex-1 text-left" onClick={() => setEdit(g)}>
                <p className="font-semibold">{g.name}</p>
                <p className="truncate text-xs text-muted">{g.equipment.length} kinds of equipment · plates in {g.unit}</p>
              </button>
              {s?.activeGymId === g.id ? <span className="flex items-center gap-1 text-sm text-success"><Check size={16} />Default</span>
                : <Button size="sm" onClick={() => repo.updateSettings({ activeGymId: g.id })}>Make default</Button>}
            </Card>
          ))}
        </div>
      </Page>
      {edit ? <GymSheet gym={edit} onClose={() => setEdit(null)} /> : null}
    </>
  );
}

function GymSheet({ gym, onClose }: { gym: Partial<GymProfile>; onClose: () => void }) {
  const [g, setG] = useState(gym);
  const unit = (g.unit ?? 'kg') as Unit;
  const show = (arr?: number[]) => (arr ?? []).map((k) => Math.round(fromKg(k, unit) * 100) / 100).join(', ');
  const [plates, setPlates] = useState(show(g.platesKg));
  const [bars, setBars] = useState(show(g.barWeightsKg));
  const parse = (t: string) => t.split(/[,\s]+/).map((x) => Number(x.replace(',', '.'))).filter((n) => n > 0).map((n) => toKg(n, unit));
  return (
    <Sheet open onClose={onClose} title={gym.id ? 'Edit gym' : 'New gym'} footer={
      <div className="flex gap-2">
        {gym.id ? <Button variant="ghost" className="text-danger" onClick={async () => { if (await repo.deleteGym(gym.id!)) { toast('Gym deleted'); onClose(); } else toast('Keep at least one gym'); }}>Delete</Button> : null}
        <Button variant="primary" className="flex-1" onClick={async () => {
          if (!g.name?.trim()) return toast('Name it');
          const p = parse(plates), b = parse(bars);
          if (!p.length || !b.length) return toast('Add at least one plate and one bar');
          await repo.saveGym({ ...g, name: g.name.trim(), platesKg: p, barWeightsKg: b } as GymProfile, unit); onClose();
        }}>Save</Button>
      </div>
    }>
      <div className="space-y-4">
        <Field label="Name"><input className={inputCls} value={g.name} onChange={(e) => setG({ ...g, name: e.target.value })} placeholder="Home, Work gym…" /></Field>
        <div>
          <p className="mb-1 text-sm font-semibold">Plates labelled in</p>
          <Segmented label="Plate unit" value={unit} onChange={(u) => { const d = repo.plateDefaults(u); setG({ ...g, unit: u }); setPlates(d.platesKg.map((k) => Math.round(fromKg(k, u) * 100) / 100).join(', ')); setBars(d.barWeightsKg.map((k) => Math.round(fromKg(k, u) * 100) / 100).join(', ')); }}
            options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} />
        </div>
        <Field label={`Plate sizes (${unit})`} hint="Comma separated, one of each size is enough"><input className={inputCls} value={plates} onChange={(e) => setPlates(e.target.value)} /></Field>
        <Field label={`Bar weights (${unit})`}><input className={inputCls} value={bars} onChange={(e) => setBars(e.target.value)} /></Field>
        <div>
          <SectionTitle>Equipment here</SectionTitle>
          <div className="mb-2 flex flex-wrap gap-1.5">{Object.keys(repo.GYM_PRESETS).map((p) => <Chip key={p} onClick={() => setG({ ...g, equipment: repo.GYM_PRESETS[p].equipment })}>{p}</Chip>)}</div>
          <div className="flex flex-wrap gap-1.5">
            {ALL_EQUIPMENT.map((q) => <Chip key={q} on={g.equipment?.includes(q)} onClick={() => setG({ ...g, equipment: g.equipment?.includes(q) ? g.equipment.filter((x) => x !== q) : [...(g.equipment ?? []), q] })}>{EQUIPMENT_LABEL[q]}</Chip>)}
          </div>
        </div>
      </div>
    </Sheet>
  );
}
