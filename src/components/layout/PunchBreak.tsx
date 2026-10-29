import { useState, type FormEvent } from 'react'
import { NOTE_TYPES, PAUSE_OPTIONS, PUNCH_BREAK_OPTIONS } from '../../constants/breaks'
import { formatHms } from '../../lib/durations'
import { cn } from '../../lib/utils'
import { Button } from '../ui/Button'
import { Input } from '../ui/fields'
import type { BreakType } from '../../types/models'
import { clockTime, useAttendanceToday, useBreakActions } from './useAttendanceToday'

/** Which "Other" text form is expanded: Punch Break's or Punch Pause Break's. */
type OpenForm = 'other' | 'pause-other' | null

const TILE = 'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition-colors disabled:opacity-60'
const TILE_IDLE = 'border-slate-200 text-slate-700 hover:border-brand-300 hover:bg-brand-50/60 hover:text-brand-700'
const TILE_OPEN = 'border-brand-300 bg-brand-50 text-brand-700'
const HEADING = 'mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500'

/**
 * The profile menu's two punch sections. Punch Break: Tea / Lunch / Bio / Other Break (Other asks what it is for)
 * and today's break time. Punch Pause Break, under it: Campus Visit / Call Calibration / Training Session / Other
 * (Other asks what the pause is for) and today's pause time. A pause is time away from the desk: it is neither
 * break time nor signed-in time, so the logged-in timer stands still while one runs. One break of either kind
 * runs at a time: its card (with End Break) replaces its own section's tiles while the other section's tiles wait.
 * A started break opens the break screen in the middle of the page and shows as a chip in the top bar.
 */
export function PunchBreakPanel({ onDone }: { onDone?: () => void }) {
  const { today, breakSeconds } = useAttendanceToday()
  const { start, end, starting, ending } = useBreakActions()
  const [open, setOpen] = useState<OpenForm>(null)
  const [note, setNote] = useState('')
  const active = today?.active ?? null
  const pausing = active?.type === 'pause'

  const reset = () => {
    setOpen(null)
    setNote('')
  }
  const toggle = (form: OpenForm) => {
    setOpen((o) => (o === form ? null : form))
    setNote('')
  }
  const pick = async (type: BreakType, reason = '') => {
    if (await start(type, reason)) {
      reset()
      onDone?.()
    }
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (open && note.trim()) pick(open === 'other' ? 'other' : 'pause', note.trim())
  }

  const activeCard = active && (
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
  )
  const noteForm = (form: Exclude<OpenForm, null>, placeholder: string) =>
    open === form && (
      <form className="mt-2 flex gap-2" onSubmit={submit}>
        <Input autoFocus maxLength={200} placeholder={placeholder} value={note} onChange={(e) => setNote(e.target.value)} />
        <Button type="submit" size="sm" disabled={!note.trim()} loading={starting}>
          Start
        </Button>
      </form>
    )
  // a section's tiles can start something only while nothing runs (the server allows one break at a time)
  const tile = { disabled: starting || !!active, title: active ? 'End your current break first' : undefined }

  return (
    <>
      <section className="px-4 py-3">
        <p className={HEADING}>Punch Break</p>
        {active && !pausing ? (
          activeCard
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              {PUNCH_BREAK_OPTIONS.map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  type="button"
                  {...tile}
                  aria-expanded={NOTE_TYPES.has(type) ? open === 'other' : undefined}
                  onClick={() => (NOTE_TYPES.has(type) ? toggle('other') : pick(type))}
                  className={cn(TILE, NOTE_TYPES.has(type) && open === 'other' ? TILE_OPEN : TILE_IDLE)}
                >
                  <Icon className="h-4 w-4 shrink-0" /> {label}
                </button>
              ))}
            </div>
            {noteForm('other', 'What is the break for?')}
          </>
        )}
        <Total label="Break time today" seconds={today?.totalSeconds} />
      </section>

      <section className="border-t border-slate-100 px-4 py-3">
        <p className={HEADING}>Punch Pause Break</p>
        {pausing ? (
          activeCard
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              {PAUSE_OPTIONS.map(({ reason, label, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  {...tile}
                  aria-expanded={reason ? undefined : open === 'pause-other'}
                  onClick={() => (reason ? pick('pause', reason) : toggle('pause-other'))}
                  className={cn(TILE, !reason && open === 'pause-other' ? TILE_OPEN : TILE_IDLE)}
                >
                  <Icon className="h-4 w-4 shrink-0" /> {label}
                </button>
              ))}
            </div>
            {noteForm('pause-other', 'What is the pause for?')}
          </>
        )}
        <Total label="Pause time today" seconds={today?.pauseSeconds} />
      </section>
    </>
  )
}

function Total({ label, seconds }: { label: string; seconds?: number }) {
  return (
    <div className="mt-3 flex items-baseline justify-between">
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <p className="text-sm font-bold tabular-nums text-slate-900">{formatHms(seconds)}</p>
    </div>
  )
}
