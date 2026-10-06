import { useNavigate } from 'react-router-dom'
import { AlarmClock, CalendarCheck2, Hourglass, Sparkles, Inbox } from 'lucide-react'
import { useMyDayQuery } from '../../services/leadsApi'
import { KpiCard } from '../../components/ui/KpiCard'

const TILES = [
  { key: 'newUntouched', label: 'New / Untouched', hint: 'Not contacted yet', icon: Sparkles, accent: 'blue' },
  { key: 'followUpsToday', label: 'Follow-ups due today', hint: 'Scheduled for today', icon: CalendarCheck2, accent: 'cyan' },
  { key: 'overdue', label: 'Overdue', hint: 'Due time has passed', icon: AlarmClock, accent: 'red' },
  { key: 'interestedNoActivity', label: 'Interested, quiet 3+ days', hint: 'No activity in 3 days', icon: Hourglass, accent: 'amber' },
] as const

/** GL-31 "My Day": four counters that open the filtered lead list. */
export function MyDay() {
  const navigate = useNavigate()
  const { data, isLoading } = useMyDayQuery(undefined, { pollingInterval: 60_000 })
  const day = data?.data

  const open = (key: string) => {
    const link = day?.links[key] ?? {}
    const qs = new URLSearchParams()
    if (link.smart) qs.set('smart', String(link.smart))
    if (link.filters) qs.set('filters', JSON.stringify(link.filters))
    navigate(`/app/leads?${qs.toString()}`)
  }

  return (
    <section className="mb-6" aria-label="My Day">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">My Day</h2>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {TILES.map(({ key, label, hint, icon, accent }) => (
          <KpiCard key={key} label={label} hint={hint} icon={icon} accent={accent} value={day?.[key]} loading={isLoading} onClick={() => open(key)} />
        ))}
      </div>
    </section>
  )
}

/** §5.3: the Unassigned count is always at the top of the Admin dashboard. */
export function UnassignedBanner({ count }: { count?: number }) {
  const navigate = useNavigate()
  if (!count) return null
  return (
    <button
      type="button"
      onClick={() => navigate('/app/leads?smart=unassigned')}
      className="mb-4 flex w-full items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-900 transition-colors hover:bg-amber-100"
    >
      <Inbox className="h-5 w-5 shrink-0" />
      <span>
        <b>{count}</b> lead{count === 1 ? '' : 's'} waiting in the Unassigned pool — click to assign.
      </span>
    </button>
  )
}
