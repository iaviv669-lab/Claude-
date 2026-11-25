// S08: the active workout logger, plus its sheets: rest timer (S09), plates (S10), set type (S11), swap (S12), options (S13).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDown, ArrowUp, Check, Disc3, Flame, Info, Link2, Link2Off, Menu, MoreVertical, TrendingUp, Pause, Play, Plus, Replace, Shrink, StickyNote, Timer, Trash2, X, Flag,
} from 'lucide-react';
import { db, type Exercise, type GymProfile, type Id, type SessionExercise, type SetLog, type SetType, type Settings } from '../data/schema';
import * as repo from '../data/repo';
import { Button, Empty, IconButton, MenuItem, Sheet, Toggle, confirmDialog, inputCls, toast, useNow } from '../components/ui';
import { ExercisePicker } from '../components/ExercisePicker';
import { fmtClock } from '../lib/time';
import { fmtWeight, fromKg, parseNum, toKg } from '../lib/units';
import { plateBreakdown, nearestLoadable } from '../lib/plates';
import { MUSCLE_LABEL } from '../data/seed';

const TYPE_TAG: Record<SetType, string> = { standard: '', warmup: 'W', drop: 'D', myo: 'M', failure: 'F' };
const TYPE_NAME: Record<SetType, string> = { standard: 'Normal set', warmup: 'Warm-up', drop: 'Drop set', myo: 'Myo set', failure: 'To failure' };

// ---------- rest alert ----------

let audioCtx: AudioContext | null = null;
function beep() {
  try {
    audioCtx ??= new AudioContext();
    const t = audioCtx.currentTime;
    for (const [i, f] of [880, 1175].entries()) {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = f; o.connect(g); g.connect(audioCtx.destination);
      g.gain.setValueAtTime(0.0001, t + i * 0.18); g.gain.exponentialRampToValueAtTime(0.3, t + i * 0.18 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.18 + 0.16);
      o.start(t + i * 0.18); o.stop(t + i * 0.18 + 0.17);
    }
  } catch { /* no audio */ }
}
function restDone() {
  navigator.vibrate?.([200, 100, 200]);
  beep();
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    try { new Notification('Rest is over', { body: 'Time for your next set.', tag: 'rest' }); } catch { /* ignore */ }
  }
}

function useWakeLock(on: boolean) {
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const get = () => navigator.wakeLock.request('screen').then((l) => (lock = l)).catch(() => {});
    get();
    const vis = () => document.visibilityState === 'visible' && get();
    document.addEventListener('visibilitychange', vis);
    return () => { document.removeEventListener('visibilitychange', vis); lock?.release().catch(() => {}); };
  }, [on]);
}

// ---------- screen ----------

export function Logger() {
  const nav = useNavigate();
  const session = useLiveQuery(repo.getActiveSession, []);
  const tree = useLiveQuery(async () => (session ? repo.getSessionTree(session.id) : null), [session?.id, session?.updatedAt]);
  const treeLive = useLiveQuery(async () => (session ? { ses: await db.sessionExercises.where('sessionId').equals(session.id).toArray(), sets: await db.setLogs.where('sessionId').equals(session.id).toArray() } : null), [session?.id]);
  const settings = useLiveQuery(() => db.settings.get('me'), []);
  const gym = useLiveQuery(async () => (session?.gymId ? db.gyms.get(session.gymId) : undefined), [session?.gymId]);
  const exIds = useMemo(() => [...new Set(treeLive?.ses.map((s) => s.exerciseId) ?? [])], [treeLive]);
  const exercises = useLiveQuery(async () => new Map((await db.exercises.bulkGet(exIds)).filter(Boolean).map((e) => [e!.id, e!])), [exIds.join()]);
  const t = useNow(250, !!session);
  const [menu, setMenu] = useState(false);
  const [restSheet, setRestSheet] = useState(false);
  const [picker, setPicker] = useState(false);
  const [swapFor, setSwapFor] = useState<Id | null>(null);
  const [plates, setPlates] = useState<{ setId: Id; kg: number | null; exercise: Exercise } | null>(null);
  const [exMenu, setExMenu] = useState<SessionExercise | null>(null);
  const [settingsSheet, setSettingsSheet] = useState(false);
  const [workoutNote, setWorkoutNote] = useState<string | null>(null);
  const firedFor = useRef<number | null>(null);
  const cardRefs = useRef(new Map<Id, HTMLElement>());

  useWakeLock(!!session && session.status === 'active' && !!settings?.keepAwake);

  // rebuild the tree from the live tables so every keystroke re-renders the right rows
  const rows = useMemo(() => {
    if (!treeLive) return [];
    const bySe = new Map<Id, SetLog[]>();
    for (const s of treeLive.sets) (bySe.get(s.sessionExerciseId) ?? bySe.set(s.sessionExerciseId, []).get(s.sessionExerciseId)!).push(s);
    return [...treeLive.ses].sort((a, b) => a.order - b.order).map((se) => ({ se, sets: (bySe.get(se.id) ?? []).sort((a, b) => a.index - b.index) }));
  }, [treeLive]);

  const restLeft = session?.restEndsAt ? Math.ceil((session.restEndsAt - t) / 1000) : 0;
  useEffect(() => {
    if (session?.restEndsAt && t >= session.restEndsAt && firedFor.current !== session.restEndsAt) {
      firedFor.current = session.restEndsAt;
      restDone();
      repo.setRest(session.id, null);
    }
  }, [t, session]);

  const startRest = useCallback(async (sec: number) => {
    if (!session) return;
    firedFor.current = null;
    await repo.setRest(session.id, Date.now() + sec * 1000);
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
  }, [session]);

  if (session === undefined || (session && !tree)) return <div className="p-8 text-center text-muted">Loading…</div>;
  if (!session) {
    return (
      <div className="mx-auto max-w-app p-4">
        <Empty icon={<Timer size={32} />} title="No workout in progress" body="Start one from your workouts, or quick-start an empty one."
          action={<div className="flex gap-2"><Button onClick={() => nav('/')}>My workouts</Button><Button variant="primary" onClick={() => repo.startSession(null, 'Quick workout')}>Quick workout</Button></div>} />
      </div>
    );
  }

  const elapsed = repo.elapsedMs(session, t) / 1000;
  const unit = settings?.unit ?? 'kg';
  const doneSets = rows.reduce((a, r) => a + r.sets.filter((s) => s.completed).length, 0);
  const totalSets = rows.reduce((a, r) => a + r.sets.length, 0);
  const currentIdx = rows.findIndex((r) => r.sets.some((s) => !s.completed));

  const scrollTo = (seId: Id) => cardRefs.current.get(seId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const onTick = async (set: SetLog, row: { se: SessionExercise; sets: SetLog[] }, placeholders: { weightKg: number | null; reps: number | null }) => {
    const done = !set.completed;
    const rest = await repo.tickSet(set.id, done, placeholders);
    if (rest === 'need-reps') { toast('Enter reps first'); return; }
    if (done) navigator.vibrate?.(15);
    if (done && rest) await startRest(rest);
    if (done && settings?.autoAdvance) {
      const left = row.sets.filter((s) => !s.completed && s.id !== set.id).length;
      if (left === 0) {
        const i = rows.findIndex((r) => r.se.id === row.se.id);
        const nextRow = row.se.supersetGroup ? undefined : rows.slice(i + 1).find((r) => r.sets.some((s) => !s.completed));
        if (nextRow) setTimeout(() => scrollTo(nextRow.se.id), 150);
      }
    }
  };

  const finish = async () => {
    const left = totalSets - doneSets;
    if (doneSets === 0) {
      if (await confirmDialog({ title: 'Nothing logged yet', body: 'Discard this workout instead?', ok: 'Discard', danger: true })) { await repo.discardSession(session.id); nav('/'); }
      return;
    }
    if (left > 0 && !(await confirmDialog({ title: 'Finish workout?', body: `${left} unticked set${left > 1 ? 's' : ''} will be removed.`, ok: 'Finish' }))) return;
    const prs = await repo.completeSession(session.id);
    sessionStorage.setItem(`prs:${session.id}`, JSON.stringify(prs));
    nav(`/session/${session.id}/summary`, { replace: true });
  };

  return (
    <div className="min-h-full pb-28">
      {/* top bar: menu, duration, rest */}
      <header className="sticky top-0 z-20 border-b border-border bg-bg/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-app items-center gap-2 px-2">
          <IconButton label="Workout options" onClick={() => setMenu(true)}><Menu size={22} /></IconButton>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{session.name}</p>
            <p className="num text-xs text-muted">{session.status === 'paused' ? 'Paused · ' : ''}{fmtClock(elapsed)} · {doneSets}/{totalSets} sets</p>
          </div>
          <button onClick={() => setRestSheet(true)} aria-label={restLeft > 0 ? `Rest ${fmtClock(restLeft)} left` : 'Rest timer'}
            className={`num flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold ${restLeft > 0 ? 'bg-accent text-on-accent' : 'bg-surface-2 text-text'}`}>
            <Timer size={16} />{restLeft > 0 ? fmtClock(restLeft) : 'Rest'}
          </button>
          <Button variant="primary" size="sm" onClick={finish}>Finish</Button>
        </div>
        {restLeft > 0 && session.restEndsAt ? <RestBar endsAt={session.restEndsAt} t={t} /> : null}
        {rows.length > 1 ? (
          <div className="mx-auto flex max-w-app gap-1.5 overflow-x-auto px-3 pb-2">
            {rows.map((r, i) => {
              const ex = exercises?.get(r.se.exerciseId);
              const done = r.sets.length > 0 && r.sets.every((s) => s.completed);
              return (
                <button key={r.se.id} onClick={() => scrollTo(r.se.id)}
                  className={`flex h-8 shrink-0 items-center gap-1 rounded-full border px-3 text-xs ${i === currentIdx ? 'border-accent text-accent font-semibold' : done ? 'border-success-soft bg-success-soft text-success' : 'border-border text-muted'}`}>
                  {done ? <Check size={12} /> : null}{r.se.supersetGroup ? <Link2 size={12} /> : null}{ex?.name ?? '…'}
                </button>
              );
            })}
          </div>
        ) : null}
      </header>

      <main className="mx-auto max-w-app space-y-3 px-3 pt-3">
        {session.status === 'paused' ? (
          <div className="flex items-center gap-3 rounded-md bg-surface-2 p-3 text-sm"><Pause size={18} /><span className="flex-1">Workout paused. The clock is stopped.</span><Button size="sm" variant="primary" onClick={() => repo.pauseSession(session.id, false)}><Play size={16} />Resume</Button></div>
        ) : null}
        {rows.length === 0 ? (
          <Empty icon={<Plus size={28} />} title="Add your first exercise" body="Pick what you’re training. Sets from last time fill in automatically." action={<Button variant="primary" onClick={() => setPicker(true)}><Plus size={18} />Add exercises</Button>} />
        ) : null}
        {rows.map((row, i) => {
          const ex = exercises?.get(row.se.exerciseId);
          const inGroup = row.se.supersetGroup;
          const prevSame = i > 0 && rows[i - 1].se.supersetGroup === inGroup && inGroup;
          const nextSame = i < rows.length - 1 && rows[i + 1].se.supersetGroup === inGroup && inGroup;
          return (
            <section key={row.se.id} ref={(el) => { if (el) cardRefs.current.set(row.se.id, el); }}
              className={`scroll-mt-28 rounded-lg border bg-surface ${i === currentIdx ? 'border-accent' : 'border-border'} ${prevSame ? '-mt-1 rounded-t-none border-t-0' : ''} ${nextSame ? 'rounded-b-none' : ''}`}>
              {inGroup && !prevSame ? <p className="flex items-center gap-1 px-4 pt-3 text-xs font-semibold text-accent"><Link2 size={14} />Superset: alternate, rest after the round</p> : null}
              <ExerciseBlock row={row} ex={ex} unit={unit} settings={settings} gym={gym}
                onTick={onTick} onMenu={() => setExMenu(row.se)} onPlates={(setId, kg) => ex && setPlates({ setId, kg, exercise: ex })} />
            </section>
          );
        })}
        {rows.length ? <Button block onClick={() => setPicker(true)}><Plus size={18} />Add exercise</Button> : null}
      </main>

      <ExercisePicker open={picker} onClose={() => setPicker(false)} gymId={session.gymId} onPick={(ids) => repo.addExercisesToSession(session.id, ids)} />

      <RestSheet open={restSheet} onClose={() => setRestSheet(false)} left={restLeft}
        onSet={async (sec) => { await startRest(sec); setRestSheet(false); }}
        onAdjust={(d) => session.restEndsAt ? repo.setRest(session.id, Math.max(Date.now(), session.restEndsAt + d * 1000)) : startRest(Math.max(10, d))}
        onSkip={async () => { await repo.setRest(session.id, null); setRestSheet(false); }} />

      <Sheet open={menu} onClose={() => setMenu(false)} title="Workout">
        {session.status === 'paused'
          ? <MenuItem icon={<Play size={20} />} onClick={() => { repo.pauseSession(session.id, false); setMenu(false); }}>Resume workout</MenuItem>
          : <MenuItem icon={<Pause size={20} />} hint="Stops the clock" onClick={() => { repo.pauseSession(session.id, true); setMenu(false); }}>Pause workout</MenuItem>}
        <MenuItem icon={<Shrink size={20} />} hint="Keep it running and use the rest of the app" onClick={() => { setMenu(false); nav('/'); }}>Minimise</MenuItem>
        <MenuItem icon={<StickyNote size={20} />} hint={session.notes || 'How it went, sleep, energy…'} onClick={() => { setMenu(false); setWorkoutNote(session.notes); }}>{session.notes ? 'Edit workout note' : 'Add workout note'}</MenuItem>
        <MenuItem icon={<Flag size={20} />} onClick={() => { setMenu(false); finish(); }}>Finish workout</MenuItem>
        <MenuItem icon={<Disc3 size={20} />} hint="Warm-ups, auto-advance, keep screen on" onClick={() => { setMenu(false); setSettingsSheet(true); }}>Workout settings</MenuItem>
        <MenuItem icon={<Trash2 size={20} />} danger onClick={async () => {
          setMenu(false);
          if (await confirmDialog({ title: 'Discard workout?', body: 'Everything logged in this session will be deleted.', ok: 'Discard', danger: true })) { await repo.discardSession(session.id); nav('/'); }
        }}>Discard workout</MenuItem>
      </Sheet>

      <Sheet open={workoutNote != null} onClose={() => setWorkoutNote(null)} title="Workout note" footer={<Button variant="primary" block onClick={async () => { await db.sessions.update(session.id, { notes: workoutNote ?? '' }); setWorkoutNote(null); }}>Save note</Button>}>
        <textarea autoFocus aria-label="Workout note" className={`${inputCls} h-32 py-2`} value={workoutNote ?? ''} onChange={(e) => setWorkoutNote(e.target.value)} placeholder="How it went, sleep, energy…" />
      </Sheet>

      {settings ? <QuickSettings open={settingsSheet} onClose={() => setSettingsSheet(false)} settings={settings} /> : null}

      <ExerciseMenu se={exMenu} rows={rows} ex={exMenu ? exercises?.get(exMenu.exerciseId) : undefined} onClose={() => setExMenu(null)}
        onSwap={(id) => { setExMenu(null); setSwapFor(id); }} />

      <SwapSheet seId={swapFor} rows={rows} gymId={session.gymId} onClose={() => setSwapFor(null)} />

      {plates && gym ? <PlateSheet {...plates} gym={gym} unit={unit} onClose={() => setPlates(null)} /> : null}
      {plates && !gym ? <PlateSheet {...plates} gym={null} unit={unit} onClose={() => setPlates(null)} /> : null}
    </div>
  );
}

function RestBar({ endsAt, t }: { endsAt: number; t: number }) {
  const [total] = useState(() => Math.max(1, endsAt - t));
  const pct = Math.max(0, Math.min(1, (endsAt - t) / total));
  return <div className="h-1 bg-surface-2"><div className="h-1 bg-accent transition-[width] duration-200" style={{ width: `${pct * 100}%` }} /></div>;
}

// ---------- one exercise ----------

function ExerciseBlock({ row, ex, unit, settings, gym, onTick, onMenu, onPlates }: {
  row: { se: SessionExercise; sets: SetLog[] }; ex?: Exercise; unit: 'kg' | 'lb'; settings?: Settings; gym?: GymProfile;
  onTick: (s: SetLog, row: { se: SessionExercise; sets: SetLog[] }, ph: { weightKg: number | null; reps: number | null }) => void;
  onMenu: () => void; onPlates: (setId: Id, kg: number | null) => void;
}) {
  const nav = useNavigate();
  const prev = useLiveQuery(() => repo.previousSets(row.se.exerciseId, row.se.sessionId), [row.se.exerciseId, row.se.sessionId]);
  const [typeFor, setTypeFor] = useState<SetLog | null>(null);
  const prevWorking = (prev ?? []).filter((s) => s.type !== 'warmup');
  const prevWarm = (prev ?? []).filter((s) => s.type === 'warmup');
  const isTime = ex?.trackedMetric === 'time';
  const barbell = !!ex?.equipment.includes('barbell') || !!ex?.equipment.includes('smith') || !!ex?.equipment.includes('trap_bar');
  let w = 0, wu = 0;
  const target = row.se.repMin && row.se.repMax ? `${row.se.repMin === row.se.repMax ? row.se.repMin : `${row.se.repMin}–${row.se.repMax}`} reps${row.se.targetRir != null ? ` · ${row.se.targetRir} RIR` : ''}` : null;
  void settings; void gym;

  return (
    <div className="px-3 pb-3 pt-2">
      <div className="flex items-start gap-1 pl-1">
        <button className="min-w-0 flex-1 py-1 text-left" onClick={() => ex && nav(`/exercise/${ex.id}`)}>
          <h3 className="truncate text-base font-semibold">{ex?.name ?? '…'}</h3>
          <p className="truncate text-xs text-muted">{target ?? (ex ? ex.primaryMuscles.map((m) => MUSCLE_LABEL[m]).join(', ') : '')}</p>
        </button>
        <IconButton label={`Options for ${ex?.name ?? 'exercise'}`} onClick={onMenu}><MoreVertical size={20} /></IconButton>
      </div>
      {row.se.progressionNote ? <p className="mx-1 mb-1 flex items-center gap-1 text-xs font-semibold text-success"><TrendingUp size={14} />{row.se.progressionNote}</p> : null}
      {row.se.notes ? <p className="mx-1 mb-1 rounded-sm bg-surface-2 px-2 py-1 text-xs text-muted">{row.se.notes}</p> : null}
      <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_4.5rem_3.75rem_2.75rem_2.75rem] items-center gap-x-1.5 px-1 text-xs text-muted">
        <span className="text-center">Set</span><span>Previous</span><span className="text-center">{isTime ? unit : unit}</span><span className="text-center">{isTime ? 'Sec' : 'Reps'}</span><span className="text-center">RIR</span><span />
      </div>
      <div className="mt-1 space-y-1">
        {row.sets.map((s) => {
          const p = s.type === 'warmup' ? prevWarm[wu++] : prevWorking[w++];
          const label = s.type === 'warmup' ? 'W' : String(w);
          return <SetRow key={s.id} set={s} label={label} prev={p} unit={unit} barbell={barbell} isTime={isTime}
            onTick={(ph) => onTick(s, row, ph)} onType={() => setTypeFor(s)} onPlates={() => onPlates(s.id, s.entries[0]?.weightKg ?? p?.entries[0]?.weightKg ?? null)} />;
        })}
      </div>
      <div className="mt-2 flex gap-2">
        <Button size="sm" variant="ghost" className="text-accent" onClick={() => repo.addSet(row.se.id)}><Plus size={16} />Set</Button>
        {!ex?.isBodyweight ? <Button size="sm" variant="ghost" className="text-muted" onClick={async () => { const n = await repo.addWarmups(row.se.id); toast(n ? `Added ${n} warm-up set${n > 1 ? 's' : ''}` : 'Enter a working weight first'); }}><Flame size={16} />Warm-ups</Button> : null}
      </div>
      <SetTypeSheet set={typeFor} onClose={() => setTypeFor(null)} />
    </div>
  );
}

function NumInput({ value, onCommit, placeholder, decimal, label, disabled }: { value: number | null; onCommit: (v: number | null) => void; placeholder?: string; decimal?: boolean; label: string; disabled?: boolean }) {
  const [text, setText] = useState(value == null ? '' : String(value));
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setText(value == null ? '' : String(value)); }, [value]);
  return (
    <input aria-label={label} inputMode={decimal ? 'decimal' : 'numeric'} enterKeyHint="next" value={text} placeholder={placeholder} disabled={disabled}
      onFocus={(e) => { focused.current = true; e.target.select(); }}
      onBlur={() => { focused.current = false; const v = parseNum(text); setText(v == null ? '' : String(v)); onCommit(v); }}
      onChange={(e) => { const t = e.target.value.replace(/[^0-9.,]/g, ''); setText(t); const v = parseNum(t); if (v != null || t === '') onCommit(v); }}
      className="num h-11 w-full rounded-md border border-border-input bg-bg px-1 text-center text-base font-semibold text-text placeholder:font-normal placeholder:text-muted focus:border-accent focus:outline-none disabled:opacity-60" />
  );
}

function SetRow({ set, label, prev, unit, barbell, isTime, onTick, onType, onPlates }: {
  set: SetLog; label: string; prev?: SetLog; unit: 'kg' | 'lb'; barbell: boolean; isTime: boolean;
  onTick: (ph: { weightKg: number | null; reps: number | null }) => void; onType: () => void; onPlates: () => void;
}) {
  const done = !!set.completed;
  const pe = prev?.entries[0];
  const prevText = pe ? `${pe.weightKg ? `${fmtWeight(pe.weightKg, unit)} × ` : ''}${pe.reps ?? ''}${isTime ? 's' : ''}${prev!.entries.length > 1 ? ` +${prev!.entries.length - 1}` : ''}` : '—';
  const multi = set.type === 'drop' || set.type === 'myo';
  const setEntry = (i: number, patch: Partial<SetLog['entries'][0]>) => repo.patchEntry(set.id, i, patch);
  const weightOf = (e: SetLog['entries'][0]) => (e.weightKg == null ? null : Number(fmtWeight(e.weightKg, unit)));
  const ph = { weightKg: pe?.weightKg ?? null, reps: pe?.reps ?? null };
  return (
    <div className={`rounded-md ${done ? 'bg-success-soft' : ''}`}>
      {set.entries.map((e, i) => (
        <div key={i} className="grid grid-cols-[2.25rem_minmax(0,1fr)_4.5rem_3.75rem_2.75rem_2.75rem] items-center gap-x-1.5 px-1 py-0.5">
          {i === 0 ? (
            <button onClick={onType} aria-label={`Set ${label}, ${TYPE_NAME[set.type]}. Change type`}
              className={`num h-9 rounded-sm text-sm font-semibold ${set.type === 'standard' ? 'text-text' : set.type === 'warmup' ? 'text-warning' : set.type === 'failure' ? 'text-danger' : 'text-accent'}`}>
              {set.type === 'standard' ? label : TYPE_TAG[set.type]}
            </button>
          ) : <span className="text-center text-xs text-muted">↳</span>}
          {i === 0 ? (
            <button onClick={barbell ? onPlates : undefined} className={`num truncate text-left text-sm ${barbell ? 'text-muted underline decoration-dotted underline-offset-4' : 'text-muted'}`} aria-label={barbell ? 'Plate calculator' : 'Previous'} tabIndex={barbell ? 0 : -1}>
              {prevText}
            </button>
          ) : <span />}
          <NumInput label={`Set ${label} weight`} decimal value={weightOf(e)} placeholder={i === 0 && pe?.weightKg ? fmtWeight(pe.weightKg, unit) : ''}
            onCommit={(v) => setEntry(i, { weightKg: v == null ? null : toKg(v, unit) })} />
          <NumInput label={`Set ${label} ${isTime ? 'seconds' : 'reps'}`} value={e.reps} placeholder={i === 0 && pe?.reps != null ? String(pe.reps) : ''}
            onCommit={(v) => setEntry(i, { reps: v == null ? null : Math.round(v) })} />
          {i === 0 ? (
            <select aria-label={`Set ${label} reps in reserve`} value={set.type === 'failure' ? '0' : set.rir ?? ''} disabled={set.type === 'failure'}
              onChange={(ev) => repo.updateSet(set.id, { rir: ev.target.value === '' ? null : Number(ev.target.value) })}
              className="num h-11 w-full appearance-none rounded-md border border-border-input bg-bg text-center text-sm text-text focus:border-accent focus:outline-none">
              <option value="">–</option>{[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          ) : <span />}
          {i === 0 ? (
            <button onClick={() => onTick(ph)} aria-pressed={done} aria-label={done ? `Untick set ${label}` : `Complete set ${label}`}
              className={`flex h-11 w-11 items-center justify-center rounded-md ${done ? 'bg-success text-on-success' : 'border border-border-input bg-bg text-muted'}`}>
              <Check size={20} strokeWidth={3} />
            </button>
          ) : (
            <IconButton label="Remove this drop" className="h-9 w-11" onClick={() => repo.updateSet(set.id, { entries: set.entries.filter((_, k) => k !== i) })}><X size={16} /></IconButton>
          )}
        </div>
      ))}
      {multi ? (
        <button className="ml-11 h-8 text-xs font-semibold text-accent" onClick={() => {
          const last = set.entries[set.entries.length - 1];
          const nextW = set.type === 'drop' && last.weightKg ? Math.round(last.weightKg * 0.8 * 4) / 4 : last.weightKg;
          repo.updateSet(set.id, { entries: [...set.entries, { weightKg: nextW, reps: null, partialReps: 0 }] });
        }}>+ {set.type === 'drop' ? 'Drop' : 'Mini-set'}</button>
      ) : null}
      {set.entries[0].partialReps ? <p className="ml-11 pb-1 text-xs text-muted">+{set.entries[0].partialReps} partial</p> : null}
    </div>
  );
}

function SetTypeSheet({ set, onClose }: { set: SetLog | null; onClose: () => void }) {
  const [partial, setPartial] = useState('');
  useEffect(() => setPartial(set?.entries[0].partialReps ? String(set.entries[0].partialReps) : ''), [set]);
  if (!set) return null;
  const pick = async (type: SetType) => {
    const entries = type === 'drop' || type === 'myo' ? set.entries : [set.entries[0]];
    await repo.updateSet(set.id, { type, entries, rir: type === 'failure' ? 0 : set.rir });
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title="Set type">
      {(['standard', 'warmup', 'drop', 'myo', 'failure'] as SetType[]).map((t) => (
        <MenuItem key={t} onClick={() => pick(t)}
          icon={<span className={`inline-flex h-7 w-7 items-center justify-center rounded-sm bg-surface-2 text-sm font-semibold ${set.type === t ? 'ring-2 ring-accent' : ''}`}>{TYPE_TAG[t] || '1'}</span>}
          hint={{ standard: 'Weight × reps', warmup: 'Lighter prep set, not counted in volume or records', drop: 'Strip weight and keep going; log each drop', myo: 'Activation set, then short mini-sets at the same weight', failure: 'Taken to technical failure (0 RIR)' }[t]}>
          {TYPE_NAME[t]}
        </MenuItem>
      ))}
      <div className="mt-3 flex items-end gap-2 border-t border-border pt-3">
        <label className="flex-1"><span className="mb-1 block text-sm font-semibold">Partial reps</span>
          <input className={inputCls} inputMode="numeric" value={partial} onChange={(e) => setPartial(e.target.value.replace(/\D/g, ''))} placeholder="0" /></label>
        <Button onClick={async () => { await repo.updateSet(set.id, { entries: [{ ...set.entries[0], partialReps: Number(partial) || 0 }, ...set.entries.slice(1)] }); onClose(); }}>Save</Button>
      </div>
      <div className="mt-3 border-t border-border pt-2">
        <MenuItem danger icon={<Trash2 size={20} />} onClick={async () => { await repo.removeSet(set.id); onClose(); }}>Delete set</MenuItem>
      </div>
    </Sheet>
  );
}

function ExerciseMenu({ se, rows, ex, onClose, onSwap }: { se: SessionExercise | null; rows: { se: SessionExercise }[]; ex?: Exercise; onClose: () => void; onSwap: (id: Id) => void }) {
  const nav = useNavigate();
  const [note, setNote] = useState<string | null>(null);
  if (!se) return null;
  const i = rows.findIndex((r) => r.se.id === se.id);
  const ids = rows.map((r) => r.se.id);
  const move = async (d: -1 | 1) => { const j = i + d; [ids[i], ids[j]] = [ids[j], ids[i]]; await repo.reorderSessionExercises(se.sessionId, ids); onClose(); };
  return (
    <Sheet open onClose={() => { setNote(null); onClose(); }} title={ex?.name ?? 'Exercise'}>
      {note != null ? (
        <div className="space-y-3">
          <textarea autoFocus className={`${inputCls} h-28 py-2`} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Seat height, grip, how it felt…" />
          <Button variant="primary" block onClick={async () => { await db.sessionExercises.update(se.id, { notes: note }); setNote(null); onClose(); }}>Save note</Button>
        </div>
      ) : (
        <>
          <MenuItem icon={<Replace size={20} />} hint="Equipment taken? Pick a similar movement" onClick={() => onSwap(se.id)}>Swap exercise</MenuItem>
          {se.supersetGroup
            ? <MenuItem icon={<Link2Off size={20} />} onClick={async () => { await repo.toggleSessionSuperset(se.id, 'detach'); onClose(); }}>Remove from superset</MenuItem>
            : <>
                {i > 0 ? <MenuItem icon={<Link2 size={20} />} onClick={async () => { await repo.toggleSessionSuperset(se.id, 'prev'); onClose(); }}>Superset with the one above</MenuItem> : null}
                {i < rows.length - 1 ? <MenuItem icon={<Link2 size={20} />} onClick={async () => { await repo.toggleSessionSuperset(se.id, 'next'); onClose(); }}>Superset with the one below</MenuItem> : null}
              </>}
          <MenuItem icon={<StickyNote size={20} />} onClick={() => setNote(se.notes)}>{se.notes ? 'Edit note' : 'Add note'}</MenuItem>
          {i > 0 ? <MenuItem icon={<ArrowUp size={20} />} onClick={() => move(-1)}>Move up</MenuItem> : null}
          {i < rows.length - 1 ? <MenuItem icon={<ArrowDown size={20} />} onClick={() => move(1)}>Move down</MenuItem> : null}
          {ex ? <MenuItem icon={<Info size={20} />} onClick={() => { onClose(); nav(`/exercise/${ex.id}`); }}>History & charts</MenuItem> : null}
          <MenuItem icon={<Trash2 size={20} />} danger onClick={async () => {
            onClose();
            if (await confirmDialog({ title: `Remove ${ex?.name ?? 'exercise'}?`, body: 'Its sets in this workout will be deleted.', ok: 'Remove', danger: true })) await repo.removeSessionExercise(se.id);
          }}>Remove from workout</MenuItem>
        </>
      )}
    </Sheet>
  );
}

function SwapSheet({ seId, rows, gymId, onClose }: { seId: Id | null; rows: { se: SessionExercise }[]; gymId: Id | null; onClose: () => void }) {
  const se = rows.find((r) => r.se.id === seId)?.se;
  const suggestions = useLiveQuery(async () => (se ? repo.suggestSwaps(se.exerciseId, gymId) : []), [se?.exerciseId, gymId]);
  const [other, setOther] = useState(false);
  if (!se) return null;
  const doSwap = async (id: Id) => { await repo.swapInSession(se.id, id); toast('Swapped'); onClose(); };
  return (
    <>
      <Sheet open={!other} onClose={onClose} title="Swap for…" footer={<Button block onClick={() => setOther(true)}>Search all exercises</Button>}>
        {suggestions?.length === 0 ? <p className="py-4 text-sm text-muted">No close matches for this gym. Search all exercises instead.</p> : null}
        {suggestions?.map((e) => (
          <MenuItem key={e.id} onClick={() => doSwap(e.id)} hint={e.primaryMuscles.map((m) => MUSCLE_LABEL[m]).join(', ')}>{e.name}</MenuItem>
        ))}
      </Sheet>
      <ExercisePicker open={other} single title="Swap for…" gymId={gymId} onClose={() => { setOther(false); onClose(); }} onPick={([id]) => doSwap(id)} />
    </>
  );
}

function RestSheet({ open, onClose, left, onSet, onAdjust, onSkip }: { open: boolean; onClose: () => void; left: number; onSet: (s: number) => void; onAdjust: (d: number) => void; onSkip: () => void }) {
  const presets = Array.from({ length: 12 }, (_, i) => (i + 1) * 15);
  return (
    <Sheet open={open} onClose={onClose} title="Rest timer">
      <p className="num text-center text-display">{left > 0 ? fmtClock(left) : '0:00'}</p>
      <div className="mt-3 flex justify-center gap-2">
        <Button onClick={() => onAdjust(-10)} disabled={left <= 0}>−10 s</Button>
        <Button onClick={() => onAdjust(10)}>+10 s</Button>
        {left > 0 ? <Button variant="ghost" onClick={onSkip}>Skip</Button> : null}
      </div>
      <p className="mb-2 mt-5 text-sm font-semibold">Restart at</p>
      <div className="grid grid-cols-4 gap-2">
        {presets.map((s) => <Button key={s} size="sm" onClick={() => onSet(s)} className="num">{fmtClock(s)}</Button>)}
      </div>
      <p className="mt-4 text-xs text-muted">You’ll get a buzz and a beep when rest is over{'Notification' in window ? ', and a notification if the app is in the background' : ''}.</p>
    </Sheet>
  );
}

function PlateSheet({ setId, kg, exercise, gym, unit, onClose }: { setId: Id; kg: number | null; exercise: Exercise; gym: GymProfile | null; unit: 'kg' | 'lb'; onClose: () => void }) {
  const plateUnit = gym?.unit ?? unit;
  const bars = gym?.barWeightsKg ?? repo.plateDefaults(plateUnit).barWeightsKg;
  const platesKg = gym?.platesKg ?? repo.plateDefaults(plateUnit).platesKg;
  const isTrap = exercise.equipment.includes('trap_bar');
  const [barKg, setBarKg] = useState(bars[0]);
  const [target, setTarget] = useState(kg != null ? fmtWeight(kg, plateUnit) : '');
  const r = (v: number) => Math.round(fromKg(v, plateUnit) * 100) / 100;
  const total = parseNum(target);
  const res = total != null ? plateBreakdown(total, r(barKg), platesKg.map(r)) : null;
  const near = total != null && res && !res.exact ? nearestLoadable(total, r(barKg), platesKg.map(r)) : null;
  return (
    <Sheet open onClose={onClose} title="Plate calculator" footer={
      <Button variant="primary" block disabled={!res} onClick={async () => {
        if (!res) return;
        const s = await db.setLogs.get(setId);
        if (s) await repo.updateSet(setId, { entries: [{ ...s.entries[0], weightKg: toKg(res.loaded, plateUnit) }, ...s.entries.slice(1)] });
        onClose();
      }}>Use {res ? `${res.loaded} ${plateUnit}` : 'weight'}</Button>
    }>
      <label className="block"><span className="mb-1 block text-sm font-semibold">Total on the bar ({plateUnit})</span>
        <input autoFocus inputMode="decimal" className={`${inputCls} num text-lg font-semibold`} value={target} onChange={(e) => setTarget(e.target.value)} /></label>
      <p className="mb-1 mt-3 text-sm font-semibold">{isTrap ? 'Trap bar' : 'Bar'}</p>
      <div className="flex flex-wrap gap-2">
        {bars.map((b) => <button key={b} onClick={() => setBarKg(b)} className={`num h-9 rounded-full border px-3 text-sm ${b === barKg ? 'border-accent bg-accent-soft font-semibold text-accent' : 'border-border'}`}>{r(b)} {plateUnit}</button>)}
      </div>
      <div className="mt-5 rounded-md bg-surface-2 p-4">
        {total == null ? <p className="text-sm text-muted">Enter the total weight, bar included.</p>
          : !res ? <p className="text-sm text-danger">That’s less than the bar ({r(barKg)} {plateUnit}).</p>
          : (
            <>
              <p className="text-sm text-muted">Each side</p>
              <div className="mt-2 flex min-h-16 items-center gap-1">
                <span className="h-3 w-8 rounded-sm bg-border-input" aria-hidden />
                {res.perSide.length ? res.perSide.map((p, i) => {
                  const h = 28 + (p / Math.max(...res.perSide)) * 36;
                  return <span key={i} className="num flex w-8 items-center justify-center rounded-sm bg-accent text-[11px] font-semibold text-on-accent" style={{ height: h }}>{p}</span>;
                }) : <span className="text-sm text-muted">Just the bar</span>}
              </div>
              <p className="num mt-2 text-sm">{res.perSide.length ? res.perSide.join(' + ') : '0'} {plateUnit} per side</p>
              {!res.exact && near ? <p className="mt-2 text-sm text-warning">Can’t make exactly {total} with your plates. Closest: {near.below} or {near.above} {plateUnit}.</p> : null}
            </>
          )}
      </div>
      <p className="mt-3 text-xs text-muted">Plates and bars come from your gym profile ({gym?.name ?? 'defaults'}). Edit them in Settings → Gyms.</p>
    </Sheet>
  );
}

function QuickSettings({ open, onClose, settings }: { open: boolean; onClose: () => void; settings: Settings }) {
  return (
    <Sheet open={open} onClose={onClose} title="Workout settings">
      <Toggle label="Add warm-ups automatically" hint="For compound lifts, from your last working weight" checked={settings.warmupAutomation === 'smart'} onChange={(v) => repo.updateSettings({ warmupAutomation: v ? 'smart' : 'off' })} />
      <Toggle label="Jump to the next exercise" hint="When every set of this one is ticked" checked={settings.autoAdvance} onChange={(v) => repo.updateSettings({ autoAdvance: v })} />
      <Toggle label="Keep screen on" hint="While a workout is running" checked={settings.keepAwake} onChange={(v) => repo.updateSettings({ keepAwake: v })} />
      <p className="mt-2 text-xs text-muted">Warm-up changes apply to exercises you add from now on. More in Settings.</p>
    </Sheet>
  );
}
