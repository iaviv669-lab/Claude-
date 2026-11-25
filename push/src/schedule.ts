// Pure scheduling logic, shared by the worker and its tests.
export interface Reminder { id: string; weekday: number /* 0 = Mon … 6 = Sun */; time: string /* HH:MM local */; title: string; body: string }
export interface Entry { sub: { endpoint: string; keys: { p256dh: string; auth: string } }; tz: string; reminders: Reminder[]; lastSent: Record<string, string>; updatedAt: number }

/** Local weekday (0 = Mon), minutes since midnight and date (YYYY-MM-DD) in an IANA time zone. */
export function localParts(now: Date, tz: string): { weekday: number; minutes: number; date: string } {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(now).map((x) => [x.type, x.value]));
  const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday);
  return { weekday, minutes: Number(p.hour) * 60 + Number(p.minute), date: `${p.year}-${p.month}-${p.day}` };
}

/** Reminders that should fire now: right weekday, time reached within the last `windowMin` minutes, not yet sent today. */
export function dueReminders(e: Entry, now: Date, windowMin = 30): Reminder[] {
  const { weekday, minutes, date } = localParts(now, e.tz);
  return e.reminders.filter((r) => {
    const [h, m] = r.time.split(':').map(Number);
    const at = h * 60 + m;
    return r.weekday === weekday && minutes >= at && minutes < at + windowMin && e.lastSent[r.id] !== date;
  });
}

const PUSH_HOSTS = [/^web\.push\.apple\.com$/, /^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/, /^android\.googleapis\.com$/];

/** Validate what the app sends. Returns an error message or null. */
export function validate(body: unknown): string | null {
  const b = body as { subscription?: Entry['sub']; tz?: string; reminders?: Reminder[] };
  if (!b?.subscription?.endpoint || !b.subscription.keys?.p256dh || !b.subscription.keys?.auth) return 'missing subscription';
  let host = '';
  try { const u = new URL(b.subscription.endpoint); if (u.protocol !== 'https:') return 'endpoint must be https'; host = u.hostname; } catch { return 'bad endpoint'; }
  if (!PUSH_HOSTS.some((re) => re.test(host))) return 'unknown push service';
  try { new Intl.DateTimeFormat('en-US', { timeZone: b.tz }); } catch { return 'bad time zone'; }
  if (!Array.isArray(b.reminders) || b.reminders.length > 14) return 'reminders must be a list of at most 14';
  for (const r of b.reminders) {
    if (!(r.weekday >= 0 && r.weekday <= 6) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time) || typeof r.title !== 'string' || r.title.length > 80 || typeof r.body !== 'string' || r.body.length > 300 || typeof r.id !== 'string' || r.id.length > 40) return 'bad reminder';
  }
  return null;
}
