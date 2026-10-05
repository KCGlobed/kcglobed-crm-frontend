import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface BadgeProps {
  children: ReactNode
  /** hex color (e.g. a stage color) → rendered as tinted pill */
  color?: string
  tone?: 'slate' | 'green' | 'red' | 'amber' | 'blue' | 'violet'
  className?: string
}

const tones = {
  slate: 'bg-slate-100 text-slate-700',
  green: 'bg-emerald-50 text-emerald-700',
  red: 'bg-red-50 text-red-700',
  amber: 'bg-amber-50 text-amber-700',
  blue: 'bg-sky-50 text-sky-700',
  violet: 'bg-violet-50 text-violet-700',
}

export function Badge({ children, color, tone = 'slate', className }: BadgeProps) {
  const style = color
    ? { backgroundColor: `${color}1a`, color }
    : undefined
  return (
    <span
      style={style}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium',
        !color && tones[tone],
        className
      )}
    >
      {children}
    </span>
  )
}
