# Parity report

Date: 2026-11-25 · Clone: Repwise (`app/`) · Original: MacroFactor Workouts (core logging slice)

## Scores

| | score | notes |
| --- | --- | --- |
| **Features (chosen slice)** | **100 / 100** | 44 features counted, 22/22 must-haves, 14/14 should, 8/8 could |
| Features (whole original app) | ~65 / 100, estimated | the 8 `skip` rows are a large part of what the original sells: program generation, smart progression, technique videos, sync, body tracking |
| Layout | not measured | no screenshots of the original were captured (App Store images weren't analysed; we don't have your account). Our layout is our own by design |

Be clear on what 100 means: everything in the slice you picked (the core logging loop for personal use) works. It is not a full copy of the original, and the most valuable part of the original, its adaptive program generator, is deliberately left out.

## Behaviour differences

| flow | original | clone | keep / fix |
| --- | --- | --- | --- |
| F01 log a set | enter or accept prefilled, tick (1 tap when prefilled) | same; ticking an empty set also fills it from last time | keep, ties the number to beat |
| F01 weight suggestions | smart progression from their algorithm + RIR | double progression from your rep range (public method) | keep; simpler, explainable |
| F01 rest alert | native notification | vibrate + beep; notification only when installed (iOS 16.4+) | keep, web limit; install to home screen |
| F02 quick workout | Workout tab → More → Empty workout (≈3 taps) | centre **+** → Quick workout, or one button on home (1–2 taps) | keep, fewer taps |
| F07 plates | from the weight field | tap the "previous" value on barbell lifts, or the weight via the sheet | keep |
| Data | account + cloud sync | on device only, JSON backup | keep for personal use; sync is the first thing to add if you want multiple devices |
| Exercise library | hundreds with videos | 98 of our own, no videos, custom exercises | keep; add customs as you need them |
| Offline | needs sign-in, then works | fully offline PWA, no sign-in | better |

## Missing, in build order

None in the slice. Beyond it, if you want more:
1. Cloud backup / sync (Supabase) for using two devices
2. Body weight trend chart (the bodyweight log already exists)
3. Import from other apps (CSV from Strong/Hevy)
4. Per-exercise warm-up scheme editor in the UI (data model supports it)
5. Drag-to-reorder instead of Move up/down

## Verdict

**Shippable** for personal use: all must-haves done, 0 open S1/S2 bugs (`bugs.md`), 38 unit + 13 e2e tests green.
"Better than the original" needs the replica-entrepreneur fixes; see `fixes.md`.
