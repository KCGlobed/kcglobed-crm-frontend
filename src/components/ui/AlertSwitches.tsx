import { Loader2 } from 'lucide-react'
import { ALERT_CHANNELS } from '../../constants/alertChannels'
import { cn } from '../../lib/utils'
import type { MyAlerts } from '../../types/models'

/** A user's Email / SMS / Push alert channels as three switch tiles (profile menu → My alerts, Users & Access form). */
export function AlertSwitches({
  value,
  onToggle,
  pending,
  className,
}: {
  value: MyAlerts
  onToggle: (key: keyof MyAlerts, label: string, on: boolean) => void
  pending?: keyof MyAlerts | null
  className?: string
}) {
  return (
    <div className={cn('grid grid-cols-3 gap-2', className)}>
      {ALERT_CHANNELS.map((c) => {
        const on = value[c.key]
        const busy = pending === c.key
        const Icon = on ? c.on : c.off
        return (
          <button
            key={c.key}
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={`${c.label} alerts`}
            aria-busy={busy || undefined}
            disabled={busy}
            title={`${c.label} alerts ${on ? 'on — click to turn off' : 'off — click to turn on'}`}
            onClick={() => onToggle(c.key, c.label, !on)}
            className={cn(
              'flex cursor-pointer flex-col items-center gap-1 rounded-xl px-1 pb-1.5 pt-2 ring-1 ring-inset transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 active:scale-95 disabled:cursor-wait',
              on ? 'bg-brand-50/70 ring-brand-200 hover:bg-brand-50' : 'bg-slate-50 ring-slate-200 hover:bg-slate-100'
            )}
          >
            <span
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-150',
                on ? 'bg-linear-to-br from-brand-500 to-brand-700 text-white shadow-sm shadow-brand-500/30' : 'bg-white text-slate-400 ring-1 ring-slate-200'
              )}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
            </span>
            <span className={cn('text-[11px] font-semibold', on ? 'text-slate-800' : 'text-slate-500')}>{c.label}</span>
            <span
              className={cn(
                'rounded-full px-1.5 text-[9px] font-bold uppercase tracking-wide',
                on ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
              )}
            >
              {on ? 'On' : 'Off'}
            </span>
          </button>
        )
      })}
    </div>
  )
}
