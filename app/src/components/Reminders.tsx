// Workout reminders: weekly repeating Calendar events (with an alert) for each workout day of
// the active 7-day program. The phone's Calendar delivers the notifications, so they work
// even when the app is closed (home-screen web apps can't schedule their own).
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BellRing } from 'lucide-react';
import { db, type Settings, type Workout } from '../data/schema';
import { getWorkout, typicalDurationMs, updateSettings } from '../data/repo';
import { buildIcs, type ReminderDay } from '../lib/ics';
import { DAY_NAMES } from '../data/templates';
import { Button, Card, Field, inputCls, toast } from './ui';

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
            <Button variant="primary" block loading={busy} onClick={add}><BellRing size={18} />Add reminders to Calendar</Button>
            <p className="text-xs text-muted">Adds a repeating event for each workout day to your phone’s Calendar, with an alert. Your phone sends the notification, even when Ironrow is closed. Changed your plan or time? Delete the old “Ironrow” events in Calendar and add them again.</p>
          </>
        )}
    </Card>
  );
}
