import { Suspense, lazy, useEffect, useState } from 'react';
import { HashRouter, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { BarChart3, Dumbbell, Plus, Settings as Cog, Timer } from 'lucide-react';
import { db } from './data/schema';
import { ensureSeeded, elapsedMs, getActiveSession } from './data/repo';
import { UiHost, useNow } from './components/ui';
import { fmtClock } from './lib/time';
import { Onboarding } from './screens/Onboarding';
import { WorkoutTab } from './screens/WorkoutTab';
import { Logger } from './screens/Logger';
import { CreateSheet } from './screens/CreateSheet';

const Dashboard = lazy(() => import('./screens/Dashboard'));
const Builder = lazy(() => import('./screens/Builder'));
const Preview = lazy(() => import('./screens/Preview'));
const Summary = lazy(() => import('./screens/Summary'));
const History = lazy(() => import('./screens/History'));
const SessionDetail = lazy(() => import('./screens/SessionDetail'));
const ExerciseDetail = lazy(() => import('./screens/ExerciseDetail'));
const ExerciseEditor = lazy(() => import('./screens/ExerciseEditor'));
const Muscles = lazy(() => import('./screens/Muscles'));
const Settings = lazy(() => import('./screens/Settings'));
const Gyms = lazy(() => import('./screens/Gyms'));
const Exercises = lazy(() => import('./screens/Exercises'));
const ProgramEditor = lazy(() => import('./screens/ProgramEditor'));
const DesignSystem = lazy(() => import('./screens/DesignSystem'));

function useTheme() {
  const theme = useLiveQuery(() => db.settings.get('me').then((s) => s?.theme ?? 'system'), [], 'system');
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const root = document.documentElement;
    // "system" follows a host-set data-theme (e.g. inside claude.ai) first, then the OS setting.
    const apply = () => {
      const host = root.getAttribute('data-theme');
      root.classList.toggle('dark', theme === 'dark' || (theme === 'system' && (host === 'dark' || (host !== 'light' && mq.matches))));
    };
    apply();
    mq.addEventListener('change', apply);
    const mo = new MutationObserver(apply);
    mo.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => { mq.removeEventListener('change', apply); mo.disconnect(); };
  }, [theme]);
}

function MiniBar() {
  const session = useLiveQuery(getActiveSession, []);
  const loc = useLocation();
  const nav = useNavigate();
  const t = useNow(1000, !!session);
  if (!session || loc.pathname === '/session') return null;
  const rest = session.restEndsAt ? Math.ceil((session.restEndsAt - t) / 1000) : 0;
  return (
    <button onClick={() => nav('/session')} className="mx-auto mb-2 flex h-12 w-[calc(100%-16px)] max-w-app items-center gap-3 rounded-md bg-accent px-4 text-on-accent shadow-pop">
      <Dumbbell size={18} />
      <span className="flex-1 truncate text-left font-semibold">{session.name}{session.status === 'paused' ? ' · paused' : ''}</span>
      {rest > 0 ? <span className="num flex items-center gap-1 text-sm"><Timer size={14} />{fmtClock(rest)}</span> : null}
      <span className="num text-sm">{fmtClock(elapsedMs(session, t) / 1000)}</span>
    </button>
  );
}

function BottomNav({ onCreate }: { onCreate: () => void }) {
  const loc = useLocation();
  const hide = loc.pathname === '/session';
  const item = 'flex flex-1 flex-col items-center justify-center gap-0.5 text-xs h-16';
  const cls = ({ isActive }: { isActive: boolean }) => `${item} ${isActive ? 'text-accent font-semibold' : 'text-muted'}`;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30">
      <MiniBar />
      {hide ? null : (
        <nav aria-label="Main" className="border-t border-border bg-bg/95 backdrop-blur safe-bottom">
          <div className="mx-auto flex max-w-app items-stretch">
            <NavLink to="/" end className={cls}><Dumbbell size={22} />Workouts</NavLink>
            <NavLink to="/progress" className={cls}><BarChart3 size={22} />Progress</NavLink>
            <button onClick={onCreate} className={item} aria-label="Create">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-on-accent shadow-card"><Plus size={24} /></span>
            </button>
            <NavLink to="/history" className={cls}><Timer size={22} />History</NavLink>
            <NavLink to="/settings" className={cls}><Cog size={22} />Settings</NavLink>
          </div>
        </nav>
      )}
    </div>
  );
}

function Shell() {
  const settings = useLiveQuery(() => db.settings.get('me'), []);
  const [create, setCreate] = useState(false);
  if (settings === undefined) return <div className="flex h-full items-center justify-center text-muted">Loading…</div>;
  if (!settings.onboarded) return <Onboarding />;
  return (
    <>
      <Suspense fallback={<div className="p-8 text-center text-muted">Loading…</div>}>
        <Routes>
          <Route path="/" element={<WorkoutTab />} />
          <Route path="/progress" element={<Dashboard />} />
          <Route path="/muscles" element={<Muscles />} />
          <Route path="/history" element={<History />} />
          <Route path="/history/:id" element={<SessionDetail />} />
          <Route path="/session" element={<Logger />} />
          <Route path="/session/:id/summary" element={<Summary />} />
          <Route path="/workout/new" element={<Builder />} />
          <Route path="/workout/:id/edit" element={<Builder />} />
          <Route path="/workout/:id" element={<Preview />} />
          <Route path="/program/:id" element={<ProgramEditor />} />
          <Route path="/exercise/new" element={<ExerciseEditor />} />
          <Route path="/exercise/:id/edit" element={<ExerciseEditor />} />
          <Route path="/exercise/:id" element={<ExerciseDetail />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/gyms" element={<Gyms />} />
          <Route path="/settings/exercises" element={<Exercises />} />
          <Route path="/design" element={<DesignSystem />} />
          <Route path="*" element={<WorkoutTab />} />
        </Routes>
      </Suspense>
      <BottomNav onCreate={() => setCreate(true)} />
      <CreateSheet open={create} onClose={() => setCreate(false)} />
    </>
  );
}

export function App() {
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useTheme();
  useEffect(() => {
    ensureSeeded().then(() => setReady(true)).catch((e) => setErr(String(e?.message ?? e)));
    navigator.storage?.persist?.().catch(() => {});
    // keep push reminders in step with the plan (no-op when notifications are off)
    import('./lib/push').then((m) => m.syncPush()).catch(() => {});
  }, []);
  if (err) return <div className="p-6"><h1 className="text-lg">Storage is unavailable</h1><p className="mt-2 text-sm text-muted">This browser blocked on-device storage ({err}). Private browsing modes often do this. Open the app in a normal window.</p></div>;
  if (!ready) return <div className="flex h-full items-center justify-center text-muted">Loading…</div>;
  return (
    <HashRouter>
      <Shell />
      <UiHost />
    </HashRouter>
  );
}
