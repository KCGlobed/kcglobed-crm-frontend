import { useNavigate } from 'react-router-dom'
import { AlarmClock, CalendarCheck2, Hourglass, Sparkles, Inbox } from 'lucide-react'
import { useMyDayQuery } from '../../services/leadsApi'
import { Skeleton } from '../../components/ui/feedback'

const TILES = [
  { key: 'newUntouched', label: 'New / Untouched', icon: Sparkles, tone: 'text-brand-600 bg-brand-50' },
  { key: 'followUpsToday', label: 'Follow-ups due today', icon: CalendarCheck2, tone: 'text-sky-600 bg-sky-50' },
  { key: 'overdue', label: 'Overdue', icon: AlarmClock, tone: 'text-red-600 bg-red-50' },
  { key: 'interestedNoActivity', label: 'Interested, no activity 3+ days', icon: Hourglass, tone: 'text-amber-600 bg-amber-50' },
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
    <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
      {TILES.map(({ key, label, icon: Icon, tone }) => (
        <button
          key={key}
          onClick={() => open(key)}
          className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50/30"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <span className={`rounded-lg p-1.5 ${tone}`}>
              <Icon className="h-4 w-4" />
            </span>
          </div>
          {isLoading ? <Skeleton className="mt-2 h-7 w-12" /> : <p className="mt-1 text-2xl font-semibold text-slate-800">{day?.[key] ?? 0}</p>}
        </button>
      ))}
    </div>
  )
}

/** §5.3: the Unassigned count is always at the top of the Admin dashboard. */
export function UnassignedBanner({ count }: { count?: number }) {
  const navigate = useNavigate()
  if (!count) return null
  return (
    <button
      onClick={() => navigate('/app/leads?smart=unassigned')}
      className="mb-4 flex w-full items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-900 hover:bg-amber-100"
    >
      <Inbox className="h-5 w-5 shrink-0" />
      <span>
        <b>{count}</b> lead{count === 1 ? '' : 's'} waiting in the Unassigned pool — click to assign.
      </span>
    </button>
  )
}
