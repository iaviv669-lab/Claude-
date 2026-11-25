# Recon map: MacroFactor Workouts (iOS/Android original → mobile-first web clone)

Scope: the core logging loop. Exercise library, workouts and simple programs
(routines), live logging of sets/reps/weight/RIR, rest timer, plate calculator,
warm-ups, supersets, set types, workout summary, history, and progress charts.
Not in this slice: smart program generation, auto-progression, body metrics,
integrations.
For: personal use (one user, no billing, no store listing).
Date: 2026-11-25

Clean-room note: everything below describes **what the app does**, in our own
words. Nothing here is its text, code, icons, exercise videos or branding.

## Sources

| # | source | URL | notes |
| --- | --- | --- | --- |
| 1 | App Store listing | https://apps.apple.com/us/app/macrofactor-workouts-tracker/id6737156524 | pitch, feature list, FAQ, pricing, 4.8★ / 5K ratings, reviews |
| 2 | Help center: Workouts collection index | https://help.macrofactorapp.com/en/collections/20-macrofactor-workouts | ~125 article titles = the full feature map |
| 3 | Dashboard | https://help.macrofactorapp.com/en/articles/275-getting-to-know-your-workouts-dashboard | widget list |
| 4 | Create a new workout | https://help.macrofactorapp.com/en/articles/307-create-a-new-workout | builder flow |
| 5 | Create an empty workout | https://help.macrofactorapp.com/en/articles/308-create-an-empty-workout | quick start flow, options menu |
| 6 | Start a workout | https://help.macrofactorapp.com/en/articles/309-how-to-start-a-workout | preview screen |
| 7 | Log a workout | https://help.macrofactorapp.com/en/articles/310-how-to-log-a-workout | **the logger, in detail**, and the summary screen |
| 8 | Set types | https://help.macrofactorapp.com/en/articles/317-logging-different-types-of-sets | W / D / M / F sets |
| 9 | Full / partial reps | https://help.macrofactorapp.com/en/articles/316-logging-full-or-partial-reps | |
| 10 | Plate calculator | https://help.macrofactorapp.com/en/articles/313-using-the-plate-calculator | |
| 11 | Warm-ups | https://help.macrofactorapp.com/en/articles/304-configuring-warm-ups | % based schemes |
| 12 | Default rest timers | https://help.macrofactorapp.com/en/articles/303-change-default-rest-timers | per movement type + per exercise |
| 13 | Rest during workout | https://help.macrofactorapp.com/en/articles/320-changing-rest-time-during-a-workout | |
| 14 | Supersets | https://help.macrofactorapp.com/en/articles/321-supersetting-exercises | |
| 15 | Smart progression | https://help.macrofactorapp.com/en/articles/305-understanding-and-using-smart-progressions | out of slice, read for prefill behaviour |
| 16 | Past workouts | https://help.macrofactorapp.com/en/articles/339-viewing-past-workouts | |
| 17 | Exercise performance | https://help.macrofactorapp.com/en/articles/344-viewing-exercise-performance-over-time | metric list |
| 18 | Sets and volume | https://help.macrofactorapp.com/en/articles/343-viewing-sets-and-volume-over-time | |
| 19 | Muscle groups | https://help.macrofactorapp.com/en/articles/280-muscle-groups | |
| 20 | Exercise stats | https://help.macrofactorapp.com/en/articles/334-seeing-detailed-stats-and-data-for-each-exercise | |
| 21 | Custom exercise | https://help.macrofactorapp.com/en/articles/328-how-to-create-a-custom-exercise | exercise fields |
| 22 | Swap exercises | https://help.macrofactorapp.com/en/articles/332-swap-exercises | |
| 23 | Build program from scratch | https://help.macrofactorapp.com/en/articles/286-create-a-new-program-via-build-from-scratch | |
| 24 | Gym profiles | https://help.macrofactorapp.com/en/articles/300-set-up-your-gym-profiles | |
| 25 | Bodyweight contribution | https://help.macrofactorapp.com/en/articles/315-understanding-bodyweight-contribution | |
| 26 | Pause / resume | https://help.macrofactorapp.com/en/articles/319-pause-or-resume-a-session | |
| 27 | Myo / drop / failure sets | https://help.macrofactorapp.com/en/articles/379-what-are-myo-sets-drop-sets-and-failure-sets | |
| 28 | Units | https://help.macrofactorapp.com/en/articles/353-changing-unit-preferences | |
| 29 | Data export | https://help.macrofactorapp.com/en/articles/356-export-your-data-workouts | |
| — | marketing site | https://macrofactorapp.com → macrofactor.com | not read: host blocked by this session's network |
| — | App Store screenshots | (images on source 1) | not analysed; add your own to `replica/screens/` if you want layout diffs |

Pricing (source 1): no free tier, 7-day trial, $11.99/mo, $47.99/6 mo, $71.99/yr.
Irrelevant for a personal clone, but it says the whole app is the product: no
feature is gated separately.

## Core loop

Open a saved workout, log each set (weight × reps, tick), rest on a timer, finish,
and see what you did and whether you're getting stronger.

## Screens

| ID | screen | route / how to reach | purpose | key components | states seen |
| --- | --- | --- | --- | --- | --- |
| S01 | First run setup | first launch | units (kg/lb), default gym equipment, experience | stepper, segmented control, checklist | filled |
| S02 | Dashboard | tab: Dashboard | weekly rings (muscles / sets / exercises vs targets), recent records (volume, reps, e1RM), workouts chart, muscle groups tiles, exercise tiles with sparkline, customise order | rings, record tabs, line/bar chart, tile grid | empty (no workouts), filled |
| S03 | Workout tab (home) | tab: Workout | active program block (expandable, days), workout library, "More: Empty workout", ⋯ → history | program card, workout card, collapsible list | empty, filled |
| S04 | Create sheet | centre **+** in bottom nav | choose New workout / New program → build from scratch | bottom sheet, radio list | — |
| S05 | Workout builder / recap | S04 → name + gym → exercises | name, gym, ordered exercise list, per-exercise ⋯ (superset, targets, remove), Save to library | text input, exercise row, kebab menu, FAB + | empty (0 exercises), filled |
| S06 | Exercise picker | "Add exercises" anywhere | search + filters (muscle, type, equipment), **+** per row, selected count badge, Done, **+** create custom | search field, filter chips, list, count badge | loading, empty search, filled |
| S07 | Workout preview | tap a workout | target muscles, exercise count, est. duration, rep details, Start / Save | muscle chips, stat row, primary CTA | filled |
| S08 | **Active workout logger** | Start workout | top: duration timer (left), rest timer (right); exercise thumbnail strip (reorderable); header "Exercise, Set n of m"; action bar (Swap, Warm up, Superset, Notes, More…); set table (set # · previous · weight · reps · RIR · ✓); F/P toggle; auto-advance | timers, thumbnail strip, action-bar chips, set row, numeric input, checkbox | first-time ("No previous"), in progress, all sets done, minimised (mini bar) |
| S09 | Rest timer sheet | tap rest timer | ±10 s, presets in 15 s steps up to 3:00 | stepper buttons, preset grid | running, finished |
| S10 | Plate calculator | tap weight field | per-side plates for the entered total; bar weight + base weight; equipment settings; per-equipment unit | plate visual, keypad, settings link | ok, "can't load this weight" error |
| S11 | Set type picker | tap set number | standard / warm-up W / drop D / myo M / failure F | menu | — |
| S12 | Swap sheet | action bar → Swap | suggested substitutes (same muscles/pattern), "find other" → S06 | list, quick-swap button | filled, no suggestions |
| S13 | Workout options | ☰ top-left in S08 | pause/resume, minimise, complete, workout settings, gym settings, discard | bottom sheet menu, confirm dialog | paused, running |
| S14 | Workout summary | Complete workout | front/back body map of muscles trained, PRs hit, volume, duration, start time, per-exercise breakdown, edit, Done | body map, PR badges, stat row | with PRs, without |
| S15 | Workout history | S03 ⋯ → History | reverse-chronological sessions | list grouped by date | empty, filled |
| S16 | Past workout detail / edit | tap history row | view and edit sets, date, duration; delete | same set table as S08 | view, edit |
| S17 | Exercise detail | Dashboard → Exercises → See all → exercise | charts: e1RM/3RM/10RM, total volume, best set volume, heaviest weight, total reps, best set reps, total sets; time range; history | metric switcher, range switcher, line chart | no data, filled |
| S18 | Muscle group detail | Dashboard → Muscle groups → See all | sets and volume per muscle over time, split resistance vs bodyweight volume, contributing sessions | bar chart, toggle | no data, filled |
| S19 | Custom exercise editor | S06 **+** / Settings → Exercises | name, tracked metric, type (compound/isolation upper/lower, core), laterality, primary/secondary muscles (tap to cycle P→S→off), equipment or bodyweight, optional details | multi-step form, muscle grid with tri-state | new, edit |
| S20 | Program builder | S04 → New program | name, icon, colour; days A/B/… (empty day = rest); per exercise sets, rep range, RIR; reorder; duplicate day | day tabs, exercise rows, target editor | empty, filled |
| S21 | Gym profiles | Settings → Gym profiles | named profiles, prefill preset, equipment checklist, plate increments, bar weights | list, checklist, number inputs | — |
| S22 | Settings | tab: More | units, theme, rest timer defaults (per movement type + per-exercise overrides), warm-up automation + scheme, auto-advance, bodyweight contribution toggle, data export | grouped list, toggles, editors | — |
| S23 | Data export | Settings → Data export | quick (one sheet) or granular export | form, download | — |

## Flows

```
F01 Log a saved workout (the core loop)
    S03 -> S07 preview -> S08 logger (repeat: enter weight/reps, ✓, rest S09) -> S13 complete -> S14 summary -> S03
    happy path clicks: 1 (open) + 1 (start) + per set ~3 (weight, reps, ✓; prefilled values make it 1) + 2 (complete, done)
    edge: first time on an exercise (no previous), kill/reload mid-workout (must restore),
          discard with confirm, timer running when screen locks/tab hidden, editing a ticked set,
          finish with unticked sets, unit switch mid-workout
F02 Quick empty workout
    S03 "Empty workout" -> S06 add exercises -> S07 -> S08 ... -> S14
    edge: start with zero exercises, add exercises mid-session
F03 Build and save a workout
    S04 -> S05 (name, gym) -> S06 pick -> S05 recap (reorder, superset, targets) -> Save
    edge: duplicate names, removing all exercises, exercise not in library -> S19
F04 Build a simple program (routine with days)
    S04 -> S20 name/icon -> day A: S06 -> sets/reps/RIR -> day B ... -> set active
    edge: empty days are rest days; duplicate a day
F05 Swap an exercise mid-workout
    S08 action bar -> S12 -> pick -> logger continues with new exercise
    edge: swap after some sets ticked (keep them on the old exercise)
F06 Superset two exercises
    S05 or S08 -> ⋯ Superset -> with previous / next -> rest starts only after the round
    edge: non-adjacent exercises (reorder first), detach
F07 Load the bar
    S08 weight field -> S10 shows per-side plates -> adjust bar/plates
    edge: weight not loadable with available plates, kg/lb plates, dumbbells (no calc)
F08 Warm up
    smart warm-ups auto-added from a % scheme of the first working set, or added manually
    edge: per-exercise scheme overrides default; hide completed warm-ups
F09 Check progress
    S02 -> S17 exercise metric + range, or S18 muscle group, or S15 -> S16
    edge: one data point, mixed units in history, bodyweight exercises (volume uses bodyweight)
F10 Create a custom exercise
    S06 + -> S19 steps -> Create -> back in S06 selected
```

Number to beat: a set with prefilled values is one tap (✓).

## Components

| component | variants | states | used on |
| --- | --- | --- | --- |
| Bottom nav | 3 tabs + centre create button | active, inactive, with mini workout bar above | all |
| Button | primary, secondary, ghost, danger | default, pressed, disabled | all |
| Bottom sheet / menu | list, form, picker | open, closing | S04 S09 S10 S11 S12 S13 |
| Set row | standard, warm-up, drop (multi-entry), myo (multi-entry), failure | empty, prefilled, editing, ticked, superset-grouped | S08 S16 |
| Numeric input + keypad | weight (decimal), reps (int), RIR (0–5) | focus, invalid | S08 S10 S16 S20 |
| Timer | elapsed (duration), countdown (rest) | running, paused, finished (vibrate/beep) | S08 S09 |
| Exercise row | library row (+), workout row (⋯), thumbnail chip | selected, in superset | S05 S06 S08 S20 |
| Filter chips | muscle, type, equipment | on, off | S06 |
| Muscle grid / body map | picker (tri-state P/S/off), display (front/back highlight) | — | S14 S19 |
| Chart | line (metric over time), bar (sets/volume), sparkline, rings | empty, 1 point, filled | S02 S17 S18 |
| Stat tile | number + label + trend | — | S02 S07 S14 |
| Confirm dialog | destructive | — | discard, delete |
| Toast | success, undo | — | delete set, swap |

## Inferred data model

```
UserSettings  units (kg|lb), theme, autoAdvance (bool), bodyweightContribution (bool),
              restDefaults {compound_lower, compound_upper, isolation_lower, isolation_upper, core},
              warmupAutomation (off|smart), defaultWarmupScheme [{pct, reps}], activeGymId, activeProgramId
              evidence: sources 7, 11, 12, 22, 28    confidence: high (fields), guess (exact shape)

Exercise      id, name, isCustom, trackedMetric (weight_reps|reps|time|distance), type
              (compound_upper|compound_lower|isolation_upper|isolation_lower|core),
              laterality (bilateral|unilateral|asymmetrical|both), primaryMuscles[], secondaryMuscles[],
              equipment[] (barbell|dumbbell|machine|cable|kettlebell|band|bodyweight...),
              isBodyweight, bodyweightPct, movementPattern, aliases[], notes,
              restOverrideSec?, warmupSchemeOverride?
              evidence: source 21 (custom exercise fields), 12, 11, 25   confidence: high

GymProfile    id, name, icon, equipment[], barWeights[], plateIncrements[], unit
              evidence: sources 10, 24   confidence: high

Workout       id, name, gymId, programId?, dayIndex?, archived, items[]  (a template)
WorkoutItem   exerciseId, order, supersetGroup?, targetSets, repMin, repMax, targetRir, restSec?
              evidence: sources 4, 14, 23   confidence: high

Program       id, name, icon, color, days[] (WorkoutId or rest), cycles?, active
              evidence: source 23   confidence: medium (cycles/periodization out of slice)

Session       id, workoutId?, name, gymId, startedAt, endedAt, pausedMs, status
              (active|paused|completed|discarded), notes
SessionExercise id, sessionId, exerciseId, order, supersetGroup?, swappedFromExerciseId?
SetLog        id, sessionExerciseId, index, type (standard|warmup|drop|myo|failure),
              entries [{weight, reps, partialReps}] (drop/myo have >1), rir?, completed, completedAt
              evidence: sources 7, 8, 9, 22, 26, 27   confidence: high

BodyWeightLog date, weight    (needed for bodyweight volume)   evidence: 25   confidence: medium

Derived, not stored: e1RM (e.g. Epley), best set, PRs, weekly sets per muscle, volume split
(resistance vs bodyweight), "previous" column = last completed set at same index.
```

Relationships: Program 1-n Workout · Workout 1-n WorkoutItem n-1 Exercise ·
Session n-1 Workout (optional) · Session 1-n SessionExercise 1-n SetLog ·
GymProfile 1-n Workout/Session.

Personal use, web: everything can live **on the device** (IndexedDB), no
server, no account. Add export/import JSON for backup.

## Feature matrix

See `features.csv`. Must: 22, should: 14, could: 8, skip: 8.

## Out of scope (cannot or should not be cloned)

- **The exercise library content**: their exercise list, written cues and
  technique videos (by Jeff Nippard) are owned content. We ship our own seed list
  of ~100–150 common lifts (names of exercises are generic) with our own short
  notes, and you can add custom ones.
- **Named creator programs** (importable Jeff Nippard routines): licensed
  content, skip.
- **Smart program generation and smart progression**: their algorithm is the
  core IP and a big build. Out of this slice by your choice; a simple, openly
  known rule (double progression: hit top of rep range on all sets → add the
  smallest increment) is a fair `could`.
- **Their names, wording, icons, colours, logo**: replica-brand gives yours.
- **Accounts, cloud sync, sharing with other users, nutrition-app integration,
  Apple Health / step import, subscriptions**: not needed for personal use.

## Size

Screens 23 (≈15 in the must slice), flows 10, entities 9.
Hard parts:
1. **The logger (S08)**: dense, fast, one-handed; prefill from previous; drop/myo
   multi-entry sets; supersets changing rest and navigation order.
2. **Session durability and timers**: a workout must survive reloads and a locked
   phone; rest timer needs wall-clock maths, notification/vibration when the tab
   is backgrounded.
3. **Progress maths and charts**: e1RM, PRs, per-muscle weekly sets, bodyweight
   volume, all derived correctly across kg/lb history.
Also: plate calculator edge cases, an offline-capable PWA.

Size: **M** (a few weeks part-time) for must + should. The must slice alone is
roughly an S+ (a long weekend to a week).
