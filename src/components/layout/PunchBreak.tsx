import { useState, type FormEvent } from 'react'
import { BREAK_OPTIONS, NOTE_TYPES, PAUSE_REASONS } from '../../constants/breaks'
import { formatHms } from '../../lib/durations'
import { cn } from '../../lib/utils'
import { Button } from '../ui/Button'
import { Input, Select } from '../ui/fields'
import type { BreakType } from '../../types/models'
import { clockTime, useAttendanceToday, useBreakActions } from './useAttendanceToday'

/** The reason dropdown's "Other" entry: the employee types the reason (not the 'other' break type). */
const CUSTOM = 'custom'

/**
 * The Punch Break section of the profile menu: the five break types, or, during a break, the running break with
 * End Break; then today's completed break time. Pause Break asks what the pause is for (Campus Visit, Training
 * Session, or Other with a typed reason) and Other Break asks what it is; both send the answer as the break's
 * note. A started break opens the break screen in the middle of the page and shows as a chip next to the
 * logged-in timer in the top bar.
 */
export function PunchBreakPanel({ onDone }: { onDone?: () => void }) {
  const { today, breakSeconds } = useAttendanceToday()
  const { start, end, starting, ending } = useBreakActions()
  const [open, setOpen] = useState<BreakType | null>(null) // the type whose reason form is expanded
  const [reason, setReason] = useState('') // pause: '' (not chosen yet), a preset, or CUSTOM
  const [note, setNote] = useState('') // the typed reason: Other Break, or a pause with CUSTOM
  const active = today?.active ?? null

  // what the expanded form would send; empty keeps Start disabled
  const resolvedNote = open === 'pause' ? (reason === CUSTOM ? note.trim() : reason) : open === 'other' ? note.trim() : ''
  const canStart = resolvedNote.length > 0

  const reset = () => {
    setOpen(null)
    setReason('')
    setNote('')
  }
  const toggle = (type: BreakType) => {
    setOpen((o) => (o === type ? null : type))
    setReason('')
    setNote('')
  }
  const pick = async (type: BreakType, breakNote = '') => {
    if (await start(type, breakNote)) {
      reset()
      onDone?.()
    }
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (open && canStart) pick(open, resolvedNote)
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
            {BREAK_OPTIONS.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                type="button"
                disabled={starting}
                aria-expanded={NOTE_TYPES.has(type) ? open === type : undefined}
                onClick={() => (NOTE_TYPES.has(type) ? toggle(type) : pick(type))}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition-colors disabled:opacity-60',
                  'last:odd:col-span-2', // an odd last tile (Other Break) takes the whole row
                  open === type
                    ? 'border-brand-300 bg-brand-50 text-brand-700'
                    : 'border-slate-200 text-slate-700 hover:border-brand-300 hover:bg-brand-50/60 hover:text-brand-700'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" /> {label}
              </button>
            ))}
          </div>
          {open && (
            <form className="mt-2 space-y-2" onSubmit={submit}>
              {open === 'pause' && (
                <Select
                  autoFocus
                  aria-label="What is the pause for?"
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value)
                    setNote('')
                  }}
                >
                  <option value="">What is the pause for?</option>
                  {PAUSE_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                  <option value={CUSTOM}>Other</option>
                </Select>
              )}
              {(open === 'other' || reason === CUSTOM) && (
                <Input
                  autoFocus
                  maxLength={200}
                  placeholder={open === 'pause' ? 'What is the pause for?' : 'What is the break for?'}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              )}
              <Button type="submit" size="sm" className="w-full" disabled={!canStart} loading={starting}>
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
