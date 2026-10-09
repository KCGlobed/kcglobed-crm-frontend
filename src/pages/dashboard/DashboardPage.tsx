import { useNavigate } from 'react-router-dom'
import { CalendarPlus, CheckCircle2, Inbox, TrendingUp, UserCheck, Users, XCircle } from 'lucide-react'
import { useDashboardSummaryQuery } from '../../services/miscApi'
import { Card, PageHeader } from '../../components/ui/misc'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/feedback'
import { Badge } from '../../components/ui/Badge'
import { KpiCard } from '../../components/ui/KpiCard'
import { useCurrentUser } from '../../app/hooks'
import { fullName, timeAgo } from '../../lib/utils'
import { isAdminLike, isCounsellor } from '../../lib/roles'
import { MyDay, UnassignedBanner } from './MyDay'

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
    <Card title={title}>
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      )}
      {!loading && (items ?? []).length === 0 && <p className="py-6 text-center text-xs text-slate-400">No data yet</p>}
      <div className="space-y-3">
        {items?.map((item) => (
          <button
            key={item._id || item.name}
            type="button"
            onClick={() => onItemClick?.(item._id)}
            disabled={!onItemClick}
            className="group block w-full rounded-md text-left"
          >
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-slate-600 group-enabled:group-hover:text-brand-700">{item.name}</span>
              <span className="font-semibold tabular-nums text-slate-700">{item.count.toLocaleString()}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-linear-to-r from-brand-500 to-brand-600 transition-all" style={{ width: `${Math.max(2, (item.count / max) * 100)}%` }} />
            </div>
          </button>
        ))}
      </div>
    </Card>
  )
}

const pct = (part?: number, whole?: number) => {
  if (!whole) return undefined
  const share = ((part ?? 0) / whole) * 100
  return `${share > 0 && share < 1 ? '<1' : Math.round(share)}% of all leads`
}

/** A metric's share of the total, as the 0–100 length of its card's bar. */
const share = (part?: number, whole?: number) => (whole ? ((part ?? 0) / whole) * 100 : 0)

export default function DashboardPage() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const { data, isLoading, isError, error, refetch } = useDashboardSummaryQuery()

  if (isError) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <Card>
          <ErrorState message="We couldn't load the dashboard. Please try again." onRetry={refetch} error={error} />
        </Card>
      </>
    )
  }

  const totals = data?.data.totals
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <>
      <section className="relative mb-5 overflow-hidden rounded-2xl bg-linear-to-br from-brand-600 via-brand-700 to-brand-900 px-5 py-5 text-white shadow-md sm:px-7 sm:py-6">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-brand-400/40 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 right-16 h-48 w-48 rounded-full border border-gold-400/40" />
        <div aria-hidden className="pointer-events-none absolute -bottom-12 right-44 h-28 w-28 rounded-full border border-white/10" />
        <div className="relative">
          <p className="flex items-center gap-2 text-xs font-medium text-gold-300">
            <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
            {today}
          </p>
          <h1 className="mt-1 truncate text-xl font-bold tracking-tight sm:text-2xl">Welcome back, {user?.name.split(' ')[0] ?? ''}</h1>
          {isCounsellor(user) && <p className="mt-1 text-sm text-brand-100">My Day — what needs you now</p>}
        </div>
      </section>
      {isAdminLike(user) && <UnassignedBanner count={totals?.unassigned} />}
      {isCounsellor(user) && <MyDay />}

      <h2 className="mb-3 text-lg font-semibold tracking-tight text-slate-900">Overview</h2>
      {/* each bar is the metric's share of all leads */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4 min-[112.5rem]:grid-cols-7">
        <KpiCard label="Total leads" value={totals?.total} hint={isCounsellor(user) ? 'Assigned to you' : 'In the CRM'} icon={Users} loading={isLoading} onClick={() => navigate('/app/leads')} />
        <KpiCard label="New today" value={totals?.newToday} progress={share(totals?.newToday, totals?.total)} hint="Created today" icon={CalendarPlus} accent="cyan" loading={isLoading} onClick={() => navigate('/app/leads?smart=new_today')} />
        <KpiCard label="New this week" value={totals?.newThisWeek} progress={share(totals?.newThisWeek, totals?.total)} hint="Since Sunday" icon={TrendingUp} accent="cyan" loading={isLoading} />
        <KpiCard
          label="Unassigned"
          value={totals?.unassigned}
          progress={share(totals?.unassigned, totals?.total)}
          hint="Waiting for an owner"
          icon={Inbox}
          accent="amber"
          loading={isLoading}
          onClick={isAdminLike(user) ? () => navigate('/app/leads?smart=unassigned') : undefined}
        />
        <KpiCard label="Enrolled" value={totals?.converted} progress={share(totals?.converted, totals?.total)} hint={pct(totals?.converted, totals?.total)} icon={CheckCircle2} accent="green" loading={isLoading} onClick={() => navigate('/app/leads?status=converted')} />
        <KpiCard label="Not Interested" value={totals?.lost} progress={share(totals?.lost, totals?.total)} hint={pct(totals?.lost, totals?.total)} icon={XCircle} accent="red" loading={isLoading} onClick={() => navigate('/app/leads?status=lost')} />
        <KpiCard label="Assigned to me today" value={data?.data.myLeadsToday} progress={share(data?.data.myLeadsToday, totals?.total)} hint="New in your queue" icon={UserCheck} accent="slate" loading={isLoading} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <DistributionCard title="Stage distribution" items={data?.data.byStage} loading={isLoading} onItemClick={(id) => id && navigate(`/app/leads?stage=${id}`)} />
        <DistributionCard title="Leads by source" items={data?.data.bySource} loading={isLoading} onItemClick={(id) => id && navigate(`/app/leads?source=${id}`)} />
        <DistributionCard title="Top counsellors" items={data?.data.byOwner} loading={isLoading} />
      </div>

      <Card
        className="mt-4"
        bodyClassName="p-0"
        title="Recent leads"
        actions={
          <button type="button" onClick={() => navigate('/app/leads')} className="text-xs font-medium text-brand-600 hover:underline">
            View all
          </button>
        }
      >
        <div className="divide-y divide-slate-100">
          {isLoading &&
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-4 py-3">
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          {data?.data.recentLeads.map((lead) => (
            <button
              key={lead._id}
              type="button"
              onClick={() => navigate(`/app/leads/${lead._id}`)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">
                  {fullName(lead)} <span className="text-xs font-normal text-slate-400">{lead.leadNo}</span>
                </p>
                <p className="text-xs text-slate-500">
                  {lead.source?.name ?? 'Unknown source'} · {timeAgo(lead.createdAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                {lead.stage && <Badge color={lead.stage.color}>{lead.stage.name}</Badge>}
                <span className="hidden w-32 truncate text-right text-xs text-slate-500 sm:block">{lead.owner?.name ?? 'Unassigned'}</span>
              </div>
            </button>
          ))}
          {!isLoading && (data?.data.recentLeads ?? []).length === 0 && (
            <EmptyState title="No leads yet" description="New leads from Meta, Quick Add and uploads will appear here." />
          )}
        </div>
      </Card>
    </>
  )
}
