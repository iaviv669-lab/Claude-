# Components

Built in `app/src/components/ui.tsx` (+ `Chart.tsx`, `BodyMap.tsx`, `ExercisePicker.tsx`).
Live gallery: Settings → "design system" link (route `#/design`).
Tokens: `tokens.json` (light) and `tokens.dark.json` (dark), as CSS variables in `app/src/index.css`.
Contrast: 0 AA failures in both themes (`python3 contrast.py`).

Rules for all: minimum tap target 44px; visible 2px accent focus ring (`:focus-visible`);
honour `prefers-reduced-motion`; numbers use tabular figures (`.num`).

```
Button
  variants  primary, secondary, ghost, danger
  sizes     sm 32px, md 44px, lg 48px
  states    default, active (brightness/bg), focus-visible ring, disabled (50%), loading (spinner, aria-busy, keeps label)
  tokens    accent/on-accent, surface-2/text, danger/white; radius md; font sm/600
  a11y      real <button>
  used on   all

IconButton
  44×44, required aria-label (also title); used for back, menus, delete

Header
  sticky, 56px, bg/95 + blur, back button, title + optional subtitle, right slot

Bottom nav
  4 tabs + centre create button (44px round, accent); 64px + safe-area; hidden on the logger
  active tab: accent + 600; NavLink gives aria-current

Mini workout bar
  accent pill above the nav while a session runs; name, rest countdown, elapsed; tap → logger

Card / Stat / SectionTitle / Empty
  Card: surface, border, radius lg, p-4; as button for list rows
  Stat: surface-2 tile, label xs muted, value lg tabular
  Empty: dashed border, icon, title, one sentence, one action

Sheet (bottom sheet)
  states    open/closed; scroll body; optional sticky footer
  a11y      role=dialog, aria-modal, labelled by title, focus moves in and returns on close, Escape + backdrop close
  used on   create, picker, rest timer, plates, set type, swap, exercise menu, workout menu, settings editors

Confirm dialog (alertdialog) and Toast (aria-live polite, optional action e.g. Undo)

Segmented control
  role=radiogroup / radio; selected = bg + shadow; used for units, theme, prefill, chart metric

Toggle
  role=switch on a real checkbox; label + hint; track surface-2 → accent

Chip
  aria-pressed; on = accent-soft + accent border; used for filters, muscles, equipment, ranges

Text / number input (`inputCls`)
  44px, border-input (3:1 on bg), focus border accent
  numbers: inputmode decimal (weight) / numeric (reps), accepts "," and ".", select-all on focus

Set row (logger)
  columns  set tag · previous · weight · reps · RIR · ✓
  variants standard (number), warm-up W (warning), drop D / myo M (accent, multi-entry with "+ Drop"), failure F (danger, RIR locked 0)
  states   empty (placeholder = last time), filled, ticked (success-soft row, success ✓), editing
  a11y     every input labelled "Set N weight/reps/reps in reserve"; ✓ is aria-pressed "Complete set N"
  tick     fills blanks from the placeholders, vibrates 15ms, starts rest

Exercise picker
  search (name + aliases), gym-equipment filter chip, muscle chips, create-custom row, multi-select with count in the footer button

Chart (SVG, no library)
  line (exercise metrics) and bars (weekly sets/volume); 3 y-ticks, ≤3 date labels; pointer shows value; "No data yet" empty state; role=img + label
Sparkline: 72×24 polyline, aria-hidden

Body map
  our own block figure, front + back; worked muscles in accent with opacity by sets; names listed below as text
```
