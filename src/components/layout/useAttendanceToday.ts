import { toast } from 'sonner'
import dayjs from 'dayjs'
import { useAttendanceTodayQuery, useEndBreakMutation, useStartBreakMutation } from '../../services/attendanceApi'
import { formatHms, useNow } from '../../lib/durations'
import { parseApiError } from '../../lib/utils'
import type { BreakType } from '../../types/models'

export const clockTime = (iso?: string | null) => (iso ? dayjs(iso).format('h:mm A') : '')

/**
 * Today's attendance for the signed-in employee, with live timers: the logged-in time and the running break
 * both tick every second. They add the time since the response arrived to the server's figures, so a PC
 * clock that is off doesn't skew them; the poll (every minute and on focus) keeps two tabs in step. During a
 * pause (campus visit, training, call calibration) the logged-in time stands still: the server takes that time
 * off, so the timer must not add it either.
 */
export function useAttendanceToday() {
  const { data, fulfilledTimeStamp } = useAttendanceTodayQuery(undefined, { pollingInterval: 60_000, refetchOnFocus: true })
  const today = data?.data
  const now = useNow(1000, !!today)
  const since = fulfilledTimeStamp ? Math.max(0, (now - fulfilledTimeStamp) / 1000) : 0
  const pausing = today?.active?.type === 'pause'
  return {
    today,
    loggedInSeconds: today ? today.loggedInSeconds + (today.live && !pausing ? since : 0) : 0,
    breakSeconds: today?.active ? (today.active.elapsedSeconds ?? 0) + since : 0,
  }
}

/** Start / end a break with the toasts; both refresh the timers, the dashboard and the report. */
export function useBreakActions() {
  const [startBreak, { isLoading: starting }] = useStartBreakMutation()
  const [endBreak, { isLoading: ending }] = useEndBreakMutation()

  const start = async (type: BreakType, note?: string): Promise<boolean> => {
    try {
      // the reason of a pause or an other break; the server drops it for the types that don't take one
      const reason = note?.trim()
      const res = await startBreak({ type, ...(reason ? { note: reason } : {}) }).unwrap()
      toast.success(`${res.data.label} started at ${clockTime(res.data.startedAt)}`)
      return true
    } catch (err) {
      toast.error(parseApiError(err).message)
      return false
    }
  }

  const end = async (): Promise<boolean> => {
    try {
      const res = await endBreak().unwrap()
      toast.success(`${res.data.label} ended · ${formatHms(res.data.durationSeconds)}`)
      return true
    } catch (err) {
      toast.error(parseApiError(err).message)
      return false
    }
  }

  return { start, end, starting, ending }
}
