import { useState } from 'react';
import { Dumbbell } from 'lucide-react';
import { Button, Field, Segmented, inputCls } from '../components/ui';
import { GYM_PRESETS, finishOnboarding } from '../data/repo';
import type { Unit } from '../data/schema';
import { APP_NAME, TAGLINE } from '../brand';

export function Onboarding() {
  const [unit, setUnit] = useState<Unit>(navigator.language === 'en-US' ? 'lb' : 'kg');
  const [gym, setGym] = useState('My gym');
  const [preset, setPreset] = useState<keyof typeof GYM_PRESETS>('Full gym');
  const [busy, setBusy] = useState(false);
  return (
    <main className="mx-auto flex min-h-full max-w-app flex-col px-5 py-10">
      <div className="mb-8 flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent text-on-accent"><Dumbbell /></span>
        <div><h1 className="text-xl">{APP_NAME}</h1><p className="text-sm text-muted">{TAGLINE}</p></div>
      </div>
      <div className="space-y-6">
        <div>
          <p className="mb-2 text-sm font-semibold">Weights in</p>
          <Segmented label="Weight unit" value={unit} onChange={setUnit} options={[{ value: 'kg', label: 'Kilograms' }, { value: 'lb', label: 'Pounds' }]} />
        </div>
        <Field label="Where do you train?" hint="You can add more places later, e.g. home and the gym.">
          <input className={inputCls} value={gym} onChange={(e) => setGym(e.target.value)} />
        </Field>
        <div>
          <p className="mb-2 text-sm font-semibold">What’s there?</p>
          <div className="space-y-2">
            {(Object.keys(GYM_PRESETS) as (keyof typeof GYM_PRESETS)[]).map((p) => (
              <label key={p} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-md border px-3 ${preset === p ? 'border-accent bg-accent-soft' : 'border-border bg-surface'}`}>
                <input type="radio" name="preset" checked={preset === p} onChange={() => setPreset(p)} className="accent-[rgb(var(--accent))]" />
                <span>{p}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-auto pt-10">
        <Button variant="primary" size="lg" block loading={busy} onClick={async () => { setBusy(true); await finishOnboarding(unit, gym.trim() || 'My gym', preset); }}>Start training</Button>
        <p className="mt-3 text-center text-xs text-muted">No account. Everything is stored on this device; export a backup from Settings.</p>
      </div>
    </main>
  );
}
