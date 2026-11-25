// Push notifications from the Ironrow server (Cloudflare Worker, see /push).
import { db } from '../data/schema';
import { getSettings, updateSettings } from '../data/repo';

export const PUSH_URL = (import.meta.env.VITE_PUSH_URL as string | undefined) ?? '';

export interface ServerReminder { id: string; weekday: number; time: string; title: string; body: string }

export type PushSupport = 'ok' | 'install-first' | 'unsupported' | 'no-server';

export function pushSupport(): PushSupport {
  if (!PUSH_URL) return 'no-server';
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const hasPush = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const iOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (iOS && !standalone) return 'install-first';
  return hasPush ? 'ok' : 'unsupported';
}

/** Reminders for each workout day of the active 7-day program, `lead` minutes before `time` (may move to the previous day). */
export async function buildReminders(time: string, lead: number): Promise<ServerReminder[]> {
  const program = await db.programs.where('active').equals(1).first();
  if (!program || program.days.length !== 7) return [];
  const [h, m] = time.split(':').map(Number);
  const out: ServerReminder[] = [];
  for (const [i, wid] of program.days.entries()) {
    if (!wid) continue;
    const w = await db.workouts.get(wid);
    if (!w) continue;
    const items = await db.workoutItems.where('workoutId').equals(wid).sortBy('order');
    const names = (await db.exercises.bulkGet(items.map((x) => x.exerciseId))).filter(Boolean).map((e) => e!.name);
    let mins = h * 60 + m - lead, day = i;
    while (mins < 0) { mins += 1440; day = (day + 6) % 7; }
    const at = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    const body = `${lead ? `Starts at ${time}. ` : ''}${names.slice(0, 4).join(', ')}${names.length > 4 ? ` +${names.length - 4} more` : ''}`;
    out.push({ id: `d${i}`, weekday: day, time: at, title: `${w.name} today`, body: body.slice(0, 300) });
  }
  return out;
}

const b64uToBytes = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

async function post(path: string, body: unknown) {
  const r = await fetch(PUSH_URL + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.ok === false) throw new Error(j.error || `Server error ${r.status}`);
  return j;
}

async function currentSubscription(create: boolean): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing || !create) return existing;
  const { publicKey } = await (await fetch(PUSH_URL + '/vapid')).json();
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(publicKey) });
}

/** Ask permission (call from a tap), subscribe and send the schedule. */
export async function enablePush(time: string, lead: number): Promise<void> {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Notifications are blocked. Allow them in Settings → Notifications → Ironrow.');
  const sub = await currentSubscription(true);
  if (!sub) throw new Error('Could not subscribe to notifications.');
  await post('/subscribe', { subscription: sub.toJSON(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone, reminders: await buildReminders(time, lead) });
  await updateSettings({ pushEnabled: true, reminderTime: time, reminderLead: lead });
}

/** Re-send the schedule (after plan or time changes, and on app start). Quietly does nothing if off. */
export async function syncPush(): Promise<void> {
  const s = await getSettings();
  if (!s.pushEnabled || pushSupport() !== 'ok' || Notification.permission !== 'granted') return;
  const sub = await currentSubscription(false);
  if (!sub) { await updateSettings({ pushEnabled: false }); return; }
  await post('/subscribe', { subscription: sub.toJSON(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone, reminders: await buildReminders(s.reminderTime ?? '17:00', s.reminderLead ?? 15) });
}

export async function sendTestPush(): Promise<void> {
  const sub = await currentSubscription(false);
  if (!sub) throw new Error('Notifications are not on.');
  await post('/test', { endpoint: sub.endpoint });
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription(false);
  if (sub) { await post('/unsubscribe', { endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe().catch(() => {}); }
  await updateSettings({ pushEnabled: false });
}
