# What their users hate, and what Repwise does about it

**Sample: 10 reviews, 1 source** (App Store, US, the 10 shown on the public reviews page; ratings 2–5★,
Jan–Aug 2026). Apple's review RSS feed returned no entries for this app; Reddit, Google Play,
G2/Capterra and Trustpilot weren't reachable from this environment; Hacker News had 2 mentions,
neither a usable review (one is a competitor advertising itself). **Every theme below is thin.**
This supports a direction for a personal app, not a ranking. All reviews are verbatim in `reviews.csv`;
the automatic theming is in `feedback.md` (its keyword themes were noisy, so the lists below were
coded by hand from the full texts). All quotes link to: https://apps.apple.com/us/app/macrofactor-workouts-tracker/id6737156524?see-all=reviews

## 1. What they hate

| # | problem | reviews | quote |
| --- | --- | --- | --- |
| 1 | Lost workouts / sessions stuck and can't finish | 1 (2★) | "Buggy: have lost multiple workout sessions due to workouts getting stuck and unable to complete." |
| 2 | Confusing, over-engineered UI | 3 (2★, 3★, 4★) | "Generally over engineered, unintuitive." / "I just don’t understand the UI." |
| 3 | Too many taps to see what you did last time; history hides details | 1 (2★) | "Way too many clicks to just see what I did on an exercise last session." / "Can’t see actual set logs from dashboard." |
| 4 | Suggested weights you can't actually load | 1 (4★) | "it’ll sometimes recommend weights I don’t have … I do not have that kind of dumbbell" |
| 5 | Notes don't carry forward to the next session | 1 (4★) | "its very cumbersome to require opening past sessions to review cues/reminders/notes." |
| 6 | Time estimates far too low | 1 (2★) | "plugged in Jeff’s own “45 minute leg routine” and the app guessed it would take 14 minutes." |
| 7 | Rest timer sound quiet/unreliable | 1 (4★) | "I would prefer a more aggressive bell like Strong. The reliabilityod the timer sound has also been inconsistent" |
| 8 | Jargon (RIR) not explained | 1 (4★) | "I didn’t know what RIR meant" |
| 9 | Editing a logged set resets the rest timer | 1 (2★) | "Doesn’t allow you to change your logged set’s weight or reps without resetting rest timer." |

## 2. What is missing

| # | request | reviews | quote |
| --- | --- | --- | --- |
| 1 | Import history from the previous app / spreadsheets | 2 (2★, 5★) | "Not being able to yet import all my years of data from my previous app" / "if you’re looking to migrate from spreadsheets it’s not worth it." |
| 2 | Ready-made splits (PPL, bro split) | 1 (5★) | "Bro splits and PPL missing was a huge surprise." |
| 3 | Cardio | 1 (5★) | "I think all programs should get optional cardio available to add" |
| 4 | Videos (incl. women performing exercises) | 2 | "Lacks video examples of women performing exercises." (out of scope: owned content) |

## 3. What is unsolved

- **Lifters who already have a program** and just want a fast, reliable logger. The generator is the
  original's headline, but two reviewers who run their own plans found it generic or slow to set up
  (2★: "Good for brand new beginners - not much else"; 3★ "I usually prefer to create my own workouts"). Thin, 2 reviews.

## 4. Fix plan (done = built and tested in this pass)

| fix | size | status | evidence |
| --- | --- | --- | --- |
| Never lose a workout: every change saved instantly, survives reload/close, atomic set edits | S | done (B01 fix, reload e2e) | hate #1 |
| Last time's numbers inline on every set, plus actual sets per session in exercise history | S | done | hate #3 |
| Suggestions rounded to weights you can load (gym plates, dumbbell steps) | S | done (`roundLoadable`) | hate #4 |
| Notes carry forward: last session's note and your exercise cue shown in the logger | S | done | hate #5 |
| Time estimate from your own past sessions (median), formula only as fallback | S | done | hate #6 |
| Loud rest alert option (3 beeps + long buzz) | S | done | hate #7 |
| Tap "RIR" for a plain-language explainer | S | done | hate #8 |
| Editing a ticked set never touches the rest timer | — | already true | hate #9 |
| CSV history import (our export, Strong/Hevy-style, simple sheets), idempotent | M | done | missing #1 |
| Starter splits (PPL, Upper/Lower) as one-tap programs | S | next | missing #2 |
| Cardio sessions | M | later | missing #3 |

New rows added to `features.csv` with original = no.

## 5. The angle

1. **For lifters who already have a plan** and found the original's generator generic,
   Repwise is just the fastest, most reliable logger: one tap a set, nothing to set up. *(unsolved; 2 reviews)*
2. **For people who've lost a workout to a buggy app**, Repwise saves every tap on your phone
   instantly, works with no signal, and never needs an account. *(hate #1; 1 review, but the worst kind)*
3. **For beginners put off by jargon**, plain words and explainers. *(hate #2, #8; 4 reviews)*

**Recommended: 1 + 2 together.** "Your plan. Every set, saved. No account." It's what you asked for
(personal use, your own routines) and the reviews say it's where the original is weakest.
