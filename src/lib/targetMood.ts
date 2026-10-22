/** The fields of a target the dashboard banner needs (a structural subset of models.Target). */
export interface TargetPace {
  targetCount: number
  achieved: number
  percent: number
  startAt: string
  endAt: string
  status: 'active' | 'completed' | 'cancelled' | 'expired'
}

export interface Mood {
  emoji: string
  label: string
  /** progress the range's elapsed time calls for, 0–100 */
  expected: number
  /** e.g. "4 days left", "6 hrs left", "Starts in 2 days" */
  timeLeft: string
  /** e.g. "need 2/day", "3 more today"; empty once nothing remains */
  pace: string
}

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

function span(ms: number): string {
  if (ms >= DAY) {
    const days = Math.round(ms / DAY)
    return `${days} day${days === 1 ? '' : 's'}`
  }
  const hours = Math.max(1, Math.round(ms / HOUR))
  return `${hours} hr${hours === 1 ? '' : 's'}`
}

/**
 * The banner's smiley: progress measured against how much of the range has gone by, so 10% on day one
 * reads as on track while 80% on the last day does not.
 */
export function targetMood(t: TargetPace, now: number = Date.now()): Mood {
  const start = new Date(t.startAt).getTime()
  const end = new Date(t.endAt).getTime()
  const progress = Math.min(100, t.percent)
  const remaining = Math.max(0, t.targetCount - t.achieved)
  const left = end - now

  if (t.status === 'completed' || progress >= 100) {
    return { emoji: '🤩', label: 'Target complete!', expected: 100, timeLeft: left > 0 ? `${span(left)} left` : 'Range over', pace: '' }
  }
  if (now < start) {
    return { emoji: '😊', label: 'Starts soon', expected: 0, timeLeft: `Starts in ${span(start - now)}`, pace: '' }
  }

  const expected = end > start ? Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)) : 100
  const days = Math.max(1, Math.ceil(left / DAY))
  const pace = remaining === 0 ? '' : left < DAY ? `${remaining} more today` : `need ${Math.ceil(remaining / days)}/day`
  const timeLeft = left > 0 ? `${span(left)} left` : 'Range over'
  const gap = progress - expected

  const base = { expected: Math.round(expected), timeLeft, pace }
  if (left <= DAY && progress < 75) return { emoji: '😰', label: 'Hurry up', ...base }
  if (gap >= 10) return { emoji: '😄', label: 'Ahead', ...base }
  if (gap >= -10) return { emoji: '🙂', label: 'On track', ...base }
  if (gap >= -25) return { emoji: '😐', label: 'Slightly behind', ...base }
  return { emoji: '😟', label: 'Behind', ...base }
}
