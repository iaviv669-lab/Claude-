import type { Muscle } from '../data/schema';
import { MUSCLE_LABEL } from '../data/seed';

// Our own simplified front/back figure: rounded blocks per muscle region, drawn fresh.
type Shape = [Muscle, number, number, number, number]; // muscle, x, y, w, h (in a 100x200 box)
const FRONT: Shape[] = [
  ['front_delts', 22, 40, 14, 12], ['front_delts', 64, 40, 14, 12], ['chest', 36, 42, 28, 18],
  ['biceps', 18, 54, 10, 20], ['biceps', 72, 54, 10, 20], ['forearms', 14, 76, 10, 22], ['forearms', 76, 76, 10, 22],
  ['abs', 40, 62, 20, 30], ['obliques', 32, 64, 7, 24], ['obliques', 61, 64, 7, 24],
  ['quads', 33, 100, 15, 40], ['quads', 52, 100, 15, 40], ['adductors', 45, 100, 10, 26], ['calves', 34, 148, 12, 34], ['calves', 54, 148, 12, 34],
];
const BACK: Shape[] = [
  ['traps', 38, 30, 24, 14], ['rear_delts', 22, 40, 14, 12], ['rear_delts', 64, 40, 14, 12], ['side_delts', 18, 38, 8, 10], ['side_delts', 74, 38, 8, 10],
  ['upper_back', 36, 44, 28, 14], ['lats', 30, 58, 16, 24], ['lats', 54, 58, 16, 24], ['triceps', 18, 54, 10, 20], ['triceps', 72, 54, 10, 20],
  ['lower_back', 40, 82, 20, 14], ['glutes', 34, 98, 32, 18], ['abductors', 28, 100, 6, 14], ['abductors', 66, 100, 6, 14],
  ['hamstrings', 33, 118, 15, 28], ['hamstrings', 52, 118, 15, 28], ['calves', 34, 150, 12, 32], ['calves', 54, 150, 12, 32],
];

function Figure({ shapes, worked, label }: { shapes: Shape[]; worked: Map<Muscle, number>; label: string }) {
  const max = Math.max(1, ...worked.values());
  return (
    <svg viewBox="0 0 100 200" className="h-48 w-24" role="img" aria-label={label}>
      <circle cx="50" cy="16" r="11" className="fill-surface-2" />
      <rect x="32" y="28" width="36" height="72" rx="14" className="fill-surface-2" />
      {shapes.map(([m, x, y, w, h], i) => {
        const v = worked.get(m) ?? 0;
        return <rect key={i} x={x} y={y} width={w} height={h} rx="5" className={v ? 'fill-accent' : 'fill-border'} opacity={v ? 0.35 + 0.65 * (v / max) : 1}><title>{MUSCLE_LABEL[m]}</title></rect>;
      })}
    </svg>
  );
}

export function BodyMap({ worked }: { worked: Map<Muscle, number> }) {
  const names = [...worked.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => MUSCLE_LABEL[m]);
  return (
    <div>
      <div className="flex justify-center gap-6">
        <Figure shapes={FRONT} worked={worked} label="Front view" />
        <Figure shapes={BACK} worked={worked} label="Back view" />
      </div>
      <p className="mt-2 text-center text-sm text-muted">{names.length ? names.join(' · ') : 'No muscles logged'}</p>
    </div>
  );
}
