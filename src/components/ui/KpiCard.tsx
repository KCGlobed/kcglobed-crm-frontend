import type { LucideIcon } from 'lucide-react'
import { ChevronRight } from 'lucide-react'
import { Skeleton } from './feedback'
import { cn } from '../../lib/utils'

/**
 * Per accent: icon disc gradient, bar fill, bar track, corner wave colour. All mid-tone (400→600 discs, 500 bars),
 * so a section can give each card its own hue and they still read as one set: `blue` is the brand purple,
 * `indigo` / `azure` / `cyan` / `teal` the cool side, `green` / `leaf` the greens, `amber` / `orange` / `red` /
 * `pink` / `fuchsia` the warm side, `slate` neutral.
 */
const ACCENTS = {
  blue: { disc: 'from-brand-400 to-brand-600 shadow-brand-500/40', bar: 'bg-brand-500', track: 'bg-brand-100', wave: 'text-brand-500' },
  indigo: { disc: 'from-indigo-400 to-indigo-600 shadow-indigo-500/40', bar: 'bg-indigo-500', track: 'bg-indigo-100', wave: 'text-indigo-500' },
  azure: { disc: 'from-blue-400 to-blue-600 shadow-blue-500/40', bar: 'bg-blue-500', track: 'bg-blue-100', wave: 'text-blue-500' },
  cyan: { disc: 'from-sky-500 to-sky-600 shadow-sky-500/40', bar: 'bg-sky-500', track: 'bg-sky-100', wave: 'text-sky-500' },
  teal: { disc: 'from-teal-400 to-teal-600 shadow-teal-500/40', bar: 'bg-teal-500', track: 'bg-teal-100', wave: 'text-teal-500' },
  green: { disc: 'from-emerald-400 to-emerald-600 shadow-emerald-500/40', bar: 'bg-emerald-500', track: 'bg-emerald-100', wave: 'text-emerald-500' },
  leaf: { disc: 'from-leaf-400 to-leaf-600 shadow-leaf-500/40', bar: 'bg-leaf-500', track: 'bg-leaf-100', wave: 'text-leaf-500' },
  amber: { disc: 'from-gold-300 to-gold-500 shadow-gold-400/50', bar: 'bg-gold-400', track: 'bg-gold-100', wave: 'text-gold-400' },
  orange: { disc: 'from-orange-400 to-orange-600 shadow-orange-500/40', bar: 'bg-orange-500', track: 'bg-orange-100', wave: 'text-orange-500' },
  red: { disc: 'from-red-300 to-red-500 shadow-red-400/40', bar: 'bg-red-400', track: 'bg-red-100', wave: 'text-red-400' },
  pink: { disc: 'from-pink-400 to-pink-600 shadow-pink-500/40', bar: 'bg-pink-500', track: 'bg-pink-100', wave: 'text-pink-500' },
  fuchsia: { disc: 'from-fuchsia-400 to-fuchsia-600 shadow-fuchsia-500/40', bar: 'bg-fuchsia-500', track: 'bg-fuchsia-100', wave: 'text-fuchsia-500' },
  slate: { disc: 'from-slate-400 to-slate-500 shadow-slate-400/40', bar: 'bg-slate-400', track: 'bg-slate-200', wave: 'text-slate-400' },
} as const
export type KpiAccent = keyof typeof ACCENTS

/**
 * Metric card: gradient icon disc + title, then the supporting line and the
 * number over a bar. `progress` (0–100) sets the bar's length — e.g. the
 * metric's share of a total; without it the bar is full for a non-zero value and
 * empty for zero. Clickable when it
 * opens a list.
 */
export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = 'blue',
  color,
  progress,
  loading,
  onClick,
}: {
  label: string
  /** a count, or ready-made text such as a duration ("2h 15m") */
  value?: number | string
  hint?: string
  icon: LucideIcon
  accent?: keyof typeof ACCENTS
  /** an exact colour (hex) for the disc, bar and wave — e.g. a lead status colour — instead of `accent` */
  color?: string
  progress?: number
  loading?: boolean
  onClick?: () => void
}) {
  const Tag = onClick ? 'button' : 'div'
  const tone = ACCENTS[accent]
  // a non-zero metric always shows at least a sliver of bar; zero draws none, even without `progress`
  const fill = progress === undefined ? (value ? 100 : 0) : progress > 0 ? Math.min(100, Math.max(4, progress)) : 0
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn(
        'group relative flex w-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-md transition duration-200 sm:p-5',
        onClick && 'hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lg'
      )}
    >
      <svg
        aria-hidden
        viewBox="0 0 200 80"
        preserveAspectRatio="none"
        fill="currentColor"
        className={cn('pointer-events-none absolute bottom-0 right-0 h-16 w-2/3 opacity-15', !color && tone.wave)}
        style={color ? { color } : undefined}
      >
        <path opacity=".5" d="M0 80C30 80 40 42 70 46s38-26 68-24 40-22 62-18v76z" />
        <path d="M40 80c30 0 40-24 70-22s42-24 90-28v50z" />
      </svg>

      <div className="relative flex items-center gap-3">
        <span
          className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-lg', !color && ['bg-linear-to-br', tone.disc])}
          style={color ? { backgroundColor: color } : undefined}
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <p className="line-clamp-2 min-w-0 flex-1 text-sm font-medium leading-tight text-slate-800">{label}</p>
        {onClick && <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />}
      </div>

      <div className="relative mt-4 flex items-end justify-between gap-2">
        <span className="truncate pb-0.5 text-xs font-medium text-slate-600">{hint ?? ' '}</span>
        {loading ? (
          <Skeleton className="h-6 w-12" />
        ) : (
          <span className="text-xl font-bold tabular-nums leading-6 tracking-tight text-slate-900">{(value ?? 0).toLocaleString()}</span>
        )}
      </div>
      <div className={cn('relative mt-2 h-1 w-full overflow-hidden rounded-full', !color && tone.track)} style={color ? { backgroundColor: `${color}33` } : undefined}>
        <div className={cn('h-full rounded-full transition-all duration-500', !color && tone.bar)} style={{ width: `${loading ? 0 : fill}%`, ...(color ? { backgroundColor: color } : {}) }} />
      </div>
    </Tag>
  )
}
