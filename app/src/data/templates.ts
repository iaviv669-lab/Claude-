// Ready-made programs that can be added in one tap (Create → …).
import type { Id } from './schema';

export interface TemplateWorkout { name: string; exercises: Id[] }
export interface ProgramTemplate {
  id: string;
  name: string;
  description: string;
  /** One slot per day; a workout's index into `workouts`, or null for a rest day. */
  week: (number | null)[];
  workouts: TemplateWorkout[];
  /** Targets by movement type. */
  compound: { sets: number; repMin: number; repMax: number; restSec: number; rir: number | null };
  isolation: { sets: number; repMin: number; repMax: number; restSec: number; rir: number | null };
}

/** The owner's own plan: Upper 1 (Mon), Upper 2 (Thu), Legs (Sat). */
export const MY_PLAN: ProgramTemplate = {
  id: 'upper-upper-legs',
  name: 'Upper / Upper / Legs',
  description: 'Mon Upper 1 · Thu Upper 2 · Sat Legs. Compounds 3 × 4–10, 2:30 rest; isolations 2 × 4–10, 2:00 rest; no RIR targets.',
  // Mon Tue Wed Thu Fri Sat Sun
  week: [0, null, null, 1, null, 2, null],
  workouts: [
    { name: 'Upper 1', exercises: [
      'x-incline-dumbbell-press', 'x-pec-deck', 'e-high-to-low-cable-fly',
      'x-machine-shoulder-press', 'x-cable-lateral-raise',
      'x-preacher-curl', 'x-cable-curl', 'x-incline-dumbbell-curl',
    ] },
    { name: 'Upper 2', exercises: [
      'x-lat-pulldown', 'x-t-bar-row', 'x-straight-arm-pulldown',
      'x-reverse-pec-deck', 'x-cable-lateral-raise', 'x-face-pull',
      'x-triceps-pushdown', 'x-overhead-cable-triceps-extension', 'e-assisted-dip-machine',
    ] },
    { name: 'Legs', exercises: [
      'x-hack-squat', 'x-bulgarian-split-squat', 'x-leg-extension',
      'x-single-leg-romanian-deadlift', 'x-seated-leg-curl',
      'x-hip-abduction-machine', 'x-hip-adduction-machine',
      'x-standing-calf-raise',
    ] },
  ],
  compound: { sets: 3, repMin: 4, repMax: 10, restSec: 150, rir: null },
  isolation: { sets: 2, repMin: 4, repMax: 10, restSec: 120, rir: null },
};

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
