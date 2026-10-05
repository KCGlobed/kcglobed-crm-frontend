import { useNavigate } from 'react-router-dom'
import {
  CalendarPlus,
  CheckCircle2,
  Inbox,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react'
import { useDashboardSummaryQuery } from '../../services/miscApi'
import { PageHeader } from '../../components/ui/misc'
import { ErrorState, Skeleton } from '../../components/ui/feedback'
import { Badge } from '../../components/ui/Badge'
import { useCurrentUser } from '../../app/hooks'
import { fullName, timeAgo } from '../../lib/utils'
import { isAdminLike, isCounsellor } from '../../lib/roles'
import { MyDay, UnassignedBanner } from './MyDay'

function StatTile({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string
  value: number | undefined
  icon: typeof Users
  loading: boolean
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <Icon className="h-4 w-4 text-slate-300" />
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-16" />
      ) : (
        <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-800">{value ?? 0}</p>
      )}
    </div>
  )
}

/** Single-hue horizontal magnitude bars: identity on the label, value as length. */
function DistributionCard({
  title,
  items,
  loading,
  onItemClick,
}: {
  title: string
  items: { _id: string; name: string; count: number }[] | undefined
  loading: boolean
  onItemClick?: (id: string) => void
}) {
  const max = Math.max(1, ...(items ?? []).map((i) => i.count))
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      )}
      {!loading && (items ?? []).length === 0 && (
        <p className="py-6 text-center text-xs text-slate-400">No data yet</p>
      )}
      <div className="space-y-2.5">
        {items?.map((item) => (
          <button
            key={item._id || item.name}
            onClick={() => onItemClick?.(item._id)}
            disabled={!onItemClick}
            className="group block w-full text-left"
          >
            <div className="mb-0.5 flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-slate-600 group-hover:text-brand-700">{item.name}</span>
              <span className="font-semibold tabular-nums text-slate-700">{item.count}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-brand-500 transition-all"
                style={{ width: `${Math.max(2, (item.count / max) * 100)}%` }}
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useDashboardSummaryQuery()

  if (isError) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <ErrorState message="Could not load the dashboard." onRetry={refetch} />
      </>
    )
  }

  const totals = data?.data.totals

  return (
    <>
      <PageHeader
        title={`Welcome, ${user?.name.split(' ')[0] ?? ''}`}
        description={isCounsellor(user) ? 'My Day — what needs you now' : 'Lead pipeline overview'}
      />
      {isAdminLike(user) && <UnassignedBanner count={totals?.unassigned} />}
      {isCounsellor(user) && <MyDay />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Total leads" value={totals?.total} icon={Users} loading={isLoading} />
        <StatTile label="New today" value={totals?.newToday} icon={CalendarPlus} loading={isLoading} />
        <StatTile label="New this week" value={totals?.newThisWeek} icon={TrendingUp} loading={isLoading} />
        <StatTile label="Unassigned" value={totals?.unassigned} icon={Inbox} loading={isLoading} />
        <StatTile label="Admitted" value={totals?.converted} icon={CheckCircle2} loading={isLoading} />
        <StatTile label="Assigned to me today" value={data?.data.myLeadsToday} icon={UserCheck} loading={isLoading} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <DistributionCard
          title="Stage distribution"
          items={data?.data.byStage}
          loading={isLoading}
          onItemClick={(id) => id && navigate(`/app/leads?stage=${id}`)}
        />
        <DistributionCard
          title="Leads by source"
          items={data?.data.bySource}
          loading={isLoading}
          onItemClick={(id) => id && navigate(`/app/leads?source=${id}`)}
        />
        <DistributionCard title="Top counsellors" items={data?.data.byOwner} loading={isLoading} />
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-700">Recent leads</h3>
          <button
            onClick={() => navigate('/app/leads')}
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            View all
          </button>
        </div>
        <div className="divide-y divide-slate-50">
          {isLoading &&
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-4 py-3">
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          {data?.data.recentLeads.map((lead) => (
            <button
              key={lead._id}
              onClick={() => navigate(`/app/leads/${lead._id}`)}
              className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-slate-50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-700">
                  {fullName(lead)} <span className="text-xs font-normal text-slate-400">{lead.leadNo}</span>
                </p>
                <p className="text-xs text-slate-400">
                  {lead.source?.name ?? 'Unknown source'} · {timeAgo(lead.createdAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {lead.stage && <Badge color={lead.stage.color}>{lead.stage.name}</Badge>}
                <span className="hidden text-xs text-slate-500 sm:block">
                  {lead.owner?.name ?? 'Unassigned'}
                </span>
              </div>
            </button>
          ))}
          {!isLoading && (data?.data.recentLeads ?? []).length === 0 && (
            <p className="px-4 py-8 text-center text-xs text-slate-400">No leads yet</p>
          )}
        </div>
      </div>
    </>
  )
}
