import { useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarCheck, ChevronRight, CircleDashed, Coffee, GraduationCap, Inbox, PhoneCall, PhoneOff, Receipt, ThumbsDown, ThumbsUp, Timer, UserCheck, Users, type LucideIcon } from 'lucide-react'
import dayjs from 'dayjs'
import { useDashboardSummaryQuery } from '../../services/miscApi'
import { useListLeadsQuery, type LeadListParams } from '../../services/leadsApi'
import { useMasterBootstrapQuery } from '../../services/mastersApi'
import { Card, PageHeader } from '../../components/ui/misc'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/feedback'
import { StageBadge } from '../../components/ui/Badge'
import { STAGE_COLORS, stageColor, textOn } from '../../lib/stageColors'
import { KpiCard } from '../../components/ui/KpiCard'
import { useCurrentUser } from '../../app/hooks'
import { isCounsellor } from '../../lib/roles'
import { cn, fullName, timeAgo } from '../../lib/utils'
import type { DashboardRecentLead, DashboardStatusTile, DashboardSummary, Stage } from '../../types/models'

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

/** A period's local YYYY-MM-DD bounds (inclusive), as the lead list's created-date params. */
type DateBounds = { created_from: string; created_to: string }

/**
 * The bounds of a period: the week / day bounds the backend used for its figures.
 * None for all time, or until the summary has arrived.
 */
function periodBounds(summary: DashboardSummary | undefined, key: PeriodKey): DateBounds | undefined {
  const period = summary?.[key]
  return period?.from && period.to ? { created_from: period.from, created_to: period.to } : undefined
}

/** "Wed 1 Oct – Tue 14 Oct", or the full date when the bounds are a single day. */
const boundsHint = (bounds?: DateBounds) =>
  !bounds
    ? undefined
    : bounds.created_from === bounds.created_to
      ? dayjs(bounds.created_from).format('ddd D MMM YYYY')
      : `${day(bounds.created_from)} – ${day(bounds.created_to)}`

/**
 * The number of leads matching `params`, read off a one-row page of the list.
 * The summary breaks only the all-time figures down by stage, so the counsellor's
 * week and today stage counts are read this way.
 * Without params nothing is requested; `loading` is true until the count arrives.
 */
function useLeadCount(params?: LeadListParams): { count?: number; loading: boolean } {
  const { currentData, isFetching } = useListLeadsQuery({ ...params, page_size: 1 }, { skip: !params })
  if (!params) return { count: undefined, loading: false }
  return { count: currentData?.pagination.total_results, loading: isFetching && currentData === undefined }
}

/** A section's title with the period pills, and the chosen period's dates, on the right. */
function PeriodSectionHeader({ title, value, onChange, hint }: { title: string; value: PeriodKey; onChange: (key: PeriodKey) => void; hint?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
      <div className="flex flex-wrap items-center gap-2">
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
        <div role="group" aria-label="Period" className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={value === p.key}
              onClick={() => onChange(p.key)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                value === p.key
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
  )
}

/**
 * The period switch's state and what the chosen period gives a section: the
 * summary's figures for it, its bounds, the caption naming its dates, and the list
 * params its cards open with, so they show exactly the leads that were counted.
 */
function usePeriod(summary?: DashboardSummary) {
  const [key, setKey] = useState<PeriodKey>('overall')
  const bounds = periodBounds(summary, key)
  const range: ListParams = bounds ?? {}
  return { key, setKey, bounds, range, period: summary?.[key], hint: boundsHint(bounds) }
}

/**
 * One switch, three cards: Total / Assigned / Unassigned for the chosen period
 * (all time, this week or today). Each card opens the list with the backend's
 * own date bounds, so it shows exactly the leads that were counted; a zero
 * card has nothing to open and stays inert.
 */
function LeadsSection({ summary, loading, onOpen }: { summary?: DashboardSummary; loading: boolean; onOpen: (params: ListParams) => void }) {
  const { key, setKey, range, period, hint } = usePeriod(summary)
  const tile = (value: number | undefined, extra: ListParams) => (value && period ? () => onOpen({ ...range, ...extra }) : undefined)

  return (
    <section aria-label="Leads">
      <PeriodSectionHeader title="Leads" value={key} onChange={setKey} hint={hint} />
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

/** The counsellor's stage cards, in display order. */
const MY_LEADS_STAGES: { name: string; icon: LucideIcon; accent?: 'amber' }[] = [
  { name: 'Untouched', icon: CircleDashed, accent: 'amber' },
  { name: 'Interested', icon: ThumbsUp },
  { name: 'Not Interested', icon: ThumbsDown },
  { name: 'Registration & Fee', icon: Receipt },
  { name: 'Enrolled', icon: GraduationCap },
]

/**
 * One of the counsellor's stage cards: how many of their leads created in the chosen
 * period sit on the named stage. All time that is the summary's byStage row (the Stage
 * Distribution data); the summary has no per-stage split for the other periods, so
 * those are counted off the list, filtered by the stage and the period's bounds —
 * the very list the card opens.
 */
function CounsellorStageCard({
  name,
  icon,
  accent,
  summary,
  total,
  bounds,
  loading,
  onOpen,
}: {
  name: string
  icon: LucideIcon
  accent?: 'amber'
  summary?: DashboardSummary
  /** the period's lead count, for the card's share bar */
  total?: number
  bounds?: DateBounds
  loading: boolean
  onOpen: (params: ListParams) => void
}) {
  const stage = stageRow(summary, name)
  const stageId = stage?._id
  const counted = useLeadCount(bounds && stageId ? { ...bounds, stage: stageId } : undefined)
  const count = !bounds ? stage?.count : stageId ? counted.count : 0
  return (
    <KpiCard
      label={stage?.name ?? name}
      value={count}
      progress={share(count, total)}
      hint="Leads on this stage"
      icon={icon}
      accent={accent}
      color={STAGE_COLORS[name]}
      loading={loading || counted.loading}
      onClick={count && stageId ? () => onOpen({ ...(bounds ?? {}), stage: stageId }) : undefined}
    />
  )
}

/**
 * Admission Counsellor's dashboard cards (their own leads): the lead count and the
 * counts by stage for the chosen period, behind the same period switch as the admin's
 * Leads section, then today's calling activity. Replaces the admin's Leads / Lead
 * Status / Pipeline cards.
 */
function CounsellorCards({ summary, loading, onOpen }: { summary?: DashboardSummary; loading: boolean; onOpen: (params: ListParams) => void }) {
  const { key, setKey, bounds, range, period, hint } = usePeriod(summary)
  const total = period?.total
  const activity = summary?.activityToday
  return (
    <>
      <section aria-label="My Leads">
        <PeriodSectionHeader
          title="My Leads"
          value={key}
          onChange={setKey}
          hint={key === 'overall' ? 'Assigned to you, all time' : hint && `Assigned to you, created ${hint}`}
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          <KpiCard
            label="Total Leads"
            value={total}
            hint={key === 'overall' ? 'All time' : 'Created in this period'}
            icon={Users}
            loading={loading}
            onClick={total ? () => onOpen(range) : undefined}
          />
          {MY_LEADS_STAGES.map((s) => (
            <CounsellorStageCard key={s.name} {...s} summary={summary} total={total} bounds={bounds} loading={loading} onOpen={onOpen} />
          ))}
        </div>
      </section>

      <section className="mt-5" aria-label="Today's Activity">
        <SectionHeading title="Today's Activity" hint="" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          {/* straight from the summary's activityToday; 0 until the backend sends it */}
          <KpiCard label="Total Calls Today" value={activity?.calls ?? 0} progress={activity?.calls ? 100 : 0} hint="Calls placed" icon={PhoneCall} accent="cyan" loading={loading} />
          <KpiCard label="Total Talk time Today" value={duration(activity?.talktimeSeconds)} progress={activity?.talktimeSeconds ? 100 : 0} hint="Time on calls" icon={Timer} accent="green" loading={loading} />
          <KpiCard label="Total Break Time Today" value={duration(activity?.breakSeconds)} progress={activity?.breakSeconds ? 100 : 0} hint="Time on break" icon={Coffee} accent="slate" loading={loading} />
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

/**
 * Every active master stage with its count from the summary's byStage rows (0 when the
 * summary has no row for it), plus any summary row for a stage no longer in Masters or
 * for "No stage", highest count first; ties keep the Masters order.
 */
function allStagesByCount(stages: Stage[], byStage: DashboardSummary['byStage']): DashboardSummary['byStage'] {
  const counted = new Map(byStage.map((row) => [row._id, row.count]))
  const known = new Set(stages.map((s) => s._id))
  const rows = [...stages]
    .filter((s) => s.isActive !== false)
    .sort((a, b) => a.order - b.order)
    .map((s) => ({ _id: s._id, name: s.name, color: s.color, count: counted.get(s._id) ?? 0 }))
  const extra = byStage.filter((row) => !row._id || !known.has(row._id))
  return [...rows, ...extra].sort((a, b) => b.count - a.count)
}

/**
 * The conversion funnel's stage steps, in order, after "Total Leads". `names` are the
 * master stage names a step matches, first preferred (the stage may be named either way).
 */
const FUNNEL_STAGES: { label: string; names: string[] }[] = [
  { label: 'Interested', names: ['Interested'] },
  { label: 'Prospects (Hot)', names: ['Prospects (Hot)', 'Prospects'] },
  { label: 'Registration Fees Done', names: ['Registration Fees Done', 'Registration & Fee'] },
  { label: 'Enrolled', names: ['Enrolled'] },
]

interface FunnelStep {
  label: string
  count: number
  /** the stage colour; none for Total Leads, drawn in the brand colour */
  color?: string
  /** where the step drills down to; a step without one, or with no leads, is inert */
  params?: ListParams
}

/** The brand colour (brand-600), for the funnel's Total Leads band. */
const BRAND = '#3d1f73'

/**
 * The funnel's drawing: a cone of three bands narrowing into a stem of two, in a
 * 360 × 290 box. The cone's half-width shrinks from 150 at the top to the stem's
 * 30 where they meet; the last band ends in a point.
 */
const FUNNEL = { w: 360, h: 290, cx: 190, stemHalf: 30, coneBottom: 174 }
const coneHalf = (y: number) => 150 - ((150 - FUNNEL.stemHalf) * y) / FUNNEL.coneBottom
/** each band's top and bottom, with a 2px gap between bands; the stem bands are the last two */
const BANDS: { y0: number; y1: number; stem: boolean }[] = [
  { y0: 0, y1: 56, stem: false },
  { y0: 58, y1: 114, stem: false },
  { y0: 116, y1: 172, stem: false },
  { y0: 176, y1: 226, stem: true },
  { y0: 228, y1: 268, stem: true },
]
function bandPoints({ y0, y1, stem }: (typeof BANDS)[number], last: boolean): string {
  const { cx, stemHalf, h } = FUNNEL
  if (!stem) {
    const a = coneHalf(y0)
    const b = coneHalf(y1)
    return `${cx - a},${y0} ${cx + a},${y0} ${cx + b},${y1} ${cx - b},${y1}`
  }
  const points = [`${cx - stemHalf},${y0}`, `${cx + stemHalf},${y0}`, `${cx + stemHalf},${y1}`]
  if (last) points.push(`${cx},${h}`)
  points.push(`${cx - stemHalf},${y1}`)
  return points.join(' ')
}

/**
 * Conversion funnel: a funnel-shaped chart, one band per step from Total Leads at the
 * wide top down to Enrolled at the tip, each filled with its stage's colour and showing
 * its count (the summary's figure, or 0). The two stem bands are too narrow for their
 * names, which sit beside them. A band with leads opens their list.
 */
function FunnelCard({ steps, loading, onOpen }: { steps: FunnelStep[] | undefined; loading: boolean; onOpen: (params: ListParams) => void }) {
  const { w, h, cx, stemHalf } = FUNNEL
  return (
    <Card title="Conversion Funnel" actions={<span className="text-xs text-slate-500">All time</span>}>
      {loading && <Skeleton className="mx-auto h-64 w-5/6" />}
      {!loading && !steps && <p className="py-6 text-center text-xs text-slate-400">No Data Yet</p>}
      {!loading && steps && (
        <svg viewBox={`0 0 ${w} ${h}`} role="group" aria-label="Conversion funnel" className="mx-auto block h-auto w-full max-w-sm">
          {steps.map((step, i) => {
            const band = BANDS[i]
            if (!band) return null
            const params = step.params
            const open = step.count > 0 && params ? () => onOpen(params) : undefined
            const fill = step.color ?? BRAND
            const ink = textOn(fill)
            const figure = step.count.toLocaleString()
            const mid = (band.y0 + band.y1) / 2
            const onKeyDown = open
              ? (e: KeyboardEvent<SVGGElement>) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    open()
                  }
                }
              : undefined
            return (
              <g
                key={step.label}
                role={open ? 'button' : undefined}
                tabIndex={open ? 0 : undefined}
                aria-label={`${step.label}: ${figure}`}
                onClick={open}
                onKeyDown={onKeyDown}
                className={cn('outline-none', open && 'cursor-pointer hover:opacity-80 focus-visible:opacity-80')}
              >
                {open && <title>{`Open ${step.label} leads`}</title>}
                <polygon points={bandPoints(band, i === BANDS.length - 1)} fill={fill} stroke="#fff" strokeWidth={2} strokeLinejoin="round" />
                {band.stem ? (
                  <>
                    <line x1={cx - stemHalf - 12} y1={mid} x2={cx - stemHalf - 1} y2={mid} stroke="#94a3b8" strokeWidth={1} />
                    <text x={cx - stemHalf - 16} y={mid + 4} textAnchor="end" fontSize={11} fill="#475569">
                      {step.label}
                    </text>
                    <text x={cx} y={mid + 4} textAnchor="middle" fontSize={11} fontWeight={600} fill={ink}>
                      {figure}
                    </text>
                  </>
                ) : (
                  <>
                    <text x={cx} y={mid - 3} textAnchor="middle" fontSize={12} fontWeight={600} fill={ink}>
                      {step.label}
                    </text>
                    <text x={cx} y={mid + 12} textAnchor="middle" fontSize={11} fill={ink} fillOpacity={0.9}>
                      {figure}
                    </text>
                  </>
                )}
              </g>
            )
          })}
        </svg>
      )}
    </Card>
  )
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
  // Stage Distribution lists every master stage, so it needs the Masters too
  const { data: masters, isLoading: mastersLoading } = useMasterBootstrapQuery()

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
  // `from=dashboard` tells the list it is a dashboard drill-down, so it offers a way back
  const open = (params: ListParams) => navigate(`/app/leads?${new URLSearchParams({ ...params, from: 'dashboard' }).toString()}`)
  const openLead = (id: string) => navigate(`/app/leads/${id}`)
  const viewAllLeads = () => navigate('/app/leads')
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

  const sources: BarItem[] | undefined = summary?.bySource.map((s) => {
    // the "No source" row has no id: it lists the leads whose source is empty
    const params: ListParams = s._id ? { source: s._id } : { filters: JSON.stringify([{ field: 'source', op: 'empty' }]) }
    return { id: s._id ?? 'none', name: s.name, count: s.count, params }
  })
  const owners: BarItem[] | undefined = counsellor ? undefined : summary?.byOwner.map((o) => ({ id: o._id, name: o.name, count: o.count, params: { owner: o._id } }))
  // every master stage, zero-lead ones included, highest first (the summary only has rows for stages holding leads)
  const stages: BarItem[] | undefined =
    summary &&
    masters &&
    allStagesByCount(masters.data.stages, summary.byStage).map((s) => {
      // the "No stage" row has no id: it lists the leads whose stage is empty
      const params: ListParams = s._id ? { stage: s._id } : { filters: JSON.stringify([{ field: 'stage', op: 'empty' }]) }
      return { id: s._id ?? 'none', name: s.name, count: s.count, color: stageColor(s), params }
    })
  // Total Leads, then each funnel stage with the count, colour and drill-down of its stage row
  const funnel: FunnelStep[] | undefined =
    summary &&
    stages && [
      { label: 'Total Leads', count: summary.totals.total, params: {} },
      ...FUNNEL_STAGES.map(({ label, names }) => {
        const row = stages.find((s) => names.some((n) => n.toLowerCase() === s.name.trim().toLowerCase()))
        return { label, count: row?.count ?? 0, color: row?.color ?? STAGE_COLORS[names[0]], params: row?.params }
      }),
    ]

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
                    hint="Leads on this stage"
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
                    hint="Leads on this stage"
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

      {/* A counsellor only ever sees their own leads, so "Leads by Counsellor" is dropped and the
          Conversion Funnel takes its slot; an admin keeps all three charts. Both get Recent Leads in a full-width row below. */}
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <DistributionCard title="Lead Source Analytics" hint="Highest volume first" items={sources} loading={isLoading} onOpen={open} />
        {!counsellor && <DistributionCard title="Leads by Counsellor" hint="Highest volume first" items={owners} loading={isLoading} onOpen={open} />}
        <DistributionCard title="Stage Distribution" hint="Highest volume first" items={stages} loading={isLoading || mastersLoading} onOpen={open} />
        {counsellor && <FunnelCard steps={funnel} loading={isLoading || mastersLoading} onOpen={open} />}
      </div>

      <RecentLeadsCard className="mt-4" leads={summary?.recentLeads} loading={isLoading} onOpenLead={openLead} onViewAll={viewAllLeads} />
    </>
  )
}
