# Brand: Ironrow

Angle (from `fixes.md`): for lifters who already have a plan, the fastest, most reliable
logger. Every set saved on your phone the moment you tap it, no account.
Tagline: **Your plan. Every set, saved. No account.**

## Name

20 candidates: Repwise, Setwell, Ironleaf, Barline, Chalkline, **Setkeeper**, Repkeep, Liftledger,
Notchbook, Loadline, Ironquill, Gripwell, Tallyset, Steadyset, Liftmark, Setpiece, Ironnote,
Hearth, Kettle, Plateline, Barnote.

Filters: nothing that sounds, looks or means like the original ("macro", "factor", science/strength
puns are out); short; spellable; fits the angle. The App Store search (run 2026-11-25, US store,
`itunes.apple.com/search`) knocked out most of them:

| name | App Store apps using the name (run 2026-11-25) | verdict |
| --- | --- | --- |
| Repwise | 8, mostly workout trackers | **out** (was the placeholder) |
| Liftledger | 5 workout logs | out |
| Ironquill, Ironnote, Barline, Steadyset, Liftmark, Plateline, Setwell, Ironleaf | 1–3 each, mostly workout apps | out |
| Setkeeper | 0 | used until 2026-11-25, then replaced by Ironrow at the owner's choice |
| Repkeep | 0 | backup |
| Tallyset | 0 | backup |
| Gripwell | 0 exact, but crowded fitness results | backup |

Remaining checks for the shortlist, **to run** (this environment can't reach these sites):

| check | Setkeeper | Repkeep | Tallyset |
| --- | --- | --- | --- |
| US trademark (tmsearch.uspto.gov, classes 9, 42) | to run | to run | to run |
| EU (euipo eSearch / TMview) | to run | to run | to run |
| WIPO Global Brand Database | to run | to run | to run |
| domain (.com / .app) | to run | to run | to run |
| Google Play | to run | to run | to run |
| handles (X, Instagram, TikTok, GitHub) | to run | to run | to run |
| web search "name workout app" | to run | to run | to run |

For a personal app none of this blocks you. If you ever publish it, run these and ask a trademark
lawyer before spending money on the name.

### Rename to Ironrow (2026-11-25)

The owner asked for "MacroTrack". The App Store search that day found it taken: at least 3 Health &
Fitness apps use the exact name (plus "MacroTrack AI"), "macro" reads as nutrition tracking, and
"Macro…" sits next to the original's name. Second round of candidates, App Store search 2026-11-25:

| name | apps using it | |
| --- | --- | --- |
| **Ironrow** | 0 | **chosen by the owner** |
| Repkeep, Tallyset, Repyard, Setpost | 0 | unused alternatives |
| Setline, GymTally, LiftLoop, RepNote, BarBook, SetSmith, LiftJot, RepStack, GymLedger, IronLog, Liftlore, Benchbook, Plateday, Liftkin, IronPace, BarWise | 1–21 | taken |

Trademark, domain, Play and handle checks for Ironrow: **to run** (not reachable from here).
Not needed for personal use; run them before ever publishing.

## Palette

Primary hue moved from the build-time placeholder blue to **violet**, its own family. Roles unchanged:

| role | light | dark |
| --- | --- | --- |
| accent | #4a24c4 | #9478ff |
| on-accent | #ffffff | #120a33 |
| accent-soft | #ebe5fc | #231848 |
| neutrals, danger, success, warning | unchanged from `tokens*.json` | |

`contrast.py`: 0 AA failures in light (17 pairs) and dark (18 pairs).
The original's brand colours were never measured (no screenshots), so `brand.json` lists none.
The name and domain sweep is what guards against leftovers.

## Logo directions (2026-11-25)

Six drafts in `design/logo-directions.png`: A Ascent, B IR monogram, C The plate, D Logbook rows, E Loaded bar, F wordmark with plate O's.

**Chosen: C + F, then the icon changed to a barbell (owner's request).** A level side-view barbell (sleeves, two plates a side, collars) is the app icon: **purple-gradient barbell (#b9a4ff → #7a4cf5 → #5a2fd6) on black (#0a0a0c)**, chosen over a black barbell on purple; white on the brand gradient (135°: #5a2fd6 → #2a1173 → #0e0826); the IRONROW wordmark with plate O's is used on the welcome screen and the home header. Letters are outlined from Inter Display Black (SIL Open Font License) so no font loads at runtime. Source of truth: `app/scripts/make-logo.py` → `app/src/components/Logo.tsx`, `app/public/icon.svg`; PNG icons rendered from the SVG.

## Logo brief

- Idea: a **keeper's tally**: four short vertical strokes crossed by one, drawn as plates on a bar
  (sets counted, nothing lost).
- Mark: symbol + wordmark; the symbol alone is the app icon.
- Must work at 16px (favicon: the tally alone, 2 colours) and 1024px (app icon, violet on near-black, no transparency).
- Deliverables: SVG mark + wordmark, 1024×1024 icon (iOS, opaque), favicon 16/32/48 + SVG, 192/512 PWA icons (maskable), 1200×630 social image.
- Must not resemble the original's mark: no shared shape, colour pair or letterform trick; check side by side.
- Current placeholder icon: our own dumbbell glyph in the new violet (`app/public/icon.svg`).

## Voice

**Plain, not dumbed down. Calm, not cheerleading. Brief, not curt.**

| do | don't |
| --- | --- |
| "Enter reps first" | "Oops! Looks like you forgot something 😅" |
| "Workout paused. The clock is stopped." | "Taking a breather? 💪" |
| "Hidden (it’s in your history)" | "Error: cannot delete referenced entity" |
| Explain jargon once, in a sheet ("RIR: reps in reserve") | Assume everyone knows RIR, RPE, e1RM |
| Numbers first ("62.5 kg · 20 + 1.25 per side") | Paragraphs before the number |

Most-seen strings (all written fresh for this app, none from the original):
1. Onboarding: "Start training" · "No account. Everything is stored on this device; export a backup from Settings."
2. Empty home: "No saved workouts yet". "Save the workouts you repeat, or just start a quick one and add exercises as you go."
3. Main button: "Start workout" / "Resume workout"
4. Logger empty: "Add your first exercise". "Pick what you’re training. Sets from last time fill in automatically."
5. Tick without reps: "Enter reps first"
6. Finish with unticked sets: "Finish workout?" "3 unticked sets will be removed."
7. Summary: "Workout done" · "New records"
8. Discard: "Discard workout?" "Everything logged in this session will be deleted."
9. Rest: "You’ll get a buzz and a beep when rest is over."
10. Storage error: "Storage is unavailable". "This browser blocked on-device storage… Open the app in a normal window."

## Sweep

`python3 sweep.py . --config replica/brand.json` → **Clean** (2026-11-25), on `app/` and the whole repo.
By eye: page title, PWA manifest name, home-screen name, favicon and backup file names all say Ironrow.
