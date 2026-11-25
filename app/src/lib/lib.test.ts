import { describe, expect, it } from 'vitest';
import { plateBreakdown, nearestLoadable } from './plates';
import { e1rm, nRm } from './e1rm';
import { fmtWeight, parseNum, toKg } from './units';
import { warmupSets } from './warmup';
import { weekStart, fmtClock } from './time';

describe('plates', () => {
  const lb = [45, 35, 25, 10, 5, 2.5];
  it('135 on a 45 bar is one 45 a side', () => expect(plateBreakdown(135, 45, lb)).toEqual({ perSide: [45], loaded: 135, exact: true }));
  it('100 on a 45 bar is 25+2.5 a side', () => expect(plateBreakdown(100, 45, lb)?.perSide).toEqual([25, 2.5]));
  it('just the bar', () => expect(plateBreakdown(20, 20, [25, 20]) ).toEqual({ perSide: [], loaded: 20, exact: true }));
  it('below the bar is null', () => expect(plateBreakdown(10, 20, [5])).toBeNull());
  it('flags an unloadable weight', () => {
    const r = plateBreakdown(101, 45, lb)!;
    expect(r.exact).toBe(false);
    expect(r.loaded).toBe(100);
  });
  it('kg fractional plates', () => expect(plateBreakdown(62.5, 20, [25, 20, 15, 10, 5, 2.5, 1.25])?.perSide).toEqual([20, 1.25]));
  it('nearest loadable', () => expect(nearestLoadable(101, 45, lb)).toEqual({ below: 100, above: 105 }));
});

describe('e1rm', () => {
  it('single is itself', () => expect(e1rm(100, 1)).toBe(100));
  it('epley 100x10', () => expect(e1rm(100, 10)).toBeCloseTo(133.33, 1));
  it('no estimate past 12 reps', () => expect(e1rm(50, 20)).toBeNull());
  it('round trip', () => expect(nRm(e1rm(100, 5)!, 5)).toBeCloseTo(100, 6));
});

describe('units', () => {
  it('round trips lb display', () => expect(fmtWeight(toKg(135, 'lb'), 'lb')).toBe('135'));
  it('kg display trims', () => expect(fmtWeight(62.5, 'kg')).toBe('62.5'));
  it('comma decimals', () => expect(parseNum('22,5')).toBe(22.5));
  it('rejects junk', () => { expect(parseNum('abc')).toBeNull(); expect(parseNum('-3')).toBeNull(); expect(parseNum('')).toBeNull(); });
});

describe('warmups', () => {
  const scheme = [{ pct: 0.4, reps: 8 }, { pct: 0.6, reps: 5 }, { pct: 0.8, reps: 3 }];
  it('100kg working', () => expect(warmupSets(100, scheme)).toEqual([{ weightKg: 40, reps: 8 }, { weightKg: 60, reps: 5 }, { weightKg: 80, reps: 3 }]));
  it('floors to bar and drops duplicates', () => expect(warmupSets(30, scheme, 2.5, 20)).toEqual([{ weightKg: 20, reps: 8 }, { weightKg: 25, reps: 3 }]));
  it('nothing for zero', () => expect(warmupSets(0, scheme)).toEqual([]));
});

describe('time', () => {
  it('monday week start', () => expect(weekStart('2026-11-25', 1)).toBe('2026-11-23'));
  it('sunday week start', () => expect(weekStart('2026-11-25', 0)).toBe('2026-11-22'));
  it('clock', () => { expect(fmtClock(90)).toBe('1:30'); expect(fmtClock(3725)).toBe('1:02:05'); });
});
