import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { statusLabel, statusTone, type BadgeTone } from '../../lib/status'

interface BadgeProps {
  children: ReactNode
  /** hex color (e.g. a stage color) → rendered as tinted pill */
  color?: string
  tone?: BadgeTone
  /** small leading dot — for statuses */
  dot?: boolean
  className?: string
  title?: string
}

// `blue` is the brand purple, so `violet` renders pink to stay distinguishable from it
const tones: Record<BadgeTone, string> = {
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  red: 'bg-red-50 text-red-700 ring-red-100',
  amber: 'bg-amber-50 text-amber-800 ring-amber-100',
  blue: 'bg-brand-50 text-brand-700 ring-brand-100',
  violet: 'bg-pink-50 text-pink-700 ring-pink-100',
  cyan: 'bg-sky-50 text-sky-700 ring-sky-100',
}

const dots: Record<BadgeTone, string> = {
  slate: 'bg-slate-400',
  green: 'bg-emerald-600',
  red: 'bg-red-500',
  amber: 'bg-amber-500',
  blue: 'bg-brand-600',
  violet: 'bg-pink-500',
  cyan: 'bg-sky-500',
}

export function Badge({ children, color, tone = 'slate', dot, className, title }: BadgeProps) {
  const style = color ? { backgroundColor: `${color}14`, color, boxShadow: `inset 0 0 0 1px ${color}33` } : undefined
  return (
    <span
      title={title}
      style={style}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium leading-4',
        !color && ['ring-1 ring-inset', tones[tone]],
        className
      )}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', color ? '' : dots[tone])} style={color ? { backgroundColor: color } : undefined} />}
      {children}
    </span>
  )
}

export function StatusBadge({ status, label, className }: { status?: string | null; label?: ReactNode; className?: string }) {
  const text = label ?? statusLabel(status)
  return (
    <Badge tone={statusTone(status)} dot className={className}>
      {text}
    </Badge>
  )
}
