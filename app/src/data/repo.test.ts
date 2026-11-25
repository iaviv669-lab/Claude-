import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './schema';
import * as r from './repo';

const SQUAT = 'x-back-squat', BENCH = 'x-barbell-bench-press', ROW = 'x-barbell-row';

beforeEach(async () => {
  await db.delete(); await db.open();
  await r.ensureSeeded();
  await r.finishOnboarding('kg', 'Gym', 'Full gym');
});

async function logSession(weights: number[], reps: number) {
  const id = await r.startSession(null, 'Test');
  await r.addExercisesToSession(id, [SQUAT]);
  const tree = (await r.getSessionTree(id))!;
  const sets = tree.exercises[0].sets;
  for (const [i, w] of weights.entries()) {
    const s = sets[i] ?? (await (async () => { await r.addSet(tree.exercises[0].se.id); return (await r.getSessionTree(id))!.exercises[0].sets[i]; })());
    await r.updateSet(s.id, { entries: [{ weightKg: w, reps, partialReps: 0 }] });
    await r.completeSet(s.id, true);
  }
  return { id, prs: await r.completeSession(id) };
}

describe('core loop', () => {
  it('seeds idempotently', async () => {
    const n = await db.exercises.count();
    await r.ensureSeeded();
    expect(await db.exercises.count()).toBe(n);
    expect(n).toBeGreaterThan(90);
  });

  it('only one active session', async () => {
    const a = await r.startSession(null);
    const b = await r.startSession(null);
    expect(b).toBe(a);
  });

  it('logs, completes, drops unticked sets, prefills next time, finds PRs', async () => {
    const first = await logSession([100, 100], 5);
    expect(first.prs).toEqual([]); // first time is not a record
    const t = await r.getSessionTree(first.id);
    expect(t!.exercises[0].sets).toHaveLength(2); // 3rd default set dropped
    expect(t!.session.status).toBe('completed');

    const id2 = await r.startSession(null);
    await r.addExercisesToSession(id2, [SQUAT]);
    const t2 = (await r.getSessionTree(id2))!;
    expect(t2.exercises[0].sets).toHaveLength(2);
    expect(t2.exercises[0].sets[0].entries[0]).toMatchObject({ weightKg: 100, reps: 5 });
    await r.discardSession(id2);
    expect(await r.getSessionTree(id2)).toBeNull();

    const second = await logSession([105], 5);
    expect(second.prs.map((p) => p.kind).sort()).toEqual(['e1rm', 'volume', 'weight']);
    const hist = await r.exerciseHistory(SQUAT);
    expect(hist.map((h) => h.heaviest)).toEqual([100, 105]);
  });

  it('rest only after the last exercise of a superset round', async () => {
    const id = await r.startSession(null);
    await r.addExercisesToSession(id, [BENCH, ROW]);
    let t = (await r.getSessionTree(id))!;
    await r.toggleSessionSuperset(t.exercises[0].se.id, 'next');
    t = (await r.getSessionTree(id))!;
    expect(t.exercises[0].se.supersetGroup).toBeTruthy();
    expect(t.exercises[0].se.supersetGroup).toBe(t.exercises[1].se.supersetGroup);
    expect(await r.completeSet(t.exercises[0].sets[0].id, true)).toBeNull();
    expect(await r.completeSet(t.exercises[1].sets[0].id, true)).toBe(150);
  });

  it('swap keeps ticked sets on the old exercise', async () => {
    const id = await r.startSession(null);
    await r.addExercisesToSession(id, [BENCH]);
    let t = (await r.getSessionTree(id))!;
    await r.updateSet(t.exercises[0].sets[0].id, { entries: [{ weightKg: 60, reps: 8, partialReps: 0 }] });
    await r.completeSet(t.exercises[0].sets[0].id, true);
    await r.swapInSession(t.exercises[0].se.id, 'x-dumbbell-bench-press');
    t = (await r.getSessionTree(id))!;
    expect(t.exercises.map((e) => e.se.exerciseId)).toEqual([BENCH, 'x-dumbbell-bench-press']);
    expect(t.exercises[0].sets).toHaveLength(1);
    expect(t.exercises[1].sets).toHaveLength(2);
  });

  it('templates round trip and supersets normalise', async () => {
    const wid = await r.saveWorkout({ name: 'Push', gymId: null }, [
      { ...r.defaultItem(BENCH), supersetGroup: 'g1' }, r.defaultItem(ROW), { ...r.defaultItem(SQUAT), supersetGroup: 'g1' },
    ]);
    const w = (await r.getWorkout(wid))!;
    expect(w.items.map((i) => i.supersetGroup)).toEqual([null, null, null]);
    const sid = await r.startSession(wid);
    const t = (await r.getSessionTree(sid))!;
    expect(t.session.name).toBe('Push');
    expect(t.exercises.map((e) => e.sets.length)).toEqual([3, 3, 3]);
  });

  it('smart warm-ups come before working sets', async () => {
    await r.updateSettings({ warmupAutomation: 'smart' });
    await logSession([100], 5);
    const id = await r.startSession(null);
    await r.addExercisesToSession(id, [SQUAT]);
    const sets = (await r.getSessionTree(id))!.exercises[0].sets;
    expect(sets.map((s) => s.type)).toEqual(['warmup', 'warmup', 'warmup', 'standard']);
    expect(sets.map((s) => s.entries[0].weightKg)).toEqual([40, 60, 80, 100]);
  });

  it('backup round trip', async () => {
    await logSession([80], 8);
    const json = await r.exportJSON();
    await db.sessions.clear();
    const counts = await r.importJSON(json);
    expect(counts.sessions).toBe(1);
    await expect(r.importJSON('{"app":"other"}')).rejects.toThrow();
    const csv = await r.exportCSV('kg');
    expect(csv.split('\n')[1]).toContain('Back Squat');
  });

  it('archives used custom exercises instead of deleting', async () => {
    const ex = await r.saveExercise({ name: 'My Press', primaryMuscles: ['chest'] });
    const id = await r.startSession(null);
    await r.addExercisesToSession(id, [ex.id]);
    const s = (await r.getSessionTree(id))!.exercises[0].sets[0];
    await r.updateSet(s.id, { entries: [{ weightKg: 10, reps: 10, partialReps: 0 }] });
    await r.completeSet(s.id, true);
    await r.completeSession(id);
    expect(await r.deleteExercise(ex.id)).toBe('archived');
    const ex2 = await r.saveExercise({ name: 'Unused' });
    expect(await r.deleteExercise(ex2.id)).toBe('deleted');
  });
});

describe('B01 concurrent field edits', () => {
  it('weight and reps written back-to-back both survive', async () => {
    const id = await r.startSession(null);
    await r.addExercisesToSession(id, [SQUAT]);
    const s = (await r.getSessionTree(id))!.exercises[0].sets[0];
    await Promise.all([r.patchEntry(s.id, 0, { weightKg: 100 }), r.patchEntry(s.id, 0, { reps: 5 })]);
    expect((await db.setLogs.get(s.id))!.entries[0]).toMatchObject({ weightKg: 100, reps: 5 });
  });
  it('tick fills blanks from placeholders atomically and refuses without reps', async () => {
    const id = await r.startSession(null);
    await r.addExercisesToSession(id, [SQUAT]);
    const s = (await r.getSessionTree(id))!.exercises[0].sets[0];
    expect(await r.tickSet(s.id, true, { weightKg: null, reps: null })).toBe('need-reps');
    await Promise.all([r.patchEntry(s.id, 0, { weightKg: 100 }), r.tickSet(s.id, true, { weightKg: 90, reps: 5 })]);
    const row = (await db.setLogs.get(s.id))!;
    expect(row.completed).toBe(1);
    expect(row.entries[0]).toMatchObject({ weightKg: 100, reps: 5 });
  });
});

describe('progression + records widget', () => {
  it('prefills weight up after hitting the top of the range', async () => {
    const wid = await r.saveWorkout({ name: 'L', gymId: null }, [{ ...r.defaultItem(SQUAT), targetSets: 2, repMin: 5, repMax: 8, targetRir: null }]);
    let id = await r.startSession(wid);
    let sets = (await r.getSessionTree(id))!.exercises[0].sets;
    for (const s of sets) { await r.updateSet(s.id, { entries: [{ weightKg: 100, reps: 8, partialReps: 0 }] }); await r.completeSet(s.id, true); }
    await r.completeSession(id);
    id = await r.startSession(wid);
    const t = (await r.getSessionTree(id))!;
    expect(t.exercises[0].sets[0].entries[0]).toMatchObject({ weightKg: 102.5, reps: 5 });
    expect(t.exercises[0].se.progressionNote).toMatch(/weight up/);
  });
  it('lists recent records', async () => {
    await logSession([100], 5);
    await logSession([110], 5);
    const recs = await r.recentRecords();
    expect(recs.some((x) => x.kind === 'weight' && x.value === 110)).toBe(true);
  });
});

describe('CSV import', () => {
  it('round-trips our own export and is idempotent', async () => {
    await logSession([100, 100], 5);
    const csv = await r.exportCSV('kg');
    await db.sessions.clear(); await db.sessionExercises.clear(); await db.setLogs.clear();
    const a = await r.importSetsCSV(csv, 'kg');
    expect(a).toMatchObject({ sessions: 1, sets: 2, skipped: 0, newExercises: [] });
    const b = await r.importSetsCSV(csv, 'kg');
    expect(b).toMatchObject({ sessions: 0, skipped: 1 });
    expect((await r.exerciseHistory(SQUAT))[0].heaviest).toBe(100);
  });
  it('reads a Strong-style export in lb with an unknown exercise', async () => {
    const csv = 'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,RPE\n"2024-03-01 18:00:00",Legs,1h 5m,Squat,1,225,5,8\n"2024-03-01 18:00:00",Legs,1h 5m,Squat,2,225,5,9\n"2024-03-01 18:00:00",Legs,1h 5m,Zorb Squat,1,180,10,\n';
    const res = await r.importSetsCSV(csv, 'lb');
    expect(res).toMatchObject({ sessions: 1, sets: 3, newExercises: ['Zorb Squat'] });
    const h = await r.exerciseHistory(SQUAT); // "squat" matches the alias on Back Squat
    expect(Math.round(h[0].heaviest * 2.2046226218)).toBe(225);
    const s = (await db.sessions.toArray())[0];
    expect((s.endedAt! - s.startedAt) / 60000).toBe(65);
  });
  it('rejects a file without the needed columns', async () => {
    await expect(r.importSetsCSV('foo,bar\n1,2', 'kg')).rejects.toThrow(/date, exercise and reps/);
  });
});

describe('exercise library', () => {
  it('loads the big library once, alongside the core list, without duplicates', async () => {
    const n = await db.exercises.count();
    expect(n).toBeGreaterThan(650);
    const names = (await db.exercises.toArray()).map((e) => e.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    expect((await db.settings.get('me'))!.librarySeeded).toBe(r.LIBRARY_VERSION);
    await r.ensureSeeded();
    expect(await db.exercises.count()).toBe(n);
    const pendlay = (await r.searchExercises({ q: 'pendlay' }))[0];
    expect(pendlay.name).toBe('Pendlay Row');
    const withSteps = (await db.exercises.toArray()).filter((e) => e.steps?.length);
    expect(withSteps.length).toBeGreaterThan(400);
  });
  it('existing devices get the library on upgrade and keep their data', async () => {
    const custom = await r.saveExercise({ name: 'My Press', primaryMuscles: ['chest'] });
    await db.exercises.where('id').startsWith('g-').delete();
    await r.updateSettings({ librarySeeded: 0 });
    await r.ensureSeeded();
    expect(await db.exercises.get(custom.id)).toBeTruthy();
    expect(await db.exercises.where('id').startsWith('g-').count()).toBeGreaterThan(400);
  });
});
