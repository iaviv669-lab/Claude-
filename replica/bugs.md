# Bugs

| ID | sev | title | status |
| --- | --- | --- | --- |
| B01 | S1 | Typing weight then reps quickly can lose the weight | fixed |
| B02 | S3 | Weekly chart with one data point shows the years 2027–2029 on the date axis | fixed |
| B03 | S3 | Dark mode: white text on danger button and on the ticked ✓ fails contrast (2.4:1) | fixed |
| B04 | S4 | Estimated 1RM on the summary shows two decimals ("79.17 kg") | fixed |
| B05 | S4 | "1 sets" / "1 exercises" plurals | fixed |

## B01 Typing weight then reps quickly can lose the weight (S1, data loss)
Steps: start a workout, add Back Squat, type 100 in weight, immediately type 5 in reps, tick, reload.
Expected: set 1 = 100 × 5.  Actual: set 1 ticked with weight blank.
Cause: each field saved a copy of the whole entries array built from the last render, so the second write overwrote the first. Ticking had the same race.
Evidence: e2e "F02 quick workout" failed after reload (error context showed `Set 1 weight` empty, 1/3 sets).
Fix: `patchEntry` and `tickSet` in `app/src/data/repo.ts` do read-modify-write in one IndexedDB transaction. Test: `repo.test.ts` "B01 concurrent field edits" (failed first, passes now).

## B02 Weekly chart axis (S3)
Steps: one finished workout → Progress. Expected: one bar labelled with this week. Actual: x axis labelled 2027, 2028, 2029.
Fix: replaced the chart library with a small SVG chart (`components/Chart.tsx`) that labels real data dates. Bundle −52 kB.

## B03 Dark mode contrast (S3)
Found by axe on the design page in dark mode. Added `on-danger` and `on-success` tokens; contrast.py 0 failures in both themes.

## To check (not reproduced)
- iOS Safari: background rest notification requires the app installed to the home screen; without it only the in-app beep/vibrate on return.
- Very long histories (years): stats read all set logs; fine at thousands of rows, untested at 100k+.

Open S1: 0. Open S2: 0.
