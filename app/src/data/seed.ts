// Our own starter exercise list. Exercise names are generic; notes are written fresh.
import type { Equipment, Exercise, ExerciseType, Laterality, MovementPattern, Muscle } from './schema';

type Row = [name: string, type: ExerciseType, pattern: MovementPattern, primary: Muscle[], secondary: Muscle[], equipment: Equipment[], laterality?: Laterality, bwPct?: number, aliases?: string[]];

const R: Row[] = [
  // chest
  ['Barbell Bench Press', 'compound_upper', 'horizontal_push', ['chest'], ['triceps', 'front_delts'], ['barbell', 'bench'], 'bilateral', 0, ['bench', 'flat bench']],
  ['Incline Barbell Bench Press', 'compound_upper', 'horizontal_push', ['chest', 'front_delts'], ['triceps'], ['barbell', 'bench'], 'bilateral', 0, ['incline bench']],
  ['Dumbbell Bench Press', 'compound_upper', 'horizontal_push', ['chest'], ['triceps', 'front_delts'], ['dumbbell', 'bench'], 'bilateral', 0, ['db bench']],
  ['Incline Dumbbell Press', 'compound_upper', 'horizontal_push', ['chest', 'front_delts'], ['triceps'], ['dumbbell', 'bench'], 'bilateral', 0, ['incline db press']],
  ['Machine Chest Press', 'compound_upper', 'horizontal_push', ['chest'], ['triceps', 'front_delts'], ['machine']],
  ['Smith Machine Bench Press', 'compound_upper', 'horizontal_push', ['chest'], ['triceps', 'front_delts'], ['smith', 'bench']],
  ['Push-Up', 'compound_upper', 'horizontal_push', ['chest'], ['triceps', 'front_delts', 'abs'], ['bodyweight'], 'bilateral', 0.65, ['press up']],
  ['Chest Dip', 'compound_upper', 'vertical_push', ['chest', 'triceps'], ['front_delts'], ['dip_bars'], 'bilateral', 1, ['dips']],
  ['Cable Fly', 'isolation_upper', 'isolation', ['chest'], ['front_delts'], ['cable'], 'bilateral', 0, ['cable crossover']],
  ['Dumbbell Fly', 'isolation_upper', 'isolation', ['chest'], [], ['dumbbell', 'bench']],
  ['Pec Deck', 'isolation_upper', 'isolation', ['chest'], [], ['machine'], 'bilateral', 0, ['machine fly']],
  // shoulders
  ['Overhead Press', 'compound_upper', 'vertical_push', ['front_delts'], ['triceps', 'side_delts'], ['barbell'], 'bilateral', 0, ['ohp', 'military press', 'standing press']],
  ['Seated Dumbbell Shoulder Press', 'compound_upper', 'vertical_push', ['front_delts'], ['triceps', 'side_delts'], ['dumbbell', 'bench'], 'bilateral', 0, ['db shoulder press']],
  ['Machine Shoulder Press', 'compound_upper', 'vertical_push', ['front_delts'], ['triceps', 'side_delts'], ['machine']],
  ['Dumbbell Lateral Raise', 'isolation_upper', 'isolation', ['side_delts'], [], ['dumbbell'], 'bilateral', 0, ['side raise', 'lateral raise']],
  ['Cable Lateral Raise', 'isolation_upper', 'isolation', ['side_delts'], [], ['cable'], 'unilateral'],
  ['Machine Lateral Raise', 'isolation_upper', 'isolation', ['side_delts'], [], ['machine']],
  ['Reverse Pec Deck', 'isolation_upper', 'isolation', ['rear_delts'], ['upper_back'], ['machine'], 'bilateral', 0, ['rear delt fly']],
  ['Face Pull', 'isolation_upper', 'horizontal_pull', ['rear_delts'], ['upper_back', 'traps'], ['cable']],
  ['Dumbbell Rear Delt Fly', 'isolation_upper', 'isolation', ['rear_delts'], ['upper_back'], ['dumbbell']],
  ['Arnold Press', 'compound_upper', 'vertical_push', ['front_delts'], ['side_delts', 'triceps'], ['dumbbell']],
  // back
  ['Pull-Up', 'compound_upper', 'vertical_pull', ['lats'], ['biceps', 'upper_back'], ['pullup_bar'], 'bilateral', 1, ['pullups']],
  ['Chin-Up', 'compound_upper', 'vertical_pull', ['lats', 'biceps'], ['upper_back'], ['pullup_bar'], 'bilateral', 1, ['chinups']],
  ['Lat Pulldown', 'compound_upper', 'vertical_pull', ['lats'], ['biceps', 'upper_back'], ['cable', 'machine'], 'bilateral', 0, ['pulldown']],
  ['Close-Grip Lat Pulldown', 'compound_upper', 'vertical_pull', ['lats'], ['biceps'], ['cable', 'machine']],
  ['Assisted Pull-Up Machine', 'compound_upper', 'vertical_pull', ['lats'], ['biceps'], ['machine']],
  ['Barbell Row', 'compound_upper', 'horizontal_pull', ['upper_back', 'lats'], ['biceps', 'rear_delts', 'lower_back'], ['barbell'], 'bilateral', 0, ['bent over row', 'pendlay row']],
  ['One-Arm Dumbbell Row', 'compound_upper', 'horizontal_pull', ['lats', 'upper_back'], ['biceps', 'rear_delts'], ['dumbbell', 'bench'], 'unilateral', 0, ['db row']],
  ['Chest-Supported Row', 'compound_upper', 'horizontal_pull', ['upper_back', 'lats'], ['biceps', 'rear_delts'], ['dumbbell', 'bench'], 'bilateral', 0, ['incline row']],
  ['Seated Cable Row', 'compound_upper', 'horizontal_pull', ['upper_back', 'lats'], ['biceps', 'rear_delts'], ['cable'], 'bilateral', 0, ['cable row']],
  ['Machine Row', 'compound_upper', 'horizontal_pull', ['upper_back', 'lats'], ['biceps'], ['machine']],
  ['T-Bar Row', 'compound_upper', 'horizontal_pull', ['upper_back', 'lats'], ['biceps', 'lower_back'], ['barbell']],
  ['Straight-Arm Pulldown', 'isolation_upper', 'isolation', ['lats'], [], ['cable'], 'bilateral', 0, ['lat prayer']],
  ['Inverted Row', 'compound_upper', 'horizontal_pull', ['upper_back', 'lats'], ['biceps'], ['bodyweight'], 'bilateral', 0.6, ['body row']],
  ['Dumbbell Shrug', 'isolation_upper', 'isolation', ['traps'], [], ['dumbbell']],
  ['Barbell Shrug', 'isolation_upper', 'isolation', ['traps'], [], ['barbell']],
  // arms
  ['Barbell Curl', 'isolation_upper', 'isolation', ['biceps'], ['forearms'], ['barbell']],
  ['EZ-Bar Curl', 'isolation_upper', 'isolation', ['biceps'], ['forearms'], ['ez_bar']],
  ['Dumbbell Curl', 'isolation_upper', 'isolation', ['biceps'], ['forearms'], ['dumbbell'], 'both'],
  ['Hammer Curl', 'isolation_upper', 'isolation', ['biceps', 'forearms'], [], ['dumbbell'], 'both'],
  ['Incline Dumbbell Curl', 'isolation_upper', 'isolation', ['biceps'], [], ['dumbbell', 'bench']],
  ['Preacher Curl', 'isolation_upper', 'isolation', ['biceps'], [], ['ez_bar', 'bench']],
  ['Cable Curl', 'isolation_upper', 'isolation', ['biceps'], [], ['cable']],
  ['Machine Preacher Curl', 'isolation_upper', 'isolation', ['biceps'], [], ['machine']],
  ['Triceps Pushdown', 'isolation_upper', 'isolation', ['triceps'], [], ['cable'], 'bilateral', 0, ['rope pushdown', 'pressdown']],
  ['Overhead Cable Triceps Extension', 'isolation_upper', 'isolation', ['triceps'], [], ['cable']],
  ['Skull Crusher', 'isolation_upper', 'isolation', ['triceps'], [], ['ez_bar', 'bench'], 'bilateral', 0, ['lying triceps extension']],
  ['Dumbbell Overhead Triceps Extension', 'isolation_upper', 'isolation', ['triceps'], [], ['dumbbell']],
  ['Close-Grip Bench Press', 'compound_upper', 'horizontal_push', ['triceps', 'chest'], ['front_delts'], ['barbell', 'bench']],
  ['Bench Dip', 'compound_upper', 'vertical_push', ['triceps'], ['chest', 'front_delts'], ['bench'], 'bilateral', 0.6],
  ['Wrist Curl', 'isolation_upper', 'isolation', ['forearms'], [], ['dumbbell', 'barbell']],
  // legs
  ['Back Squat', 'compound_lower', 'squat', ['quads', 'glutes'], ['adductors', 'lower_back'], ['barbell'], 'bilateral', 0, ['squat', 'high bar squat', 'low bar squat']],
  ['Front Squat', 'compound_lower', 'squat', ['quads'], ['glutes', 'upper_back'], ['barbell']],
  ['Goblet Squat', 'compound_lower', 'squat', ['quads', 'glutes'], ['adductors'], ['dumbbell', 'kettlebell']],
  ['Hack Squat', 'compound_lower', 'squat', ['quads'], ['glutes'], ['machine']],
  ['Smith Machine Squat', 'compound_lower', 'squat', ['quads', 'glutes'], [], ['smith']],
  ['Leg Press', 'compound_lower', 'squat', ['quads', 'glutes'], ['adductors'], ['machine']],
  ['Bulgarian Split Squat', 'compound_lower', 'lunge', ['quads', 'glutes'], ['adductors'], ['dumbbell', 'bench'], 'unilateral', 0, ['rear foot elevated split squat', 'bss']],
  ['Walking Lunge', 'compound_lower', 'lunge', ['quads', 'glutes'], ['hamstrings'], ['dumbbell'], 'unilateral'],
  ['Reverse Lunge', 'compound_lower', 'lunge', ['quads', 'glutes'], ['hamstrings'], ['dumbbell'], 'unilateral'],
  ['Step-Up', 'compound_lower', 'lunge', ['quads', 'glutes'], [], ['dumbbell', 'bench'], 'unilateral'],
  ['Bodyweight Squat', 'compound_lower', 'squat', ['quads', 'glutes'], [], ['bodyweight'], 'bilateral', 0.7, ['air squat']],
  ['Leg Extension', 'isolation_lower', 'isolation', ['quads'], [], ['machine']],
  ['Deadlift', 'compound_lower', 'hinge', ['glutes', 'hamstrings', 'lower_back'], ['quads', 'traps', 'forearms'], ['barbell'], 'bilateral', 0, ['conventional deadlift']],
  ['Sumo Deadlift', 'compound_lower', 'hinge', ['glutes', 'adductors', 'hamstrings'], ['quads', 'lower_back'], ['barbell']],
  ['Trap Bar Deadlift', 'compound_lower', 'hinge', ['glutes', 'quads', 'hamstrings'], ['lower_back', 'traps'], ['trap_bar'], 'bilateral', 0, ['hex bar deadlift']],
  ['Romanian Deadlift', 'compound_lower', 'hinge', ['hamstrings', 'glutes'], ['lower_back'], ['barbell'], 'bilateral', 0, ['rdl']],
  ['Dumbbell Romanian Deadlift', 'compound_lower', 'hinge', ['hamstrings', 'glutes'], ['lower_back'], ['dumbbell'], 'bilateral', 0, ['db rdl']],
  ['Single-Leg Romanian Deadlift', 'compound_lower', 'hinge', ['hamstrings', 'glutes'], [], ['dumbbell'], 'unilateral'],
  ['Good Morning', 'compound_lower', 'hinge', ['hamstrings', 'lower_back'], ['glutes'], ['barbell']],
  ['Hip Thrust', 'compound_lower', 'hinge', ['glutes'], ['hamstrings'], ['barbell', 'bench'], 'bilateral', 0, ['barbell hip thrust']],
  ['Glute Bridge', 'compound_lower', 'hinge', ['glutes'], ['hamstrings'], ['bodyweight'], 'bilateral', 0.3],
  ['Back Extension', 'isolation_lower', 'hinge', ['lower_back', 'glutes'], ['hamstrings'], ['machine'], 'bilateral', 0.5, ['hyperextension', '45 degree back extension']],
  ['Lying Leg Curl', 'isolation_lower', 'isolation', ['hamstrings'], [], ['machine']],
  ['Seated Leg Curl', 'isolation_lower', 'isolation', ['hamstrings'], [], ['machine']],
  ['Nordic Curl', 'isolation_lower', 'isolation', ['hamstrings'], [], ['bodyweight'], 'bilateral', 0.5],
  ['Cable Pull-Through', 'compound_lower', 'hinge', ['glutes', 'hamstrings'], [], ['cable']],
  ['Hip Adduction Machine', 'isolation_lower', 'isolation', ['adductors'], [], ['machine'], 'bilateral', 0, ['adductor machine']],
  ['Hip Abduction Machine', 'isolation_lower', 'isolation', ['abductors', 'glutes'], [], ['machine'], 'bilateral', 0, ['abductor machine']],
  ['Standing Calf Raise', 'isolation_lower', 'isolation', ['calves'], [], ['machine'], 'bilateral', 0, ['calf raise']],
  ['Seated Calf Raise', 'isolation_lower', 'isolation', ['calves'], [], ['machine']],
  ['Leg Press Calf Raise', 'isolation_lower', 'isolation', ['calves'], [], ['machine']],
  ['Single-Leg Calf Raise', 'isolation_lower', 'isolation', ['calves'], [], ['bodyweight', 'dumbbell'], 'unilateral', 1],
  // core
  ['Plank', 'core', 'core', ['abs'], ['obliques'], ['bodyweight'], 'bilateral', 0],
  ['Hanging Leg Raise', 'core', 'core', ['abs'], ['obliques'], ['pullup_bar'], 'bilateral', 0.3, ['leg raise']],
  ['Hanging Knee Raise', 'core', 'core', ['abs'], [], ['pullup_bar'], 'bilateral', 0.2],
  ['Cable Crunch', 'core', 'core', ['abs'], [], ['cable']],
  ['Ab Wheel Rollout', 'core', 'core', ['abs'], ['lats'], ['bodyweight'], 'bilateral', 0.5, ['ab rollout']],
  ['Crunch', 'core', 'core', ['abs'], [], ['bodyweight'], 'bilateral', 0.25],
  ['Decline Sit-Up', 'core', 'core', ['abs'], [], ['bench'], 'bilateral', 0.4],
  ['Russian Twist', 'core', 'core', ['obliques'], ['abs'], ['bodyweight', 'dumbbell'], 'bilateral', 0.2],
  ['Pallof Press', 'core', 'core', ['obliques', 'abs'], [], ['cable', 'band'], 'unilateral'],
  ['Side Plank', 'core', 'core', ['obliques'], ['abs'], ['bodyweight'], 'unilateral'],
  ['Dead Bug', 'core', 'core', ['abs'], [], ['bodyweight']],
  // carries & misc
  ["Farmer's Carry", 'compound_lower', 'carry', ['forearms', 'traps'], ['abs', 'glutes'], ['dumbbell', 'kettlebell'], 'bilateral', 0, ['farmer walk']],
  ['Kettlebell Swing', 'compound_lower', 'hinge', ['glutes', 'hamstrings'], ['lower_back'], ['kettlebell']],
  ['Band Pull-Apart', 'isolation_upper', 'horizontal_pull', ['rear_delts'], ['upper_back'], ['band']],
];

const TIMED = new Set(['Plank', 'Side Plank', "Farmer's Carry", 'Dead Bug']);

const slug = (s: string) => 'x-' + s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export function seedExercises(t = 0): Exercise[] {
  return R.map(([name, type, pattern, primary, secondary, equipment, laterality = 'bilateral', bw = 0, aliases = []]) => ({
    id: slug(name),
    createdAt: t,
    updatedAt: t,
    name,
    aliases,
    isCustom: 0,
    archived: 0,
    trackedMetric: TIMED.has(name) ? 'time' : 'weight_reps',
    type,
    laterality,
    pattern,
    primaryMuscles: primary,
    secondaryMuscles: secondary,
    equipment,
    isBodyweight: equipment.includes('bodyweight') || equipment.includes('pullup_bar') || equipment.includes('dip_bars') || bw > 0,
    bodyweightPct: bw,
    notes: '',
    restOverrideSec: null,
    warmupOverride: null,
  }));
}

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: 'Chest', front_delts: 'Front delts', side_delts: 'Side delts', rear_delts: 'Rear delts', lats: 'Lats',
  upper_back: 'Upper back', traps: 'Traps', biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms', abs: 'Abs',
  obliques: 'Obliques', lower_back: 'Lower back', glutes: 'Glutes', quads: 'Quads', hamstrings: 'Hamstrings',
  adductors: 'Adductors', abductors: 'Abductors', calves: 'Calves', neck: 'Neck',
};
export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: 'Barbell', dumbbell: 'Dumbbell', kettlebell: 'Kettlebell', machine: 'Machine', cable: 'Cable', smith: 'Smith machine',
  ez_bar: 'EZ bar', trap_bar: 'Trap bar', band: 'Band', pullup_bar: 'Pull-up bar', dip_bars: 'Dip bars', bench: 'Bench', bodyweight: 'Bodyweight',
};
export const TYPE_LABEL: Record<ExerciseType, string> = {
  compound_upper: 'Compound · upper', compound_lower: 'Compound · lower', isolation_upper: 'Isolation · upper', isolation_lower: 'Isolation · lower', core: 'Core',
};
export const ALL_MUSCLES = Object.keys(MUSCLE_LABEL) as Muscle[];
export const ALL_EQUIPMENT = Object.keys(EQUIPMENT_LABEL) as Equipment[];
