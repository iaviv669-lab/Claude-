# Test plan

Automated: `cd app && npm test` (unit, 32) and `npx playwright test` (e2e, 13, Pixel 7 viewport).
Every e2e test fails on any console error or uncaught exception; axe (WCAG 2.1 AA) runs on
onboarding, logger, workouts, summary, progress, history, settings, gyms, exercise detail,
design system (light + dark). No server, so no 5xx check applies.

✅ automated · 🖐 manual (needs a real phone) · ⏭ not applicable

## F01 Log a saved workout
- F01-H1 ✅ start saved workout → log → finish → summary → history (core.spec "F03 + F01")
- F01-E1 ✅ first time on an exercise shows "—" for previous
- F01-E2 ✅ second session prefills weight/reps from last time
- F01-E3 ✅ refresh mid-workout restores ticked sets (core.spec F02)
- F01-E4 ✅ finishing with unticked sets warns with the count, then drops them
- F01-E5 ✅ two tabs on one workout stay in sync (more.spec)
- F01-E6 ✅ double tap on ✓ never creates duplicate sets
- F01-E7 ✅ ✓ with no reps and no previous is refused ("Enter reps first")
- F01-E8 ✅ fast typing weight then reps keeps both (unit B01, was bug B01)
- F01-E9 🖐 rest alert vibrates/beeps with the screen locked; notification when installed to home screen (iOS 16.4+)
- F01-E10 🖐 screen stays on during a workout (Wake Lock)
- F01-N1 ✅ starting a second workout while one runs resumes the first (unit)
- F01-N2 ✅ discard deletes everything from the session (unit)

## F02 Quick workout
- F02-H1 ✅ quick start → add exercise → log → finish → history
- F02-E1 ✅ finishing with nothing ticked offers discard instead

## F03 Build a workout
- F03-H1 ✅ name, add 2 exercises, superset, save, preview
- F03-E1 ✅ long name with emoji and accents, no horizontal scroll at phone width
- F03-E2 ✅ superset members not adjacent after a reorder are detached (unit normaliseSupersets)
- F03-N1 ✅ save with no name / no exercises is refused (toast) (code path; manual check done)

## F04 Programs
- F04-H1 ✅ create, add a day with a new workout, make active, "Next" badge on home
- F04-E1 ✅ rotation advances after a completed session (nextProgramWorkout; manual)

## F05 Swap
- F05-H1 ✅ swap after a ticked set keeps it on the old exercise, moves the rest (unit + e2e)
- F05-E1 ✅ suggestions only from equipment at the session's gym (unit suggestSwaps)

## F06 Supersets
- F06-H1 ✅ rest starts only after the last exercise of a round (unit + e2e)

## F07 Plates
- F07-H1 ✅ 62.5 kg on 20 kg bar → 20 + 1.25 per side, "Use" writes the weight back
- F07-E1 ✅ unloadable weight shows nearest options (unit)
- F07-E2 ✅ below the bar weight is an error (unit)

## F08 Warm-ups and set types
- F08-H1 ✅ add warm-ups from 100 kg → 40/60/80 before working sets
- F08-E1 ✅ automatic warm-ups when the setting is on (unit)
- F08-E2 ✅ drop set with multiple entries
- F08-E3 ✅ warm-ups excluded from volume and records (unit isWorking)

## F09 Progress
- F09-H1 ✅ dashboard muscles/weekly chart, exercise detail charts in lb
- F09-E1 ✅ a single data point renders a sensible axis (was bug B02)
- F09-E2 ✅ records only after the first session (unit), PRs on summary

## F10 Custom exercise
- F10-H1 ✅ create with main + secondary muscle, shows on detail
- F10-E1 ✅ deleting a used custom exercise archives it (unit)

## Data
- D-H1 ✅ JSON export → delete all → restore (more.spec)
- D-E1 ✅ import rejects a non-backup file (unit)
- D-E2 ✅ CSV export (unit)
- D-E3 ✅ offline reload after first visit (service worker)
- D-E4 🖐 Safari storage eviction after weeks unused: mitigated by persist() + install prompt; can't be automated

## Not applicable
- ⏭ second user's data, expired session, wrong password, card declined, emails: no accounts, no server, no payments
- ⏭ time zones / DST: dates stored as local calendar day at start + UTC ms; weekly buckets use local dates (unit tests for week start)
