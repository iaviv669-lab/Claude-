// Schema for the workout tracker clone: IndexedDB via Dexie.
// Version 1 is the first migration. Copy to app/src/data/schema.ts.
// Conventions: string UUID ids, UTC epoch ms times, weights stored in kg.

import Dexie, { type Table } from 'dexie';

export type Id = string;
export type Unit = 'kg' | 'lb';
export type Muscle =
  | 'chest' | 'front_delts' | 'side_delts' | 'rear_delts' | 'lats' | 'upper_back'
  | 'traps' | 'biceps' | 'triceps' | 'forearms' | 'abs' | 'obliques' | 'lower_back'
  | 'glutes' | 'quads' | 'hamstrings' | 'adductors' | 'abductors' | 'calves' | 'neck';
export type Equipment =
  | 'barbell' | 'dumbbell' | 'kettlebell' | 'machine' | 'cable' | 'smith'
  | 'ez_bar' | 'trap_bar' | 'band' | 'pullup_bar' | 'dip_bars' | 'bench' | 'bodyweight';
export type ExerciseType =
  | 'compound_upper' | 'compound_lower' | 'isolation_upper' | 'isolation_lower' | 'core';
export type Laterality = 'bilateral' | 'unilateral' | 'asymmetrical' | 'both';
export type TrackedMetric = 'weight_reps' | 'reps' | 'time' | 'distance';
export type MovementPattern =
  | 'horizontal_push' | 'vertical_push' | 'horizontal_pull' | 'vertical_pull'
  | 'squat' | 'hinge' | 'lunge' | 'carry' | 'isolation' | 'core';
export type SetType = 'standard' | 'warmup' | 'drop' | 'myo' | 'failure';
export type SessionStatus = 'active' | 'paused' | 'completed';
// discarded sessions are deleted, not kept

interface Row { id: Id; createdAt: number; updatedAt: number; }

export interface WarmupStep { pct: number; reps: number; } // pct of first working weight

export interface Settings extends Row {
  id: 'me';
  unit: Unit;
  theme: 'system' | 'light' | 'dark';
  weekStartsOn: 0 | 1;
  autoAdvance: boolean;
  keepAwake: boolean;
  bodyweightContribution: boolean;
  prefill: 'previous' | 'targets';
  suggestProgression?: boolean;   // default on
  restDefaults: Record<ExerciseType, number>; // seconds, e.g. compound_lower 180, isolation_upper 90
  warmupAutomation: 'off' | 'smart';
  warmupScheme: WarmupStep[]; // e.g. [{pct:.4,reps:8},{pct:.6,reps:5},{pct:.8,reps:3}]
  activeGymId: Id | null;
  activeProgramId: Id | null;
  onboarded: boolean;
}

export interface Exercise extends Row {
  name: string;
  aliases: string[];
  isCustom: 0 | 1;            // 0/1, not boolean: IndexedDB can't index booleans
  archived: 0 | 1;
  trackedMetric: TrackedMetric;
  type: ExerciseType;
  laterality: Laterality;
  pattern: MovementPattern;
  primaryMuscles: Muscle[];
  secondaryMuscles: Muscle[];
  equipment: Equipment[];
  isBodyweight: boolean;
  bodyweightPct: number;      // 0..1, share of bodyweight moved (e.g. push-up ~0.65)
  notes: string;              // our own short cue, or the user's
  restOverrideSec: number | null;
  warmupOverride: WarmupStep[] | null;
}

export interface GymProfile extends Row {
  name: string;
  icon: string;
  equipment: Equipment[];
  barWeightsKg: number[];     // e.g. [20, 15, 10]
  platesKg: number[];         // available plate sizes, one entry per size (assume pairs)
  unit: Unit;                 // how plates are labelled at this gym
  dumbbellIncrementKg: number;
}

export interface Program extends Row {
  name: string;
  icon: string;
  color: string;
  active: 0 | 1;              // number so it can be indexed
  archived: 0 | 1;
  days: (Id | null)[];        // workoutId per day slot; null = rest day
}

export interface Workout extends Row {
  name: string;
  gymId: Id | null;
  programId: Id | null;
  archived: 0 | 1;
  notes: string;
}

export interface WorkoutItem extends Row {
  workoutId: Id;
  exerciseId: Id;
  order: number;
  supersetGroup: Id | null;
  targetSets: number;
  repMin: number;
  repMax: number;
  targetRir: number | null;
  restSec: number | null;     // null = exercise override or settings default
}

export interface Session extends Row {
  workoutId: Id | null;
  name: string;               // snapshot, survives template deletion
  gymId: Id | null;
  status: SessionStatus;
  startedAt: number;
  endedAt: number | null;
  localDate: string;          // YYYY-MM-DD at start, local calendar
  pausedMs: number;
  pausedAt: number | null;
  restEndsAt: number | null;  // wall clock for the running rest timer
  notes: string;
}

export interface SessionExercise extends Row {
  sessionId: Id;
  exerciseId: Id;
  order: number;
  supersetGroup: Id | null;
  swappedFromExerciseId: Id | null;
  progressionNote?: string | null; // why the prefilled numbers changed (double progression)
  repMin: number | null;
  repMax: number | null;
  targetRir: number | null;
  notes: string;
}

export interface SetEntry { weightKg: number | null; reps: number | null; partialReps: number; }

export interface SetLog extends Row {
  sessionExerciseId: Id;
  sessionId: Id;              // denormalised for cascade + range queries
  exerciseId: Id;             // denormalised for "previous" + stats
  index: number;
  type: SetType;
  entries: SetEntry[];        // length 1, or >1 for drop / myo
  enteredUnit: Unit;
  rir: number | null;
  completed: 0 | 1;
  completedAt: number | null;
}

export interface BodyWeight extends Row {
  localDate: string;          // unique
  weightKg: number;
}

export class WorkoutDB extends Dexie {
  settings!: Table<Settings, Id>;
  exercises!: Table<Exercise, Id>;
  gyms!: Table<GymProfile, Id>;
  programs!: Table<Program, Id>;
  workouts!: Table<Workout, Id>;
  workoutItems!: Table<WorkoutItem, Id>;
  sessions!: Table<Session, Id>;
  sessionExercises!: Table<SessionExercise, Id>;
  setLogs!: Table<SetLog, Id>;
  bodyWeights!: Table<BodyWeight, Id>;

  constructor() {
    super('workout-tracker');
    this.version(1).stores({
      settings: 'id',
      exercises: 'id, name, isCustom, archived, type, *primaryMuscles, *equipment',
      gyms: 'id, name',
      programs: 'id, active, archived',
      workouts: 'id, programId, archived, name',
      workoutItems: 'id, workoutId, [workoutId+order], exerciseId',
      sessions: 'id, status, startedAt, localDate, workoutId',
      sessionExercises: 'id, sessionId, [sessionId+order], exerciseId',
      setLogs: 'id, sessionId, sessionExerciseId, [sessionExerciseId+index], [exerciseId+completedAt], completedAt',
      bodyWeights: 'id, &localDate',
    });
  }
}

export const db = new WorkoutDB();

export const now = () => Date.now();
export const newId = () => crypto.randomUUID();
