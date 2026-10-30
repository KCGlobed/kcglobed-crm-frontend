import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Clock3, Coffee } from 'lucide-react'
import { useCurrentUser } from '../../app/hooks'
import { BREAK_OPTIONS } from '../../constants/breaks'
import { formatHms } from '../../lib/durations'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { clockTime, useAttendanceToday, useBreakActions } from './useAttendanceToday'

/**
 * The top bar's timers, for every employee except Super Admin: the time signed in today (it starts at
 * sign-in and, after a sign-out, carries on from the day's total at the next sign-in) and, during a break,
 * the break's own timer next to it. Both run at once. Breaks are punched from the profile menu; while one
 * runs, a break screen with a large timer and End Break opens in the middle of the page.
 */
export function HeaderTimers() {
  const user = useCurrentUser()
  if (!user || user.isSuperAdmin) return null
  return <Timers />
}

function Timers() {
  const { today, loggedInSeconds, breakSeconds } = useAttendanceToday()
  const { end, ending } = useBreakActions()
  // the break screen opens for every running break (also after a reload); closing it only hides it for that
  // break, and the amber chip brings it back
  const [hiddenFor, setHiddenFor] = useState<string | null>(null)
  const active = today?.active ?? null
  const BreakIcon = (active && BREAK_OPTIONS.find((o) => o.type === active.type)?.icon) || Coffee

  if (!today) return null

  return (
    <div className="flex items-center gap-1.5">
      <span
        title={today.firstLoginAt ? `Logged in today since ${clockTime(today.firstLoginAt)}` : 'Logged in today'}
        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-800"
      >
        <Clock3 className="h-3.5 w-3.5" />
        <span className="hidden lg:inline">Logged in</span>
        <span className="tabular-nums">{formatHms(loggedInSeconds)}</span>
      </span>

      {active && (
        <>
          <button
            type="button"
            onClick={() => setHiddenFor(null)}
            title={`On ${active.label} since ${clockTime(active.startedAt)}: open the break screen`}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
            </span>
            <span className="hidden sm:inline">{active.label} ·</span>
            <span className="tabular-nums">{formatHms(breakSeconds)}</span>
          </button>

          {/* rendered into <body>: the top bar's backdrop blur would otherwise make it the frame for this fixed
              overlay, centring the screen on the bar instead of the window */}
          {createPortal(
            <Modal
              open={hiddenFor !== active._id}
              onClose={() => setHiddenFor(active._id)}
              title={`On ${active.label}`}
              description={active.note ? active.note : undefined}
              size="md"
            >
              <div className="flex flex-col items-center py-6 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                  <BreakIcon className="h-8 w-8" />
                </span>
                <p className="mt-5 text-6xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-7xl">{formatHms(breakSeconds)}</p>
                <p className="mt-2 text-sm text-slate-500">Started at {clockTime(active.startedAt)}</p>
                <p className="mt-1 text-xs text-slate-400">
                  Logged in today <span className="font-medium tabular-nums text-slate-600">{formatHms(loggedInSeconds)}</span>
                </p>
                <Button className="mt-8 h-11 w-full max-w-xs text-base" loading={ending} onClick={() => end()}>
                  End Break
                </Button>
              </div>
            </Modal>,
            document.body,
          )}
        </>
      )}
    </div>
  )
}
