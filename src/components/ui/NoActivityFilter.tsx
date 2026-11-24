import { useState } from 'react'
import { CalendarX } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from './Button'
import { Input } from './fields'

/** local YYYY-MM-DD, `daysAgo` days back */
const isoDay = (daysAgo = 0) => {
  const d = new Date(Date.now() - daysAgo * 86_400_000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** YYYY-MM-DD → DD-MM-YYYY for the button */
const shown = (day: string) => day.split('-').reverse().join('-')

interface NoActivityFilterProps {
  /** YYYY-MM-DD; '' = not in use */
  value: string
  onChange: (day: string) => void
  className?: string
}

/**
 * Leads → Quick Filters → No Activity: one date. Lists the open leads whose Last Activity is before that date,
 * i.e. nobody has worked on them since (backend ?no_activity_before).
 */
export function NoActivityFilter({ value, onChange, className }: NoActivityFilterProps) {
  const [open, setOpen] = useState(false)
  // "no work in the last N days" = Last Activity before the first of those N days
  const presets = [
    ['Today', isoDay(0)],
    ['Last 3 Days', isoDay(2)],
    ['Last 7 Days', isoDay(6)],
    ['Last 15 Days', isoDay(14)],
    ['Last 30 Days', isoDay(29)],
  ] as const
  return (
    <div className={cn('relative [&_button]:cursor-pointer', className)}>
      <Button variant={value ? 'secondary' : 'outline'} size="sm" onClick={() => setOpen((o) => !o)}>
        <CalendarX className="h-3.5 w-3.5" />
        {value ? `No Activity since ${shown(value)}` : 'No Activity'}
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1.5 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">No Activity Since</p>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-slate-500">Date</span>
              <Input type="date" aria-label="No activity since" value={value} max={isoDay()} onChange={(e) => onChange(e.target.value)} />
            </label>
            <p className="mt-1.5 text-[10px] text-slate-400">
              Shows open leads whose Last Activity is before this date: nobody worked on them on or after it.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
              {presets.map(([text, day]) => (
                <button
                  key={text}
                  type="button"
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                    value === day
                      ? 'border-brand-600 bg-brand-600 font-medium text-white'
                      : 'border-slate-200 text-slate-600 hover:border-brand-300 hover:bg-brand-50/60 hover:text-brand-700'
                  )}
                  onClick={() => onChange(day)}
                >
                  {text}
                </button>
              ))}
            </div>
            <div className="mt-3 flex justify-end gap-2">
              {value && (
                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => onChange('')}>
                  Clear
                </Button>
              )}
              <Button size="sm" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
