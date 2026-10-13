import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarCheck, ChevronRight, CircleDashed, Coffee, GraduationCap, Inbox, PhoneCall, PhoneOff, Receipt, ThumbsDown, ThumbsUp, Timer, UserCheck, Users, type LucideIcon } from 'lucide-react'
import dayjs from 'dayjs'
import { useDashboardSummaryQuery } from '../../services/miscApi'
import { Card, PageHeader } from '../../components/ui/misc'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/feedback'
import { StageBadge } from '../../components/ui/Badge'
import { STAGE_COLORS, stageColor } from '../../lib/stageColors'
import { KpiCard } from '../../components/ui/KpiCard'
import { useCurrentUser } from '../../app/hooks'
import { isCounsellor } from '../../lib/roles'
import { cn, fullName, timeAgo } from '../../lib/utils'
import type { DashboardRecentLead, DashboardStatusTile, DashboardSummary } from '../../types/models'

/** Query params of the lead list (`/app/leads?…`) a metric drills down to. */
type ListParams = Record<string, string>

/** A metric's share of a total, as the 0–100 length of its card's bar. */
const share = (part?: number, whole?: number) => (whole ? ((part ?? 0) / whole) * 100 : 0)

const day = (iso: string) => dayjs(iso).format('ddd D MMM')

function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

type PeriodKey = 'overall' | 'thisWeek' | 'today'

/** Pipeline cards: each shows the count of the stage of that name from the summary's `byStage` rows. */
const PIPELINE_CARDS: { label: string; icon: LucideIcon }[] = [
  { label: 'Connected', icon: PhoneCall },
  { label: 'Not Connected', icon: PhoneOff },
  { label: 'Interview', icon: CalendarCheck },
]
const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'overall', label: 'Overall' },
  { key: 'thisWeek', label: 'This Week' },
  { key: 'today', label: 'Today' },
]

/**
 * One switch, three cards: Total / Assigned / Unassigned for the chosen period
 * (all time, this week or today). Each card opens the list with the backend's
 * own date bounds, so it shows exactly the leads that were counted; a zero
 * card has nothing to open and stays inert.
 */
function LeadsSection({ summary, loading, onOpen }: { summary?: DashboardSummary; loading: boolean; onOpen: (params: ListParams) => void }) {
  const [key, setKey] = useState<PeriodKey>('overall')
  const period = summary?.[key]
  const hint = !summary
    ? undefined
    : key === 'thisWeek'
      ? `${day(summary.thisWeek.from ?? '')} – ${day(summary.thisWeek.to ?? '')}`
      : key === 'today'
        ? dayjs(summary.today.from).format('ddd D MMM YYYY')
        : undefined
  const range: ListParams = period?.from && period.to ? { created_from: period.from, created_to: period.to } : {}
  const tile = (value: number | undefined, extra: ListParams) => (value && period ? () => onOpen({ ...range, ...extra }) : undefined)

  return (
    <section aria-label="Leads">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">Leads</h2>
        <div className="flex flex-wrap items-center gap-2">
          {hint && <p className="text-xs text-slate-500">{hint}</p>}
          <div role="group" aria-label="Period" className="flex gap-1">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                aria-pressed={key === p.key}
                onClick={() => setKey(p.key)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  key === p.key
                    ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                    : 'border-slate-300 bg-white text-slate-600 hover:border-brand-300 hover:bg-brand-50/60 hover:text-brand-700'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <KpiCard
          label="Total Leads"
          value={period?.total}
          hint={key === 'overall' ? 'All time' : 'Created in this period'}
          icon={Users}
          loading={loading}
          onClick={tile(period?.total, {})}
        />
        <KpiCard
          label="Assigned Leads"
          value={period?.assigned}
          progress={share(period?.assigned, period?.total)}
          hint="Have a counsellor"
          icon={UserCheck}
          accent="green"
          loading={loading}
          onClick={tile(period?.assigned, { assigned: 'true' })}
        />
        <KpiCard
          label="Unassigned Leads"
          value={period?.unassigned}
          progress={share(period?.unassigned, period?.total)}
          hint="Waiting for an owner"
          icon={Inbox}
          accent="amber"
          loading={loading}
          onClick={tile(period?.unassigned, { unassigned: 'true' })}
        />
      </div>
    </section>
  )
}

const STATUS_TILES: { key: DashboardStatusTile['key']; label: string; icon: LucideIcon; accent: 'blue' | 'red' | 'green' }[] = [
  { key: 'interested', label: 'Interested', icon: ThumbsUp, accent: 'blue' },
  { key: 'notInterested', label: 'Not Interested', icon: ThumbsDown, accent: 'red' },
  { key: 'enrolled', label: 'Enrolled', icon: GraduationCap, accent: 'green' },
]

/** The summary's row for a stage of this name (case and surrounding spaces ignored). */
const stageRow = (summary: DashboardSummary | undefined, name: string) =>
  summary?.byStage.find((s) => s.name.trim().toLowerCase() === name.toLowerCase())

/** Seconds as "2h 15m" / "45m" / "0m". */
const duration = (seconds = 0) => {
  const mins = Math.round(seconds / 60)
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`
}

/**
 * Admission Counsellor's dashboard cards (their own leads): lead counts by stage,
 * then today's calling activity. Replaces the admin's Leads / Lead Status / Pipeline cards.
 */
function CounsellorCards({ summary, loading, onOpen }: { summary?: DashboardSummary; loading: boolean; onOpen: (params: ListParams) => void }) {
  const total = summary?.totals.total
  const activity = summary?.activityToday
  // every stage card reads its count straight from the summary's byStage rows (the Stage Distribution data)
  const stageCard = (name: string, icon: LucideIcon, accent?: 'amber') => {
    const stage = stageRow(summary, name)
    const stageId = stage?._id
    return (
      <KpiCard
        key={name}
        label={stage?.name ?? name}
        value={stage?.count}
        progress={share(stage?.count, total)}
        hint={stage ? 'Leads on this stage' : summary ? 'Stage not found in Masters' : undefined}
        icon={icon}
        accent={accent}
        color={STAGE_COLORS[name]}
        loading={loading}
        onClick={stage?.count && stageId ? () => onOpen({ stage: stageId }) : undefined}
      />
    )
  }
  return (
    <>
      <section aria-label="My Leads">
        <SectionHeading title="My Leads" hint="Leads assigned to you, all time" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          <KpiCard
            label="Total Leads"
            value={total}
            hint="All time"
            icon={Users}
            loading={loading}
            onClick={total ? () => onOpen({}) : undefined}
          />
          {stageCard('Untouched', CircleDashed, 'amber')}
          {stageCard('Interested', ThumbsUp)}
          {stageCard('Not Interested', ThumbsDown)}
          {stageCard('Registration & Fee', Receipt)}
          {stageCard('Enrolled', GraduationCap)}
        </div>
      </section>

      <section className="mt-5" aria-label="Today's Activity">
        <SectionHeading title="Today's Activity" hint="" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          {/* straight from the summary's activityToday; 0 until the backend sends it */}
          <KpiCard label="Total Calls Today" value={activity?.calls ?? 0} hint="Calls placed" icon={PhoneCall} accent="cyan" loading={loading} />
          <KpiCard label="Total Talk time Today" value={duration(activity?.talktimeSeconds)} hint="Time on calls" icon={Timer} accent="green" loading={loading} />
          <KpiCard label="Total Break Time Today" value={duration(activity?.breakSeconds)} hint="Time on break" icon={Coffee} accent="slate" loading={loading} />
        </div>
      </section>
    </>
  )
}

interface BarItem {
  id: string
  name: string
  count: number
  /** e.g. the stage colour, shown as a dot before the name */
  color?: string
  /** where the row drills down to; rows without one, or with no leads, are inert */
  params?: ListParams
}

/** Single-hue horizontal magnitude bars: identity on the label, value as length. */
function DistributionCard({
  title,
  hint,
  items,
  loading,
  onOpen,
}: {
  title: string
  hint?: string
  items: BarItem[] | undefined
  loading: boolean
  onOpen: (params: ListParams) => void
}) {
  const max = Math.max(1, ...(items ?? []).map((i) => i.count))
  return (
    <Card title={title} actions={hint ? <span className="text-xs text-slate-500">{hint}</span> : undefined}>
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      )}
      {!loading && (items ?? []).length === 0 && <p className="py-6 text-center text-xs text-slate-400">No Data Yet</p>}
      <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
        {items?.map((item) => {
          const params = item.params
          const open = item.count > 0 && params ? () => onOpen(params) : undefined
          return (
            <button
              key={item.id}
              type="button"
              onClick={open}
              disabled={!open}
              title={open ? `Open ${item.name} leads` : undefined}
              className="group block w-full rounded-md text-left disabled:cursor-default"
            >
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="flex min-w-0 items-center gap-1 text-slate-600 group-enabled:group-hover:text-brand-700">
                  {item.color && <span aria-hidden className="mr-0.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />}
                  <span className="truncate">{item.name}</span>
                  {open && <ChevronRight className="h-3 w-3 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />}
                </span>
                <span className="font-semibold tabular-nums text-slate-700">{item.count.toLocaleString()}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-linear-to-r from-brand-500 to-brand-600 transition-all"
                  style={{ width: `${item.count ? Math.max(2, (item.count / max) * 100) : 0}%` }}
                />
              </div>
            </button>
          )
        })}
      </div>
    </Card>
  )
}

/** The newest leads in scope; a row opens the lead, "View all" opens the list. */
function RecentLeadsCard({
  leads,
  loading,
  onOpenLead,
  onViewAll,
  className,
}: {
  leads: DashboardRecentLead[] | undefined
  loading: boolean
  onOpenLead: (id: string) => void
  onViewAll: () => void
  className?: string
}) {
  return (
    <Card
      className={className}
      bodyClassName="p-0"
      title="Recent Leads"
      actions={
        <button type="button" onClick={onViewAll} className="text-xs font-medium text-brand-600 hover:underline">
          View All
        </button>
      }
    >
      {/* same height as a DistributionCard (its padded 24rem list), scrolling past that */}
      <div className="max-h-104 divide-y divide-slate-100 overflow-y-auto">
        {loading &&
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-4 py-3">
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        {leads?.map((lead) => (
          <button
            key={lead._id}
            type="button"
            onClick={() => onOpenLead(lead._id)}
            title={`Open ${fullName(lead)}`}
            className="group flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-800 group-hover:text-brand-700">
                {fullName(lead)} <span className="text-xs font-normal text-slate-400">{lead.leadNo}</span>
              </p>
              <p className="text-xs text-slate-500">
                {lead.source?.name ?? 'No source'} · {timeAgo(lead.createdAt)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {lead.stage && <StageBadge stage={lead.stage} />}
              <span className="hidden w-32 truncate text-right text-xs text-slate-500 sm:block">{lead.owner?.name ?? 'Unassigned'}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600" />
            </div>
          </button>
        ))}
        {!loading && (leads ?? []).length === 0 && (
          <EmptyState title="No Leads Yet" description="New leads from Meta, Quick Add and uploads will appear here." />
        )}
      </div>
    </Card>
  )
}

export default function DashboardPage() {
  const user = useCurrentUser()
  const counsellor = isCounsellor(user)
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

  const summary = data?.data
  const open = (params: ListParams) => navigate(`/app/leads?${new URLSearchParams(params).toString()}`)
  const openLead = (id: string) => navigate(`/app/leads/${id}`)
  const viewAllLeads = () => navigate('/app/leads')
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

  const sources: BarItem[] | undefined = summary?.bySource.map((s) => {
    // the "No source" row has no id: it lists the leads whose source is empty
    const params: ListParams = s._id ? { source: s._id } : { filters: JSON.stringify([{ field: 'source', op: 'empty' }]) }
    return { id: s._id ?? 'none', name: s.name, count: s.count, params }
  })
  const owners: BarItem[] | undefined = counsellor ? undefined : summary?.byOwner.map((o) => ({ id: o._id, name: o.name, count: o.count, params: { owner: o._id } }))
  const stages: BarItem[] | undefined = summary?.byStage.map((s) => {
    // the "No stage" row has no id: it lists the leads whose stage is empty
    const params: ListParams = s._id ? { stage: s._id } : { filters: JSON.stringify([{ field: 'stage', op: 'empty' }]) }
    return { id: s._id ?? 'none', name: s.name, count: s.count, color: stageColor(s), params }
  })

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
        </div>
      </section>

      {counsellor ? (
        <CounsellorCards summary={summary} loading={isLoading} onOpen={open} />
      ) : (
        <>
          <LeadsSection summary={summary} loading={isLoading} onOpen={open} />

          <section className="mt-5" aria-label="Lead Status">
            <SectionHeading title="Lead Status" hint="By stage, all time" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              {STATUS_TILES.map(({ key, label, icon, accent }) => {
                const tile = summary?.leadStatus.find((t) => t.key === key)
                const stageId = tile?.stageId
                return (
                  <KpiCard
                    key={key}
                    label={tile?.name ?? label}
                    value={tile?.count}
                    progress={share(tile?.count, summary?.totals.total)}
                    hint={stageId ? 'Leads on this stage' : summary ? 'Stage not found in Masters' : undefined}
                    icon={icon}
                    accent={accent}
                    color={STAGE_COLORS[tile?.name ?? label]}
                    loading={isLoading}
                    onClick={tile?.count && stageId ? () => open({ stage: stageId }) : undefined}
                  />
                )
              })}
            </div>
          </section>

          <section className="mt-5" aria-label="Pipeline">
            <SectionHeading title="Pipeline" hint="By stage, all time" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              {PIPELINE_CARDS.map(({ label, icon }) => {
                const stage = stageRow(summary, label)
                const stageId = stage?._id
                return (
                  <KpiCard
                    key={label}
                    label={stage?.name ?? label}
                    value={stage?.count}
                    progress={share(stage?.count, summary?.totals.total)}
                    hint={stage ? 'Leads on this stage' : summary ? 'Stage not found in Masters' : undefined}
                    icon={icon}
                    color={STAGE_COLORS[label]}
                    loading={isLoading}
                    onClick={stage?.count && stageId ? () => open({ stage: stageId }) : undefined}
                  />
                )
              })}
            </div>
          </section>
        </>
      )}

      {/* A counsellor only ever sees their own leads, so "Leads by Counsellor" is dropped and
          Recent Leads takes its row; an admin keeps all three charts with Recent Leads below. */}
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <DistributionCard title="Lead Source Analytics" hint="Highest volume first" items={sources} loading={isLoading} onOpen={open} />
        {!counsellor && <DistributionCard title="Leads by Counsellor" hint="Highest volume first" items={owners} loading={isLoading} onOpen={open} />}
        <DistributionCard title="Stage Distribution" hint="In stage order" items={stages} loading={isLoading} onOpen={open} />
        {counsellor && <RecentLeadsCard leads={summary?.recentLeads} loading={isLoading} onOpenLead={openLead} onViewAll={viewAllLeads} />}
      </div>

      {!counsellor && <RecentLeadsCard className="mt-4" leads={summary?.recentLeads} loading={isLoading} onOpenLead={openLead} onViewAll={viewAllLeads} />}
    </>
  )
}
