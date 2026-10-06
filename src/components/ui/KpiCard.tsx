import type { LucideIcon } from 'lucide-react'
import { ChevronRight } from 'lucide-react'
import { Skeleton } from './feedback'
import { cn } from '../../lib/utils'

const ACCENTS = {
  blue: 'bg-brand-50 text-brand-600',
  green: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-500',
  cyan: 'bg-sky-50 text-sky-600',
  slate: 'bg-slate-100 text-slate-500',
} as const

/** Metric card: title, big number, supporting line, icon; clickable when it opens a list. */
export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = 'blue',
  loading,
  onClick,
}: {
  label: string
  value?: number
  hint?: string
  icon: LucideIcon
  accent?: keyof typeof ACCENTS
  loading?: boolean
  onClick?: () => void
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn(
        'group flex w-full flex-col rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors',
        onClick && 'hover:border-brand-200 hover:shadow-[var(--shadow-md)]'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', ACCENTS[accent])}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      {loading ? (
        <Skeleton className="mt-1 h-8 w-16" />
      ) : (
        <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-slate-800">{(value ?? 0).toLocaleString()}</p>
      )}
      <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
        <span className="truncate">{hint ?? ' '}</span>
        {onClick && <ChevronRight className="ml-auto h-3.5 w-3.5 text-slate-300 transition-colors group-hover:text-brand-600" />}
      </p>
    </Tag>
  )
}
