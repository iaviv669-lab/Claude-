// Small dependency-free SVG charts. Colours come from tokens, so they follow the theme.
import { useState } from 'react';

const niceMax = (v: number) => {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v)!;
};
const dateLabel = (sec: number) => new Date(sec * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/** x = unix seconds; y may contain nulls (gaps). */
export function Chart({ x, y, kind = 'line', height = 200, fmt = (v: number) => String(Math.round(v)), label }: { x: number[]; y: (number | null)[]; kind?: 'line' | 'bars'; height?: number; fmt?: (v: number) => string; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const pts = x.map((xx, i) => ({ x: xx, y: y[i], i })).filter((p) => p.y != null) as { x: number; y: number; i: number }[];
  if (!pts.length) return <div className="flex items-center justify-center rounded-md bg-surface-2 text-sm text-muted" style={{ height }}>No data yet</div>;
  const W = 320, H = height, L = 40, R = 8, T = 10, B = 24;
  const ys = pts.map((p) => p.y);
  let lo = kind === 'bars' ? 0 : Math.min(...ys), hi = Math.max(...ys);
  if (kind === 'line') { const pad = (hi - lo) * 0.15 || Math.max(1, hi * 0.05); lo = Math.max(0, lo - pad); hi = hi + pad; } else hi = niceMax(hi);
  const ticks = [0, 0.5, 1].map((f) => lo + (hi - lo) * f);
  const n = kind === 'bars' ? x.length : pts.length;
  const xs = (k: number) => (n <= 1 ? L + (W - L - R) / 2 : L + ((W - L - R) * k) / (n - 1));
  const sx = kind === 'bars' ? (k: number) => L + ((W - L - R) * (k + 0.5)) / n : xs;
  const sy = (v: number) => T + (H - T - B) * (1 - (v - lo) / (hi - lo || 1));
  const labelIdx = n <= 4 ? [...Array(n).keys()] : [0, Math.floor((n - 1) / 2), n - 1];
  const items = kind === 'bars' ? x.map((xx, k) => ({ x: xx, y: y[k] ?? 0, k })) : pts.map((p, k) => ({ x: p.x, y: p.y, k }));
  const h = hover != null ? items[hover] : null;
  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label}
        onPointerLeave={() => setHover(null)}
        onPointerMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          let best = 0; items.forEach((_it, k) => { if (Math.abs(sx(k) - px) < Math.abs(sx(best) - px)) best = k; });
          setHover(best);
        }}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={L} x2={W - R} y1={sy(t)} y2={sy(t)} className="stroke-border" strokeWidth="1" />
            <text x={L - 6} y={sy(t) + 4} textAnchor="end" className="fill-muted" fontSize="11">{fmt(t)}</text>
          </g>
        ))}
        {labelIdx.map((k) => <text key={k} x={sx(k)} y={H - 6} textAnchor="middle" className="fill-muted" fontSize="11">{dateLabel(items[k].x)}</text>)}
        {kind === 'bars'
          ? items.map((it, k) => { const bw = Math.min(24, ((W - L - R) / n) * 0.6); return <rect key={k} x={sx(k) - bw / 2} y={sy(it.y)} width={bw} height={Math.max(0, sy(lo) - sy(it.y))} rx="3" className={hover === k ? 'fill-accent' : 'fill-accent/80'} />; })
          : <>
              <polyline points={items.map((it, k) => `${sx(k)},${sy(it.y)}`).join(' ')} fill="none" className="stroke-accent" strokeWidth="2" strokeLinejoin="round" />
              {items.length < 40 ? items.map((it, k) => <circle key={k} cx={sx(k)} cy={sy(it.y)} r={hover === k ? 5 : 3} className="fill-accent" />) : null}
            </>}
        {h ? <line x1={sx(hover!)} x2={sx(hover!)} y1={T} y2={H - B} className="stroke-muted" strokeDasharray="3 3" /> : null}
      </svg>
      {h ? <figcaption className="num pointer-events-none absolute right-1 top-0 rounded-sm bg-bg/90 px-2 py-0.5 text-xs">{dateLabel(h.x)}: <b>{fmt(h.y)}</b></figcaption> : null}
    </figure>
  );
}

export function Sparkline({ values, width = 72, height = 24 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return <span className="text-xs text-muted">—</span>;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * width},${height - 2 - ((v - min) / span) * (height - 4)}`).join(' ');
  return <svg width={width} height={height} aria-hidden className="text-accent"><polyline points={pts} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /></svg>;
}
