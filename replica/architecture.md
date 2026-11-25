# Architecture: your workout tracker (a rebuild of MacroFactor Workouts' core logging features)

Inputs: `replica/recon.md`, `replica/features.csv`. Scope: personal use,
mobile-first web, core logging loop. One user, one device, no server.

## Stack

The skill's default stack (Next.js + Postgres + auth + Stripe) assumes many
users and a server. You chose personal use, so every one of those layers is
cost and moving parts with no benefit. The clone is a **static, offline-first
PWA** and the database lives in the browser.

| layer | choice | why |
| --- | --- | --- |
| web | Vite + React 18 + TypeScript | fast dev loop, static build, no server needed |
| routing | React Router (hash or history) | ~23 screens, simple nested routes |
| styling | Tailwind CSS, tokens from `/replica-design` | mobile-first utilities, easy dark mode |
| state | Zustand for UI/session state; DB is the source of truth | tiny, no boilerplate |
| database | IndexedDB via **Dexie** (+ `dexie-react-hooks` live queries) | durable on-device storage, indexes, transactions, versioned migrations |
| charts | uPlot (or Recharts if simpler is preferred) | small, fast line/bar charts on phones |
| offline / install | `vite-plugin-pwa` (Workbox) | installable to home screen, works with no signal in the gym |
| auth | none | single user on their own device |
| payments | none | personal use |
| email | none | — |
| jobs | none; rest-timer alerts via Notification API + `navigator.vibrate` | no backend to run jobs |
| backup | JSON export/import + CSV export, `navigator.storage.persist()` | data is on-device; export is the backup |
| tests | Vitest (logic), Playwright (flows) | Playwright is preinstalled here |
| hosting | any static host: GitHub Pages, Cloudflare Pages, Netlify or Vercel | free, HTTPS (required for PWA + notifications) |

Later, if you want sync across devices: add Supabase (Postgres + auth) and a
sync layer. The schema below already uses UUIDs and `updatedAt` so that's
possible without a rewrite.

## Schema

Tables: **10** (Dexie object stores). Access rules: none needed (single user,
same-origin storage). Full definition with types: `replica/schema.ts` (Dexie
version 1 = the first migration).

Conventions, adapted from the skill's Postgres rules:
- `id`: `crypto.randomUUID()` string primary key; `createdAt`, `updatedAt` on every row.
- Times: UTC epoch milliseconds (`number`). Display in local time. Session dates
  for grouping use the local calendar day stored as `localDate` (`YYYY-MM-DD`)
  at start, so a workout at 23:30 doesn't jump days if you travel.
- Weights stored **in kg as a float**, plus the unit it was entered in
  (`enteredUnit`). Display converts. Avoids mixed-unit history bugs.
- Enums: TypeScript string unions, validated in the data layer.
- Delete rules (decided, enforced in the data layer inside one Dexie transaction):

| parent → child | on delete |
| --- | --- |
| Session → SessionExercise → SetLog | cascade |
| Workout → WorkoutItem | cascade |
| Program → Workout | workouts detach (`programId = null`), not deleted |
| Exercise (custom) → WorkoutItem / SessionExercise | **restrict** if used in history; offer archive instead |
| GymProfile → Workout / Session | restrict while referenced; history keeps `gymId` |
| Workout → Session | sessions keep a name snapshot; `workoutId` set null |

```ts
// excerpt; see replica/schema.ts
db.version(1).stores({
  settings:         'id',
  exercises:        'id, name, isCustom, archived, *primaryMuscles, *equipment',
  gyms:             'id, name',
  programs:         'id, active, archived',
  workouts:         'id, programId, archived, name',
  workoutItems:     'id, workoutId, [workoutId+order], exerciseId',
  sessions:         'id, status, startedAt, localDate, workoutId',
  sessionExercises: 'id, sessionId, [sessionId+order], exerciseId',
  setLogs:          'id, sessionExerciseId, [sessionExerciseId+index], exerciseId, completedAt',
  bodyWeights:      'id, &localDate',
});
```

Hard constraints the recon found, and where they live:
- **Only one active session at a time.** Checked in a transaction in
  `startSession`; the UI resumes it instead of starting another.
- **"Previous" values** = the last *completed* session's sets for that exercise,
  matched by set index. Index `setLogs.[exerciseId]` + `completedAt` makes this
  one query (denormalised `exerciseId` on SetLog on purpose).
- **Supersets** = `supersetGroup` (shared id) on adjacent items; reordering
  that breaks adjacency auto-detaches.
- **Drop / myo sets** = one SetLog with `entries[]` > 1; volume sums entries.
- **One bodyweight entry per day** = unique index `&localDate`.

## API

No server, so the "API" is the **data layer** (`src/data/*.ts`): typed
functions, each one Dexie transaction. Screens call only these.

| function | does | who | input | output | flow |
| --- | --- | --- | --- | --- | --- |
| `getSettings / updateSettings` | read/patch settings | app | partial settings | Settings | S01 S22 |
| `seedLibrary` | insert built-in exercises on first run (idempotent by fixed ids) | app | — | count | S01 |
| `searchExercises` | name/alias search + muscle/type/equipment filters | S06 | query, filters | Exercise[] | F02 F03 F10 |
| `createExercise / updateExercise / archiveExercise` | custom exercise CRUD (restrict delete if used) | S19 | Exercise fields | Exercise | F10 |
| `suggestSwaps` | substitutes sharing primary muscles + pattern, available in gym | S12 | exerciseId, gymId | Exercise[] | F05 |
| `createWorkout / updateWorkout / deleteWorkout / duplicateWorkout` | template CRUD | S05 | name, gymId, items | Workout | F03 |
| `setItems / reorderItems / setSuperset / detachSuperset` | edit template items | S05 S20 | ids, order, group | WorkoutItem[] | F03 F06 |
| `createProgram / updateProgram / setActiveProgram` | programs with days | S20 | name, icon, color, days | Program | F04 |
| `startSession` | create Session + SessionExercises + prefilled SetLogs from template & previous; reject if one active | S07 | workoutId? | Session | F01 F02 |
| `getActiveSession` | restore on load | app | — | Session + tree | F01 |
| `updateSet` | write weight/reps/rir/type/entries | S08 | setId, patch | SetLog | F01 |
| `completeSet / uncompleteSet` | tick, stamp `completedAt`, return rest duration to start | S08 | setId | {restSec} | F01 |
| `addSet / removeSet / addExerciseToSession / removeExerciseFromSession / swapInSession` | mid-workout edits (swap keeps ticked sets on old exercise) | S08 S12 | ids | tree | F01 F05 |
| `addWarmups` | generate warm-up sets from scheme and first working weight | S08 | sessionExerciseId | SetLog[] | F08 |
| `pauseSession / resumeSession` | accumulate `pausedMs` | S13 | sessionId | Session | F01 |
| `completeSession` | end, drop empty unticked sets (ask first), compute PRs | S13 | sessionId | Summary | F01 |
| `discardSession` | cascade delete | S13 | sessionId | — | F01 |
| `listSessions / getSession / editSession / deleteSession` | history | S15 S16 | paging, patch | Session[] | F09 |
| `exerciseStats` | e1RM/3RM/10RM, heaviest, volume, best set, reps, sets over range | S17 | exerciseId, range | series | F09 |
| `muscleStats` | sets & volume per muscle per week (primary = 1, secondary = 0.5) | S02 S18 | range | series | F09 |
| `weeklySummary / recentRecords` | dashboard widgets | S02 | — | widgets | F09 |
| `plateBreakdown` (pure) | per-side plates for target total, bar, available plates | S10 | total, bar, plates, unit | plates[] or error | F07 |
| `exportJSON / importJSON / exportCSV` | backup & restore (import validates, replaces in one transaction) | S23 | file | file / counts | — |
| `logBodyWeight` | upsert by day | S22 | date, kg | BodyWeight | — |

Webhooks in: none. Webhooks out: none. Jobs: none.
Background behaviour: rest timer stores `restEndsAt` (wall clock) and schedules
a notification when the page is hidden; on return, the UI recomputes from the
clock rather than counting ticks.

Formulas (public, standard):
- e1RM: Epley `w × (1 + reps/30)` for reps ≤ 12 (ignore higher reps for e1RM);
  3RM/10RM estimated from e1RM by inverting the same formula.
- Volume: Σ weight × reps over completed, non-warm-up sets; bodyweight exercises
  add `bodyweight × bodyweightPct` (could-have).
- Double progression (could-have): all working sets at repMax and RIR ≥ target
  → next time add the smallest loadable increment; else keep weight, aim +1 rep.

## The parts that bite

- **time zones**: store UTC ms + `localDate`; weekly charts bucket by `localDate`, weeks start Monday (setting).
- **idempotency**: `seedLibrary` uses fixed ids and `bulkPut`; import is all-or-nothing in one transaction; double-tap on ✓ is a toggle on persisted state, not an append.
- **races**: two tabs open on one session → Dexie live queries keep both views in sync; a `BroadcastChannel` lock keeps only one tab running the rest timer.
- **offline**: the whole app is offline; the service worker precaches the build. Updates apply on next launch (prompt, never mid-workout).
- **storage eviction**: Safari can evict IndexedDB for sites not used for a while unless installed; call `navigator.storage.persist()`, nudge to install to home screen, and remind to export monthly.
- **timers in background**: browsers throttle hidden tabs; compute from timestamps; iOS web push/notifications only work for installed PWAs (iOS 16.4+), so vibrate + sound + a visible countdown on return are the fallback.
- **screen sleep**: Screen Wake Lock API while a session is active (toggle).
- **numeric input on phones**: `inputmode="decimal"` for weight, `numeric` for reps; accept both `,` and `.` decimals.
- **units**: store kg, convert on display, round display to the gym's smallest plate; never re-convert stored values (drift).
- **search**: library is ~150 rows + customs; in-memory filter over a cached list is enough, no index server.
- **file size**: export of years of data is a few MB of JSON; fine.
- **GDPR deletion**: "Delete all data" = `db.delete()` + clear caches.
- **multi-tenancy, rate limits, email deliverability, realtime**: not applicable.

## Build order

1. **Vertical slice** (ugly, end to end): pick exercises → start an empty
   workout → log weight × reps with ✓ → rest timer → complete → summary → it
   appears in history.
   Screens S03 S06 S08 S09 S14 S15. Tables settings, exercises (seed),
   sessions, sessionExercises, setLogs. Functions `seedLibrary`,
   `searchExercises`, `startSession`, `updateSet`, `completeSet`,
   `completeSession`, `getActiveSession`, `listSessions`.
2. **Must-haves** (features.csv `must`), by area:
   - exercises: filters, custom exercise S19
   - workouts: templates S05, reorder/remove, targets, preview S07
   - logging: previous column + prefill, add/remove mid-session, reload-safe, discard S13, rest alerts
   - history/progress: session detail S16, exercise chart S17
   - settings: first run S01, units S22
3. **Should-haves**: edit past sessions, set types + RIR, supersets, swap S12,
   plate calculator S10, gym profiles S21, rest defaults by type, smart
   warm-ups, auto-advance, pause/minimise, dashboard S02, muscle stats S18,
   export/import S23.
   **Could-haves**: programs S20, partial reps, notes, bodyweight volume, double
   progression, body map, theme, PWA install polish.
4. **Fixes from replica-entrepreneur**: none yet (optional for personal use, but
   it's a good way to find features worth adding).

Project layout:

```
app/                      (the clone, next to replica/)
  src/data/schema.ts      from replica/schema.ts
  src/data/*.ts           data layer above
  src/lib/plates.ts, e1rm.ts, units.ts, time.ts   pure, unit-tested
  src/screens/S03Workout.tsx ...                   one file per screen ID
  src/components/         from replica-design's component list
  src/seed/exercises.ts   our own exercise list
```
