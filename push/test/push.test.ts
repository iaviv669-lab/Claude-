import { describe, expect, it } from 'vitest';
import { b64u, decryptPayload, encryptPayload, unb64u, vapidAuth, sendPush } from '../src/webpush';
import { dueReminders, localParts, validate, type Entry } from '../src/schedule';

async function subscriber() {
  const keys = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
  const auth = crypto.getRandomValues(new Uint8Array(16));
  const p256dh = b64u(await crypto.subtle.exportKey('raw', keys.publicKey));
  return { keys, auth, sub: { endpoint: 'https://web.push.apple.com/QAbc', keys: { p256dh, auth: b64u(auth) } } };
}
async function vapidKeys() {
  const k = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey('jwk', k.privateKey);
  return { pair: k, v: { publicKey: b64u(await crypto.subtle.exportKey('raw', k.publicKey)), privateKey: jwk.d!, subject: 'https://example.com/' } };
}

describe('web push encryption (RFC 8291)', () => {
  it('round trips and has the aes128gcm header layout', async () => {
    const s = await subscriber();
    const msg = new TextEncoder().encode(JSON.stringify({ title: 'Ironrow: Upper 1', body: 'Incline Dumbbell Press, Pec Deck…' }));
    const body = await encryptPayload(s.sub, msg);
    expect(body.length).toBe(16 + 4 + 1 + 65 + msg.length + 1 + 16);
    expect(new DataView(body.buffer).getUint32(16)).toBe(4096);
    expect(body[20]).toBe(65);
    const out = await decryptPayload(body, s.keys, s.auth);
    expect(new TextDecoder().decode(out)).toBe(new TextDecoder().decode(msg));
  });
  it('fails to decrypt with the wrong auth secret', async () => {
    const s = await subscriber();
    const body = await encryptPayload(s.sub, new TextEncoder().encode('hi'));
    await expect(decryptPayload(body, s.keys, new Uint8Array(16))).rejects.toThrow();
  });
});

describe('VAPID (RFC 8292)', () => {
  it('signs a JWT for the push origin that verifies with the public key', async () => {
    const { pair, v } = await vapidKeys();
    const h = await vapidAuth('https://web.push.apple.com/QAbc?x=1', v, 1_800_000_000);
    const m = h.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/)!;
    expect(m[4]).toBe(v.publicKey);
    const claims = JSON.parse(new TextDecoder().decode(unb64u(m[2])));
    expect(claims).toEqual({ aud: 'https://web.push.apple.com', exp: 1_800_000_000 + 43200, sub: 'https://example.com/' });
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pair.publicKey, unb64u(m[3]), new TextEncoder().encode(`${m[1]}.${m[2]}`));
    expect(ok).toBe(true);
  });
  it('sendPush posts an encrypted body with the right headers', async () => {
    const s = await subscriber(); const { v } = await vapidKeys();
    let seen: { url: string; init: RequestInit } | null = null;
    const status = await sendPush(s.sub, { title: 't' }, v, 60, (async (url: string, init: RequestInit) => { seen = { url, init }; return new Response(null, { status: 201 }); }) as unknown as typeof fetch);
    expect(status).toBe(201);
    const hdr = seen!.init.headers as Record<string, string>;
    expect(hdr['Content-Encoding']).toBe('aes128gcm');
    expect(hdr.TTL).toBe('60');
    expect(hdr.Authorization.startsWith('vapid t=')).toBe(true);
    const out = await decryptPayload(seen!.init.body as Uint8Array, s.keys, s.auth);
    expect(JSON.parse(new TextDecoder().decode(out))).toEqual({ title: 't' });
  });
});

describe('schedule', () => {
  const entry = (tz: string, time = '17:45'): Entry => ({ sub: { endpoint: 'https://web.push.apple.com/x', keys: { p256dh: 'a', auth: 'b' } }, tz, lastSent: {}, updatedAt: 0,
    reminders: [{ id: 'mon', weekday: 0, time, title: 'Ironrow: Upper 1', body: '' }, { id: 'thu', weekday: 3, time, title: 'Ironrow: Upper 2', body: '' }] });
  it('local parts in a time zone', () => {
    // 2026-11-26T15:50Z is Thursday 17:50 in Jerusalem (UTC+2 in winter)
    expect(localParts(new Date('2026-11-26T15:50:00Z'), 'Asia/Jerusalem')).toEqual({ weekday: 3, minutes: 17 * 60 + 50, date: '2026-11-26' });
  });
  it('fires on the right day within the window, once per day', () => {
    const e = entry('Asia/Jerusalem');
    expect(dueReminders(e, new Date('2026-11-26T15:40:00Z')).map((r) => r.id)).toEqual([]); // 17:40, too early
    expect(dueReminders(e, new Date('2026-11-26T15:50:00Z')).map((r) => r.id)).toEqual(['thu']); // 17:50
    expect(dueReminders(e, new Date('2026-11-26T16:20:00Z')).map((r) => r.id)).toEqual([]); // 18:20, window passed
    e.lastSent.thu = '2026-11-26';
    expect(dueReminders(e, new Date('2026-11-26T15:55:00Z'))).toEqual([]); // already sent today
    expect(dueReminders(e, new Date('2026-11-27T15:50:00Z'))).toEqual([]); // Friday
  });
  it('validates input', () => {
    const good = { subscription: { endpoint: 'https://web.push.apple.com/abc', keys: { p256dh: 'x', auth: 'y' } }, tz: 'Asia/Jerusalem', reminders: [{ id: 'mon', weekday: 0, time: '17:45', title: 'x', body: 'y' }] };
    expect(validate(good)).toBeNull();
    expect(validate({ ...good, subscription: { ...good.subscription, endpoint: 'https://evil.example.com/x' } })).toBe('unknown push service');
    expect(validate({ ...good, tz: 'Mars/Base' })).toBe('bad time zone');
    expect(validate({ ...good, reminders: [{ ...good.reminders[0], time: '25:00' }] })).toBe('bad reminder');
  });
});
