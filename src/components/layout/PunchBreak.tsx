import { useState } from 'react'
import { Coffee, MoreHorizontal, Soup, Toilet, type LucideIcon } from 'lucide-react'
import { formatHms } from '../../lib/durations'
import { cn } from '../../lib/utils'
import { Button } from '../ui/Button'
import { Input } from '../ui/fields'
import type { BreakType } from '../../types/models'
import { clockTime, useAttendanceToday, useBreakActions } from './useAttendanceToday'

const OPTIONS: { type: BreakType; label: string; icon: LucideIcon }[] = [
  { type: 'tea', label: 'Tea Break', icon: Coffee },
  { type: 'lunch', label: 'Lunch Break', icon: Soup },
  { type: 'bio', label: 'Bio Break', icon: Toilet },
  { type: 'other', label: 'Other Break', icon: MoreHorizontal },
]

/**
 * The Punch Break section of the profile menu: the four break types (Other asks what it is for), or, during a
 * break, the running break with End Break; then today's completed break time. A started break opens the break
 * screen in the middle of the page and shows as a chip next to the logged-in timer in the top bar.
 */
export function PunchBreakPanel({ onDone }: { onDone?: () => void }) {
  const { today, breakSeconds } = useAttendanceToday()
  const { start, end, starting, ending } = useBreakActions()
  const [otherOpen, setOtherOpen] = useState(false)
  const [note, setNote] = useState('')
  const active = today?.active ?? null

  const pick = async (type: BreakType) => {
    if (type === 'other' && !note.trim()) {
      setOtherOpen(true)
      return
    }
    if (await start(type, note.trim())) {
      setOtherOpen(false)
      setNote('')
      onDone?.()
    }
  }

  return (
    <div className="px-4 py-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Punch Break</p>
      {active ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-center">
          <p className="text-xs font-medium text-amber-800">
            On {active.label}
            {active.note ? ` · ${active.note}` : ''}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{formatHms(breakSeconds)}</p>
          <p className="text-[11px] text-slate-500">Started at {clockTime(active.startedAt)}</p>
          <Button className="mt-2 w-full" size="sm" loading={ending} onClick={async () => (await end()) && onDone?.()}>
            End Break
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {OPTIONS.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                type="button"
                disabled={starting}
                onClick={() => (type === 'other' ? setOtherOpen((o) => !o) : pick(type))}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition-colors disabled:opacity-60',
                  type === 'other' && otherOpen
                    ? 'border-brand-300 bg-brand-50 text-brand-700'
                    : 'border-slate-200 text-slate-700 hover:border-brand-300 hover:bg-brand-50/60 hover:text-brand-700'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" /> {label}
              </button>
            ))}
          </div>
          {otherOpen && (
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                pick('other')
              }}
            >
              <Input autoFocus maxLength={200} placeholder="What is the break for?" value={note} onChange={(e) => setNote(e.target.value)} />
              <Button type="submit" size="sm" disabled={!note.trim()} loading={starting}>
                Start
              </Button>
            </form>
          )}
        </>
      )}

      <div className="mt-3 flex items-baseline justify-between">
        <p className="text-xs font-medium text-slate-600">Break time today</p>
        <p className="text-sm font-bold tabular-nums text-slate-900">{formatHms(today?.totalSeconds)}</p>
      </div>
    </div>
  )
}
