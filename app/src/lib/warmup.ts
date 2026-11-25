import type { WarmupStep } from '../data/schema';

/** Warm-up weights from a % scheme of the first working weight, rounded to `step`, skipping duplicates and the empty bar floor. */
export function warmupSets(workingKg: number, scheme: WarmupStep[], stepKg = 2.5, floorKg = 0): { weightKg: number; reps: number }[] {
  if (!(workingKg > 0)) return [];
  const out: { weightKg: number; reps: number }[] = [];
  for (const s of scheme) {
    const w = Math.max(floorKg, Math.round((workingKg * s.pct) / stepKg) * stepKg);
    if (w >= workingKg) continue;
    if (out.length && out[out.length - 1].weightKg === w) continue;
    out.push({ weightKg: w, reps: s.reps });
  }
  return out;
}
