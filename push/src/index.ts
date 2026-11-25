// Ironrow push server: stores each phone's push subscription + weekly reminder schedule,
// and every 5 minutes sends the reminders that are due (Web Push, VAPID).
import { sendPush, type VapidKeys } from './webpush';
import { dueReminders, validate, type Entry } from './schedule';

interface Env { SUBS: KVNamespace; VAPID_PUBLIC_KEY: string; VAPID_PRIVATE_KEY: string; VAPID_SUBJECT: string; ALLOWED_ORIGINS: string }

const vapid = (env: Env): VapidKeys => ({ publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT });

async function keyFor(endpoint: string): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint)));
  return 'sub:' + [...h.slice(0, 16)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

function cors(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const ok = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).includes(origin);
  return ok ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' } : { Vary: 'Origin' };
}

const json = (data: unknown, status: number, headers: Record<string, string>) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const h = cors(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    const url = new URL(req.url);
    try {
      if (req.method === 'GET' && url.pathname === '/') return json({ ok: true, service: 'ironrow-push' }, 200, h);
      if (req.method === 'GET' && url.pathname === '/vapid') return json({ publicKey: env.VAPID_PUBLIC_KEY }, 200, h);
      if (req.method === 'POST' && url.pathname === '/subscribe') {
        const body = await req.json();
        const err = validate(body);
        if (err) return json({ ok: false, error: err }, 400, h);
        const b = body as { subscription: Entry['sub']; tz: string; reminders: Entry['reminders'] };
        const key = await keyFor(b.subscription.endpoint);
        const prev = (await env.SUBS.get(key, 'json')) as Entry | null;
        const entry: Entry = { sub: b.subscription, tz: b.tz, reminders: b.reminders, lastSent: prev?.lastSent ?? {}, updatedAt: Date.now() };
        await env.SUBS.put(key, JSON.stringify(entry));
        return json({ ok: true, reminders: entry.reminders.length }, 200, h);
      }
      if (req.method === 'POST' && (url.pathname === '/unsubscribe' || url.pathname === '/test')) {
        const { endpoint } = (await req.json()) as { endpoint?: string };
        if (!endpoint) return json({ ok: false, error: 'missing endpoint' }, 400, h);
        const key = await keyFor(endpoint);
        if (url.pathname === '/unsubscribe') { await env.SUBS.delete(key); return json({ ok: true }, 200, h); }
        const entry = (await env.SUBS.get(key, 'json')) as Entry | null;
        if (!entry) return json({ ok: false, error: 'not subscribed' }, 404, h);
        const status = await sendPush(entry.sub, { title: 'Ironrow', body: 'Notifications are working. You’ll get a reminder on your workout days.', url: './' }, vapid(env), 600);
        return json({ ok: status >= 200 && status < 300, status }, 200, h);
      }
      return json({ ok: false, error: 'not found' }, 404, h);
    } catch (e) {
      return json({ ok: false, error: e instanceof Error ? e.message : 'error' }, 500, h);
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    const now = new Date();
    let cursor: string | undefined;
    do {
      const page = await env.SUBS.list({ prefix: 'sub:', cursor });
      for (const k of page.keys) {
        const entry = (await env.SUBS.get(k.name, 'json')) as Entry | null;
        if (!entry) continue;
        const due = dueReminders(entry, now);
        if (!due.length) continue;
        const date = new Intl.DateTimeFormat('en-CA', { timeZone: entry.tz }).format(now); // YYYY-MM-DD
        let gone = false;
        for (const r of due) {
          const status = await sendPush(entry.sub, { title: r.title, body: r.body, url: './', tag: r.id }, vapid(env));
          if (status === 404 || status === 410) { gone = true; break; }
          entry.lastSent[r.id] = date;
        }
        if (gone) await env.SUBS.delete(k.name);
        else await env.SUBS.put(k.name, JSON.stringify(entry));
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
  },
};
