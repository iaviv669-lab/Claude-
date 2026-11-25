// The data layer. Screens call only these. Each write is one Dexie transaction.
import { db, newId, now } from './schema';
import type {
  Exercise, GymProfile, Id, Program, Session, SessionExercise, SetLog, SetType, Settings, Unit, Workout, WorkoutItem,
  Muscle, BodyWeight,
} from './schema';
import { seedExercises } from './seed';
import { localDate } from '../lib/time';
import { warmupSets } from '../lib/warmup';
import { bestE1rm, isWorking, setVolume } from '../lib/e1rm';
import { toKg } from '../lib/units';

// ---------- settings & first run ----------

export const DEFAULT_SETTINGS: Omit<Settings, 'createdAt' | 'updatedAt'> = {
  id: 'me',
  unit: 'kg',
  theme: 'system',
  weekStartsOn: 1,
  autoAdvance: true,
  keepAwake: true,
  bodyweightContribution: false,
  prefill: 'previous',
  restDefaults: { compound_lower: 180, compound_upper: 150, isolation_lower: 90, isolation_upper: 90, core: 60 },
  warmupAutomation: 'off',
  warmupScheme: [{ pct: 0.4, reps: 8 }, { pct: 0.6, reps: 5 }, { pct: 0.8, reps: 3 }],
  activeGymId: null,
  activeProgramId: null,
  onboarded: false,
};

export const GYM_PRESETS: Record<string, Pick<GymProfile, 'equipment'>> = {
  'Full gym': { equipment: ['barbell', 'dumbbell', 'kettlebell', 'machine', 'cable', 'smith', 'ez_bar', 'trap_bar', 'band', 'pullup_bar', 'dip_bars', 'bench', 'bodyweight'] },
  'Home: barbell + rack': { equipment: ['barbell', 'dumbbell', 'bench', 'pullup_bar', 'band', 'bodyweight'] },
  'Home: dumbbells': { equipment: ['dumbbell', 'bench', 'band', 'bodyweight'] },
  'Bodyweight only': { equipment: ['bodyweight', 'pullup_bar', 'band'] },
};

export const plateDefaults = (unit: Unit) =>
  unit === 'kg'
    ? { barWeightsKg: [20, 15, 10], platesKg: [25, 20, 15, 10, 5, 2.5, 1.25], dumbbellIncrementKg: 2 }
    : { barWeightsKg: [45, 35].map((w) => toKg(w, 'lb')), platesKg: [45, 35, 25, 10, 5, 2.5].map((w) => toKg(w, 'lb')), dumbbellIncrementKg: toKg(5, 'lb') };

export async function ensureSeeded() {
  await db.transaction('rw', db.settings, db.exercises, async () => {
    if (!(await db.settings.get('me'))) await db.settings.put({ ...DEFAULT_SETTINGS, createdAt: now(), updatedAt: now() });
    const builtIns = seedExercises(now());
    const existing = new Set(await db.exercises.where('isCustom').equals(0).primaryKeys());
    const missing = builtIns.filter((e) => !existing.has(e.id));
    if (missing.length) await db.exercises.bulkPut(missing);
  });
}

export async function getSettings(): Promise<Settings> {
  return (await db.settings.get('me')) ?? { ...DEFAULT_SETTINGS, createdAt: 0, updatedAt: 0 };
}

export async function updateSettings(patch: Partial<Settings>) {
  await db.settings.update('me', { ...patch, updatedAt: now() });
}

export async function finishOnboarding(unit: Unit, gymName: string, preset: keyof typeof GYM_PRESETS) {
  await db.transaction('rw', db.settings, db.gyms, async () => {
    const gym: GymProfile = { id: newId(), createdAt: now(), updatedAt: now(), name: gymName, icon: 'dumbbell', unit, ...GYM_PRESETS[preset], ...plateDefaults(unit) };
    await db.gyms.put(gym);
    await db.settings.update('me', { unit, activeGymId: gym.id, onboarded: true, updatedAt: now() });
  });
}

// ---------- exercises ----------

export interface ExerciseFilter { q?: string; muscles?: Muscle[]; equipment?: string[]; type?: string; includeArchived?: boolean; }

export function matchExercise(e: Exercise, f: ExerciseFilter): boolean {
  if (!f.includeArchived && e.archived) return false;
  if (f.q) {
    const words = f.q.toLowerCase().split(/\s+/).filter(Boolean);
    const hay = [e.name, ...e.aliases].join(' ').toLowerCase();
    if (!words.every((w) => hay.includes(w))) return false;
  }
  if (f.muscles?.length && !f.muscles.some((m) => e.primaryMuscles.includes(m) || e.secondaryMuscles.includes(m))) return false;
  if (f.equipment?.length && !e.equipment.some((q) => f.equipment!.includes(q))) return false;
  if (f.type && e.type !== f.type) return false;
  return true;
}

export async function searchExercises(f: ExerciseFilter): Promise<Exercise[]> {
  const all = await db.exercises.toArray();
  return all.filter((e) => matchExercise(e, f)).sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveExercise(e: Partial<Exercise> & { name: string }): Promise<Exercise> {
  const t = now();
  const prev = e.id ? await db.exercises.get(e.id) : undefined;
  const row: Exercise = {
    aliases: [], isCustom: 1, archived: 0, trackedMetric: 'weight_reps', type: 'isolation_upper', laterality: 'bilateral',
    pattern: 'isolation', primaryMuscles: [], secondaryMuscles: [], equipment: [], isBodyweight: false, bodyweightPct: 0,
    notes: '', restOverrideSec: null, warmupOverride: null,
    ...prev, ...e, id: e.id ?? newId(), createdAt: prev?.createdAt ?? t, updatedAt: t,
  } as Exercise;
  await db.exercises.put(row);
  return row;
}

/** Custom exercises used in history are archived, not deleted. Returns what happened. */
export async function deleteExercise(id: Id): Promise<'deleted' | 'archived'> {
  return db.transaction('rw', db.exercises, db.setLogs, db.workoutItems, async () => {
    const used = (await db.setLogs.where('[exerciseId+completedAt]').between([id, -Infinity], [id, Infinity]).count()) > 0;
    if (used) { await db.exercises.update(id, { archived: 1, updatedAt: now() }); return 'archived'; }
    await db.workoutItems.where('exerciseId').equals(id).delete();
    await db.exercises.delete(id);
    return 'deleted';
  });
}

export async function suggestSwaps(exerciseId: Id, gymId: Id | null, limit = 8): Promise<Exercise[]> {
  const ex = await db.exercises.get(exerciseId);
  if (!ex) return [];
  const gym = gymId ? await db.gyms.get(gymId) : undefined;
  const all = await db.exercises.filter((e) => !e.archived && e.id !== exerciseId).toArray();
  const scored = all
    .filter((e) => !gym || e.equipment.some((q) => gym.equipment.includes(q)))
    .map((e) => {
      const shared = e.primaryMuscles.filter((m) => ex.primaryMuscles.includes(m)).length;
      const score = shared * 3 + (e.pattern === ex.pattern ? 2 : 0) + (e.type === ex.type ? 1 : 0);
      return { e, score, shared };
    })
    .filter((x) => x.shared > 0)
    .sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name));
  return scored.slice(0, limit).map((x) => x.e);
}

// ---------- gyms ----------

export async function saveGym(g: Partial<GymProfile> & { name: string }, unit: Unit): Promise<GymProfile> {
  const prev = g.id ? await db.gyms.get(g.id) : undefined;
  const row: GymProfile = { icon: 'dumbbell', unit, ...GYM_PRESETS['Full gym'], ...plateDefaults(unit), ...prev, ...g, id: g.id ?? newId(), createdAt: prev?.createdAt ?? now(), updatedAt: now() } as GymProfile;
  await db.gyms.put(row);
  return row;
}

export async function deleteGym(id: Id): Promise<boolean> {
  if ((await db.gyms.count()) <= 1) return false;
  await db.transaction('rw', db.gyms, db.workouts, db.settings, async () => {
    await db.workouts.where('id').above('').modify((w) => { if (w.gymId === id) w.gymId = null; });
    await db.gyms.delete(id);
    const s = await db.settings.get('me');
    if (s?.activeGymId === id) await db.settings.update('me', { activeGymId: (await db.gyms.toCollection().first())?.id ?? null });
  });
  return true;
}

// ---------- workouts (templates) ----------

export interface ItemDraft { id?: Id; exerciseId: Id; supersetGroup: Id | null; targetSets: number; repMin: number; repMax: number; targetRir: number | null; restSec: number | null; }

export function defaultItem(exerciseId: Id): ItemDraft {
  return { exerciseId, supersetGroup: null, targetSets: 3, repMin: 8, repMax: 12, targetRir: 2, restSec: null };
}

export async function saveWorkout(w: { id?: Id; name: string; gymId: Id | null; programId?: Id | null; notes?: string }, items: ItemDraft[]): Promise<Id> {
  return db.transaction('rw', db.workouts, db.workoutItems, async () => {
    const t = now();
    const prev = w.id ? await db.workouts.get(w.id) : undefined;
    const id = w.id ?? newId();
    await db.workouts.put({ archived: 0, notes: '', programId: null, ...prev, ...w, id, createdAt: prev?.createdAt ?? t, updatedAt: t } as Workout);
    await db.workoutItems.where('workoutId').equals(id).delete();
    await db.workoutItems.bulkPut(
      normaliseSupersets(items).map((it, i) => ({ ...it, id: it.id ?? newId(), workoutId: id, order: i, createdAt: t, updatedAt: t })),
    );
    return id;
  });
}

/** A superset group only survives if its members are adjacent and there are at least two. */
export function normaliseSupersets<T extends { supersetGroup: Id | null }>(items: T[]): T[] {
  const out = items.map((x) => ({ ...x }));
  for (let i = 0; i < out.length; i++) {
    const g = out[i].supersetGroup;
    if (!g) continue;
    const adj = (i > 0 && out[i - 1].supersetGroup === g) || (i < out.length - 1 && out[i + 1].supersetGroup === g);
    if (!adj) out[i].supersetGroup = null;
  }
  // a group split in two runs keeps only the first run
  const seen = new Map<Id, number>();
  for (let i = 0; i < out.length; i++) {
    const g = out[i].supersetGroup;
    if (!g) continue;
    const startedRun = i === 0 || out[i - 1].supersetGroup !== g;
    if (startedRun) {
      if (seen.has(g)) { let j = i; while (j < out.length && out[j].supersetGroup === g) out[j++].supersetGroup = null; }
      else seen.set(g, i);
    }
  }
  return out;
}

export async function getWorkout(id: Id) {
  const w = await db.workouts.get(id);
  if (!w) return null;
  const items = await db.workoutItems.where('[workoutId+order]').between([id, -Infinity], [id, Infinity]).toArray();
  return { workout: w, items };
}

export async function deleteWorkout(id: Id) {
  await db.transaction('rw', db.workouts, db.workoutItems, db.sessions, db.programs, async () => {
    await db.workoutItems.where('workoutId').equals(id).delete();
    await db.sessions.where('workoutId').equals(id).modify({ workoutId: null });
    await db.programs.toCollection().modify((p) => { p.days = p.days.map((d) => (d === id ? null : d)); });
    await db.workouts.delete(id);
  });
}

export async function duplicateWorkout(id: Id): Promise<Id | null> {
  const src = await getWorkout(id);
  if (!src) return null;
  const groupMap = new Map<Id, Id>();
  return saveWorkout(
    { name: `${src.workout.name} (copy)`, gymId: src.workout.gymId, programId: src.workout.programId },
    src.items.map(({ exerciseId, supersetGroup, targetSets, repMin, repMax, targetRir, restSec }) => ({
      exerciseId, targetSets, repMin, repMax, targetRir, restSec,
      supersetGroup: supersetGroup ? (groupMap.get(supersetGroup) ?? groupMap.set(supersetGroup, newId()).get(supersetGroup)!) : null,
    })),
  );
}

export async function setWorkoutArchived(id: Id, archived: boolean) {
  await db.workouts.update(id, { archived: archived ? 1 : 0, updatedAt: now() });
}

// ---------- programs ----------

export async function saveProgram(p: Partial<Program> & { name: string }): Promise<Id> {
  const prev = p.id ? await db.programs.get(p.id) : undefined;
  const id = p.id ?? newId();
  await db.programs.put({ icon: 'calendar', color: 'accent', active: 0, archived: 0, days: [null, null, null], ...prev, ...p, id, createdAt: prev?.createdAt ?? now(), updatedAt: now() } as Program);
  return id;
}

export async function setActiveProgram(id: Id | null) {
  await db.transaction('rw', db.programs, db.settings, async () => {
    await db.programs.toCollection().modify((p) => { p.active = p.id === id ? 1 : 0; });
    await db.settings.update('me', { activeProgramId: id, updatedAt: now() });
  });
}

export async function deleteProgram(id: Id) {
  await db.transaction('rw', db.programs, db.workouts, db.settings, async () => {
    await db.workouts.where('programId').equals(id).modify({ programId: null });
    await db.programs.delete(id);
    const s = await db.settings.get('me');
    if (s?.activeProgramId === id) await db.settings.update('me', { activeProgramId: null });
  });
}

/** Next workout in the active program: the day after the last completed session from this program. */
export async function nextProgramWorkout(program: Program): Promise<Id | null> {
  const days = program.days.filter((d): d is Id => !!d);
  if (!days.length) return null;
  const last = await db.sessions.where('status').equals('completed').filter((s) => !!s.workoutId && days.includes(s.workoutId)).reverse().sortBy('startedAt');
  const lastId = last[0]?.workoutId;
  if (!lastId) return days[0];
  const idx = days.indexOf(lastId);
  return days[(idx + 1) % days.length];
}

// ---------- sessions ----------

export async function getActiveSession(): Promise<Session | undefined> {
  return db.sessions.where('status').anyOf('active', 'paused').first();
}

/** Last completed working sets for an exercise (from its most recent completed session). */
export async function previousSets(exerciseId: Id, excludeSessionId?: Id): Promise<SetLog[]> {
  const latest = await db.setLogs
    .where('[exerciseId+completedAt]').between([exerciseId, 1], [exerciseId, Infinity])
    .reverse()
    .filter((s) => s.sessionId !== excludeSessionId)
    .first();
  if (!latest) return [];
  const sess = await db.sessions.get(latest.sessionId);
  if (!sess || sess.status !== 'completed') {
    // fall back: search further back for a completed session
    const all = await db.setLogs.where('[exerciseId+completedAt]').between([exerciseId, 1], [exerciseId, Infinity]).reverse().toArray();
    for (const s of all) {
      if (s.sessionId === excludeSessionId) continue;
      const ss = await db.sessions.get(s.sessionId);
      if (ss?.status === 'completed') return setsOf(s.sessionExerciseId);
    }
    return [];
  }
  return setsOf(latest.sessionExerciseId);
}

async function setsOf(sessionExerciseId: Id) {
  return db.setLogs.where('[sessionExerciseId+index]').between([sessionExerciseId, -Infinity], [sessionExerciseId, Infinity]).toArray();
}

function blankSet(se: SessionExercise, sessionId: Id, index: number, unit: Unit, type: SetType = 'standard', weightKg: number | null = null, reps: number | null = null, rir: number | null = null): SetLog {
  const t = now();
  return { id: newId(), createdAt: t, updatedAt: t, sessionExerciseId: se.id, sessionId, exerciseId: se.exerciseId, index, type, entries: [{ weightKg, reps, partialReps: 0 }], enteredUnit: unit, rir, completed: 0, completedAt: null };
}

async function buildSetsFor(se: SessionExercise, sessionId: Id, targetSets: number, settings: Settings, gym: GymProfile | undefined): Promise<SetLog[]> {
  const prev = (await previousSets(se.exerciseId, sessionId)).filter((s) => s.type !== 'warmup');
  const out: SetLog[] = [];
  let index = 0;
  const firstWorkingKg = prev[0]?.entries[0]?.weightKg ?? null;
  const ex = await db.exercises.get(se.exerciseId);
  if (settings.warmupAutomation === 'smart' && firstWorkingKg && ex && !ex.isBodyweight && ex.type.startsWith('compound')) {
    const bar = ex.equipment.includes('barbell') ? (gym?.barWeightsKg[0] ?? 20) : 0;
    const step = Math.min(...(gym?.platesKg ?? [1.25])) * 2;
    for (const w of warmupSets(firstWorkingKg, ex.warmupOverride ?? settings.warmupScheme, step || 2.5, bar)) {
      out.push(blankSet(se, sessionId, index++, settings.unit, 'warmup', w.weightKg, w.reps));
    }
  }
  const n = Math.max(1, targetSets);
  for (let i = 0; i < n; i++) {
    const p = settings.prefill === 'previous' ? prev[i] ?? prev[prev.length - 1] : undefined;
    out.push(blankSet(se, sessionId, index++, settings.unit, p?.type === 'failure' ? 'failure' : 'standard', p?.entries[0]?.weightKg ?? null, p?.entries[0]?.reps ?? (settings.prefill === 'targets' ? se.repMax : null), se.targetRir));
  }
  return out;
}

export async function startSession(workoutId: Id | null, name?: string): Promise<Id> {
  const active = await getActiveSession();
  if (active) return active.id; // only one at a time: resume instead
  const settings = await getSettings();
  const tpl = workoutId ? await getWorkout(workoutId) : null;
  const gymId = tpl?.workout.gymId ?? settings.activeGymId;
  const gym = gymId ? await db.gyms.get(gymId) : undefined;
  const t = now();
  const sessionId = newId();
  await db.transaction('rw', [db.sessions, db.sessionExercises, db.setLogs, db.exercises, db.gyms, db.settings], async () => {
    await db.sessions.put({
      id: sessionId, createdAt: t, updatedAt: t, workoutId, name: name ?? tpl?.workout.name ?? 'Workout', gymId: gymId ?? null,
      status: 'active', startedAt: t, endedAt: null, localDate: localDate(t), pausedMs: 0, pausedAt: null, restEndsAt: null, notes: '',
    });
    for (const [order, it] of (tpl?.items ?? []).entries()) {
      const se: SessionExercise = { id: newId(), createdAt: t, updatedAt: t, sessionId, exerciseId: it.exerciseId, order, supersetGroup: it.supersetGroup, swappedFromExerciseId: null, repMin: it.repMin, repMax: it.repMax, targetRir: it.targetRir, notes: '' };
      await db.sessionExercises.put(se);
      await db.setLogs.bulkPut(await buildSetsFor(se, sessionId, it.targetSets, settings, gym));
    }
  });
  return sessionId;
}

export async function getSessionTree(sessionId: Id) {
  const session = await db.sessions.get(sessionId);
  if (!session) return null;
  const exercises = await db.sessionExercises.where('[sessionId+order]').between([sessionId, -Infinity], [sessionId, Infinity]).toArray();
  const sets = await db.setLogs.where('sessionId').equals(sessionId).toArray();
  const bySe = new Map<Id, SetLog[]>();
  for (const s of sets) (bySe.get(s.sessionExerciseId) ?? bySe.set(s.sessionExerciseId, []).get(s.sessionExerciseId)!).push(s);
  for (const arr of bySe.values()) arr.sort((a, b) => a.index - b.index);
  return { session, exercises: exercises.map((se) => ({ se, sets: bySe.get(se.id) ?? [] })) };
}

export async function addExercisesToSession(sessionId: Id, exerciseIds: Id[]) {
  const settings = await getSettings();
  const session = await db.sessions.get(sessionId);
  const gym = session?.gymId ? await db.gyms.get(session.gymId) : undefined;
  await db.transaction('rw', [db.sessionExercises, db.setLogs, db.exercises, db.sessions], async () => {
    let order = (await db.sessionExercises.where('sessionId').equals(sessionId).count());
    for (const exerciseId of exerciseIds) {
      const t = now();
      const se: SessionExercise = { id: newId(), createdAt: t, updatedAt: t, sessionId, exerciseId, order: order++, supersetGroup: null, swappedFromExerciseId: null, repMin: null, repMax: null, targetRir: null, notes: '' };
      await db.sessionExercises.put(se);
      const prevCount = (await previousSets(exerciseId, sessionId)).filter((s) => s.type !== 'warmup').length;
      await db.setLogs.bulkPut(await buildSetsFor(se, sessionId, prevCount || 3, settings, gym));
    }
  });
}

export async function removeSessionExercise(seId: Id) {
  await db.transaction('rw', db.sessionExercises, db.setLogs, async () => {
    const se = await db.sessionExercises.get(seId);
    if (!se) return;
    await db.setLogs.where('sessionExerciseId').equals(seId).delete();
    await db.sessionExercises.delete(seId);
    const rest = await db.sessionExercises.where('[sessionId+order]').between([se.sessionId, -Infinity], [se.sessionId, Infinity]).toArray();
    await db.sessionExercises.bulkPut(normaliseSupersets(rest).map((r, i) => ({ ...r, order: i })));
  });
}

export async function reorderSessionExercises(sessionId: Id, orderedIds: Id[]) {
  await db.transaction('rw', db.sessionExercises, async () => {
    const rows = await db.sessionExercises.where('sessionId').equals(sessionId).toArray();
    const byId = new Map(rows.map((r) => [r.id, r]));
    const ordered = orderedIds.map((id) => byId.get(id)!).filter(Boolean);
    await db.sessionExercises.bulkPut(normaliseSupersets(ordered).map((r, i) => ({ ...r, order: i, updatedAt: now() })));
  });
}

/** Superset with the neighbour in `dir`; if already in a group, detach. */
export async function toggleSessionSuperset(seId: Id, dir: 'prev' | 'next' | 'detach') {
  await db.transaction('rw', db.sessionExercises, async () => {
    const se = await db.sessionExercises.get(seId);
    if (!se) return;
    const rows = await db.sessionExercises.where('[sessionId+order]').between([se.sessionId, -Infinity], [se.sessionId, Infinity]).toArray();
    const i = rows.findIndex((r) => r.id === seId);
    if (dir === 'detach') rows[i].supersetGroup = null;
    else {
      const j = dir === 'prev' ? i - 1 : i + 1;
      if (j < 0 || j >= rows.length) return;
      const g = rows[j].supersetGroup ?? rows[i].supersetGroup ?? newId();
      rows[i].supersetGroup = g; rows[j].supersetGroup = g;
    }
    await db.sessionExercises.bulkPut(normaliseSupersets(rows));
  });
}

/** Swap: ticked sets stay with the old exercise (kept as its own entry), unticked ones move to the new one. */
export async function swapInSession(seId: Id, newExerciseId: Id) {
  await db.transaction('rw', db.sessionExercises, db.setLogs, async () => {
    const se = await db.sessionExercises.get(seId);
    if (!se) return;
    const sets = await db.setLogs.where('sessionExerciseId').equals(seId).toArray();
    const done = sets.filter((s) => s.completed);
    const todo = sets.filter((s) => !s.completed);
    const fresh = (s: SetLog, i: number): SetLog => ({ ...s, exerciseId: newExerciseId, index: i, entries: [{ weightKg: null, reps: null, partialReps: 0 }], updatedAt: now() });
    if (!done.length) {
      await db.sessionExercises.update(seId, { exerciseId: newExerciseId, swappedFromExerciseId: se.exerciseId, updatedAt: now() });
      await db.setLogs.bulkPut(todo.map((s, i) => ({ ...fresh(s, i), sessionExerciseId: seId })));
      return;
    }
    // keep the old exercise with its done sets; insert the new one right after
    const rows = await db.sessionExercises.where('[sessionId+order]').between([se.sessionId, -Infinity], [se.sessionId, Infinity]).toArray();
    const t = now();
    const neu: SessionExercise = { ...se, id: newId(), createdAt: t, updatedAt: t, exerciseId: newExerciseId, swappedFromExerciseId: se.exerciseId };
    const i = rows.findIndex((r) => r.id === seId);
    rows.splice(i + 1, 0, neu);
    await db.sessionExercises.bulkPut(rows.map((r, k) => ({ ...r, order: k })));
    await db.setLogs.bulkPut((todo.length ? todo : [done[done.length - 1]]).map((s, k) => ({ ...fresh(s, k), id: todo.length ? s.id : newId(), sessionExerciseId: neu.id, completed: 0, completedAt: null })));
  });
}

export async function updateSet(setId: Id, patch: Partial<SetLog>) {
  await db.setLogs.update(setId, { ...patch, updatedAt: now() });
}

export async function addSet(seId: Id, type: SetType = 'standard') {
  const se = await db.sessionExercises.get(seId);
  if (!se) return;
  const settings = await getSettings();
  const sets = await setsOf(seId);
  const last = sets.filter((s) => s.type !== 'warmup').pop() ?? sets[sets.length - 1];
  const row = blankSet(se, se.sessionId, 0, settings.unit, type, last?.entries[0]?.weightKg ?? null, last?.entries[0]?.reps ?? null, last?.rir ?? se.targetRir);
  if (type === 'warmup') {
    // warm-ups go before working sets
    const firstWorking = sets.findIndex((s) => s.type !== 'warmup');
    const at = firstWorking < 0 ? sets.length : firstWorking;
    const list = [...sets.slice(0, at), row, ...sets.slice(at)];
    row.entries = [{ weightKg: null, reps: null, partialReps: 0 }];
    await db.setLogs.bulkPut(list.map((s, i) => ({ ...s, index: i })));
  } else {
    row.index = sets.length;
    await db.setLogs.put(row);
  }
}

export async function removeSet(setId: Id) {
  await db.transaction('rw', db.setLogs, async () => {
    const s = await db.setLogs.get(setId);
    if (!s) return;
    await db.setLogs.delete(setId);
    const rest = await setsOf(s.sessionExerciseId);
    await db.setLogs.bulkPut(rest.map((r, i) => ({ ...r, index: i })));
  });
}

export async function addWarmups(seId: Id) {
  const se = await db.sessionExercises.get(seId);
  if (!se) return 0;
  const settings = await getSettings();
  const ex = await db.exercises.get(se.exerciseId);
  const session = await db.sessions.get(se.sessionId);
  const gym = session?.gymId ? await db.gyms.get(session.gymId) : undefined;
  const sets = await setsOf(seId);
  const working = sets.find((s) => s.type !== 'warmup' && s.entries[0]?.weightKg);
  const w = working?.entries[0]?.weightKg;
  if (!w || !ex) return 0;
  const bar = ex.equipment.includes('barbell') ? (gym?.barWeightsKg[0] ?? 20) : 0;
  const step = Math.min(...(gym?.platesKg ?? [1.25])) * 2 || 2.5;
  const warm = warmupSets(w, ex.warmupOverride ?? settings.warmupScheme, step, bar).map((x) => blankSet(se, se.sessionId, 0, settings.unit, 'warmup', x.weightKg, x.reps));
  const list = [...sets.filter((s) => s.type === 'warmup'), ...warm, ...sets.filter((s) => s.type !== 'warmup')];
  await db.setLogs.bulkPut(list.map((s, i) => ({ ...s, index: i })));
  return warm.length;
}

/** Rest in seconds for an exercise, honouring item → exercise → settings defaults. */
export async function restFor(seId: Id): Promise<number> {
  const se = await db.sessionExercises.get(seId);
  if (!se) return 90;
  const ex = await db.exercises.get(se.exerciseId);
  const settings = await getSettings();
  const session = await db.sessions.get(se.sessionId);
  let itemRest: number | null = null;
  if (session?.workoutId) {
    const it = await db.workoutItems.where('workoutId').equals(session.workoutId).filter((i) => i.exerciseId === se.exerciseId).first();
    itemRest = it?.restSec ?? null;
  }
  return itemRest ?? ex?.restOverrideSec ?? (ex ? settings.restDefaults[ex.type] : 90);
}

/** Tick a set. Returns the rest to start (null = don't start rest, e.g. mid-superset or a warm-up chain). */
export async function completeSet(setId: Id, done: boolean): Promise<number | null> {
  const s = await db.setLogs.get(setId);
  if (!s) return null;
  await db.setLogs.update(setId, { completed: done ? 1 : 0, completedAt: done ? now() : null, updatedAt: now() });
  if (!done) return null;
  const se = await db.sessionExercises.get(s.sessionExerciseId);
  if (!se) return null;
  if (se.supersetGroup) {
    // rest only after the last exercise of the round
    const group = await db.sessionExercises.where('sessionId').equals(se.sessionId).filter((x) => x.supersetGroup === se.supersetGroup).sortBy('order');
    if (group[group.length - 1].id !== se.id) return null;
  }
  if (s.type === 'warmup') return 60;
  if (s.type === 'drop' || s.type === 'myo') return await restFor(se.id);
  return restFor(se.id);
}

export async function setRest(sessionId: Id, endsAt: number | null) {
  await db.sessions.update(sessionId, { restEndsAt: endsAt, updatedAt: now() });
}

export async function pauseSession(sessionId: Id, pause: boolean) {
  const s = await db.sessions.get(sessionId);
  if (!s) return;
  const t = now();
  if (pause && s.status === 'active') await db.sessions.update(sessionId, { status: 'paused', pausedAt: t, updatedAt: t });
  if (!pause && s.status === 'paused') await db.sessions.update(sessionId, { status: 'active', pausedMs: s.pausedMs + (t - (s.pausedAt ?? t)), pausedAt: null, updatedAt: t });
}

export const elapsedMs = (s: Session, t = now()) =>
  (s.endedAt ?? t) - s.startedAt - s.pausedMs - (s.status === 'paused' && s.pausedAt ? t - s.pausedAt : 0);

export interface Record_ { exerciseId: Id; kind: 'e1rm' | 'weight' | 'reps' | 'volume'; value: number; previous: number | null; }

/** Finish: drop unticked sets (and exercises left empty), stamp end, return PRs hit. */
export async function completeSession(sessionId: Id): Promise<Record_[]> {
  const records = await computeRecords(sessionId);
  await db.transaction('rw', db.sessions, db.sessionExercises, db.setLogs, async () => {
    const s = await db.sessions.get(sessionId);
    if (!s) return;
    await db.setLogs.where('sessionId').equals(sessionId).filter((x) => !x.completed).delete();
    const ses = await db.sessionExercises.where('sessionId').equals(sessionId).toArray();
    for (const se of ses) if ((await db.setLogs.where('sessionExerciseId').equals(se.id).count()) === 0) await db.sessionExercises.delete(se.id);
    const t = now();
    const paused = s.status === 'paused' && s.pausedAt ? t - s.pausedAt : 0;
    await db.sessions.update(sessionId, { status: 'completed', endedAt: t, pausedMs: s.pausedMs + paused, pausedAt: null, restEndsAt: null, updatedAt: t });
  });
  return records;
}

export async function discardSession(sessionId: Id) {
  await db.transaction('rw', db.sessions, db.sessionExercises, db.setLogs, async () => {
    await db.setLogs.where('sessionId').equals(sessionId).delete();
    await db.sessionExercises.where('sessionId').equals(sessionId).delete();
    await db.sessions.delete(sessionId);
  });
}
export const deleteSession = discardSession;

export async function editSessionTimes(sessionId: Id, startedAt: number, durationMs: number) {
  await db.sessions.update(sessionId, { startedAt, endedAt: startedAt + durationMs, pausedMs: 0, localDate: localDate(startedAt), updatedAt: now() });
}

/** Records = this session's best vs the best in all earlier completed sessions. */
export async function computeRecords(sessionId: Id): Promise<Record_[]> {
  const session = await db.sessions.get(sessionId);
  if (!session) return [];
  const sets = (await db.setLogs.where('sessionId').equals(sessionId).toArray()).filter(isWorking);
  const byEx = new Map<Id, SetLog[]>();
  for (const s of sets) (byEx.get(s.exerciseId) ?? byEx.set(s.exerciseId, []).get(s.exerciseId)!).push(s);
  const completedBefore = new Set((await db.sessions.where('status').equals('completed').filter((s) => s.startedAt < session.startedAt).primaryKeys()));
  const out: Record_[] = [];
  for (const [exerciseId, mine] of byEx) {
    const hist = (await db.setLogs.where('[exerciseId+completedAt]').between([exerciseId, 1], [exerciseId, Infinity]).toArray()).filter((s) => completedBefore.has(s.sessionId) && isWorking(s));
    if (!hist.length) continue; // first time isn't a record
    const best = (arr: SetLog[], f: (s: SetLog) => number | null) => arr.reduce<number | null>((m, s) => { const v = f(s); return v != null && (m == null || v > m) ? v : m; }, null);
    const metrics: [Record_['kind'], (s: SetLog) => number | null][] = [
      ['e1rm', bestE1rm],
      ['weight', (s) => Math.max(...s.entries.map((e) => e.weightKg ?? 0)) || null],
      ['reps', (s) => Math.max(...s.entries.map((e) => e.reps ?? 0)) || null],
      ['volume', (s) => setVolume(s) || null],
    ];
    for (const [kind, f] of metrics) {
      const a = best(mine, f), b = best(hist, f);
      if (a != null && b != null && a > b + 1e-6) out.push({ exerciseId, kind, value: a, previous: b });
    }
  }
  return out;
}

// ---------- stats ----------

export interface SessionSummary { volumeKg: number; sets: number; durationMs: number; muscles: Map<Muscle, number>; }

export async function sessionSummary(sessionId: Id): Promise<SessionSummary | null> {
  const tree = await getSessionTree(sessionId);
  if (!tree) return null;
  const exIds = [...new Set(tree.exercises.map((e) => e.se.exerciseId))];
  const exs = new Map((await db.exercises.bulkGet(exIds)).filter(Boolean).map((e) => [e!.id, e!]));
  const bw = await bodyweightOn(tree.session.localDate);
  const settings = await getSettings();
  let volumeKg = 0, sets = 0;
  const muscles = new Map<Muscle, number>();
  for (const { se, sets: ss } of tree.exercises) {
    const ex = exs.get(se.exerciseId);
    for (const s of ss.filter(isWorking)) {
      sets++;
      volumeKg += setVolume(s, settings.bodyweightContribution && ex?.isBodyweight ? (bw ?? 0) * (ex.bodyweightPct || 1) : 0);
      for (const m of ex?.primaryMuscles ?? []) muscles.set(m, (muscles.get(m) ?? 0) + 1);
      for (const m of ex?.secondaryMuscles ?? []) muscles.set(m, (muscles.get(m) ?? 0) + 0.5);
    }
  }
  return { volumeKg, sets, durationMs: elapsedMs(tree.session), muscles };
}

export async function bodyweightOn(local: string): Promise<number | null> {
  const row = await db.bodyWeights.where('localDate').belowOrEqual(local).last();
  return row?.weightKg ?? null;
}

export async function logBodyWeight(local: string, weightKg: number) {
  const prev = await db.bodyWeights.where('localDate').equals(local).first();
  const row: BodyWeight = { id: prev?.id ?? newId(), createdAt: prev?.createdAt ?? now(), updatedAt: now(), localDate: local, weightKg };
  await db.bodyWeights.put(row);
}

export interface ExercisePoint { date: string; startedAt: number; e1rm: number | null; heaviest: number; volume: number; bestSetVolume: number; reps: number; bestSetReps: number; sets: number; }

export async function exerciseHistory(exerciseId: Id): Promise<ExercisePoint[]> {
  const sets = (await db.setLogs.where('[exerciseId+completedAt]').between([exerciseId, 1], [exerciseId, Infinity]).toArray()).filter(isWorking);
  const sessions = new Map((await db.sessions.bulkGet([...new Set(sets.map((s) => s.sessionId))])).filter((s) => s?.status === 'completed').map((s) => [s!.id, s!]));
  const by = new Map<Id, SetLog[]>();
  for (const s of sets) if (sessions.has(s.sessionId)) (by.get(s.sessionId) ?? by.set(s.sessionId, []).get(s.sessionId)!).push(s);
  const pts: ExercisePoint[] = [];
  for (const [sid, ss] of by) {
    const sess = sessions.get(sid)!;
    const vols = ss.map((s) => setVolume(s));
    const reps = ss.map((s) => s.entries.reduce((a, e) => a + (e.reps ?? 0), 0));
    const e1 = ss.map(bestE1rm).filter((v): v is number => v != null);
    pts.push({
      date: sess.localDate, startedAt: sess.startedAt, e1rm: e1.length ? Math.max(...e1) : null,
      heaviest: Math.max(...ss.flatMap((s) => s.entries.map((e) => e.weightKg ?? 0))),
      volume: vols.reduce((a, b) => a + b, 0), bestSetVolume: Math.max(...vols),
      reps: reps.reduce((a, b) => a + b, 0), bestSetReps: Math.max(...reps), sets: ss.length,
    });
  }
  return pts.sort((a, b) => a.startedAt - b.startedAt);
}

export interface WeekBucket { week: string; sets: number; volumeKg: number; sessions: number; muscles: Partial<Record<Muscle, number>>; }

/** Per-week totals across completed sessions; muscles count primary = 1 set, secondary = 0.5. */
export async function weeklyStats(weekOf: (local: string) => string): Promise<WeekBucket[]> {
  const sessions = await db.sessions.where('status').equals('completed').toArray();
  const exs = new Map((await db.exercises.toArray()).map((e) => [e.id, e]));
  const buckets = new Map<string, WeekBucket>();
  const ids = new Set(sessions.map((s) => s.id));
  const sets = (await db.setLogs.toArray()).filter((s) => ids.has(s.sessionId) && isWorking(s));
  const sessWeek = new Map(sessions.map((s) => [s.id, weekOf(s.localDate)]));
  for (const s of sessions) {
    const w = sessWeek.get(s.id)!;
    const b = buckets.get(w) ?? { week: w, sets: 0, volumeKg: 0, sessions: 0, muscles: {} };
    b.sessions++; buckets.set(w, b);
  }
  for (const s of sets) {
    const b = buckets.get(sessWeek.get(s.sessionId)!)!;
    const ex = exs.get(s.exerciseId);
    b.sets++; b.volumeKg += setVolume(s);
    for (const m of ex?.primaryMuscles ?? []) b.muscles[m] = (b.muscles[m] ?? 0) + 1;
    for (const m of ex?.secondaryMuscles ?? []) b.muscles[m] = (b.muscles[m] ?? 0) + 0.5;
  }
  return [...buckets.values()].sort((a, b) => a.week.localeCompare(b.week));
}

// ---------- backup ----------

const TABLES = ['settings', 'exercises', 'gyms', 'programs', 'workouts', 'workoutItems', 'sessions', 'sessionExercises', 'setLogs', 'bodyWeights'] as const;

export async function exportJSON(): Promise<string> {
  const data: Record<string, unknown[]> = {};
  for (const t of TABLES) data[t] = await db.table(t).toArray();
  return JSON.stringify({ app: 'repwise', version: 1, exportedAt: new Date().toISOString(), data });
}

export async function importJSON(text: string): Promise<Record<string, number>> {
  const parsed = JSON.parse(text);
  if (parsed?.app !== 'repwise' || parsed.version !== 1 || typeof parsed.data !== 'object') throw new Error('This file is not a Repwise backup.');
  for (const t of TABLES) if (!Array.isArray(parsed.data[t] ?? [])) throw new Error(`Backup table "${t}" is malformed.`);
  const counts: Record<string, number> = {};
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      await db.table(t).clear();
      const rows = parsed.data[t] ?? [];
      await db.table(t).bulkPut(rows);
      counts[t] = rows.length;
    }
  });
  await ensureSeeded();
  return counts;
}

/** One row per set: easy to open in a spreadsheet. */
export async function exportCSV(unit: Unit): Promise<string> {
  const sessions = new Map((await db.sessions.where('status').equals('completed').toArray()).map((s) => [s.id, s]));
  const exs = new Map((await db.exercises.toArray()).map((e) => [e.id, e]));
  const rows = [['date', 'workout', 'exercise', 'set', 'type', `weight_${unit}`, 'reps', 'partial_reps', 'rir']];
  const sets = (await db.setLogs.toArray()).filter((s) => sessions.has(s.sessionId)).sort((a, b) => sessions.get(a.sessionId)!.startedAt - sessions.get(b.sessionId)!.startedAt || (a.completedAt ?? 0) - (b.completedAt ?? 0));
  for (const s of sets) {
    const sess = sessions.get(s.sessionId)!;
    for (const e of s.entries) {
      const w = e.weightKg == null ? '' : String(Math.round((unit === 'kg' ? e.weightKg : e.weightKg * 2.2046226218) * 100) / 100);
      rows.push([sess.localDate, sess.name, exs.get(s.exerciseId)?.name ?? s.exerciseId, String(s.index + 1), s.type, w, String(e.reps ?? ''), String(e.partialReps || ''), s.rir == null ? '' : String(s.rir)]);
    }
  }
  return rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n');
}

export async function deleteAllData() {
  await db.delete();
  await db.open();
  await ensureSeeded();
}

export type { WorkoutItem };
