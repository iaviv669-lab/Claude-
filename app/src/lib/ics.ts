// Build an iCalendar (.ics) file with weekly repeating workout events and an alert.
// Times are "floating" (no time zone), so the phone uses its own local time.

export interface ReminderDay { weekday: number /* 0 = Mon … 6 = Sun */; title: string; details: string }
export interface ReminderOptions { time: string /* "HH:MM" */; minutesBefore: number; durationMin: number; uidPrefix: string; now?: Date }

const BYDAY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

/** Escape text per RFC 5545. */
export const escapeText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Fold lines longer than 75 octets (UTF-8) with CRLF + space. */
export function fold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  for (const ch of line) {
    if (enc.encode(cur + ch).length > (out.length ? 74 : 75)) { out.push(cur); cur = ch; } else cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const pad = (n: number) => String(n).padStart(2, '0');
const local = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const utc = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

/** The next date (today or later) falling on `weekday` (0 = Mon), at hh:mm local. */
export function nextOccurrence(weekday: number, hh: number, mm: number, now = new Date()): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0);
  const todayMon0 = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() + ((weekday - todayMon0 + 7) % 7));
  return d;
}

export function buildIcs(days: ReminderDay[], o: ReminderOptions): string {
  const [hh, mm] = o.time.split(':').map(Number);
  const now = o.now ?? new Date();
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Ironrow//Workout reminders//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Ironrow workouts'];
  for (const d of days) {
    const start = nextOccurrence(d.weekday, hh, mm, now);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${o.uidPrefix}-${BYDAY[d.weekday].toLowerCase()}@ironrow`,
      `DTSTAMP:${utc(now)}`,
      `DTSTART:${local(start)}`,
      `DURATION:PT${Math.max(15, Math.round(o.durationMin))}M`,
      `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[d.weekday]}`,
      `SUMMARY:${escapeText(d.title)}`,
      `DESCRIPTION:${escapeText(d.details)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(d.title)}`,
      `TRIGGER:-PT${Math.max(0, Math.round(o.minutesBefore))}M`,
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
