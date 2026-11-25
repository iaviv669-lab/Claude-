export interface PlateResult { perSide: number[]; loaded: number; exact: boolean; }

/**
 * Plates per side to reach `total` on a bar of `bar` weight, greedy from the heaviest plate.
 * Assumes an unlimited number of pairs of each available plate size.
 * All values in one unit (the gym's plate unit). Returns null if total < bar.
 */
export function plateBreakdown(total: number, bar: number, plates: number[]): PlateResult | null {
  if (!(total >= bar)) return null;
  const sizes = [...new Set(plates)].filter((p) => p > 0).sort((a, b) => b - a);
  let remaining = Math.round(((total - bar) / 2) * 1000) / 1000;
  const perSide: number[] = [];
  for (const p of sizes) {
    while (remaining + 1e-9 >= p) {
      perSide.push(p);
      remaining = Math.round((remaining - p) * 1000) / 1000;
    }
  }
  const loaded = bar + perSide.reduce((a, b) => a + b, 0) * 2;
  return { perSide, loaded: Math.round(loaded * 1000) / 1000, exact: remaining < 1e-6 };
}

/** Closest loadable totals at or below and above a target. */
export function nearestLoadable(total: number, bar: number, plates: number[]): { below: number; above: number } {
  const smallest = Math.min(...plates.filter((p) => p > 0));
  const step = smallest * 2;
  const below = plateBreakdown(total, bar, plates)?.loaded ?? bar;
  let above = below;
  for (let t = below + step; t <= total + step * 20; t += step) {
    const r = plateBreakdown(t, bar, plates);
    if (r && r.exact && r.loaded >= total) { above = r.loaded; break; }
  }
  return { below, above };
}
