// S15
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, History as HistoryIcon } from 'lucide-react';
import { db } from '../data/schema';
import { Card, Empty, Header, Page, SectionTitle } from '../components/ui';
import { fmtDate, fmtDuration } from '../lib/time';
import { elapsedMs } from '../data/repo';
import { isWorking } from '../lib/e1rm';

export default function History() {
  const nav = useNavigate();
  const sessions = useLiveQuery(() => db.sessions.where('status').equals('completed').reverse().sortBy('startedAt'), []);
  const counts = useLiveQuery(async () => {
    const m = new Map<string, { sets: number; ex: Set<string> }>();
    for (const s of await db.setLogs.toArray()) {
      if (!isWorking(s)) continue;
      const c = m.get(s.sessionId) ?? { sets: 0, ex: new Set() };
      c.sets++; c.ex.add(s.exerciseId); m.set(s.sessionId, c);
    }
    return m;
  }, []);
  const groups = new Map<string, typeof sessions>();
  for (const s of sessions ?? []) {
    const k = s.localDate.slice(0, 7);
    (groups.get(k) ?? groups.set(k, []).get(k)!)!.push(s);
  }
  return (
    <>
      <Header title="History" />
      <Page>
        {sessions && sessions.length === 0 ? <Empty icon={<HistoryIcon size={32} />} title="No finished workouts yet" body="Workouts appear here when you tap Finish." /> : null}
        {[...groups.entries()].map(([month, list]) => (
          <div key={month}>
            <SectionTitle>{fmtDate(`${month}-01`, { month: 'long', year: 'numeric' })} · {list!.length}</SectionTitle>
            <div className="space-y-2">
              {list!.map((s) => (
                <Card as="button" key={s.id} onClick={() => nav(`/history/${s.id}`)} className="flex w-full items-center gap-3">
                  <div className="w-12 text-center"><p className="text-xs text-muted">{fmtDate(s.localDate, { weekday: 'short' })}</p><p className="num text-lg">{Number(s.localDate.slice(8))}</p></div>
                  <div className="min-w-0 flex-1"><p className="truncate font-semibold">{s.name}</p><p className="text-xs text-muted">{fmtDuration(elapsedMs(s))} · {counts?.get(s.id)?.ex.size ?? 0} exercise{counts?.get(s.id)?.ex.size === 1 ? "" : "s"} · {counts?.get(s.id)?.sets ?? 0} set{counts?.get(s.id)?.sets === 1 ? "" : "s"}</p></div>
                  <ChevronRight size={18} className="text-muted" />
                </Card>
              ))}
            </div>
          </div>
        ))}
      </Page>
    </>
  );
}
