// S14: workout summary
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { db } from '../data/schema';
import { getSessionTree, sessionSummary, type Record_ } from '../data/repo';
import { BodyMap } from '../components/BodyMap';
import { Button, Card, Header, Page, SectionTitle, Stat } from '../components/ui';
import { fmtDuration } from '../lib/time';
import { fmtVolume, fmtWeight } from '../lib/units';
import { SetList } from './SessionDetail';

const KIND: Record<Record_['kind'], string> = { e1rm: 'Est. 1-rep max', weight: 'Heaviest weight', reps: 'Most reps', volume: 'Best set volume' };

export default function Summary() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const settings = useLiveQuery(() => db.settings.get('me'), []);
  const summary = useLiveQuery(() => sessionSummary(id), [id]);
  const tree = useLiveQuery(() => getSessionTree(id), [id]);
  const exNames = useLiveQuery(async () => new Map((await db.exercises.toArray()).map((e) => [e.id, e.name])), []);
  const prs: Record_[] = (() => { try { return JSON.parse(sessionStorage.getItem(`prs:${id}`) ?? '[]'); } catch { return []; } })();
  const unit = settings?.unit ?? 'kg';
  if (!summary || !tree) return <div className="p-8 text-center text-muted">Loading…</div>;
  const start = new Date(tree.session.startedAt);
  return (
    <>
      <Header title="Workout done" sub={`${tree.session.name} · ${start.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}`} />
      <Page>
        <div className="flex gap-2">
          <Stat label="Duration" value={fmtDuration(summary.durationMs)} />
          <Stat label="Sets" value={summary.sets} />
          <Stat label="Volume" value={fmtVolume(summary.volumeKg, unit)} />
        </div>
        {tree.session.notes ? <p className="mt-3 rounded-md bg-surface-2 px-3 py-2 text-sm">{tree.session.notes}</p> : null}
        <p className="mt-2 text-center text-xs text-muted">Started {start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</p>
        {prs.length ? (
          <>
            <SectionTitle>New records</SectionTitle>
            <div className="space-y-2">
              {prs.map((p, i) => (
                <Card key={i} className="flex items-center gap-3 border-warning/40">
                  <Trophy className="text-warning" size={22} />
                  <div className="flex-1"><p className="font-semibold">{exNames?.get(p.exerciseId) ?? ''}</p><p className="text-xs text-muted">{KIND[p.kind]}</p></div>
                  <p className="num text-right"><span className="font-semibold">{p.kind === 'reps' ? p.value : fmtWeight(Math.round(p.value * 10) / 10, unit, true)}</span><br /><span className="text-xs text-muted">was {p.kind === 'reps' ? p.previous : fmtWeight(p.previous == null ? null : Math.round(p.previous * 10) / 10, unit)}</span></p>
                </Card>
              ))}
            </div>
          </>
        ) : null}
        <SectionTitle>Muscles worked</SectionTitle>
        <Card><BodyMap worked={summary.muscles} /></Card>
        <SectionTitle right={<button className="text-sm text-accent" onClick={() => nav(`/history/${id}`)}>Edit</button>}>What you did</SectionTitle>
        <SetList tree={tree} unit={unit} names={exNames} />
        <Button variant="primary" size="lg" block className="mt-6" onClick={() => nav('/', { replace: true })}>Done</Button>
      </Page>
    </>
  );
}
