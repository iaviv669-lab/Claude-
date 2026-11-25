/**
 * Double progression (a standard, public method):
 * - every working set last time reached the top of the rep range (and wasn't harder than the RIR target)
 *   → add the smallest weight step, aim for the bottom of the range;
 * - otherwise keep the weight and try for one more rep on each set (capped at the top of the range).
 */
export interface PrevSet { weightKg: number | null; reps: number | null; rir: number | null; }
export interface Suggestion { weightKg: number; reps: number; up: boolean; note: string; }

export function suggestProgression(prev: PrevSet[], repMin: number, repMax: number, targetRir: number | null, stepKg: number): Suggestion | null {
  const working = prev.filter((p) => p.weightKg && p.reps != null);
  if (!working.length || !(stepKg > 0)) return null;
  const weight = Math.max(...working.map((p) => p.weightKg!));
  const atTop = working.filter((p) => p.weightKg === weight).every((p) => p.reps! >= repMax && (targetRir == null || p.rir == null || p.rir >= targetRir));
  if (atTop) return { weightKg: Math.round((weight + stepKg) * 1000) / 1000, reps: repMin, up: true, note: 'Hit the top of the range last time: weight up' };
  const minReps = Math.min(...working.filter((p) => p.weightKg === weight).map((p) => p.reps!));
  return { weightKg: weight, reps: Math.min(repMax, Math.max(repMin, minReps + 1)), up: false, note: 'Same weight, aim for one more rep' };
}
