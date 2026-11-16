import dayjs, { type Dayjs } from 'dayjs'
import { formatHms } from '../../lib/durations'
import type { BadgeTone } from '../../lib/status'
import type { ReportColumnType, ReportPeriodKey, ReportRunStatus, ReportRunTrigger, ReportSchedule } from '../../types/models'

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const FULL_WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export const RUN_STATUS: Record<ReportRunStatus, { label: string; tone: BadgeTone }> = {
  running: { label: 'Sending', tone: 'blue' },
  sent: { label: 'Sent', tone: 'green' },
  retry: { label: 'Retrying', tone: 'amber' },
  failed: { label: 'Failed', tone: 'red' },
}

export const TRIGGER_LABEL: Record<ReportRunTrigger, string> = {
  schedule: 'Scheduled',
  manual: 'Run now',
  resend: 'Resent',
}

/** A report value as the screen shows it: durations HH:MM:SS (like every duration in the CRM), percents with %. */
export function formatValue(type: ReportColumnType, value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—'
  if (type === 'duration') return formatHms(Number(value))
  if (type === 'percent') return `${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 1 })}%`
  if (type === 'number') return Number(value).toLocaleString('en-IN')
  return String(value)
}

/** The dates a period covers on `today` — the server's apps.reports.periods.resolve. */
export function periodRange(period: ReportPeriodKey, today: Dayjs = dayjs()): [string, string] {
  const day = (d: Dayjs) => d.format('YYYY-MM-DD')
  // dayjs weeks start on Sunday; the report week is Monday–Sunday
  const monday = today.subtract((today.day() + 6) % 7, 'day')
  switch (period) {
    case 'yesterday':
      return [day(today.subtract(1, 'day')), day(today.subtract(1, 'day'))]
    case 'last_7_days':
      return [day(today.subtract(6, 'day')), day(today)]
    case 'last_week':
      return [day(monday.subtract(7, 'day')), day(monday.subtract(1, 'day'))]
    case 'this_month':
      return [day(today.startOf('month')), day(today)]
    case 'last_month': {
      const last = today.startOf('month').subtract(1, 'day')
      return [day(last.startOf('month')), day(last)]
    }
    default:
      return [day(today), day(today)]
  }
}

/** [0,1,2,3,4,5] → "Mon–Sat"; [0,2,4] → "Mon, Wed, Fri"; all seven → "Every day". */
export function dayList(days: number[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b)
  if (sorted.length === 7) return 'Every day'
  const runs: number[][] = []
  for (const d of sorted) {
    const last = runs[runs.length - 1]
    if (last && d === last[last.length - 1] + 1) last.push(d)
    else runs.push([d])
  }
  return runs
    .map((r) => (r.length >= 3 ? `${WEEKDAYS[r[0]]}–${WEEKDAYS[r[r.length - 1]]}` : r.map((d) => WEEKDAYS[d]).join(', ')))
    .join(', ')
}

const clock = (hhmm: string) => dayjs(`2000-01-01T${hhmm}`).format('h:mm A')

/** "Mon–Sat at 8:00 PM", "Weekly on Monday at 9:00 AM", "Monthly on day 1 at 9:00 AM". */
export function scheduleWhen(s: Pick<ReportSchedule, 'frequency' | 'weekdays' | 'monthDay' | 'sendTime'>): string {
  const at = clock(s.sendTime)
  if (s.frequency === 'monthly') return `Monthly on day ${s.monthDay} at ${at}`
  if (s.frequency === 'weekly') return `Weekly on ${FULL_WEEKDAYS[s.weekdays[0]] ?? '—'} at ${at}`
  return `${dayList(s.weekdays)} at ${at}`
}

export const when = (iso?: string | null) => (iso ? dayjs(iso).format('DD MMM YYYY, h:mm A') : '—')
