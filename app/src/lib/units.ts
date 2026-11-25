import type { Unit } from '../data/schema';

export const LB_PER_KG = 2.2046226218;

export const toKg = (v: number, unit: Unit) => (unit === 'kg' ? v : v / LB_PER_KG);
export const fromKg = (kg: number, unit: Unit) => (unit === 'kg' ? kg : kg * LB_PER_KG);

/** Display a stored kg value in the user's unit, rounded to 0.01 then trimmed. */
export function fmtWeight(kg: number | null | undefined, unit: Unit, withUnit = false): string {
  if (kg == null || Number.isNaN(kg)) return '';
  const v = Math.round(fromKg(kg, unit) * 100) / 100;
  const s = Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
  return withUnit ? `${s} ${unit}` : s;
}

/** Parse user input accepting both "." and "," as decimal separators. */
export function parseNum(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function fmtVolume(kg: number, unit: Unit): string {
  const v = fromKg(kg, unit);
  if (v >= 10000) return `${(v / 1000).toFixed(1)}k ${unit}`;
  return `${Math.round(v).toLocaleString()} ${unit}`;
}
