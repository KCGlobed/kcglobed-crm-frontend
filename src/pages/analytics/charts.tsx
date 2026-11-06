/**
 * Analytics charts, drawn in-house as SVG (no chart library). Every mark is clickable (onSelect → drill-down) and
 * keyboard-focusable, with the exact number in a native tooltip.
 */
import type { KeyboardEvent } from 'react'
import { ChevronRight, type LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'
import { COLORS, FUNNEL_FILLS } from './colors'


export interface Slice {
  key: string
  label: string
  value: number
  color: string
}

const fmt = (n: number) => n.toLocaleString('en-IN')
const press = (fn: () => void) => (e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    fn()
  }
}
const clickable = (fn: () => void, label: string, extra = '') => ({
  role: 'button' as const,
  tabIndex: 0,
  'aria-label': label,
  onClick: fn,
  onKeyDown: press(fn),
  className: cn('cursor-pointer outline-none transition-opacity hover:opacity-80 focus-visible:opacity-70', extra),
})

function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  const [x0, y0] = p(a0)
  const [x1, y1] = p(a1)
  return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}`
}

export function Legend({ items, onSelect }: { items: Slice[]; onSelect?: (key: string) => void }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600">
      {items.map((s) => (
        <li key={s.key}>
          <button type="button" disabled={!onSelect} onClick={() => onSelect?.(s.key)} className="inline-flex cursor-pointer items-center gap-1.5 hover:text-slate-900 disabled:cursor-default">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
            {Number.isFinite(s.value) && <b className="font-semibold text-slate-800">{fmt(s.value)}</b>}
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Donut (full) or half donut (gauge-style); the centre shows a headline number. */
export function Donut({
  slices,
  onSelect,
  half = false,
  center,
  centerLabel,
}: {
  slices: Slice[]
  onSelect: (key: string) => void
  half?: boolean
  center?: string
  centerLabel?: string
}) {
  const total = slices.reduce((s, x) => s + x.value, 0)
  const size = 200
  const cx = size / 2
  const cy = half ? size / 2 + 10 : size / 2
  const r = 78
  const span = half ? Math.PI : Math.PI * 2
  let a = half ? Math.PI : -Math.PI / 2
  return (
    <div className="flex flex-col items-center gap-3">
      <svg viewBox={`0 0 ${size} ${half ? size / 2 + 24 : size}`} className="w-full max-w-[230px]">
        <path d={half ? arc(cx, cy, r, Math.PI, Math.PI * 2 - 0.0001) : arc(cx, cy, r, 0, Math.PI * 2 - 0.0001)} fill="none" stroke="#e8e5ef" strokeWidth={26} />
        {total > 0 &&
          slices.map((s) => {
            if (!s.value) return null
            const a0 = a
            const a1 = a + (s.value / total) * span
            a = a1
            return (
              <path key={s.key} d={arc(cx, cy, r, a0, Math.max(a0 + 0.0001, a1 - 0.004))} fill="none" stroke={s.color} strokeWidth={26} {...clickable(() => onSelect(s.key), `${s.label}: ${s.value}`)}>
                <title>{`${s.label}: ${fmt(s.value)} (${((s.value / total) * 100).toFixed(1)}%)`}</title>
              </path>
            )
          })}
        <text x={cx} y={half ? cy - 12 : cy + 2} textAnchor="middle" className="fill-slate-800 text-[26px] font-bold">
          {center ?? fmt(total)}
        </text>
        {centerLabel && (
          <text x={cx} y={half ? cy + 8 : cy + 22} textAnchor="middle" className="fill-slate-500 text-[11px]">
            {centerLabel}
          </text>
        )}
      </svg>
      <Legend items={slices} onSelect={onSelect} />
    </div>
  )
}

/** One line over days; each point opens that day. */
export function LineChart({ points, onSelect, color = COLORS.brand }: { points: { key: string; label: string; value: number }[]; onSelect: (key: string) => void; color?: string }) {
  const w = 640
  const h = 220
  const pad = { l: 36, r: 12, t: 12, b: 28 }
  const max = Math.max(1, ...points.map((p) => p.value))
  const step = points.length > 1 ? (w - pad.l - pad.r) / (points.length - 1) : 0
  const x = (i: number) => pad.l + i * step
  const y = (v: number) => pad.t + (h - pad.t - pad.b) * (1 - v / max)
  const ticks = [0, Math.round(max / 2), max]
  const every = Math.ceil(points.length / 8)
  const line = points.map((p, i) => `${i ? 'L' : 'M'} ${x(i)} ${y(p.value)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke={COLORS.grid} />
          <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" className="fill-slate-400 text-[10px]">{t}</text>
        </g>
      ))}
      {points.length > 0 && <path d={`${line} L ${x(points.length - 1)} ${h - pad.b} L ${x(0)} ${h - pad.b} Z`} fill={color} opacity={0.08} />}
      <path d={line} fill="none" stroke={color} strokeWidth={2} />
      {points.map((p, i) => (
        <g key={p.key}>
          <circle cx={x(i)} cy={y(p.value)} r={p.value ? 4 : 2.5} fill="white" stroke={color} strokeWidth={2} {...clickable(() => onSelect(p.key), `${p.label}: ${p.value}`)}>
            <title>{`${p.label}: ${fmt(p.value)} leads`}</title>
          </circle>
          {i % every === 0 && (
            <text x={x(i)} y={h - 8} textAnchor="middle" className="fill-slate-400 text-[10px]">{p.label}</text>
          )}
        </g>
      ))}
    </svg>
  )
}

export interface Series {
  key: string
  label: string
  color: string
}

/** Stacked bars: columns (time / categories) or horizontal (people / sources). Each segment opens its rows. */
export function StackedBars<R extends { key: string; label: string }>({
  rows,
  series,
  value,
  onSelect,
  horizontal = false,
  right,
}: {
  rows: R[]
  series: Series[]
  value: (row: R, series: string) => number
  onSelect: (rowKey: string, seriesKey?: string) => void
  horizontal?: boolean
  /** horizontal only: text at the end of each bar (e.g. "42% contacted") */
  right?: (row: R) => string
}) {
  const totals = rows.map((r) => series.reduce((s, x) => s + value(r, x.key), 0))
  const max = Math.max(1, ...totals)
  if (horizontal) {
    return (
      <div className="space-y-2.5">
        {rows.map((r, i) => (
          <div key={r.key} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-xs">
            <button type="button" onClick={() => onSelect(r.key)} className="cursor-pointer truncate text-left font-medium text-slate-700 hover:text-brand-700" title={r.label}>
              {r.label}
            </button>
            <div className="flex h-5 overflow-hidden rounded-md bg-slate-100" style={{ width: `${Math.max(4, (totals[i] / max) * 100)}%` }}>
              {series.map((s) => {
                const v = value(r, s.key)
                return v ? (
                  <div key={s.key} style={{ width: `${(v / (totals[i] || 1)) * 100}%`, background: s.color }} title={`${r.label} · ${s.label}: ${fmt(v)}`}
                    {...clickable(() => onSelect(r.key, s.key), `${r.label} ${s.label}: ${v}`)} />
                ) : null
              })}
            </div>
            <span className="whitespace-nowrap text-slate-500">{right ? right(r) : fmt(totals[i])}</span>
          </div>
        ))}
      </div>
    )
  }
  const w = 640
  const h = 220
  const pad = { l: 36, r: 8, t: 20, b: 30 }
  const bw = (w - pad.l - pad.r) / Math.max(1, rows.length)
  const y = (v: number) => (h - pad.t - pad.b) * (v / max)
  const every = Math.ceil(rows.length / 10)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      {[0, Math.round(max / 2), max].map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={w - pad.r} y1={h - pad.b - y(t)} y2={h - pad.b - y(t)} stroke={COLORS.grid} />
          <text x={pad.l - 6} y={h - pad.b - y(t) + 4} textAnchor="end" className="fill-slate-400 text-[10px]">{t}</text>
        </g>
      ))}
      {rows.map((r, i) => {
        let base = h - pad.b
        const x0 = pad.l + i * bw + bw * 0.18
        return (
          <g key={r.key}>
            {series.map((s) => {
              const v = value(r, s.key)
              if (!v) return null
              const hh = y(v)
              base -= hh
              return (
                <rect key={s.key} x={x0} y={base} width={bw * 0.64} height={hh} fill={s.color} rx={2} {...clickable(() => onSelect(r.key, s.key), `${r.label} ${s.label}: ${v}`)}>
                  <title>{`${r.label} · ${s.label}: ${fmt(v)}`}</title>
                </rect>
              )
            })}
            {totals[i] > 0 && (
              <text x={x0 + bw * 0.32} y={h - pad.b - y(totals[i]) - 4} textAnchor="middle" className="fill-slate-700 text-[10px] font-semibold">
                {totals[i]}
              </text>
            )}
            {i % every === 0 && (
              <text x={x0 + bw * 0.32} y={h - 10} textAnchor="middle" className="fill-slate-500 text-[10px]">
                {r.label.length > 12 ? `${r.label.slice(0, 11)}…` : r.label}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

/** Horizontal bars with an optional dashed target line (Time to first call). */
export function Bars({
  rows,
  onSelect,
  target,
  unit = '',
  emptyText = '—',
  format,
}: {
  rows: { key: string; label: string; value: number | null; color?: string | null; note?: string }[]
  onSelect: (key: string) => void
  target?: number
  unit?: string
  emptyText?: string
  /** shows a value (e.g. minutes as HH:MM:SS) instead of number + unit */
  format?: (value: number) => string
}) {
  const max = Math.max(1, target ?? 0, ...rows.map((r) => r.value ?? 0)) * 1.08
  return (
    <div className="relative space-y-2">
      {rows.map((r) => (
        <div key={r.key} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-xs">
          <span className="truncate font-medium text-slate-700" title={r.label}>{r.label}</span>
          <div className="relative h-5 rounded-md bg-slate-50">
            {r.value !== null && (
              <div
                style={{ width: `${Math.max(1.5, (r.value / max) * 100)}%`, background: r.color ?? (target !== undefined && r.value > target ? COLORS.missed : COLORS.brand) }}
                title={`${r.label}: ${format ? format(r.value) : fmt(r.value) + unit}`}
                {...clickable(() => onSelect(r.key), `${r.label}: ${r.value}${unit}`, 'h-full rounded-md')}
              />
            )}
            {target !== undefined && (
              <div className="pointer-events-none absolute inset-y-[-3px] border-l-2 border-dashed border-red-500" style={{ left: `${(target / max) * 100}%` }} title={`Target ${format ? format(target) : target + unit}`} />
            )}
          </div>
          <span className="whitespace-nowrap text-slate-600">
            {r.value === null ? emptyText : format ? format(r.value) : `${fmt(r.value)}${unit}`}
            {r.note && <span className="ml-1 text-slate-400">{r.note}</span>}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Funnel: a centred band per step, the conversion from the step before on its right. */
export function Funnel({ steps, onSelect }: { steps: { key: string; label: string; value: number; fromPrevious: number | null; color?: string | null }[]; onSelect: (key: string) => void }) {
  const max = Math.max(1, ...steps.map((s) => s.value))
  return (
    <div className="space-y-1.5">
      {steps.map((s, i) => (
        <div key={s.key} className="grid grid-cols-[minmax(0,8rem)_1fr_4.5rem] items-center gap-3 text-xs">
          <span className="truncate font-medium text-slate-700" title={s.label}>{s.label}</span>
          <div className="flex justify-center">
            <div
              style={{ width: `${Math.max(8, (s.value / max) * 100)}%`, background: FUNNEL_FILLS[Math.min(FUNNEL_FILLS.length - 1, Math.round((i * (FUNNEL_FILLS.length - 1)) / Math.max(1, steps.length - 1)))] }}
              title={`${s.label}: ${fmt(s.value)}`}
              {...clickable(() => onSelect(s.key), `${s.label}: ${s.value}`, 'flex h-8 items-center justify-center rounded-lg text-xs font-semibold text-white shadow-sm')}
            >
              {fmt(s.value)}
            </div>
          </div>
          <span className={cn('text-right', s.fromPrevious !== null && s.fromPrevious < 50 ? 'text-red-600' : 'text-slate-500')}>
            {s.fromPrevious === null ? '' : `${s.fromPrevious}%`}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Ring gauge (one per counsellor): share of follow-ups done on time. */
export function Ring({ pct, label, sub, onClick }: { pct: number; label: string; sub: string; onClick: () => void }) {
  const r = 30
  const c = 2 * Math.PI * r
  const color = pct >= 90 ? COLORS.onTime : pct >= 75 ? COLORS.upcoming : COLORS.missed
  return (
    <button type="button" onClick={onClick} className="flex cursor-pointer flex-col items-center gap-1 rounded-lg p-2 hover:bg-slate-50">
      <svg viewBox="0 0 80 80" className="h-20 w-20">
        <circle cx={40} cy={40} r={r} fill="none" stroke="#e8e5ef" strokeWidth={8} />
        <circle cx={40} cy={40} r={r} fill="none" stroke={color} strokeWidth={8} strokeDasharray={`${(pct / 100) * c} ${c}`} strokeLinecap="round" transform="rotate(-90 40 40)" />
        <text x={40} y={45} textAnchor="middle" className="fill-slate-800 text-[15px] font-bold">{Math.round(pct)}%</text>
      </svg>
      <span className="max-w-[7rem] truncate text-xs font-medium text-slate-700" title={label}>{label}</span>
      <span className="text-[10px] text-slate-500">{sub}</span>
    </button>
  )
}

/** Small area line for a card: the per-day numbers over the period. */
export function Sparkline({ values, color }: { values: number[]; color: string }) {
  const w = 120
  const h = 36
  if (values.length < 2) return <div className="h-9" />
  const max = Math.max(1, ...values)
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 3 - (v / max) * (h - 6)])
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-9 w-full" preserveAspectRatio="none" aria-hidden>
      <path d={`${line} L ${w} ${h} L 0 ${h} Z`} fill={color} opacity={0.12} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/**
 * Headline card: the number, a per-day sparkline and the change vs the period before (▲ / ▼). `goodWhenUp` colours the
 * change: more enrolments is good, more "action not taken" is bad.
 */
export function TrendCard({
  label,
  value,
  sub,
  series,
  change,
  previousText,
  color,
  icon: Icon,
  goodWhenUp = true,
  onClick,
}: {
  label: string
  value: number
  sub?: string
  series: number[]
  change: number | null
  previousText?: string
  color: string
  icon: LucideIcon
  goodWhenUp?: boolean
  onClick: () => void
}) {
  const up = (change ?? 0) > 0
  const good = change === null || change === 0 ? null : up === goodWhenUp
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex w-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-md transition duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lg sm:p-5"
    >
      {/* the KpiCard corner wave, in the card's colour */}
      <svg aria-hidden viewBox="0 0 200 80" preserveAspectRatio="none" fill="currentColor" className="pointer-events-none absolute bottom-0 right-0 h-16 w-2/3 opacity-10" style={{ color }}>
        <path opacity=".5" d="M0 80C30 80 40 42 70 46s38-26 68-24 40-22 62-18v76z" />
        <path d="M40 80c30 0 40-24 70-22s42-24 90-28v50z" />
      </svg>
      <div className="relative flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${color}b3, ${color})` }}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <p className="line-clamp-2 min-w-0 flex-1 text-sm font-medium leading-tight text-slate-800">{label}</p>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
      </div>
      <div className="relative mt-3 flex items-end justify-between gap-2">
        <span className="text-2xl font-bold tabular-nums tracking-tight text-slate-900">{fmt(value)}</span>
        {change !== null && (
          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', good === null ? 'bg-slate-100 text-slate-600' : good ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
            {up ? '▲' : change < 0 ? '▼' : '•'} {Math.abs(change)}%
          </span>
        )}
      </div>
      {sub && <span className="relative mt-0.5 truncate text-xs font-medium text-slate-600">{sub}</span>}
      <div className="relative mt-2">
        <Sparkline values={series} color={color} />
      </div>
      {previousText && <span className="relative mt-1 text-[10px] text-slate-400">{previousText}</span>}
    </button>
  )
}

/**
 * Table with colour intensity: rows = counsellors, columns = sources / stages, every cell (and row / column total)
 * opens its leads. `columnColor` tints a column header (stage colour).
 */
export function Heatmap({
  columns,
  rows,
  totals,
  total,
  onCell,
  onColumn,
  activeColumn,
  rowHeader = 'Counsellor',
}: {
  columns: { key: string; label: string; color?: string | null }[]
  rows: { key: string; label: string; cells: Record<string, number>; total: number }[]
  totals: Record<string, number>
  total: number
  onCell: (rowKey: string, colKey: string) => void
  onColumn?: (colKey: string) => void
  activeColumn?: string | null
  rowHeader?: string
}) {
  const max = Math.max(1, ...rows.flatMap((r) => columns.map((c) => r.cells[c.key] ?? 0)))
  const shade = (n: number) => (n ? `rgba(95, 61, 158, ${0.08 + (n / max) * 0.72})` : undefined)
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-white px-2 py-2 text-left font-semibold text-slate-600">{rowHeader}</th>
            {columns.map((c) => (
              <th key={c.key} className="min-w-[4.5rem] px-1.5 py-2 text-center align-bottom font-semibold text-slate-600">
                <button
                  type="button"
                  disabled={!onColumn}
                  onClick={() => onColumn?.(c.key)}
                  className={cn('inline-flex max-w-[7rem] items-center gap-1 rounded px-1 py-0.5 leading-tight disabled:cursor-default',
                    onColumn && 'cursor-pointer hover:bg-slate-100', activeColumn === c.key && 'bg-brand-50 text-brand-700 ring-1 ring-brand-300')}
                  title={onColumn ? `${c.label} — show sub-stages` : c.label}
                >
                  {c.color && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.color }} />}
                  <span className="line-clamp-2">{c.label}</span>
                </button>
              </th>
            ))}
            <th className="px-2 py-2 text-center font-bold text-slate-700">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="group">
              <td className="sticky left-0 z-10 max-w-[10rem] truncate border-t border-slate-100 bg-white px-2 py-1.5 font-medium text-slate-700 group-hover:bg-slate-50" title={r.label}>{r.label}</td>
              {columns.map((c) => {
                const n = r.cells[c.key] ?? 0
                return (
                  <td key={c.key} className="border-t border-slate-100 p-0.5 text-center">
                    {n ? (
                      <button type="button" onClick={() => onCell(r.key, c.key)} title={`${r.label} · ${c.label}: ${n}`}
                        className={cn('w-full cursor-pointer rounded px-1 py-1.5 font-semibold tabular-nums hover:ring-2 hover:ring-brand-400', n / max > 0.55 ? 'text-white' : 'text-slate-800')}
                        style={{ background: shade(n) }}>
                        {fmt(n)}
                      </button>
                    ) : (
                      <span className="text-slate-300">·</span>
                    )}
                  </td>
                )
              })}
              <td className="border-t border-slate-100 px-2 text-center">
                <button type="button" onClick={() => onCell(r.key, '')} className="cursor-pointer font-bold tabular-nums text-slate-800 hover:text-brand-700 hover:underline">{fmt(r.total)}</button>
              </td>
            </tr>
          ))}
          <tr>
            <td className="sticky left-0 z-10 border-t-2 border-slate-200 bg-white px-2 py-1.5 font-bold text-slate-700">Total</td>
            {columns.map((c) => (
              <td key={c.key} className="border-t-2 border-slate-200 text-center">
                <button type="button" onClick={() => onCell('', c.key)} className="cursor-pointer font-bold tabular-nums text-slate-700 hover:text-brand-700 hover:underline">{fmt(totals[c.key] ?? 0)}</button>
              </td>
            ))}
            <td className="border-t-2 border-slate-200 text-center font-bold tabular-nums text-slate-900">{fmt(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
