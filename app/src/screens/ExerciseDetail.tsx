// S17
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { db } from '../data/schema';
import * as repo from '../data/repo';
import { Chart } from '../components/Chart';
import { Card, Chip, Header, IconButton, Page, SectionTitle, Stat } from '../components/ui';
import { EQUIPMENT_LABEL, MUSCLE_LABEL, TYPE_LABEL } from '../data/seed';
import { nRm } from '../lib/e1rm';
import { fmtDate } from '../lib/time';
import { fmtWeight, fromKg } from '../lib/units';

type Metric = 'e1rm' | 'e3rm' | 'e10rm' | 'heaviest' | 'volume' | 'bestSetVolume' | 'reps' | 'bestSetReps' | 'sets';
const METRICS: { id: Metric; label: string; weight: boolean }[] = [
  { id: 'e1rm', label: 'Est. 1RM', weight: true }, { id: 'e3rm', label: 'Est. 3RM', weight: true }, { id: 'e10rm', label: 'Est. 10RM', weight: true },
  { id: 'heaviest', label: 'Heaviest', weight: true }, { id: 'volume', label: 'Volume', weight: true }, { id: 'bestSetVolume', label: 'Best set volume', weight: true },
  { id: 'reps', label: 'Total reps', weight: false }, { id: 'bestSetReps', label: 'Best set reps', weight: false }, { id: 'sets', label: 'Sets', weight: false },
];
const RANGES = [{ id: 30, label: '1M' }, { id: 90, label: '3M' }, { id: 365, label: '1Y' }, { id: 0, label: 'All' }];

export default function ExerciseDetail() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const ex = useLiveQuery(() => db.exercises.get(id), [id]);
  const settings = useLiveQuery(() => db.settings.get('me'), []);
  const pts = useLiveQuery(() => repo.exerciseHistory(id), [id]);
  const [metric, setMetric] = useState<Metric>('e1rm');
  const [range, setRange] = useState(90);
  const unit = settings?.unit ?? 'kg';
  const m = METRICS.find((x) => x.id === metric)!;
  const data = useMemo(() => {
    const cut = range ? Date.now() - range * 864e5 : 0;
    const p = (pts ?? []).filter((x) => x.startedAt >= cut);
    const val = (x: NonNullable<typeof pts>[0]) => {
      switch (metric) {
        case 'e1rm': return x.e1rm; case 'e3rm': return x.e1rm && nRm(x.e1rm, 3); case 'e10rm': return x.e1rm && nRm(x.e1rm, 10);
        default: return x[metric];
      }
    };
    return { x: p.map((v) => v.startedAt / 1000), y: p.map((v) => { const n = val(v); return n == null ? null : m.weight ? Math.round(fromKg(n, unit) * 10) / 10 : n; }) };
  }, [pts, metric, range, unit, m.weight]);
  if (ex === undefined) return <div className="p-8 text-center text-muted">Loading…</div>;
  if (!ex) return <><Header title="Exercise" back /><Page><p className="text-muted">Not found.</p></Page></>;
  const best = (pts ?? []).reduce((a, p) => Math.max(a, p.e1rm ?? 0), 0);
  const heaviest = (pts ?? []).reduce((a, p) => Math.max(a, p.heaviest), 0);
  return (
    <>
      <Header title={ex.name} back sub={TYPE_LABEL[ex.type]} right={<IconButton label="Edit exercise" onClick={() => nav(`/exercise/${ex.id}/edit`)}><Pencil size={20} /></IconButton>} />
      <Page>
        <div className="flex gap-2">
          <Stat label="Best est. 1RM" value={best ? fmtWeight(best, unit, true) : '—'} />
          <Stat label="Heaviest" value={heaviest ? fmtWeight(heaviest, unit, true) : '—'} />
          <Stat label="Sessions" value={pts?.length ?? 0} />
        </div>
        <SectionTitle>Trend</SectionTitle>
        <Card className="p-3">
          <div className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-2">{METRICS.map((x) => <Chip key={x.id} on={metric === x.id} onClick={() => setMetric(x.id)}>{x.label}</Chip>)}</div>
          <Chart x={data.x} y={data.y} height={200} label={`${m.label} over time`} fmt={(v) => String(Math.round(v * 10) / 10)} />
          <div className="mt-2 flex justify-center gap-1.5">{RANGES.map((r) => <Chip key={r.id} on={range === r.id} onClick={() => setRange(r.id)}>{r.label}</Chip>)}</div>
          {m.weight ? <p className="mt-2 text-center text-xs text-muted">in {unit}{metric.startsWith('e') ? ' · estimated from your best set (Epley), sets over 12 reps excluded' : ''}</p> : null}
        </Card>
        <SectionTitle>About</SectionTitle>
        <Card className="space-y-1 text-sm">
          <p><span className="text-muted">Main: </span>{ex.primaryMuscles.map((x) => MUSCLE_LABEL[x]).join(', ') || '—'}</p>
          {ex.secondaryMuscles.length ? <p><span className="text-muted">Also: </span>{ex.secondaryMuscles.map((x) => MUSCLE_LABEL[x]).join(', ')}</p> : null}
          <p><span className="text-muted">Equipment: </span>{ex.equipment.map((x) => EQUIPMENT_LABEL[x]).join(', ')}</p>
          {ex.notes ? <p className="pt-1">{ex.notes}</p> : null}
        </Card>
        <SectionTitle>Sessions</SectionTitle>
        <div className="space-y-1">
          {[...(pts ?? [])].reverse().slice(0, 30).map((p) => (
            <div key={p.startedAt} className="num flex justify-between rounded-md bg-surface px-3 py-2 text-sm">
              <span>{fmtDate(p.date)}</span>
              <span className="min-w-0 truncate pl-3 text-right text-muted">{p.top.filter((t) => t.type !== 'warmup').map((t) => `${t.weightKg ? fmtWeight(t.weightKg, unit) : 'BW'}×${t.reps ?? 0}`).join(', ')}</span>
              <span className="hidden">{p.sets} set{p.sets === 1 ? "" : "s"} · top {fmtWeight(p.heaviest, unit, true)}{p.e1rm ? ` · e1RM ${fmtWeight(p.e1rm, unit)}` : ''}</span>
            </div>
          ))}
          {pts && pts.length === 0 ? <p className="text-sm text-muted">You haven’t logged this exercise yet.</p> : null}
        </div>
      </Page>
    </>
  );
}
