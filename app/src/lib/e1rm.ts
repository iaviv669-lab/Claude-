import type { SetEntry, SetLog } from '../data/schema';

/** Epley estimate. Reps above 12 are unreliable, so they give no estimate. */
export function e1rm(weightKg: number, reps: number): number | null {
  if (!weightKg || !reps || reps < 1 || reps > 12) return null;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

/** Estimated max for N reps, from a 1RM, inverting Epley. */
export const nRm = (oneRm: number, n: number) => (n === 1 ? oneRm : oneRm / (1 + n / 30));

export const entryVolume = (e: SetEntry) => (e.weightKg ?? 0) * ((e.reps ?? 0) + (e.partialReps ?? 0) * 0.5);

/** Working sets count toward volume and records; warm-ups don't. */
export const isWorking = (s: Pick<SetLog, 'type' | 'completed'>) => s.completed === 1 && s.type !== 'warmup';

export function setVolume(s: SetLog, bodyweightKg = 0): number {
  return s.entries.reduce((sum, e) => sum + entryVolume({ ...e, weightKg: (e.weightKg ?? 0) + bodyweightKg }), 0);
}

export function bestE1rm(s: SetLog): number | null {
  let best: number | null = null;
  for (const e of s.entries) {
    const v = e1rm(e.weightKg ?? 0, e.reps ?? 0);
    if (v != null && (best == null || v > best)) best = v;
  }
  return best;
}
