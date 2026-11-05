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
  /** both dates at once, so a preset never loses half the range; the times (HH:MM, '' = whole day) only with `withTime` */
  onChange: (from: string, to: string, fromTime?: string, toTime?: string) => void
  /** show a start / end time under each date (the lead list's Created Date) */
  withTime?: boolean
  fromTime?: string
  toTime?: string
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
export function DateRangeFilter({
  from = '',
  to = '',
  onChange,
  withTime = false,
  fromTime = '',
  toTime = '',
  label = 'Created Date',
  heading = 'Created Between',
  align = 'left',
  className,
}: DateRangeFilterProps) {
  const [open, setOpen] = useState(false)
  const active = Boolean(from || to)
  const shownFrom = from ? `${from}${withTime && fromTime ? ` ${fromTime}` : ''}` : '…'
  const shownTo = to ? `${to}${withTime && toTime ? ` ${toTime}` : ''}` : '…'
  // a time belongs to its date: clearing the date drops its time too
  const change = (nextFrom: string, nextTo: string, nextFromTime = fromTime, nextToTime = toTime) =>
    withTime ? onChange(nextFrom, nextTo, nextFrom ? nextFromTime : '', nextTo ? nextToTime : '') : onChange(nextFrom, nextTo)
  const presets = [
    ['Today', isoDay(), isoDay()],
    ['Last 7 Days', isoDay(6), isoDay()],
    ['Last 30 Days', isoDay(29), isoDay()],
    ['This Month', `${isoDay().slice(0, 8)}01`, isoDay()],
  ] as const
  return (
    <div className={cn('relative [&_button]:cursor-pointer', className)}>
      <Button variant={active ? 'secondary' : 'outline'} size="sm" onClick={() => setOpen((o) => !o)}>
        <CalendarRange className="h-3.5 w-3.5" />
        {active ? `${shownFrom} → ${shownTo}` : label}
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
                <Input type="date" aria-label={`${label} from`} value={from} max={to || undefined} onChange={(e) => change(e.target.value, to)} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium text-slate-500">End Date</span>
                <Input type="date" aria-label={`${label} to`} value={to} min={from || undefined} onChange={(e) => change(from, e.target.value)} />
              </label>
              {withTime && (
                <>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-slate-500">Start Time</span>
                    <Input
                      type="time"
                      aria-label={`${label} from time`}
                      value={fromTime}
                      disabled={!from}
                      title={from ? 'Blank = from the start of the day' : 'Pick a start date first'}
                      onChange={(e) => change(from, to, e.target.value, toTime)}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-medium text-slate-500">End Time</span>
                    <Input
                      type="time"
                      aria-label={`${label} to time`}
                      value={toTime}
                      disabled={!to}
                      title={to ? 'Blank = till the end of the day' : 'Pick an end date first'}
                      onChange={(e) => change(from, to, fromTime, e.target.value)}
                    />
                  </label>
                  <p className="col-span-2 -mt-1 text-[10px] text-slate-400">Time optional: blank start = 12:00 AM, blank end = 11:59 PM</p>
                </>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
              {presets.map(([text, start, end]) => (
                <button
                  key={text}
                  type="button"
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[11px] transition-colors',
                    from === start && to === end && !fromTime && !toTime
                      ? 'border-brand-600 bg-brand-600 font-medium text-white'
                      : 'border-slate-200 text-slate-600 hover:border-brand-300 hover:bg-brand-50/60 hover:text-brand-700'
                  )}
                  onClick={() => change(start, end, '', '')}
                >
                  {text}
                </button>
              ))}
            </div>
            <div className="mt-3 flex justify-end gap-2">
              {active && (
                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => change('', '', '', '')}>
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
