// S02
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { BarChart3, ChevronRight } from 'lucide-react';
import { db, type Muscle } from '../data/schema';
import * as repo from '../data/repo';
import { Chart, Sparkline } from '../components/Chart';
import { Card, Empty, Header, Page, SectionTitle, Segmented, Stat } from '../components/ui';
import { MUSCLE_LABEL } from '../data/seed';
import { localDate, weekStart } from '../lib/time';
import { fmtVolume, fmtWeight, fromKg } from '../lib/units';
import { bestE1rm, isWorking } from '../lib/e1rm';

const tsOf = (local: string) => { const [y, m, d] = local.split('-').map(Number); return new Date(y, m - 1, d).getTime() / 1000; };

export default function Dashboard() {
  const nav = useNavigate();
  const settings = useLiveQuery(() => db.settings.get('me'), []);
  const wso = settings?.weekStartsOn ?? 1;
  const weeks = useLiveQuery(() => repo.weeklyStats((d) => weekStart(d, wso)), [wso]);
  const [metric, setMetric] = useState<'sets' | 'volume'>('sets');
  const unit = settings?.unit ?? 'kg';
  const thisWeek = weekStart(localDate(), wso);
  const cur = weeks?.find((w) => w.week === thisWeek);
  const last = weeks?.find((w) => w.week === weekStart(localDate(Date.now() - 7 * 864e5), wso));
  const recent = useLiveQuery(async () => {
    const sessions = await db.sessions.where('status').equals('completed').reverse().sortBy('startedAt');
    const ids = new Set(sessions.slice(0, 40).map((s) => s.id));
    const sets = (await db.setLogs.toArray()).filter((s) => ids.has(s.sessionId) && isWorking(s));
    const by = new Map<string, { last: number; e1: number[] }>();
    const order = new Map(sessions.map((s, i) => [s.id, i]));
    for (const s of sets.sort((a, b) => order.get(b.sessionId)! - order.get(a.sessionId)!)) {
      const v = by.get(s.exerciseId) ?? { last: order.get(s.sessionId)!, e1: [] };
      const e = bestE1rm(s); if (e) v.e1.push(e);
      by.set(s.exerciseId, v);
    }
    const exs = await db.exercises.bulkGet([...by.keys()]);
    return [...by.values()].map((v, i) => ({ ex: exs[i]!, ...v })).filter((x) => x.ex).sort((a, b) => a.last - b.last).slice(0, 8);
  }, []);
  const muscleTop = useMemo(() => Object.entries(cur?.muscles ?? {}).sort((a, b) => b[1] - a[1]) as [Muscle, number][], [cur]);
  const series = useMemo(() => {
    const w = (weeks ?? []).slice(-16);
    return { x: w.map((b) => tsOf(b.week)), y: w.map((b) => (metric === 'sets' ? b.sets : Math.round(fromKg(b.volumeKg, unit)))) };
  }, [weeks, metric, unit]);

  if (weeks && weeks.length === 0) {
    return <><Header title="Progress" /><Page><Empty icon={<BarChart3 size={32} />} title="Your charts start after your first workout" body="Finish a workout and your sets, volume and strength trends show up here." /></Page></>;
  }
  return (
    <>
      <Header title="Progress" />
      <Page>
        <SectionTitle>This week</SectionTitle>
        <div className="flex gap-2">
          <Stat label="Workouts" value={cur?.sessions ?? 0} sub={last ? `last week ${last.sessions}` : undefined} />
          <Stat label="Sets" value={cur?.sets ?? 0} sub={last ? `last week ${last.sets}` : undefined} />
          <Stat label="Volume" value={fmtVolume(cur?.volumeKg ?? 0, unit)} />
        </div>

        <SectionTitle right={<button className="flex items-center text-sm text-accent" onClick={() => nav('/muscles')}>All<ChevronRight size={16} /></button>}>Sets per muscle this week</SectionTitle>
        <Card className="p-3">
          {muscleTop.length === 0 ? <p className="text-sm text-muted">Nothing logged this week yet.</p> : (
            <ul className="space-y-1.5">
              {muscleTop.slice(0, 8).map(([m, n]) => (
                <li key={m} className="flex items-center gap-2 text-sm">
                  <span className="w-24 truncate">{MUSCLE_LABEL[m]}</span>
                  <span className="h-2 flex-1 rounded-full bg-surface-2"><span className="block h-2 rounded-full bg-accent" style={{ width: `${Math.min(100, (n / Math.max(10, muscleTop[0][1])) * 100)}%` }} /></span>
                  <span className="num w-8 text-right text-muted">{Math.round(n * 10) / 10}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-muted">Secondary muscles count as half a set.</p>
        </Card>

        <SectionTitle>Weekly trend</SectionTitle>
        <Card className="p-3">
          <Segmented label="Metric" value={metric} onChange={setMetric} options={[{ value: 'sets', label: 'Sets' }, { value: 'volume', label: `Volume (${unit})` }]} />
          <div className="mt-3"><Chart x={series.x} y={series.y} kind="bars" height={180} label={`Weekly ${metric}`} /></div>
        </Card>

        <SectionTitle right={<button className="flex items-center text-sm text-accent" onClick={() => nav('/settings/exercises')}>All<ChevronRight size={16} /></button>}>Recent exercises</SectionTitle>
        <div className="space-y-1">
          {recent?.map(({ ex, e1 }) => (
            <Card as="button" key={ex.id} onClick={() => nav(`/exercise/${ex.id}`)} className="flex w-full items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1"><p className="truncate font-semibold">{ex.name}</p><p className="num text-xs text-muted">{e1.length ? `Est. 1RM ${fmtWeight(e1[e1.length - 1], unit, true)}` : 'No estimate'}</p></div>
              <Sparkline values={e1.slice(-10)} />
            </Card>
          ))}
        </div>
      </Page>
    </>
  );
}
