/** RFC 4180 CSV parser (quotes, escaped quotes, newlines in quotes, CRLF). */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',' || c === ';' && !s.slice(0, s.indexOf('\n')).includes(',')) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

export interface ImportedSet { when: number; workout: string; exercise: string; weight: number | null; reps: number | null; type: 'standard' | 'warmup' | 'drop' | 'failure'; rir: number | null; order: number; durationMin: number | null; }

const find = (h: string[], ...names: string[]) => h.findIndex((x) => names.includes(x));

export function parseDate(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3], +(iso[4] ?? 12), +(iso[5] ?? 0)).getTime();
  const n = Date.parse(t.replace(/,/, ''));
  return Number.isFinite(n) ? n : null;
}

function parseDuration(v: string): number | null {
  const h = v.match(/(\d+)\s*h/), m = v.match(/(\d+)\s*m/);
  if (h || m) return (h ? +h[1] * 60 : 0) + (m ? +m[1] : 0);
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? (n > 600 ? Math.round(n / 60) : n) : null;
}

/** Map a set-per-row CSV (ours, Strong-style, Hevy-style, or a simple sheet) into sets. Weight unit from the header, else `fallback`. */
export function mapSets(rows: string[][], fallback: 'kg' | 'lb'): { sets: ImportedSet[]; unit: 'kg' | 'lb'; error?: string } {
  if (rows.length < 2) return { sets: [], unit: fallback, error: 'The file has no rows.' };
  const h = rows[0].map((x) => x.trim().toLowerCase());
  const iDate = find(h, 'date', 'start_time', 'start time', 'workout date', 'day');
  const iWorkout = find(h, 'workout', 'workout name', 'title', 'workout_name', 'routine');
  const iEx = find(h, 'exercise', 'exercise name', 'exercise_title', 'exercise_name', 'movement', 'lift');
  let iW = find(h, 'weight_kg', 'weight (kg)', 'kg');
  let unit: 'kg' | 'lb' = fallback;
  if (iW >= 0) unit = 'kg';
  else { iW = find(h, 'weight_lb', 'weight_lbs', 'weight (lb)', 'weight (lbs)', 'lbs', 'lb'); if (iW >= 0) unit = 'lb'; else iW = find(h, 'weight', 'load'); }
  const iReps = find(h, 'reps', 'rep', 'repetitions');
  const iOrder = find(h, 'set', 'set order', 'set_index', 'set number');
  const iType = find(h, 'type', 'set_type', 'set type');
  const iRir = find(h, 'rir');
  const iRpe = find(h, 'rpe');
  const iDur = find(h, 'duration', 'duration (min)', 'duration_min');
  if (iDate < 0 || iEx < 0 || iReps < 0) return { sets: [], unit, error: 'Needs at least date, exercise and reps columns.' };
  const num = (v: string | undefined) => { if (v == null || v.trim() === '') return null; const n = Number(v.replace(',', '.')); return Number.isFinite(n) ? n : null; };
  const sets: ImportedSet[] = [];
  for (const r of rows.slice(1)) {
    const when = parseDate(r[iDate] ?? '');
    const exercise = (r[iEx] ?? '').trim();
    if (when == null || !exercise) continue;
    const t = (iType >= 0 ? r[iType] ?? '' : '').toLowerCase();
    const type = t.startsWith('w') ? 'warmup' : t.startsWith('d') ? 'drop' : t.startsWith('f') ? 'failure' : 'standard';
    const rpe = iRpe >= 0 ? num(r[iRpe]) : null;
    sets.push({
      when, exercise, type,
      workout: (iWorkout >= 0 ? r[iWorkout] : '')?.trim() || 'Imported workout',
      weight: iW >= 0 ? num(r[iW]) : null,
      reps: num(r[iReps]),
      rir: iRir >= 0 ? num(r[iRir]) : rpe != null ? Math.max(0, Math.round(10 - rpe)) : null,
      order: iOrder >= 0 ? num(r[iOrder]) ?? 0 : 0,
      durationMin: iDur >= 0 ? parseDuration(r[iDur] ?? '') : null,
    });
  }
  return { sets, unit };
}
