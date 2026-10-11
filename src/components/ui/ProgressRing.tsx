import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

const TONES = {
  brand: { stroke: 'stroke-brand-600', track: 'stroke-brand-100' },
  emerald: { stroke: 'stroke-emerald-500', track: 'stroke-emerald-100' },
  amber: { stroke: 'stroke-gold-400', track: 'stroke-gold-100' },
} as const

/**
 * Circular progress: `value` (0–100) as the filled arc, whatever is passed as
 * children in the middle (a number, initials…) and an optional caption below.
 */
export function ProgressRing({
  value,
  size = 72,
  stroke = 6,
  tone = 'brand',
  label,
  title,
  children,
  className,
  testId,
}: {
  value: number
  size?: number
  stroke?: number
  tone?: keyof typeof TONES
  label?: string
  title?: string
  children?: ReactNode
  className?: string
  testId?: string
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)))
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const t = TONES[tone]
  return (
    <div className={cn('flex shrink-0 flex-col items-center gap-1', className)} title={title} data-testid={testId} data-value={pct}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label ?? 'Progress'}: ${pct}%`} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className={t.track} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - pct / 100)}
            className={cn('transition-[stroke-dashoffset] duration-500', t.stroke)}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">{children}</div>
      </div>
      {label && <span className="max-w-24 truncate text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</span>}
    </div>
  )
}
