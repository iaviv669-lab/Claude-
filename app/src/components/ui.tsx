// Primitives. Specs: replica/design/components.md. Tokens only, no raw hex.
import { forwardRef, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { ChevronLeft, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { create } from 'zustand';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent active:brightness-95',
  secondary: 'bg-surface-2 text-text active:bg-border',
  ghost: 'bg-transparent text-text active:bg-surface-2',
  danger: 'bg-danger text-white active:brightness-95',
};
const SIZE: Record<Size, string> = { sm: 'h-8 px-3 text-sm', md: 'h-11 px-4 text-sm', lg: 'h-12 px-5 text-base' };

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; block?: boolean; loading?: boolean }>(
  function Button({ variant = 'secondary', size = 'md', block, loading, className = '', children, disabled, ...rest }, ref) {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-[filter,background-color] disabled:opacity-50 disabled:pointer-events-none ${VARIANT[variant]} ${SIZE[size]} ${block ? 'w-full' : ''} ${className}`}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...rest}
      >
        {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden /> : null}
        {children}
      </button>
    );
  },
);

export function IconButton({ label, children, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button aria-label={label} title={label} className={`inline-flex h-11 w-11 items-center justify-center rounded-md text-text active:bg-surface-2 disabled:opacity-40 ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function Header({ title, back, right, sub }: { title: ReactNode; back?: boolean | string; right?: ReactNode; sub?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-app items-center gap-1 px-2">
        {back ? (
          <IconButton label="Back" onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))}><ChevronLeft size={22} /></IconButton>
        ) : <span className="w-2" />}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg">{title}</h1>
          {sub ? <p className="-mt-1 truncate text-xs text-muted">{sub}</p> : null}
        </div>
        {right}
      </div>
    </header>
  );
}

export function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <main className={`mx-auto w-full max-w-app px-4 pb-28 pt-4 ${className}`}>{children}</main>;
}

export function Card({ children, className = '', as: As = 'div', ...rest }: { children: ReactNode; className?: string; as?: 'div' | 'button' | 'section' } & Record<string, unknown>) {
  return <As className={`rounded-lg border border-border bg-surface p-4 text-left ${className}`} {...rest}>{children}</As>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between first:mt-0">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{children}</h2>
      {right}
    </div>
  );
}

export function Empty({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-border px-6 py-10 text-center">
      {icon ? <div className="mb-3 text-muted">{icon}</div> : null}
      <p className="font-semibold">{title}</p>
      {body ? <p className="mt-1 text-sm text-muted">{body}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Chip({ on, children, onClick, className = '' }: { on?: boolean; children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={`h-8 shrink-0 rounded-full border px-3 text-sm ${on ? 'border-accent bg-accent-soft text-accent font-semibold' : 'border-border bg-surface text-text'} ${className}`}>
      {children}
    </button>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex min-h-12 cursor-pointer items-center gap-3 py-2">
      <span className="flex-1">
        <span className="block text-base">{label}</span>
        {hint ? <span className="block text-sm text-muted">{hint}</span> : null}
      </span>
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span aria-hidden className="relative h-7 w-12 rounded-full bg-surface-2 ring-1 ring-border-input transition-colors peer-checked:bg-accent peer-checked:ring-accent peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent after:absolute after:left-0.5 after:top-0.5 after:h-6 after:w-6 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5" />
    </label>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export const inputCls = 'h-11 w-full rounded-md border border-border-input bg-bg px-3 text-base text-text placeholder:text-muted focus:border-accent focus:outline-none';

export function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-md bg-surface-2 p-1">
      {options.map((o) => (
        <button key={String(o.value)} role="radio" aria-checked={value === o.value} type="button" onClick={() => onChange(o.value)}
          className={`h-9 flex-1 rounded-sm text-sm font-semibold ${value === o.value ? 'bg-bg text-text shadow-card' : 'text-muted'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Bottom sheet. Closes on backdrop, Escape; traps initial focus. */
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
        className="relative flex max-h-[88vh] w-full max-w-app flex-col rounded-t-lg bg-surface shadow-pop outline-none safe-bottom">
        <div className="flex items-center gap-2 border-b border-border px-4 py-2">
          <h2 className="flex-1 text-lg">{title}</h2>
          <IconButton label="Close" onClick={onClose}><X size={20} /></IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">{children}</div>
        {footer ? <div className="border-t border-border p-3">{footer}</div> : null}
      </div>
    </div>
  );
}

export function MenuItem({ icon, children, onClick, danger, hint }: { icon?: ReactNode; children: ReactNode; onClick: () => void; danger?: boolean; hint?: string }) {
  return (
    <button type="button" onClick={onClick} className={`flex min-h-12 w-full items-center gap-3 rounded-md px-2 text-left active:bg-surface-2 ${danger ? 'text-danger' : 'text-text'}`}>
      {icon ? <span className="text-muted">{icon}</span> : null}
      <span className="flex-1">
        <span className="block">{children}</span>
        {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
      </span>
    </button>
  );
}

// ---------- confirm + toast ----------

interface UiState {
  toast: { msg: string; action?: { label: string; run: () => void } } | null;
  confirm: { title: string; body?: string; ok: string; danger?: boolean; resolve: (v: boolean) => void } | null;
}
export const useUi = create<UiState>(() => ({ toast: null, confirm: null }));

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string, action?: { label: string; run: () => void }) {
  clearTimeout(toastTimer);
  useUi.setState({ toast: { msg, action } });
  toastTimer = setTimeout(() => useUi.setState({ toast: null }), 4000);
}
export function confirmDialog(opts: { title: string; body?: string; ok: string; danger?: boolean }): Promise<boolean> {
  return new Promise((resolve) => useUi.setState({ confirm: { ...opts, resolve } }));
}

export function UiHost() {
  const { toast: t, confirm: c } = useUi();
  const close = (v: boolean) => { c?.resolve(v); useUi.setState({ confirm: null }); };
  return (
    <>
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4">
        {t ? (
          <div className="pointer-events-auto flex max-w-app items-center gap-3 rounded-md bg-text px-4 py-3 text-sm text-bg shadow-pop">
            <span>{t.msg}</span>
            {t.action ? <button className="font-semibold underline" onClick={() => { t.action!.run(); useUi.setState({ toast: null }); }}>{t.action.label}</button> : null}
          </div>
        ) : null}
      </div>
      {c ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/50" onClick={() => close(false)} aria-hidden />
          <div role="alertdialog" aria-modal="true" aria-label={c.title} className="relative w-full max-w-sm rounded-lg bg-surface p-5 shadow-pop">
            <h2 className="text-lg">{c.title}</h2>
            {c.body ? <p className="mt-2 text-sm text-muted">{c.body}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => close(false)} autoFocus>Cancel</Button>
              <Button variant={c.danger ? 'danger' : 'primary'} onClick={() => close(true)}>{c.ok}</Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0 flex-1 rounded-md bg-surface-2 px-3 py-2">
      <div className="truncate text-xs text-muted">{label}</div>
      <div className="num truncate text-lg">{value}</div>
      {sub ? <div className="truncate text-xs text-muted">{sub}</div> : null}
    </div>
  );
}

export function useNow(intervalMs = 1000, enabled = true) {
  const [t, setT] = useState(Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setT(Date.now()), intervalMs);
    const vis = () => setT(Date.now());
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', vis); };
  }, [intervalMs, enabled]);
  return t;
}
