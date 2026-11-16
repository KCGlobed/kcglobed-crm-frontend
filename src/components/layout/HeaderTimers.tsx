import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Clock3, Coffee, LogIn, LogOut } from 'lucide-react'
import { useCurrentUser } from '../../app/hooks'
import { BREAK_OPTIONS } from '../../constants/breaks'
import { formatHms } from '../../lib/durations'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/feedback'
import { Modal } from '../ui/Modal'
import { clockTime, useAttendanceToday, useBreakActions, usePunchActions } from './useAttendanceToday'

/**
 * The top bar's attendance, for every employee except Super Admin. Punched out: Punch In (with today's
 * punched-in time so far, once there is some). Punched in: the punched-in timer and Punch Out. The day's time
 * is its punched-in spans added up, and a pool member is online for the round-robin only while punched in.
 * During a break, the break's own timer sits next to it. Breaks are punched from the profile menu; while one
 * runs, a break screen with a large timer and End Break opens in the middle of the page.
 */
export function HeaderTimers() {
  const user = useCurrentUser()
  if (!user || user.isSuperAdmin) return null
  return <Timers receivesLeads={!!user.receivesLeads} />
}

function Timers({ receivesLeads }: { receivesLeads: boolean }) {
  const { today, loggedInSeconds, breakSeconds } = useAttendanceToday()
  const { end, ending } = useBreakActions()
  const { punchIn, punchOut, punchingIn, punchingOut } = usePunchActions()
  // the break screen opens for every running break (also after a reload); closing it only hides it for that
  // break, and the amber chip brings it back
  const [hiddenFor, setHiddenFor] = useState<string | null>(null)
  const [confirmOut, setConfirmOut] = useState(false)
  const active = today?.active ?? null
  const punch = today?.punch ?? null
  const BreakIcon = (active && BREAK_OPTIONS.find((o) => o.type === active.type)?.icon) || Coffee

  if (!today) return null

  return (
    <div className="flex items-center gap-1.5">
      {punch ? (
        <>
          <span
            title={`Punched in since ${clockTime(punch.punchedInAt)}${today.firstLoginAt ? ` · first Punch In ${clockTime(today.firstLoginAt)}` : ''}`}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-800"
          >
            <Clock3 className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Punched in</span>
            <span className="tabular-nums">{formatHms(loggedInSeconds)}</span>
          </span>
          <Button size="sm" variant="outline" onClick={() => setConfirmOut(true)} title="Punch out">
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Punch Out</span>
          </Button>
        </>
      ) : (
        <>
          {/* after a Punch Out today; before the first punch ever the figure would be the sign-in time */}
          {!!today.punches?.length && (
            <span
              title={today.lastPunchOutAt ? `Punched out at ${clockTime(today.lastPunchOutAt)}` : 'Punched-in time today'}
              className="hidden h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-600 md:inline-flex"
            >
              <Clock3 className="h-3.5 w-3.5" />
              <span className="tabular-nums">{formatHms(loggedInSeconds)}</span>
            </span>
          )}
          <Button size="sm" variant="success" loading={punchingIn} onClick={() => punchIn()} title="Punch in to start your day">
            <LogIn className="h-3.5 w-3.5" /> Punch In
          </Button>
        </>
      )}

      {active && (
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
      )}

      {/* rendered into <body>: the top bar's backdrop blur would otherwise make it the frame for these fixed
          overlays, centring them on the bar instead of the window */}
      {active &&
        createPortal(
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
                Punched in today <span className="font-medium tabular-nums text-slate-600">{formatHms(loggedInSeconds)}</span>
              </p>
              <Button className="mt-8 h-11 w-full max-w-xs text-base" loading={ending} onClick={() => end()}>
                End Break
              </Button>
            </div>
          </Modal>,
          document.body,
        )}
      {createPortal(
        <ConfirmDialog
          open={confirmOut}
          onClose={() => setConfirmOut(false)}
          onConfirm={async () => (await punchOut()) && setConfirmOut(false)}
          title="Punch out?"
          message={[
            active ? `Your ${active.label} ends too.` : '',
            receivesLeads ? 'Leads stop coming to you until you punch in again.' : '',
            'Time between this Punch Out and your next Punch In is not counted.',
          ]
            .filter(Boolean)
            .join(' ')}
          confirmLabel="Punch Out"
          loading={punchingOut}
        />,
        document.body,
      )}
    </div>
  )
}
