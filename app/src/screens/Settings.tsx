// S22 + S23
import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Download, Upload } from 'lucide-react';
import { db, type ExerciseType } from '../data/schema';
import * as repo from '../data/repo';
import { Button, Card, Field, Header, Page, SectionTitle, Segmented, Sheet, Toggle, confirmDialog, inputCls, toast } from '../components/ui';
import { TYPE_LABEL } from '../data/seed';
import { fmtClock, localDate } from '../lib/time';
import { fmtWeight, parseNum, toKg } from '../lib/units';
import { APP_NAME } from '../brand';
import { saveFile } from '../lib/saveFile';

async function download(name: string, text: string, type: string) {
  const r = await saveFile(name, text, type);
  toast(r === 'saved' ? 'File ready' : r === 'declined' ? 'Not saved' : 'Saving files isn’t available here. Open the app in a browser to export.');
}

export default function Settings() {
  const nav = useNavigate();
  const s = useLiveQuery(() => db.settings.get('me'), []);
  const bw = useLiveQuery(() => db.bodyWeights.orderBy('localDate').last(), []);
  const counts = useLiveQuery(async () => ({ sessions: await db.sessions.where('status').equals('completed').count(), custom: await db.exercises.where('isCustom').equals(1).count() }), []);
  const file = useRef<HTMLInputElement>(null);
  const csvFile = useRef<HTMLInputElement>(null);
  const [restEdit, setRestEdit] = useState(false);
  const [warmEdit, setWarmEdit] = useState(false);
  const [bwText, setBwText] = useState('');
  if (!s) return null;
  const row = 'flex min-h-12 w-full items-center justify-between py-2 text-left';
  return (
    <>
      <Header title="Settings" />
      <Page>
        <SectionTitle>Units & look</SectionTitle>
        <Card className="space-y-3">
          <Segmented label="Weight unit" value={s.unit} onChange={(unit) => repo.updateSettings({ unit })} options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} />
          <Segmented label="Theme" value={s.theme} onChange={(theme) => repo.updateSettings({ theme })} options={[{ value: 'system', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
          <Segmented label="Week starts" value={s.weekStartsOn} onChange={(weekStartsOn) => repo.updateSettings({ weekStartsOn })} options={[{ value: 1, label: 'Week: Mon' }, { value: 0, label: 'Week: Sun' }]} />
        </Card>

        <SectionTitle>Workouts</SectionTitle>
        <Card className="divide-y divide-border py-1">
          <Segmented label="Prefill sets with" value={s.prefill} onChange={(prefill) => repo.updateSettings({ prefill })} options={[{ value: 'previous', label: 'Last time' }, { value: 'targets', label: 'Targets only' }]} />
          <Toggle label="Suggest weight increases" hint="When you hit the top of an exercise’s rep range on every set, prefill the next step up" checked={s.suggestProgression !== false} onChange={(v) => repo.updateSettings({ suggestProgression: v })} />
          <button className={row} onClick={() => setRestEdit(true)}><span>Default rest times</span><ChevronRight size={18} className="text-muted" /></button>
          <Toggle label="Add warm-ups automatically" hint="Compound lifts, from your last working weight" checked={s.warmupAutomation === 'smart'} onChange={(v) => repo.updateSettings({ warmupAutomation: v ? 'smart' : 'off' })} />
          <button className={row} onClick={() => setWarmEdit(true)}><span>Warm-up scheme</span><span className="num text-sm text-muted">{s.warmupScheme.map((w) => `${Math.round(w.pct * 100)}%×${w.reps}`).join(' · ')}</span></button>
          <Toggle label="Jump to the next exercise" checked={s.autoAdvance} onChange={(v) => repo.updateSettings({ autoAdvance: v })} />
          <Toggle label="Loud rest alert" hint="Three beeps and a longer buzz when rest is over" checked={!!s.loudAlert} onChange={(v) => repo.updateSettings({ loudAlert: v })} />
          <Toggle label="Keep screen on during workouts" hint="Recommended on iPhone: a locked phone pauses the rest timer alert until you come back" checked={s.keepAwake} onChange={(v) => repo.updateSettings({ keepAwake: v })} />
          <Toggle label="Count bodyweight in volume" hint="For pull-ups, dips etc. Uses your latest bodyweight." checked={s.bodyweightContribution} onChange={(v) => repo.updateSettings({ bodyweightContribution: v })} />
        </Card>

        <SectionTitle>Bodyweight</SectionTitle>
        <Card className="flex items-end gap-2">
          <Field label={bw ? `Latest: ${fmtWeight(bw.weightKg, s.unit, true)} on ${bw.localDate}` : 'Log today’s weight'}>
            <input className={inputCls} inputMode="decimal" placeholder={s.unit} value={bwText} onChange={(e) => setBwText(e.target.value)} />
          </Field>
          <Button onClick={async () => { const v = parseNum(bwText); if (v == null || v <= 0) return toast('Enter a weight'); await repo.logBodyWeight(localDate(), toKg(v, s.unit)); setBwText(''); toast('Saved'); }}>Save</Button>
        </Card>

        <SectionTitle>Library</SectionTitle>
        <Card className="divide-y divide-border py-1">
          <button className={row} onClick={() => nav('/settings/gyms')}><span>Gyms & equipment</span><ChevronRight size={18} className="text-muted" /></button>
          <button className={row} onClick={() => nav('/settings/exercises')}><span>Exercises</span><span className="flex items-center text-sm text-muted">{counts?.custom ?? 0} custom<ChevronRight size={18} /></span></button>
        </Card>

        <SectionTitle>Your data</SectionTitle>
        <Card className="space-y-2">
          <p className="text-sm text-muted">Everything is stored only on this device ({counts?.sessions ?? 0} workouts). Export a backup now and then, and before switching phones or clearing browser data.</p>
          <Button block onClick={async () => download(`${APP_NAME.toLowerCase()}-backup-${localDate()}.json`, await repo.exportJSON(), 'application/json')}><Download size={18} />Export backup (JSON)</Button>
          <Button block onClick={async () => download(`${APP_NAME.toLowerCase()}-sets-${localDate()}.csv`, await repo.exportCSV(s.unit), 'text/csv')}><Download size={18} />Export sets (CSV, for spreadsheets)</Button>
          <Button block onClick={() => file.current?.click()}><Upload size={18} />Restore from backup</Button>
          <Button block onClick={() => csvFile.current?.click()}><Upload size={18} />Import history from CSV</Button>
          <p className="text-xs text-muted">CSV with one row per set: date, exercise, weight, reps (workout name and set order optional). Exports from most lifting apps and simple spreadsheets work. Weight unit is read from the header, else your current unit.</p>
          <input ref={csvFile} type="file" accept=".csv,text/csv" className="hidden" onChange={async (e) => {
            const f = e.target.files?.[0]; e.target.value = '';
            if (!f) return;
            try {
              const r = await repo.importSetsCSV(await f.text(), s.unit);
              toast(`Imported ${r.sessions} workouts, ${r.sets} sets${r.skipped ? ` (${r.skipped} already there)` : ''}${r.newExercises.length ? `, ${r.newExercises.length} new exercises` : ''}`);
            } catch (err) { toast(err instanceof Error ? err.message : 'Could not read that file'); }
          }} />
          <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={async (e) => {
            const f = e.target.files?.[0]; e.target.value = '';
            if (!f) return;
            if (!(await confirmDialog({ title: 'Replace all data?', body: 'Everything on this device will be replaced by the backup.', ok: 'Restore', danger: true }))) return;
            try { const c = await repo.importJSON(await f.text()); toast(`Restored ${c.sessions} workouts`); } catch (err) { toast(err instanceof Error ? err.message : 'Could not read that file'); }
          }} />
          <Button block variant="ghost" className="text-danger" onClick={async () => {
            if (await confirmDialog({ title: 'Delete all data?', body: 'Workouts, exercises, gyms and settings will be erased from this device. This can’t be undone.', ok: 'Delete everything', danger: true })) { await repo.deleteAllData(); location.reload(); }
          }}>Delete all data</Button>
        </Card>
        <SectionTitle>Credits</SectionTitle>
        <Card className="space-y-2 text-xs text-muted">
          <p>Exercise library includes the open exercise library by Achref Thamri (gymdeck-exercises), used under the MIT License: Copyright (c) 2026 Achref Thamri. Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files, to deal in the Software without restriction, subject to including this notice. The software is provided “as is”, without warranty of any kind.</p>
          <p>Logo lettering: Barlow Condensed by The Barlow Project Authors, SIL Open Font License 1.1. Icons: Lucide (ISC).</p>
        </Card>
        <p className="mt-6 text-center text-xs text-muted">{APP_NAME} · works offline · <button className="underline" onClick={() => nav('/design')}>design system</button></p>
      </Page>

      <RestDefaults open={restEdit} onClose={() => setRestEdit(false)} value={s.restDefaults} />
      <WarmupScheme open={warmEdit} onClose={() => setWarmEdit(false)} value={s.warmupScheme} />
    </>
  );
}

function RestDefaults({ open, onClose, value }: { open: boolean; onClose: () => void; value: Record<ExerciseType, number> }) {
  const [v, setV] = useState(value);
  return (
    <Sheet open={open} onClose={onClose} title="Default rest" footer={<div className="flex gap-2"><Button onClick={() => setV(repo.DEFAULT_SETTINGS.restDefaults)}>Reset</Button><Button variant="primary" className="flex-1" onClick={async () => { await repo.updateSettings({ restDefaults: v }); onClose(); }}>Save</Button></div>}>
      {(Object.keys(TYPE_LABEL) as ExerciseType[]).map((k) => (
        <div key={k} className="flex items-center gap-3 py-2">
          <span className="flex-1">{TYPE_LABEL[k]}</span>
          <Button size="sm" onClick={() => setV({ ...v, [k]: Math.max(15, (v[k] ?? 60) - 15) })}>−</Button>
          <span className="num w-12 text-center">{fmtClock(v[k] ?? 60)}</span>
          <Button size="sm" onClick={() => setV({ ...v, [k]: Math.min(600, (v[k] ?? 60) + 15) })}>+</Button>
        </div>
      ))}
      <p className="mt-2 text-xs text-muted">An exercise’s own rest (set in the exercise or the workout) wins over these.</p>
    </Sheet>
  );
}

function WarmupScheme({ open, onClose, value }: { open: boolean; onClose: () => void; value: { pct: number; reps: number }[] }) {
  const [v, setV] = useState(value.map((x) => ({ pct: String(Math.round(x.pct * 100)), reps: String(x.reps) })));
  return (
    <Sheet open={open} onClose={onClose} title="Warm-up scheme" footer={<Button variant="primary" block onClick={async () => {
      const scheme = v.map((x) => ({ pct: Math.min(95, Number(x.pct) || 0) / 100, reps: Math.max(1, Number(x.reps) || 1) })).filter((x) => x.pct > 0).sort((a, b) => a.pct - b.pct);
      await repo.updateSettings({ warmupScheme: scheme }); onClose();
    }}>Save</Button>}>
      <p className="mb-3 text-sm text-muted">Each step is a % of your first working weight. Weights round to your smallest plates.</p>
      {v.map((x, i) => (
        <div key={i} className="mb-2 flex items-center gap-2">
          <input aria-label={`Step ${i + 1} percent`} className={`${inputCls} w-20`} inputMode="numeric" value={x.pct} onChange={(e) => setV(v.map((y, k) => (k === i ? { ...y, pct: e.target.value } : y)))} /><span>% ×</span>
          <input aria-label={`Step ${i + 1} reps`} className={`${inputCls} w-16`} inputMode="numeric" value={x.reps} onChange={(e) => setV(v.map((y, k) => (k === i ? { ...y, reps: e.target.value } : y)))} /><span>reps</span>
          <Button size="sm" variant="ghost" onClick={() => setV(v.filter((_, k) => k !== i))}>Remove</Button>
        </div>
      ))}
      {v.length < 6 ? <Button size="sm" onClick={() => setV([...v, { pct: '90', reps: '1' }])}>Add step</Button> : null}
    </Sheet>
  );
}
