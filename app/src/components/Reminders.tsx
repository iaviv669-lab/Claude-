// Workout reminders: weekly repeating Calendar events (with an alert) for each workout day of
// the active 7-day program. The phone's Calendar delivers the notifications, so they work
// even when the app is closed (home-screen web apps can't schedule their own).
import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BellOff, BellRing, CalendarPlus, Send } from 'lucide-react';
import { db, type Settings, type Workout } from '../data/schema';
import { getWorkout, typicalDurationMs, updateSettings } from '../data/repo';
import { buildIcs, type ReminderDay } from '../lib/ics';
import { DAY_NAMES } from '../data/templates';
import { Button, Card, Field, inputCls, toast } from './ui';
import { disablePush, enablePush, pushSupport, sendTestPush, syncPush } from '../lib/push';

const LEADS = [{ v: 0, l: 'At the time' }, { v: 15, l: '15 min before' }, { v: 30, l: '30 min before' }, { v: 60, l: '1 hour before' }, { v: 120, l: '2 hours before' }];

async function offerFile(name: string, text: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([text], name, { type: 'text/calendar' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Ironrow workout reminders' }); return 'shared'; }
    catch (e) { if ((e as DOMException)?.name === 'AbortError') return 'cancelled'; }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'downloaded';
}

export function Reminders({ settings }: { settings: Settings }) {
  const program = useLiveQuery(() => db.programs.where('active').equals(1).first(), []);
  const workouts = useLiveQuery(async () => new Map((await db.workouts.toArray()).map((w) => [w.id, w])), []);
  const [time, setTime] = useState(settings.reminderTime ?? '17:00');
  const [lead, setLead] = useState(settings.reminderLead ?? 15);
  const [busy, setBusy] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const support = pushSupport();
  const pushOn = !!settings.pushEnabled;
  // keep the server's schedule in step when the time or alert lead changes
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(async () => {
      await updateSettings({ reminderTime: time, reminderLead: lead });
      if (pushOn) syncPush().catch(() => toast('Couldn’t update your reminder times. Check your connection.'));
    }, 600);
    return () => clearTimeout(t);
  }, [time, lead]); // eslint-disable-line react-hooks/exhaustive-deps
  const run = async (f: () => Promise<void>, ok: string) => {
    setPushBusy(true);
    try { await f(); toast(ok); } catch (e) { toast(e instanceof Error ? e.message : 'Something went wrong'); } finally { setPushBusy(false); }
  };
  const weekly = program && program.days.length === 7;
  const days = weekly ? program.days.map((d, i) => (d ? { i, w: workouts?.get(d) } : null)).filter((x): x is { i: number; w: Workout } => !!x && !!x.w) : [];

  const add = async () => {
    if (!program || !days.length) return;
    setBusy(true);
    try {
      await updateSettings({ reminderTime: time, reminderLead: lead });
      const exNames = new Map((await db.exercises.toArray()).map((e) => [e.id, e.name]));
      const list: ReminderDay[] = [];
      let duration = 60;
      for (const { i, w } of days) {
        const full = await getWorkout(w.id);
        const typical = await typicalDurationMs(w.id);
        if (typical) duration = Math.round(typical / 60000);
        list.push({ weekday: i, title: `Ironrow: ${w.name}`, details: (full?.items ?? []).map((it) => exNames.get(it.exerciseId) ?? '').filter(Boolean).join(', ') });
      }
      const ics = buildIcs(list, { time, minutesBefore: lead, durationMin: duration, uidPrefix: program.id.slice(0, 8) });
      const r = await offerFile('ironrow-workouts.ics', ics);
      if (r !== 'cancelled') toast(r === 'shared' ? 'Choose Calendar (or Save to Files, then open it)' : 'Open the downloaded file and tap Add All');
    } finally { setBusy(false); }
  };

  if (program === undefined) return null;
  return (
    <Card className="space-y-3">
      {!program ? <p className="text-sm text-muted">Set a weekly program as active to get reminders on its workout days.</p>
        : !weekly ? <p className="text-sm text-muted">Reminders follow weekdays, so they need a 7-day program (Mon–Sun). “{program.name}” has {program.days.length} days.</p>
        : (
          <>
            <p className="text-sm">{days.map(({ i, w }) => `${DAY_NAMES[i]} ${w.name}`).join(' · ')}</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Workout time"><input type="time" className={inputCls} value={time} onChange={(e) => setTime(e.target.value || '17:00')} /></Field>
              <Field label="Remind me"><select className={inputCls} value={lead} onChange={(e) => setLead(Number(e.target.value))}>{LEADS.map((x) => <option key={x.v} value={x.v}>{x.l}</option>)}</select></Field>
            </div>
            {support === 'ok' ? (
              pushOn ? (
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-sm font-semibold text-success"><BellRing size={16} />Notifications are on</p>
                  <div className="flex gap-2">
                    <Button className="flex-1" loading={pushBusy} onClick={() => run(sendTestPush, 'Test sent. It should arrive in a few seconds.')}><Send size={16} />Send a test</Button>
                    <Button variant="ghost" onClick={() => run(disablePush, 'Notifications turned off')}><BellOff size={16} />Turn off</Button>
                  </div>
                  <p className="text-xs text-muted">Ironrow notifies you on each workout day, even when the app is closed. Change your plan or time and it updates the next time you open the app.</p>
                </div>
              ) : (
                <>
                  <Button variant="primary" block loading={pushBusy} onClick={() => run(() => enablePush(time, lead), 'Notifications are on')}><BellRing size={18} />Turn on notifications</Button>
                  <p className="text-xs text-muted">Ironrow will send you a notification on each workout day, even when the app is closed.</p>
                </>
              )
            ) : support === 'install-first' ? (
              <p className="rounded-md bg-surface-2 px-3 py-2 text-sm">To get notifications, open Ironrow from its Home Screen icon, then come back here.</p>
            ) : support === 'unsupported' ? (
              <p className="text-sm text-muted">This browser can’t receive notifications from Ironrow. You can use calendar reminders instead.</p>
            ) : null}
            <details className="pt-1">
              <summary className="cursor-pointer text-sm text-accent">Or use calendar reminders</summary>
              <div className="mt-2 space-y-2">
                <Button block loading={busy} onClick={add}><CalendarPlus size={18} />Add reminders to Calendar</Button>
                <p className="text-xs text-muted">Adds a repeating event for each workout day to your phone’s Calendar, with an alert. Changed your plan or time? Delete the old “Ironrow” events in Calendar and add them again.</p>
              </div>
            </details>
          </>
        )}
    </Card>
  );
}
