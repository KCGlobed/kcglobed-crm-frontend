import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarCheck, CalendarClock, ChevronRight, CircleDashed, Clock, Coffee, GraduationCap, Hash, Inbox, Phone, PhoneCall, PhoneIncoming, PhoneMissed, PhoneOff, PhoneOutgoing, Pause, Receipt, Repeat, ThumbsDown, ThumbsUp, Timer, UserCheck, Users, type LucideIcon } from 'lucide-react'
import dayjs from 'dayjs'
import { useDashboardSummaryQuery } from '../../services/miscApi'
import { leadsApi, useListLeadsQuery, type LeadListParams } from '../../services/leadsApi'
import { useMasterBootstrapQuery } from '../../services/mastersApi'
import { useMyTargetQuery } from '../../services/targetsApi'
import { useTaskSummaryQuery } from '../../services/tasksApi'
import { targetMood } from '../../lib/targetMood'
import { TargetBar, TargetLine, TargetSmiley } from './TargetBanner'
import { Card, PageHeader } from '../../components/ui/misc'
import { DateRangeFilter } from '../../components/ui/DateRangeFilter'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/feedback'
import { StageBadge } from '../../components/ui/Badge'
import { STAGE_COLORS, stageColor } from '../../lib/stageColors'
import { KpiCard, type KpiAccent } from '../../components/ui/KpiCard'
import { useAppDispatch, useCurrentUser } from '../../app/hooks'
import { isCounsellor } from '../../lib/roles'
import { cn, fullName, timeAgo } from '../../lib/utils'
import { formatHms } from '../../lib/durations'
import type { CallActivity, DashboardRecentLead, DashboardStatusTile, DashboardSummary, Stage } from '../../types/models'
import type { CallMetric } from '../../services/telephonyApi'

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
  { label: 'Registration & Fee', icon: Receipt },
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
 * card has nothing to open and stays inert. `children` are more cards in the
 * same grid, after these three (the Super Admin's stage and follow-up cards).
 */
function LeadsSection({
  period: state,
  loading,
  onOpen,
  unassignedLabel = 'Unassigned Leads',
  children,
}: {
  period: PeriodState
  loading: boolean
  onOpen: (params: ListParams) => void
  unassignedLabel?: string
  children?: ReactNode
}) {
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
          accent="azure"
          loading={busy}
          onClick={tile(figures.assigned, { assigned: 'true' })}
        />
        <KpiCard
          label={unassignedLabel}
          value={figures.unassigned}
          progress={share(figures.unassigned, figures.total)}
          hint="Waiting for an owner"
          icon={Inbox}
          accent="slate"
          loading={busy}
          onClick={tile(figures.unassigned, { unassigned: 'true' })}
        />
        {children}
      </div>
    </section>
  )
}

/**
 * The Super Admin's "Follow-ups Due" card: open follow-ups already past their due time, across every counsellor.
 * It is about now, not the period the lead cards are switched to; it opens the Follow-ups page (overdue, team
 * view). Zero until the count arrives.
 */
function FollowUpsDueCard({ onOpen }: { onOpen: () => void }) {
  const { data, isLoading } = useTaskSummaryQuery({}, { pollingInterval: 60_000 })
  const overdue = data?.data.counts.overdue ?? 0
  return (
    <KpiCard
      label="Follow-ups Due"
      value={overdue}
      hint="Overdue"
      icon={CalendarClock}
      accent="orange"
      loading={isLoading}
      onClick={overdue ? onOpen : undefined}
    />
  )
}

const STATUS_TILES: { key: DashboardStatusTile['key']; label: string; icon: LucideIcon; accent: 'blue' | 'red' | 'green' }[] = [
  { key: 'interested', label: 'Interested', icon: ThumbsUp, accent: 'blue' },
  { key: 'notInterested', label: 'Not Interested', icon: ThumbsDown, accent: 'red' },
  { key: 'enrolled', label: 'Enrolled', icon: GraduationCap, accent: 'green' },
]

/**
 * Not Connected = the leads a call never got through to: these two stages, plus the Closed leads who stopped
 * answering (the sub-stage below). Every other lead counts as Connected.
 */
const UNTOUCHED_STAGE = 'Untouched'
const NOT_CONNECTED_STAGE = 'Not Connected'
const CLOSED_STAGE = 'Closed'
const STOPPED_ANSWERING_SUB = 'Stopped answering after counselling (5-7 attempts)'

/** The period's Not Connected figure (undefined while it loads) and the lists both cards open. */
interface NotConnected {
  count?: number
  loading: boolean
  params: ListParams
  /** the Connected leads: on neither stage and not stopped answering */
  connectedParams: ListParams
}

/**
 * Not Connected for the period: the two stages' rows plus the Closed leads who stopped answering — a sub-stage, so
 * counted off the list within the period's bounds (the stage rows count whole stages); 0 for what Masters lacks.
 */
function useNotConnected(masters: Stage[] | undefined, stages: BarItem[] | undefined, bounds: DateBounds | undefined, range: ListParams): NotConnected {
  const closed = masters?.find((s) => s.isActive !== false && nameKey(s.name) === nameKey(CLOSED_STAGE))
  const sub = closed?.subStages?.find((s) => s.isActive && nameKey(s.name) === nameKey(STOPPED_ANSWERING_SUB))
  const stopped = useLeadCount(closed && sub ? { stage: closed._id, sub_stage: sub._id, ...(bounds ?? {}) } : undefined)
  const stoppedCount = sub ? stopped.count : 0
  const rows = [NOT_CONNECTED_STAGE, UNTOUCHED_STAGE].map((name) => stages?.find((s) => nameKey(s.name) === nameKey(name)))
  const ids = rows.flatMap((r) => (r ? [r.id] : []))
  const onStages = ids.length ? [{ field: 'stage', op: 'any_of', value: ids }] : []
  const onStopped = sub ? [{ field: 'subStage', op: 'any_of', value: [sub._id] }] : []
  const not = (conditions: object[]) => conditions.map((c) => ({ ...c, op: 'none_of' }))
  return {
    count: stages && stoppedCount !== undefined ? rows.reduce((n, r) => n + (r?.count ?? 0), 0) + stoppedCount : undefined,
    loading: stopped.loading,
    // on one of the stages, or on the stopped-answering sub-stage (an OR group)
    params: { ...range, filters: JSON.stringify([{ any: [...onStages, ...onStopped] }]) },
    connectedParams: { ...range, filters: JSON.stringify([...not(onStages), ...not(onStopped)]) },
  }
}

/** The Not Connected card, the same on both dashboards. */
function NotConnectedCard({ notConnected, total, loading, onOpen }: { notConnected: NotConnected; total?: number; loading: boolean; onOpen: (params: ListParams) => void }) {
  const { count, params } = notConnected
  return (
    <KpiCard
      label="Not Connected"
      value={count}
      progress={share(count, total)}
      hint="Leads on this stage"
      icon={PhoneOff}
      color={STAGE_COLORS[NOT_CONNECTED_STAGE]}
      loading={loading || notConnected.loading}
      onClick={count ? () => onOpen(params) : undefined}
    />
  )
}

/** The counsellor's stage cards on the second row, in display order. */
const MY_LEADS_STAGES: { name: string; icon: LucideIcon }[] = [
  { name: 'Interested', icon: ThumbsUp },
  { name: 'Not Interested', icon: ThumbsDown },
  { name: 'Registration & Fee', icon: Receipt },
  { name: 'Enrolled', icon: GraduationCap },
]

/**
 * Admission Counsellor's dashboard cards (their own leads), behind the same period switch
 * as the admin's Leads section, two rows of four: Total / Connected / Not Connected /
 * Untouched, then Interested / Not Interested / Registration & Fee / Enrolled; then today's
 * calling activity. Every figure comes from the page's stage rows for the period (the
 * Stage Distribution data) plus the stopped-answering count: Total is every lead, Not
 * Connected is Untouched + Not Connected + the Closed leads who stopped answering, and
 * Connected is the rest. Replaces the admin's Leads / Lead Status / Pipeline cards.
 */
function CounsellorCards({
  summary,
  period: state,
  stages,
  notConnected,
  stagesLoading,
  loading,
  onOpen,
  onOpenCalls,
}: {
  summary?: DashboardSummary
  period: PeriodState
  /** the period's lead count on every stage (plus "No stage"), undefined while they load */
  stages?: BarItem[]
  notConnected: NotConnected
  stagesLoading: boolean
  loading: boolean
  onOpen: (params: ListParams) => void
  /** a call card's "view all": the calls it counted */
  onOpenCalls: (metric: CallMetric) => void
}) {
  const { key, setKey, custom, setCustom, range, hint } = state
  const stageOf = (name: string) => stages?.find((s) => nameKey(s.name) === nameKey(name))
  const total = stages?.reduce((n, r) => n + r.count, 0)
  const connected = total === undefined || notConnected.count === undefined ? undefined : total - notConnected.count
  const busy = loading || stagesLoading || !stages
  /** a card for a stage row: its count (0 when the stage has no row), opening its leads */
  const stageCard = (name: string, icon: LucideIcon, accent?: KpiAccent) => {
    const row = stageOf(name)
    const params = row?.params
    return (
      <KpiCard
        key={name}
        label={row?.name ?? name}
        value={row?.count ?? 0}
        progress={share(row?.count, total)}
        hint="Leads on this stage"
        icon={icon}
        accent={accent}
        color={STAGE_COLORS[name]}
        loading={busy}
        onClick={row?.count && params ? () => onOpen(params) : undefined}
      />
    )
  }
  const activity = summary?.activityToday
  const dialCalls = activity?.dialCalls ?? 0
  const inbound = activity?.inbound ?? 0
  const loggedIn = activity?.loggedInSeconds ?? 0
  const unique = activity?.uniqueNumbers ?? 0
  /** a card's bar: its share (0–100) of the row's total; empty when the total is 0 */
  const pct = (part: number | undefined, whole: number) => (whole ? Math.min(100, Math.round(((part ?? 0) / whole) * 100)) : 0)
  /** a call card opens the calls it counted (none to open at 0) */
  const calls = (metric: CallMetric, value: number | undefined) => (value ? () => onOpenCalls(metric) : undefined)
  return (
    <>
      <section aria-label="My Leads">
        <PeriodSectionHeader
          title="My Leads / Stage Distribution"
          value={key}
          onChange={setKey}
          custom={custom}
          onCustomChange={setCustom}
          hint={hint}
        />
        {/* 2 rows × 4 on a wide screen, 4 × 2 on a narrow one */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" data-testid="my-leads">
          <KpiCard
            label="Total Leads"
            value={total}
            hint={key === 'overall' ? 'All time' : 'Created in this period'}
            icon={Users}
            loading={busy}
            onClick={total ? () => onOpen(range) : undefined}
          />
          <KpiCard
            label="Connected"
            value={connected}
            progress={share(connected, total)}
            hint="Leads on this stage"
            icon={PhoneCall}
            accent="leaf"
            loading={busy}
            onClick={connected ? () => onOpen(notConnected.connectedParams) : undefined}
          />
          {/* Not Connected takes its palette amber; Untouched, outside the palette, a blue of its own */}
          <NotConnectedCard notConnected={notConnected} total={total} loading={busy} onOpen={onOpen} />
          {stageCard(UNTOUCHED_STAGE, CircleDashed, 'azure')}
          {MY_LEADS_STAGES.map((s) => stageCard(s.name, s.icon))}
        </div>
      </section>

      <section className="mt-5" aria-label="Today's Activity">
        <SectionHeading title="Today's Activity / Calls Distribution" hint="" />
        {/* 4 rows × 3: dial calls, inbound calls, time, numbers — straight from the summary's activityToday (0 when
            it has no figure yet); each bar is the card's share of its row's total. Every card has a hue of its own
            (all mid-tone, see KpiCard), so no two look alike */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4" data-testid="todays-activity">
          <KpiCard label="Total Dial Calls" value={dialCalls} progress={dialCalls ? 100 : 0} hint="Outgoing calls today" icon={PhoneOutgoing} accent="blue" loading={loading} onClick={calls('dial', dialCalls)} />
          <KpiCard label="Connected" value={activity?.dialConnected ?? 0} progress={pct(activity?.dialConnected, dialCalls)} hint="Dial calls the lead picked up" icon={PhoneCall} accent="green" loading={loading} onClick={calls('dial_connected', activity?.dialConnected)} />
          <KpiCard label="Not Connected" value={activity?.dialNotConnected ?? 0} progress={pct(activity?.dialNotConnected, dialCalls)} hint="No answer, busy or failed" icon={PhoneOff} accent="red" loading={loading} onClick={calls('dial_not_connected', activity?.dialNotConnected)} />

          <KpiCard label="Inbound Calls Today" value={inbound} progress={inbound ? 100 : 0} hint="Calls received today" icon={PhoneIncoming} accent="azure" loading={loading} onClick={calls('inbound', inbound)} />
          <KpiCard label="Inbound Received" value={activity?.inboundAnswered ?? 0} progress={pct(activity?.inboundAnswered, inbound)} hint="Answered" icon={Phone} accent="teal" loading={loading} onClick={calls('inbound_answered', activity?.inboundAnswered)} />
          <KpiCard label="Inbound Missed" value={activity?.inboundMissed ?? 0} progress={pct(activity?.inboundMissed, inbound)} hint="Not answered" icon={PhoneMissed} accent="pink" loading={loading} onClick={calls('inbound_missed', activity?.inboundMissed)} />

          <KpiCard label="Active Time" value={formatHms(activity?.activeSeconds)} progress={pct(activity?.activeSeconds, loggedIn)} hint="Excludes talk, break & pause time" icon={Clock} accent="indigo" loading={loading} />
          <KpiCard label="Talk Time" value={formatHms(activity?.talktimeSeconds)} progress={pct(activity?.talktimeSeconds, loggedIn)} hint="From pick-up, connected calls only" icon={Timer} accent="leaf" loading={loading} onClick={calls('connected', activity?.talktimeSeconds)} />
          <KpiCard label="Break Time" value={formatHms(activity?.breakSeconds)} progress={pct(activity?.breakSeconds, loggedIn)} hint="Time on break" icon={Coffee} accent="slate" loading={loading} />

          {/* the numbers row: distinct numbers out of the attempts, every attempt, and today's Pause Break time */}
          <KpiCard label="Unique Numbers Dialled" value={unique} progress={pct(unique, dialCalls)} hint="Distinct numbers called today" icon={Hash} accent="cyan" loading={loading} />
          <KpiCard label="Total Dial Attempts" value={dialCalls} progress={dialCalls ? 100 : 0} hint="Outgoing attempts, repeats included" icon={Repeat} accent="amber" loading={loading} onClick={calls('dial', dialCalls)} />
          <KpiCard label="Pause Break" value={formatHms(activity?.pauseSeconds)} progress={pct(activity?.pauseSeconds, loggedIn)} hint="Campus visit, training, calibration" icon={Pause} accent="fuchsia" loading={loading} />
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
 * summary has no row for it), plus any summary row for a stage inactive or no longer in
 * Masters or for "No stage", so the rows add up to every lead; highest count first, ties
 * keep the Masters order.
 */
/** Admins: today's calls of everyone they can see — each card opens those calls (Calls page). */
function TeamCallsSection({ activity, loading, onOpenCalls }: { activity?: CallActivity; loading: boolean; onOpenCalls: (metric: CallMetric) => void }) {
  const dial = activity?.dialCalls ?? 0
  const inbound = activity?.inbound ?? 0
  const pct = (part: number | undefined, whole: number) => (whole ? Math.min(100, Math.round(((part ?? 0) / whole) * 100)) : 0)
  const open = (metric: CallMetric, value: number | undefined) => (value ? () => onOpenCalls(metric) : undefined)
  return (
    <section className="mt-5" aria-label="Team calls today">
      <SectionHeading title="Team Calls Today" hint="Click a card for its calls" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4" data-testid="team-calls">
        <KpiCard label="Dial Calls" value={dial} progress={dial ? 100 : 0} hint="Outgoing calls today" icon={PhoneOutgoing} accent="blue" loading={loading} onClick={open('dial', dial)} />
        <KpiCard label="Connected" value={activity?.dialConnected ?? 0} progress={pct(activity?.dialConnected, dial)} hint="Dial calls the lead picked up" icon={PhoneCall} accent="green" loading={loading} onClick={open('dial_connected', activity?.dialConnected)} />
        <KpiCard label="Not Connected" value={activity?.dialNotConnected ?? 0} progress={pct(activity?.dialNotConnected, dial)} hint="No answer, busy or failed" icon={PhoneOff} accent="red" loading={loading} onClick={open('dial_not_connected', activity?.dialNotConnected)} />
        <KpiCard label="Talk Time" value={formatHms(activity?.talktimeSeconds)} hint={activity?.avgTalkSeconds ? `Avg ${formatHms(activity.avgTalkSeconds)} per connected call` : 'From pick-up, connected calls only'} icon={Timer} accent="leaf" loading={loading} onClick={open('connected', activity?.talktimeSeconds)} />
        <KpiCard label="Inbound Calls" value={inbound} progress={inbound ? 100 : 0} hint="Calls received today" icon={PhoneIncoming} accent="azure" loading={loading} onClick={open('inbound', inbound)} />
        <KpiCard label="Inbound Received" value={activity?.inboundAnswered ?? 0} progress={pct(activity?.inboundAnswered, inbound)} hint="Answered" icon={Phone} accent="teal" loading={loading} onClick={open('inbound_answered', activity?.inboundAnswered)} />
        <KpiCard label="Inbound Missed" value={activity?.inboundMissed ?? 0} progress={pct(activity?.inboundMissed, inbound)} hint="Not answered" icon={PhoneMissed} accent="pink" loading={loading} onClick={open('inbound_missed', activity?.inboundMissed)} />
        <KpiCard label="Connect Rate" value={`${activity?.connectRate ?? 0}%`} progress={activity?.connectRate ?? 0} hint="Connected of all calls" icon={Hash} accent="cyan" loading={loading} onClick={open('connected', activity?.connected)} />
      </div>
    </section>
  )
}

function allStagesByCount(stages: Stage[], byStage: DashboardSummary['byStage']): DashboardSummary['byStage'] {
  const counted = new Map(byStage.map((row) => [row._id, row.count]))
  const active = stages.filter((s) => s.isActive !== false)
  const known = new Set(active.map((s) => s._id))
  const rows = [...active]
    .sort((a, b) => a.order - b.order)
    .map((s) => ({ _id: s._id, name: s.name, color: s.color, count: counted.get(s._id) ?? 0 }))
  const extra = byStage.filter((row) => !row._id || !known.has(row._id))
  return [...rows, ...extra].sort((a, b) => b.count - a.count)
}

/**
 * The conversion funnel's steps, in order, after "Total Leads". Each counts the leads now at that point: on the
 * Masters stage named one of `stages` (first match wins) — on any of its sub-stages, or with `subStages` only on
 * those. A step that matches nothing in Masters shows 0. Names are compared without case, spaces or punctuation
 * ("Program Fees – Payment Stages" = "program fees payment stages").
 */
const FUNNEL_STEPS: { label: string; stages: string[]; subStages?: string[] }[] = [
  { label: 'Interested', stages: ['Interested'] },
  // a step up from Interested: the Interested leads on its Interview Preparation sub-stage
  { label: 'Interview Preparation', stages: ['Interested'], subStages: ['Interview Preparation'] },
  // a step up from Interview: the leads who cleared the technical interview (the prescreening is not "done")
  { label: 'Interview Done', stages: ['Interview'], subStages: ['Technical Interview Cleared'] },
  { label: 'Registration Fees', stages: ['Registration Fees', 'Registration Fees Done', 'Registration & Fee'] },
  // the program fees stage, every sub-stage (direct payment, loan, part EMI)
  { label: 'Banking/Payment', stages: ['Program Fees – Payment Stages', 'Program Fees Payment', 'Banking/Payment', 'Banking', 'Payment'] },
  { label: 'Enrolment', stages: ['Enrolment', 'Enrollment', 'Enrolled'] },
]

/** A Masters name for matching: lower case, every run of spaces or punctuation one space. */
const nameKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** Where a funnel step counts from: a stage (its count comes with the stage rows), or sub-stages (counted off the list), or nothing. */
type FunnelSource = { kind: 'stage'; stageId: string } | { kind: 'sub'; params: ListParams } | { kind: 'none' }

/** Each funnel step's source in these Masters: the first stage name that exists, narrowed to the named sub-stages it has. */
function funnelSources(stages: Stage[]): FunnelSource[] {
  const active = stages.filter((s) => s.isActive !== false)
  return FUNNEL_STEPS.map((step): FunnelSource => {
    const stage = step.stages.map((name) => active.find((s) => nameKey(s.name) === nameKey(name))).find(Boolean)
    if (!stage) return { kind: 'none' }
    if (!step.subStages) return { kind: 'stage', stageId: stage._id }
    const wanted = new Set(step.subStages.map(nameKey))
    const subs = (stage.subStages ?? []).filter((sub) => sub.isActive && wanted.has(nameKey(sub.name)))
    if (subs.length === 1) return { kind: 'sub', params: { stage: stage._id, sub_stage: subs[0]._id } }
    if (subs.length > 1) return { kind: 'sub', params: { stage: stage._id, filters: JSON.stringify([{ field: 'subStage', op: 'any_of', value: subs.map((s) => s._id) }]) } }
    return { kind: 'none' }
  })
}

interface FunnelStep {
  label: string
  count: number
  /** where the step drills down to; a step without one, or with no leads, is inert */
  params?: ListParams
}

/**
 * the steps' fills, top to bottom: light to dark, from a light lavender at the mouth (Total Leads) through the
 * brand purple to its deepest at Enrolment; white text on every one
 */
const BAND_FILLS = ['#ab95dd', '#9a80d0', '#8466be', '#6f4fae', '#5d3fa1', '#4b2d87', '#3a2075']
const FUNNEL_INK = '#FFFFFF'

/** how wide the cone's mouth may be, as a share of its height, so a wide card gets a slim funnel in the middle rather than a bowl */
const FUNNEL_ASPECT = 1.25
/** how wide the cone's bottom is, as a share of its top: a slim point, still wide enough for the last step's name */
const FUNNEL_TAPER = 0.3
/** each rim ellipse is this many times as tall as it is wide… */
const FUNNEL_RIM = 0.095
/** …but the mouth's half-height is at most this share of the funnel's, so a wide, short box isn't all rim */
const FUNNEL_RIM_MAX = 0.06
/** room left round the drawing for the white outlines */
const FUNNEL_PAD = 2
/** the darkened edges laid over every band, so it reads as round */
const FUNNEL_SHADE = 'funnel-shade'

/**
 * The funnel's drawing for a `w` × `h` box: a cone seen from slightly above, as tall as
 * the box and as wide as it up to FUNNEL_ASPECT of that height, centred. Its axis runs
 * from `top` down, narrowing from `halfTop` either side of `cx` to FUNNEL_TAPER of that,
 * cut into `count` bands of one height (`step`). Every band's top and bottom edge is the
 * front half of an ellipse `rim` times as tall as it is wide, and the whole ellipse at
 * the top is the cone's mouth.
 */
function funnelGeometry(w: number, h: number, count: number) {
  const halfTop = Math.min(w, h * FUNNEL_ASPECT) / 2 - FUNNEL_PAD
  const halfBottom = halfTop * FUNNEL_TAPER
  const rim = Math.min(FUNNEL_RIM, (h * FUNNEL_RIM_MAX) / halfTop)
  const top = FUNNEL_PAD + halfTop * rim
  const bottom = h - FUNNEL_PAD - halfBottom * rim
  const halfAt = (y: number) => halfTop - ((halfTop - halfBottom) * (y - top)) / (bottom - top)
  const step = (bottom - top) / count
  const bands = Array.from({ length: count }, (_, i) => ({ y0: top + i * step, y1: top + (i + 1) * step }))
  return { cx: w / 2, top, halfTop, rim, halfAt, step, bands }
}

/**
 * A step's figure and name centred on `mid`: their font sizes, scaled to the band height
 * within readable bounds (the same on every step), and their baselines.
 */
function stepText(mid: number, bandHeight: number) {
  const figure = Math.min(24, Math.max(14, bandHeight * 0.3))
  const name = Math.min(13, Math.max(10, bandHeight * 0.16))
  // from the figure's baseline to the name's; the block from the figure's cap height to the name's baseline is centred
  const gap = name * 1.3
  const figureY = mid - (figure * 0.72 + gap) / 2 + figure * 0.72
  return { figure, name, figureY, nameY: figureY + gap }
}

type FunnelGeometry = ReturnType<typeof funnelGeometry>

/** A band's outline: down its left side, along the front of its bottom rim, up its right side and back along the front of its top rim. */
function bandPath({ cx, rim, halfAt }: FunnelGeometry, { y0, y1 }: FunnelGeometry['bands'][number]): string {
  const a = halfAt(y0)
  const b = halfAt(y1)
  return `M ${cx - a} ${y0} L ${cx - b} ${y1} A ${b} ${b * rim} 0 0 0 ${cx + b} ${y1} L ${cx + a} ${y0} A ${a} ${a * rim} 0 0 1 ${cx - a} ${y0} Z`
}

/** The size of the element the returned ref is put on, in whole pixels, kept current as it resizes; 0 × 0 until it mounts. */
function useElementSize() {
  const [node, setNode] = useState<HTMLElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    if (!node) return
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width)
      const height = Math.round(entry.contentRect.height)
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }))
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [node])
  return [setNode, size] as const
}

/**
 * Conversion funnel: a cone filling the card, Total Leads in its mouth (the ellipse on
 * top), then one band of equal height per step down to Enrolment — Interested light
 * lavender, the rest deepening purple. Each step's count (0 when Masters has nothing for
 * it) and name sit inside in white. A step with leads opens their list.
 */
function FunnelCard({ steps, hint, loading, onOpen }: { steps: FunnelStep[] | undefined; hint?: string; loading: boolean; onOpen: (params: ListParams) => void }) {
  const [measure, { width, height }] = useElementSize()
  const geometry = steps && width > 0 && height > 0 ? funnelGeometry(width, height, Math.max(1, steps.length - 1)) : undefined
  return (
    <Card
      title="Conversion Funnel"
      actions={hint && <span className="text-xs text-slate-500">{hint}</span>}
      // the card stretches to its row's height (at least min-h-80 on its own), and the funnel fills its body
      className="flex flex-col"
      bodyClassName="relative flex min-h-96 flex-1 items-center justify-center"
    >
      {loading && <Skeleton className="mx-auto h-64 w-5/6" />}
      {!loading && !steps && <p className="py-6 text-center text-xs text-slate-400">No Data Yet</p>}
      {/* laid over the body's padded area rather than in its flow, so the drawing never sets the row's height */}
      {!loading && steps && (
        <div ref={measure} className="absolute inset-4">
          {geometry && <FunnelDrawing steps={steps} width={width} height={height} geometry={geometry} onOpen={onOpen} />}
        </div>
      )}
    </Card>
  )
}

function FunnelDrawing({
  steps,
  width,
  height,
  geometry,
  onOpen,
}: {
  steps: FunnelStep[]
  width: number
  height: number
  geometry: FunnelGeometry
  onOpen: (params: ListParams) => void
}) {
  const { cx, top, halfTop, rim, halfAt, step: bandHeight, bands } = geometry
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="group" aria-label="Conversion funnel" className="block">
      <defs>
        {/* left to right across each band: darker at both sides, its own colour through the middle where the text sits */}
        <linearGradient id={FUNNEL_SHADE}>
          <stop offset="0" stopColor="#000" stopOpacity={0.22} />
          <stop offset="0.3" stopColor="#000" stopOpacity={0} />
          <stop offset="0.7" stopColor="#000" stopOpacity={0} />
          <stop offset="1" stopColor="#000" stopOpacity={0.28} />
        </linearGradient>
      </defs>
      {steps.map((step, i) => {
        // the first step (Total Leads) is the mouth; every later one has a band
        const first = i === 0
        const band = first ? undefined : bands[i - 1]
        const fill = BAND_FILLS[i]
        if ((!first && !band) || !fill) return null
        const params = step.params
        const open = step.count > 0 && params ? () => onOpen(params) : undefined
        const figure = step.count.toLocaleString()
        // the text's middle: a touch below the mouth's centre, or the band's middle seen face on (between the fronts of its two rims)
        const mid = band ? (band.y0 + halfAt(band.y0) * rim + band.y1 + halfAt(band.y1) * rim) / 2 : top + halfTop * rim * 0.25
        const text = stepText(mid, bandHeight)
        const outline = band && bandPath(geometry, band)
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
            {/* the step's band, or for Total Leads the mouth: the whole ellipse on top, the inside of the cone */}
            {outline ? (
              <>
                <path d={outline} fill={fill} />
                <path d={outline} fill={`url(#${FUNNEL_SHADE})`} stroke="#fff" strokeWidth={1.5} strokeLinejoin="round" />
              </>
            ) : (
              <>
                <ellipse cx={cx} cy={top} rx={halfTop} ry={halfTop * rim} fill={fill} />
                <ellipse cx={cx} cy={top} rx={halfTop} ry={halfTop * rim} fill={`url(#${FUNNEL_SHADE})`} stroke="#fff" strokeWidth={1.5} />
              </>
            )}
            <text x={cx} y={text.figureY} textAnchor="middle" fontSize={text.figure} fontWeight={700} fill={FUNNEL_INK}>
              {figure}
            </text>
            <text x={cx} y={text.nameY} textAnchor="middle" fontSize={text.name} fontWeight={500} fill={FUNNEL_INK}>
              {step.label}
            </text>
          </g>
        )
      })}
    </svg>
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
  // the signed-in person's own target for the banner; re-read every 2 minutes as leads change stage
  const { data: mine } = useMyTargetQuery(undefined, { skip: !user || user.isSuperAdmin, pollingInterval: 120_000 })
  const myTarget = mine?.data ?? null
  const mood = myTarget ? targetMood(myTarget) : null
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
  // the Not Connected card of both dashboards (and the counsellor's Connected = the rest)
  const notConnected = useNotConnected(masters?.data.stages, stages, bounds, range)
  const sources = usePeriodRows(counsellor ? undefined : sourceRows, bounds)
  const owners = usePeriodRows(ownerRows, bounds)
  // the period's lead total: the summary's figure, or for a custom range the same count the Leads cards make (shared through the cache)
  const customTotal = useLeadCount(key === 'custom' ? bounds : undefined)
  const total = allTime ? summary?.totals.total : key === 'custom' ? customTotal.count : period.period?.total
  const rowsLoading = isLoading || mastersLoading || (!allTime && (!stages || (!counsellor && (!sources || !owners))))
  // the funnel's sub-stage steps are counted off the list (the summary has stage rows only), within the period
  const sourcesOfFunnel = masters ? funnelSources(masters.data.stages) : undefined
  const subParams = sourcesOfFunnel?.flatMap((s) => (s.kind === 'sub' ? [{ ...s.params, ...(bounds ?? {}) }] : []))
  const subCounts = useLeadCounts(subParams?.length ? subParams : undefined)
  const funnelLoading = rowsLoading || (!!subParams?.length && !subCounts)

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
  // a call card's "view all": the Calls page with the card's own filters (today; a counsellor's cards: their calls)
  const openCalls = (metric: CallMetric, mine: boolean) => {
    const date = summary?.today?.from ?? dayjs().format('YYYY-MM-DD')
    const query = new URLSearchParams({ metric, from: date, to: date, back: 'dashboard', ...(mine && user ? { userId: user._id } : {}) })
    navigate(`/app/calls?${query.toString()}`)
  }
  // Recent Leads' "View all" is a drill-down too: the list then shows the way back to the dashboard
  const viewAllLeads = () => navigate('/app/leads?from=dashboard')
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

  /** The period's row for the stage of this name, from the (possibly counted) stage rows. */
  const stageOf = (name: string) => stages?.find((s) => s.name.trim().toLowerCase() === name.trim().toLowerCase())
  // Total Leads, then each funnel step: a stage's count and drill-down from its (period) row, a sub-stage step's from
  // the list count, 0 for a step Masters has nothing for
  let subIndex = 0
  const funnel: FunnelStep[] | undefined =
    stages && total !== undefined && sourcesOfFunnel && !funnelLoading
      ? [
          { label: 'Total Leads', count: total, params: range },
          ...FUNNEL_STEPS.map(({ label }, i): FunnelStep => {
            const source = sourcesOfFunnel[i]
            if (source.kind === 'stage') {
              const row = stages.find((s) => s.id === source.stageId)
              return { label, count: row?.count ?? 0, params: { stage: source.stageId, ...(bounds ?? {}) } }
            }
            if (source.kind === 'sub') {
              const count = subCounts?.[subIndex++] ?? 0
              return { label, count, params: { ...source.params, ...(bounds ?? {}) } }
            }
            return { label, count: 0 }
          }),
        ]
      : undefined
  const chartHint = allTime ? 'Highest volume first' : period.hint

  /** The stage behind a lead-status tile: the summary names it (it may be renamed in Masters), else the default name. */
  const statusName = (tileKey: DashboardStatusTile['key'], fallback: string) => summary?.leadStatus.find((t) => t.key === tileKey)?.name ?? fallback
  /** A card for the stage of this name: the period's count from the stage rows (0 when it has none), opening its leads. */
  const stageCard = (name: string, icon: LucideIcon, accent?: KpiAccent) => {
    const row = stageOf(name)
    const params = row?.params
    return (
      <KpiCard
        key={`stage-${name}`}
        label={row?.name ?? name}
        value={row?.count ?? 0}
        progress={share(row?.count, total)}
        hint="Leads on this stage"
        icon={icon}
        accent={accent}
        color={STAGE_COLORS[name]}
        loading={rowsLoading}
        onClick={row?.count && params ? () => open(params) : undefined}
      />
    )
  }

  return (
    <>
      <section className="relative mb-5 overflow-hidden rounded-2xl bg-linear-to-br from-brand-600 via-brand-700 to-brand-900 px-5 py-5 text-white shadow-md sm:px-7 sm:py-6">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-brand-400/40 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 right-16 h-48 w-48 rounded-full border border-gold-400/40" />
        <div aria-hidden className="pointer-events-none absolute -bottom-12 right-44 h-28 w-28 rounded-full border border-white/10" />
        <div className={cn('relative min-w-0', myTarget && 'pr-20 sm:pr-28')}>
          <p className="flex items-center gap-2 text-xs font-medium text-gold-300">
            <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
            {today}
          </p>
          <h1 className="mt-1 truncate text-xl font-bold tracking-tight sm:text-2xl">Welcome back, {user?.name.split(' ')[0] ?? ''}</h1>
          {myTarget && mood && <TargetLine target={myTarget} mood={mood} />}
        </div>
        {myTarget && mood && (
          <TargetSmiley target={myTarget} mood={mood} className="absolute right-4 top-1/2 -translate-y-1/2 sm:right-7" />
        )}
        {myTarget && <TargetBar target={myTarget} />}
      </section>

      {counsellor ? (
        <CounsellorCards
          summary={summary}
          period={period}
          stages={stages}
          notConnected={notConnected}
          stagesLoading={rowsLoading}
          loading={isLoading}
          onOpen={open}
          onOpenCalls={(metric) => openCalls(metric, true)}
        />
      ) : user?.isSuperAdmin ? (
        // Super Admin: one grid of nine cards in this order, every one following the period switch except
        // Follow-ups Due (overdue right now); a stage with no leads shows 0. The palette stages keep their colours;
        // the other cards take hues none of them use (azure, slate, orange beside Not Connected's amber)
        <LeadsSection period={period} loading={isLoading} onOpen={open} unassignedLabel="Not Assigned Leads">
          <NotConnectedCard notConnected={notConnected} total={total} loading={rowsLoading} onOpen={open} />
          {stageCard(statusName('notInterested', 'Not Interested'), ThumbsDown, 'red')}
          {stageCard(statusName('interested', 'Interested'), ThumbsUp, 'blue')}
          <FollowUpsDueCard onOpen={() => navigate('/app/tasks?view=overdue&who=team')} />
          {stageCard('Registration & Fee', Receipt)}
          {stageCard(statusName('enrolled', 'Enrolled'), GraduationCap, 'green')}
        </LeadsSection>
      ) : (
        <>
          <LeadsSection period={period} loading={isLoading} onOpen={open} />

          {/* the status tiles and the pipeline cards together, one grid straight under the lead cards (no heading) */}
          <section className="mt-3 sm:mt-4" aria-label="Lead stages">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              {STATUS_TILES.map(({ key: tileKey, label, icon, accent }) => stageCard(statusName(tileKey, label), icon, accent))}
              {PIPELINE_CARDS.map(({ label, icon }) => stageCard(label, icon))}
            </div>
          </section>
        </>
      )}

      {!counsellor && summary?.teamCallsToday && (
        <TeamCallsSection activity={summary.teamCallsToday} loading={isLoading} onOpenCalls={(metric) => openCalls(metric, false)} />
      )}

      {/* A counsellor only ever sees their own leads: no source or by-counsellor charts, just Stage
          Distribution and the Conversion Funnel side by side, with Recent Leads full width below.
          An admin keeps the three charts and gets the funnel next to Recent Leads. */}
      <div className={cn('mt-5 grid gap-4', counsellor ? 'lg:grid-cols-2' : 'lg:grid-cols-3')}>
        {!counsellor && <DistributionCard title="Lead Source Analytics" hint={chartHint} items={sources} loading={rowsLoading} onOpen={open} />}
        {!counsellor && <DistributionCard title="Leads by Counsellor" hint={chartHint} items={owners} loading={rowsLoading} onOpen={open} />}
        <DistributionCard title="Stage Distribution" hint={chartHint} items={stages} loading={rowsLoading} onOpen={open} />
        {counsellor && <FunnelCard steps={funnel} hint={allTime ? 'All time' : period.hint} loading={funnelLoading} onOpen={open} />}
      </div>

      {counsellor ? (
        <RecentLeadsCard className="mt-4" leads={summary?.recentLeads} loading={isLoading} onOpenLead={openLead} onViewAll={viewAllLeads} />
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <RecentLeadsCard leads={summary?.recentLeads} loading={isLoading} onOpenLead={openLead} onViewAll={viewAllLeads} />
          <FunnelCard steps={funnel} hint={allTime ? 'All time' : period.hint} loading={funnelLoading} onOpen={open} />
        </div>
      )}
    </>
  )
}
