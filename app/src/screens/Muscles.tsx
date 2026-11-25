// S18
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Muscle } from '../data/schema';
import * as repo from '../data/repo';
import { Chart } from '../components/Chart';
import { Card, Chip, Header, Page, SectionTitle } from '../components/ui';
import { ALL_MUSCLES, MUSCLE_LABEL } from '../data/seed';
import { weekStart } from '../lib/time';

const tsOf = (local: string) => { const [y, m, d] = local.split('-').map(Number); return new Date(y, m - 1, d).getTime() / 1000; };

export default function Muscles() {
  const settings = useLiveQuery(() => db.settings.get('me'), []);
  const wso = settings?.weekStartsOn ?? 1;
  const weeks = useLiveQuery(() => repo.weeklyStats((d) => weekStart(d, wso)), [wso]);
  const [m, setM] = useState<Muscle>('chest');
  const recent = (weeks ?? []).slice(-4);
  const avg = useMemo(() => {
    const out = new Map<Muscle, number>();
    for (const mm of ALL_MUSCLES) out.set(mm, recent.reduce((a, w) => a + (w.muscles[mm] ?? 0), 0) / Math.max(1, recent.length));
    return [...out.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  }, [recent]);
  const neglected = ALL_MUSCLES.filter((x) => x !== 'neck' && !avg.find(([k]) => k === x));
  const w = (weeks ?? []).slice(-16);
  return (
    <>
      <Header title="Muscles" back />
      <Page>
        <SectionTitle>Average sets per week (last 4 weeks)</SectionTitle>
        <Card className="p-3">
          <ul className="space-y-1.5">
            {avg.map(([k, v]) => (
              <li key={k}><button className="flex w-full items-center gap-2 text-sm" onClick={() => setM(k)}>
                <span className={`w-24 truncate text-left ${k === m ? 'font-semibold text-accent' : ''}`}>{MUSCLE_LABEL[k]}</span>
                <span className="h-2 flex-1 rounded-full bg-surface-2"><span className="block h-2 rounded-full bg-accent" style={{ width: `${Math.min(100, (v / Math.max(10, avg[0][1])) * 100)}%` }} /></span>
                <span className="num w-10 text-right text-muted">{v.toFixed(1)}</span>
              </button></li>
            ))}
          </ul>
          {avg.length === 0 ? <p className="text-sm text-muted">No training logged in the last 4 weeks.</p> : null}
          {neglected.length && avg.length ? <p className="mt-3 text-xs text-muted">Not trained lately: {neglected.map((x) => MUSCLE_LABEL[x]).join(', ')}</p> : null}
        </Card>
        <SectionTitle>{MUSCLE_LABEL[m]} by week</SectionTitle>
        <Card className="p-3">
          <div className="-mx-3 mb-2 flex gap-1.5 overflow-x-auto px-3 pb-1">{ALL_MUSCLES.filter((x) => x !== 'neck').map((x) => <Chip key={x} on={x === m} onClick={() => setM(x)}>{MUSCLE_LABEL[x]}</Chip>)}</div>
          <Chart kind="bars" x={w.map((b) => tsOf(b.week))} y={w.map((b) => b.muscles[m] ?? 0)} height={180} label={`${MUSCLE_LABEL[m]} sets per week`} fmt={(v) => String(Math.round(v * 10) / 10)} />
        </Card>
      </Page>
    </>
  );
}
