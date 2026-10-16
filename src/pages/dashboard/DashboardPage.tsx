import { useEffect, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarCheck, ChevronRight, CircleDashed, Coffee, GraduationCap, Inbox, PhoneCall, PhoneOff, Receipt, ThumbsDown, ThumbsUp, Timer, UserCheck, Users, type LucideIcon } from 'lucide-react'
import dayjs from 'dayjs'
import { useDashboardSummaryQuery } from '../../services/miscApi'
import { leadsApi, useListLeadsQuery, type LeadListParams } from '../../services/leadsApi'
import { useMasterBootstrapQuery } from '../../services/mastersApi'
import { Card, PageHeader } from '../../components/ui/misc'
import { DateRangeFilter } from '../../components/ui/DateRangeFilter'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/feedback'
import { StageBadge } from '../../components/ui/Badge'
import { STAGE_COLORS, stageColor } from '../../lib/stageColors'
import { KpiCard } from '../../components/ui/KpiCard'
import { useAppDispatch, useCurrentUser } from '../../app/hooks'
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

type PeriodKey = 'overall' | 'thisWeek' | 'today' | 'custom'

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
/** The dates typed into the "Custom" picker; empty until chosen. */
type CustomRange = { from: string; to: string }
const NO_CUSTOM: CustomRange = { from: '', to: '' }

/**
 * The bounds of a period: the dates of the custom range once both are chosen, or the
 * week / day bounds the backend used for its figures. None for all time, or until the
 * summary has arrived.
 */
function periodBounds(summary: DashboardSummary | undefined, key: PeriodKey, custom: CustomRange): DateBounds | undefined {
  if (key === 'custom') return custom.from && custom.to ? { created_from: custom.from, created_to: custom.to } : undefined
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

/**
 * The lead counts of several list queries at once (one-row pages, as useLeadCount),
 * in the order given; undefined while they load or when nothing is asked. The
 * requests go through the API cache, so a row already counted by a card is not
 * fetched again.
 */
function useLeadCounts(paramsList: LeadListParams[] | undefined): number[] | undefined {
  const dispatch = useAppDispatch()
  const key = paramsList ? JSON.stringify(paramsList) : ''
  const [state, setState] = useState<{ key: string; counts: number[] }>()
  useEffect(() => {
    if (!paramsList || !key) return
    let live = true
    const requests = paramsList.map((p) => dispatch(leadsApi.endpoints.listLeads.initiate({ ...p, page_size: 1 })))
    Promise.all(requests.map((r) => r.unwrap()))
      .then((pages) => live && setState({ key, counts: pages.map((page) => page.pagination.total_results) }))
      .catch(() => live && setState({ key, counts: paramsList.map(() => 0) }))
    return () => {
      live = false
      requests.forEach((r) => r.unsubscribe())
    }
    // `key` stands in for paramsList, which is a fresh array on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, dispatch])
  return state?.key === key ? state.counts : undefined
}

/**
 * Chart rows for the chosen period: the summary's own rows for all time; otherwise
 * each row counted off the list within the bounds, its drill-down bounded the same
 * way, re-sorted highest first. Undefined while the counts load.
 */
function usePeriodRows(rows: BarItem[] | undefined, bounds?: DateBounds): BarItem[] | undefined {
  const counts = useLeadCounts(bounds && rows ? rows.map((r) => ({ ...r.params, ...bounds })) : undefined)
  if (!bounds) return rows
  if (!rows || !counts) return undefined
  return rows
    .map((r, i) => ({ ...r, count: counts[i] ?? 0, params: r.params && { ...r.params, ...bounds } }))
    .sort((a, b) => b.count - a.count)
}

/** A section's title with the custom date picker, the period pills and the chosen period's dates on the right. */
function PeriodSectionHeader({
  title,
  value,
  onChange,
  custom,
  onCustomChange,
  hint,
}: {
  title: string
  value: PeriodKey
  onChange: (key: PeriodKey) => void
  custom: CustomRange
  onCustomChange: (from: string, to: string) => void
  hint?: string
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
      <div className="flex flex-wrap items-center gap-2">
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
        {/* any range the pills don't offer; its button shows the dates while one is set */}
        <DateRangeFilter label="Custom Date" heading="Created Between" align="right" from={custom.from} to={custom.to} onChange={onCustomChange} />
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
  const [custom, setCustomRange] = useState<CustomRange>(NO_CUSTOM)
  // a pill drops the custom range; a complete custom range takes over from the pills, and clearing it goes back to all time
  const choose = (next: PeriodKey) => {
    setKey(next)
    setCustomRange(NO_CUSTOM)
  }
  const setCustom = (from: string, to: string) => {
    setCustomRange({ from, to })
    setKey(from && to ? 'custom' : key === 'custom' ? 'overall' : key)
  }
  const bounds = periodBounds(summary, key, custom)
  const range: ListParams = bounds ?? {}
  // the summary has figures for its own periods only; a custom range is counted off the list by the sections
  const period = key === 'custom' ? undefined : summary?.[key]
  return { key, setKey: choose, custom, setCustom, bounds, range, period, hint: boundsHint(bounds) }
}
/** The page's period switch state, shared by every section. */
type PeriodState = ReturnType<typeof usePeriod>

/**
 * One switch, three cards: Total / Assigned / Unassigned for the chosen period.
 * All time, this week and today come from the summary; a custom range, which
 * the summary lacks, is counted off the list. Each card opens the list with the
 * period's bounds, so it shows exactly the leads that were counted; a zero
 * card has nothing to open and stays inert.
 */
function LeadsSection({ period: state, loading, onOpen }: { period: PeriodState; loading: boolean; onOpen: (params: ListParams) => void }) {
  const { key, setKey, custom, setCustom, bounds, range, period, hint } = state
  const counted = key === 'custom' ? bounds : undefined
  const total = useLeadCount(counted)
  const assigned = useLeadCount(counted && { ...counted, assigned: 'true' })
  const unassigned = useLeadCount(counted && { ...counted, unassigned: 'true' })
  const figures = period ?? { total: total.count, assigned: assigned.count, unassigned: unassigned.count }
  const busy = loading || total.loading || assigned.loading || unassigned.loading
  const tile = (value: number | undefined, extra: ListParams) => (value ? () => onOpen({ ...range, ...extra }) : undefined)

  return (
    <section aria-label="Leads">
      <PeriodSectionHeader title="Leads" value={key} onChange={setKey} custom={custom} onCustomChange={setCustom} hint={hint} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <KpiCard
          label="Total Leads"
          value={figures.total}
          hint={key === 'overall' ? 'All time' : 'Created in this period'}
          icon={Users}
          loading={busy}
          onClick={tile(figures.total, {})}
        />
        <KpiCard
          label="Assigned Leads"
          value={figures.assigned}
          progress={share(figures.assigned, figures.total)}
          hint="Have a counsellor"
          icon={UserCheck}
          accent="green"
          loading={busy}
          onClick={tile(figures.assigned, { assigned: 'true' })}
        />
        <KpiCard
          label="Unassigned Leads"
          value={figures.unassigned}
          progress={share(figures.unassigned, figures.total)}
          hint="Waiting for an owner"
          icon={Inbox}
          accent="amber"
          loading={busy}
          onClick={tile(figures.unassigned, { unassigned: 'true' })}
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
function CounsellorCards({ summary, period: state, loading, onOpen }: { summary?: DashboardSummary; period: PeriodState; loading: boolean; onOpen: (params: ListParams) => void }) {
  const { key, setKey, custom, setCustom, bounds, range, period, hint } = state
  // the summary has no figure for a custom range: count it off the list
  const counted = useLeadCount(key === 'custom' ? bounds : undefined)
  const total = period ? period.total : counted.count
  const activity = summary?.activityToday
  return (
    <>
      <section aria-label="My Leads">
        <PeriodSectionHeader
          title="My Leads"
          value={key}
          onChange={setKey}
          custom={custom}
          onCustomChange={setCustom}
          hint={hint}
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          <KpiCard
            label="Total Leads"
            value={total}
            hint={key === 'overall' ? 'All time' : 'Created in this period'}
            icon={Users}
            loading={loading || counted.loading}
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

/** The dot for a stage with neither a palette nor a usable Masters colour (e.g. Untouched), so every row has one. */
const NEUTRAL_STAGE_DOT = '#94a3b8'

/** Sources kept off the Lead Source Analytics card for now, by name (lower-case) — temporary, on request. */
const HIDDEN_SOURCES = new Set(['direct', 'no source'])

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
  /** where the step drills down to; a step without one, or with no leads, is inert */
  params?: ListParams
}

/**
 * The funnel's drawing: an inverted triangle in a 400 × 290 box, 224 wide at the top
 * and pointed at the bottom, cut into five bands of equal height with a 2px gap. The
 * space left of it holds the bands' names.
 */
const FUNNEL = { w: 400, h: 290, cx: 282, halfTop: 112 }
const halfAt = (y: number) => FUNNEL.halfTop * (1 - y / FUNNEL.h)
/** each band's top and bottom; the last runs to the tip */
const BANDS: { y0: number; y1: number }[] = [
  { y0: 0, y1: 56 },
  { y0: 58, y1: 114 },
  { y0: 116, y1: 172 },
  { y0: 174, y1: 230 },
  { y0: 232, y1: 290 },
]
/** the bands' fills, top to bottom: the brand purple, lighter at the top and deepest at the tip, all dark enough for white counts */
const BAND_FILLS = ['#7f5fbb', '#6a48aa', '#5f3d9e', '#4b2d87', '#3d1f73']
/** where every band's name ends (right-aligned), left of the funnel */
const LABEL_X = 142
/** the bands' text: names beside the funnel in near-black, counts inside in white */
const LABEL_INK = '#0F172A'
const COUNT_INK = '#FFFFFF'

function bandPoints({ y0, y1 }: (typeof BANDS)[number], last: boolean): string {
  const { cx, h } = FUNNEL
  const a = halfAt(y0)
  if (last) return `${cx - a},${y0} ${cx + a},${y0} ${cx},${h}`
  const b = halfAt(y1)
  return `${cx - a},${y0} ${cx + a},${y0} ${cx + b},${y1} ${cx - b},${y1}`
}

/**
 * Conversion funnel: an inverted triangle, one band per step from Total Leads at the
 * wide top down to Enrolled at the tip, shaded from lighter to deep purple on the way
 * down. Every band's name sits beside the funnel in black, joined to it by a thin
 * line; its count (the summary's figure, or 0) sits inside in white. A band with
 * leads opens their list.
 */
function FunnelCard({ steps, hint, loading, onOpen }: { steps: FunnelStep[] | undefined; hint?: string; loading: boolean; onOpen: (params: ListParams) => void }) {
  const { w, h, cx } = FUNNEL
  return (
    <Card
      title="Conversion Funnel"
      actions={hint && <span className="text-xs text-slate-500">{hint}</span>}
      // the card stretches to its row's height; the funnel sits in the middle of that
      className="flex flex-col"
      bodyClassName="flex flex-1 items-center justify-center"
    >
      {loading && <Skeleton className="mx-auto h-64 w-5/6" />}
      {!loading && !steps && <p className="py-6 text-center text-xs text-slate-400">No Data Yet</p>}
      {!loading && steps && (
        <svg viewBox={`0 0 ${w} ${h}`} role="group" aria-label="Conversion funnel" className="mx-auto block h-auto w-full max-w-sm">
          {steps.map((step, i) => {
            const band = BANDS[i]
            const fill = BAND_FILLS[i]
            if (!band || !fill) return null
            const params = step.params
            const open = step.count > 0 && params ? () => onOpen(params) : undefined
            const figure = step.count.toLocaleString()
            const last = i === BANDS.length - 1
            const mid = (band.y0 + band.y1) / 2
            // the tip narrows to nothing, so its count and side label sit near its top
            const anchorY = last ? band.y0 + 18 : mid
            const edge = cx - halfAt(anchorY)
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
                <polygon points={bandPoints(band, last)} fill={fill} stroke="#fff" strokeWidth={2} strokeLinejoin="round" />
                <line x1={LABEL_X + 6} y1={anchorY} x2={edge - 2} y2={anchorY} stroke="#94a3b8" strokeWidth={1} />
                <text x={LABEL_X} y={anchorY + 4} textAnchor="end" fontSize={12} fontWeight={500} fill={LABEL_INK}>
                  {step.label}
                </text>
                {/* a halo in the band's colour keeps a wide count readable where it spills past the narrow tip */}
                <text x={cx} y={anchorY + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill={COUNT_INK} stroke={fill} strokeWidth={3} paintOrder="stroke">
                  {figure}
                </text>
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
  const summary = data?.data

  // One period for the whole page: the switch sits in the Leads / My Leads section, but every
  // card and chart follows it. The summary carries all-time rows only (plus week and day
  // totals), so for any other period each row is counted off the list.
  const period = usePeriod(summary)
  const { key, bounds, range } = period
  const allTime = !bounds

  // the id-less row is "No source" (leads with the field empty); it is hidden for now along with the named ones
  const sourceRows: BarItem[] | undefined = summary?.bySource
    .filter((s) => s._id && !HIDDEN_SOURCES.has(s.name.trim().toLowerCase()))
    .map((s) => {
      // the "No source" row has no id: it lists the leads whose source is empty
      const params: ListParams = s._id ? { source: s._id } : { filters: JSON.stringify([{ field: 'source', op: 'empty' }]) }
      return { id: s._id ?? 'none', name: s.name, count: s.count, params }
    })
  const ownerRows: BarItem[] | undefined = counsellor ? undefined : summary?.byOwner.map((o) => ({ id: o._id, name: o.name, count: o.count, params: { owner: o._id } }))
  const stageRows: BarItem[] | undefined =
    summary &&
    masters &&
    allStagesByCount(masters.data.stages, summary.byStage).map((s) => {
      // the "No stage" row has no id: it lists the leads whose stage is empty
      const params: ListParams = s._id ? { stage: s._id } : { filters: JSON.stringify([{ field: 'stage', op: 'empty' }]) }
      return { id: s._id ?? 'none', name: s.name, count: s.count, color: stageColor(s) ?? NEUTRAL_STAGE_DOT, params }
    })
  const stages = usePeriodRows(stageRows, bounds)
  const sources = usePeriodRows(counsellor ? undefined : sourceRows, bounds)
  const owners = usePeriodRows(ownerRows, bounds)
  // the period's lead total: the summary's figure, or for a custom range the same count the Leads cards make (shared through the cache)
  const customTotal = useLeadCount(key === 'custom' ? bounds : undefined)
  const total = allTime ? summary?.totals.total : key === 'custom' ? customTotal.count : period.period?.total
  const rowsLoading = isLoading || mastersLoading || (!allTime && (!stages || (!counsellor && (!sources || !owners))))

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

  // `from=dashboard` tells the list it is a dashboard drill-down, so it offers a way back
  const open = (params: ListParams) => navigate(`/app/leads?${new URLSearchParams({ ...params, from: 'dashboard' }).toString()}`)
  const openLead = (id: string) => navigate(`/app/leads/${id}`)
  const viewAllLeads = () => navigate('/app/leads')
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

  /** The period's row for the stage of this name, from the (possibly counted) stage rows. */
  const stageOf = (name: string) => stages?.find((s) => s.name.trim().toLowerCase() === name.trim().toLowerCase())
  // Total Leads, then each funnel stage with the count and drill-down of its stage row
  const funnel: FunnelStep[] | undefined =
    stages && total !== undefined
      ? [
          { label: 'Total Leads', count: total, params: range },
          ...FUNNEL_STAGES.map(({ label, names }) => {
            const row = names.map(stageOf).find(Boolean)
            return { label, count: row?.count ?? 0, params: row?.params }
          }),
        ]
      : undefined
  const chartHint = allTime ? 'Highest volume first' : period.hint

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
        <CounsellorCards summary={summary} period={period} loading={isLoading} onOpen={open} />
      ) : (
        <>
          <LeadsSection period={period} loading={isLoading} onOpen={open} />

          <section className="mt-5" aria-label="Lead Status">
            <SectionHeading title="Lead Status" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              {STATUS_TILES.map(({ key: tileKey, label, icon, accent }) => {
                // the summary names the stage behind each tile (it may be renamed in Masters); the count comes from the period's stage rows
                const name = summary?.leadStatus.find((t) => t.key === tileKey)?.name ?? label
                const row = stageOf(name)
                const params = row?.params
                return (
                  <KpiCard
                    key={tileKey}
                    label={row?.name ?? name}
                    value={row?.count}
                    progress={share(row?.count, total)}
                    hint="Leads on this stage"
                    icon={icon}
                    accent={accent}
                    color={STAGE_COLORS[name]}
                    loading={rowsLoading}
                    onClick={row?.count && params ? () => open(params) : undefined}
                  />
                )
              })}
            </div>
          </section>

          <section className="mt-5" aria-label="Pipeline">
            <SectionHeading title="Pipeline" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              {PIPELINE_CARDS.map(({ label, icon }) => {
                const row = stageOf(label)
                const params = row?.params
                return (
                  <KpiCard
                    key={label}
                    label={row?.name ?? label}
                    value={row?.count}
                    progress={share(row?.count, total)}
                    hint="Leads on this stage"
                    icon={icon}
                    color={STAGE_COLORS[label]}
                    loading={rowsLoading}
                    onClick={row?.count && params ? () => open(params) : undefined}
                  />
                )
              })}
            </div>
          </section>
        </>
      )}

      {/* A counsellor only ever sees their own leads: no source or by-counsellor charts, just Stage
          Distribution and the Conversion Funnel side by side, with Recent Leads full width below.
          An admin keeps the three charts and gets the funnel next to Recent Leads. */}
      <div className={cn('mt-5 grid gap-4', counsellor ? 'lg:grid-cols-2' : 'lg:grid-cols-3')}>
        {!counsellor && <DistributionCard title="Lead Source Analytics" hint={chartHint} items={sources} loading={rowsLoading} onOpen={open} />}
        {!counsellor && <DistributionCard title="Leads by Counsellor" hint={chartHint} items={owners} loading={rowsLoading} onOpen={open} />}
        <DistributionCard title="Stage Distribution" hint={chartHint} items={stages} loading={rowsLoading} onOpen={open} />
        {counsellor && <FunnelCard steps={funnel} hint={allTime ? 'All time' : period.hint} loading={rowsLoading} onOpen={open} />}
      </div>

      {counsellor ? (
        <RecentLeadsCard className="mt-4" leads={summary?.recentLeads} loading={isLoading} onOpenLead={openLead} onViewAll={viewAllLeads} />
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <RecentLeadsCard leads={summary?.recentLeads} loading={isLoading} onOpenLead={openLead} onViewAll={viewAllLeads} />
          <FunnelCard steps={funnel} hint={allTime ? 'All time' : period.hint} loading={rowsLoading} onOpen={open} />
        </div>
      )}
    </>
  )
}
