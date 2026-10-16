import { useState } from 'react'
import { CalendarRange } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from './Button'
import { Input } from './fields'

/** local YYYY-MM-DD, `daysAgo` days back */
const isoDay = (daysAgo = 0) => {
  const d = new Date(Date.now() - daysAgo * 86_400_000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface DateRangeFilterProps {
  from?: string
  to?: string
  /** both dates at once, so a preset never loses half the range */
  onChange: (from: string, to: string) => void
  /** the button text while no range is set */
  label?: string
  heading?: string
  /** which edge of the button the panel hangs from; `right` keeps it on screen when the button sits at the right edge */
  align?: 'left' | 'right'
  className?: string
}

/**
 * The compact "Created Date" filter of every list: one button that opens a small panel with a
 * start / end date, the usual presets (today, last 7 / 30 days, this month) and Clear / Done.
 * The button shows the range while one is set.
 */
export function DateRangeFilter({ from = '', to = '', onChange, label = 'Created Date', heading = 'Created Between', align = 'left', className }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false)
  const active = Boolean(from || to)
  const presets = [
    ['Today', isoDay(), isoDay()],
    ['Last 7 Days', isoDay(6), isoDay()],
    ['Last 30 Days', isoDay(29), isoDay()],
    ['This Month', `${isoDay().slice(0, 8)}01`, isoDay()],
  ] as const
  return (
    <div className={cn('relative', className)}>
      <Button variant={active ? 'secondary' : 'outline'} size="sm" onClick={() => setOpen((o) => !o)}>
        <CalendarRange className="h-3.5 w-3.5" />
        {active ? `${from || '…'} → ${to || '…'}` : label}
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className={cn(
              'absolute top-full z-50 mt-1.5 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-4 shadow-xl',
              align === 'right' ? 'right-0' : 'left-0'
            )}
          >
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{heading}</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-slate-500">Start Date</span>
                <Input type="date" aria-label={`${label} from`} value={from} max={to || undefined} onChange={(e) => onChange(e.target.value, to)} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-slate-500">End Date</span>
                <Input type="date" aria-label={`${label} to`} value={to} min={from || undefined} onChange={(e) => onChange(from, e.target.value)} />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
              {presets.map(([text, start, end]) => (
                <button
                  key={text}
                  type="button"
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                    from === start && to === end
                      ? 'border-brand-600 bg-brand-600 font-medium text-white'
                      : 'border-slate-200 text-slate-600 hover:border-brand-300 hover:bg-brand-50/60 hover:text-brand-700'
                  )}
                  onClick={() => onChange(start, end)}
                >
                  {text}
                </button>
              ))}
            </div>
            <div className="mt-3 flex justify-end gap-2">
              {active && (
                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => onChange('', '')}>
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
