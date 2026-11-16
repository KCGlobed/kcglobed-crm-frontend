import { LogIn } from 'lucide-react'
import { useCurrentUser } from '../../app/hooks'
import { useAttendanceTodayQuery } from '../../services/attendanceApi'
import { Button } from '../ui/Button'
import { clockTime, usePunchActions } from './useAttendanceToday'

/**
 * The strip under the top bar while the employee is signed in but not punched in (every employee except Super
 * Admin): the day's time counts only while punched in, and a round-robin member gets leads only then.
 */
export function PunchReminder() {
  const user = useCurrentUser()
  if (!user || user.isSuperAdmin) return null
  return <Reminder receivesLeads={!!user.receivesLeads} />
}

function Reminder({ receivesLeads }: { receivesLeads: boolean }) {
  // the top bar polls the same query; this only reads it
  const { data } = useAttendanceTodayQuery()
  const { punchIn, punchingIn } = usePunchActions()
  const today = data?.data
  if (!today || today.punch) return null

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900"
    >
      <p>
        <span className="font-semibold">
          {today.lastPunchOutAt ? `You punched out at ${clockTime(today.lastPunchOutAt)}.` : 'You are not punched in.'}
        </span>{' '}
        {receivesLeads
          ? 'Punch in to start your time — leads come to you only while you are punched in.'
          : 'Punch in to start your time.'}
      </p>
      <Button size="sm" variant="success" className="h-7" loading={punchingIn} onClick={() => punchIn()}>
        <LogIn className="h-3.5 w-3.5" /> Punch In
      </Button>
    </div>
  )
}
