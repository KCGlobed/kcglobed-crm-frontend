import { useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  FileSpreadsheet,
  GraduationCap,
  ListChecks,
  PhoneCall,
  PhoneOff,
  PhoneOutgoing,
  RotateCcw,
  Sparkles,
  Target,
  Timer,
  Users,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { useCurrentUser } from '../../app/hooks'
import { Button } from '../../components/ui/Button'
import { CheckboxMultiSelect } from '../../components/ui/CheckboxMultiSelect'
import { DateRangeFilter } from '../../components/ui/DateRangeFilter'
import { ErrorState, LoadingState } from '../../components/ui/feedback'
import { KpiCard } from '../../components/ui/KpiCard'
import { Card, PageHeader } from '../../components/ui/misc'
import { can } from '../../constants/permissions'
import { authorizedDownload } from '../../lib/download'
import { formatHms } from '../../lib/durations'
import { cn, formatDateTime } from '../../lib/utils'
import { useAnalyticsSummaryQuery, useUpdateAnalyticsSettingsMutation, type AnalyticsParams } from '../../services/analyticsApi'
import { Bars, Donut, Funnel, Heatmap, LineChart, Ring, StackedBars, TrendCard } from './charts'
import { COLORS } from './colors'

const FILTER_KEYS = [
  'created_from', 'created_to', 'created_from_time', 'created_to_time',
  'modified_from', 'modified_to', 'modified_from_time', 'modified_to_time',
  'acted_from', 'acted_to', 'acted_from_time', 'acted_to_time', 'source', 'owner',
]
const CARD_STYLE: Record<string, { color: string; goodWhenUp: boolean; sub: string; icon: LucideIcon }> = {
  total: { color: COLORS.brand, goodWhenUp: true, sub: 'matching the filters', icon: Users },
  open: { color: COLORS.brandSoft, goodWhenUp: true, sub: 'still to work', icon: ListChecks },
  notActed: { color: COLORS.missed, goodWhenUp: false, sub: 'assigned, no work by the counsellor', icon: AlertTriangle },
  converted: { color: COLORS.converted, goodWhenUp: true, sub: 'converted', icon: GraduationCap },
  lost: { color: COLORS.lost, goodWhenUp: false, sub: 'closed / not workable', icon: XCircle },
}
const FU_COLS = [
  { key: 'dueToday', label: 'Due today', tone: 'text-slate-800' },
  { key: 'onTime', label: 'Done on time', tone: 'text-emerald-700' },
  { key: 'missed', label: 'Missed today', tone: 'text-red-600' },
  { key: 'overdue', label: 'Overdue (open)', tone: 'text-red-700' },
  { key: 'upcoming', label: 'Upcoming', tone: 'text-amber-700' },
] as const
const CLASS_LABEL: Record<string, string> = { open: 'Actionable', lost: 'Non-actionable', converted: 'Enrolled' }
const CLASS_SLICE = ['open', 'lost', 'converted'] as const

function Panel({ title, hint, children, className, actions }: { title: string; hint?: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <Card title={title} actions={actions} className={cn('flex flex-col rounded-2xl border-slate-100 shadow-md', className)} bodyClassName="flex-1 p-5">
      {hint && <p className="-mt-1 mb-4 text-xs text-slate-500">{hint}</p>}
      {children}
    </Card>
  )
}

function Band({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-3 mt-8 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
      <p className="text-xs text-slate-500">{sub}</p>
    </div>
  )
}

const fmtN = (n: number) => n.toLocaleString('en-IN')
/** minutes → HH:MM:SS, like every duration in the CRM */
/** seconds → HH:MM:SS; from a day up "3d 04:05:06" so long gaps stay readable */
const dur = (seconds: number) => {
  const days = Math.floor(seconds / 86400)
  return days ? `${days}d ${formatHms(seconds % 86400)}` : formatHms(seconds)
}
/** minutes → the same */
const hms = (minutes: number) => dur(minutes * 60)

const Empty = ({ text = 'No data for these filters' }: { text?: string }) => <p className="py-8 text-center text-xs text-slate-400">{text}</p>

/**
 * Analytics → Sales & Counsellor (SOP "Sales & Counsellor Analytics Dashboard"): filters, four headline numbers and
 * twelve charts / lists on live CRM data. Every number and chart part opens the leads or follow-ups behind it.
 */
export default function AnalyticsPage() {
  const user = useCurrentUser()
  const [params, setParams] = useSearchParams()
  const filters: AnalyticsParams = Object.fromEntries(FILTER_KEYS.filter((k) => params.get(k)).map((k) => [k, params.get(k) as string]))
  // Calls trend: Daily / Weekly / Monthly (not a filter: only the trend's buckets change)
  const callPeriod = (['day', 'week', 'month'] as const).find((p) => p === params.get('call_period')) ?? 'day'
  const { data, isLoading, isError, error, refetch, isFetching } = useAnalyticsSummaryQuery({ ...filters, call_period: callPeriod })
  const navigate = useNavigate()
  const [stageOpen, setStageOpen] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [editTarget, setEditTarget] = useState<string | null>(null)
  const [saveTarget, { isLoading: savingTarget }] = useUpdateAnalyticsSettingsMutation()
  const canExport = can(user, 'analytics', 'export')
  const canEdit = can(user, 'analytics', 'edit')

  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    setParams(next, { replace: true })
  }
  const range = (prefix: string) => (from: string, to: string, fromTime = '', toTime = '') =>
    set({ [`${prefix}_from`]: from, [`${prefix}_to`]: to, [`${prefix}_from_time`]: from ? fromTime : '', [`${prefix}_to_time`]: to ? toTime : '' })
  // every click opens the Leads page with exactly the leads that part counted (the backend's an_metric filter)
  const open = (metric: string, key: string, title: string) => {
    const q = new URLSearchParams({ an_metric: metric, an_key: key, an_title: title })
    Object.entries(filters).forEach(([k, v]) => q.set(`an_${k}`, v))
    navigate(`/app/leads?${q}`)
  }
  const ids = (k: string) => (params.get(k) ?? '').split(',').filter(Boolean)

  const download = async () => {
    setDownloading(true)
    try {
      await authorizedDownload(`/analytics/report?${new URLSearchParams(filters)}`, 'sales-counsellor-analytics.xlsx')
    } catch (err) {
      toast.error((err as { data?: { message?: string } })?.data?.message ?? 'Download failed')
    } finally {
      setDownloading(false)
    }
  }

  const d = data?.data
  const h = d?.headline

  return (
    <div className="pb-10">
      <PageHeader
        title="Sales & Counsellor Analytics"
        description={d ? `Live CRM data · updated ${formatDateTime(d.generatedAt)} · click any chart or number to open those leads` : 'Live CRM data'}
        actions={
          canExport && (
            <Button onClick={download} loading={downloading} disabled={!d}>
              <FileSpreadsheet className="h-4 w-4" /> Excel report
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-100 bg-white p-3 shadow-md">
        <DateRangeFilter withTime label="Lead created" heading="Lead created between" from={params.get('created_from') ?? ''} to={params.get('created_to') ?? ''}
          fromTime={params.get('created_from_time') ?? ''} toTime={params.get('created_to_time') ?? ''} onChange={range('created')} />
        <DateRangeFilter withTime label="Lead modified" heading="Lead modified between" from={params.get('modified_from') ?? ''} to={params.get('modified_to') ?? ''}
          fromTime={params.get('modified_from_time') ?? ''} toTime={params.get('modified_to_time') ?? ''} onChange={range('modified')} />
        <DateRangeFilter withTime label="Activity date" heading="Counsellor actions between" from={params.get('acted_from') ?? ''} to={params.get('acted_to') ?? ''}
          fromTime={params.get('acted_from_time') ?? ''} toTime={params.get('acted_to_time') ?? ''} onChange={range('acted')} />
        <CheckboxMultiSelect options={d?.options.sources ?? []} value={ids('source')} onChange={(v) => set({ source: v.join(',') })}
          allLabel="All sources" plural="Sources" ariaLabel="Lead source" searchPlaceholder="Search sources…" />
        <CheckboxMultiSelect options={d?.options.counsellors ?? []} value={ids('owner')} onChange={(v) => set({ owner: v.join(',') })}
          allLabel="All counsellors" plural="Counsellors" ariaLabel="Counsellor" searchPlaceholder="Search counsellors…" />
        {Object.keys(filters).length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </Button>
        )}
        {isFetching && !isLoading && <span className="ml-auto text-xs text-slate-400">Updating…</span>}
      </div>

      {isError ? (
        <div className="mt-6"><ErrorState error={error} onRetry={refetch} /></div>
      ) : isLoading || !d || !h ? (
        <LoadingState className="mt-10" />
      ) : (
        <div className={isFetching ? 'opacity-70 transition-opacity' : ''}>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {d.cards.cards.map((c) => (
              <TrendCard
                key={c.key}
                label={c.label}
                value={c.value}
                sub={CARD_STYLE[c.key].sub}
                series={c.series}
                change={c.change}
                color={CARD_STYLE[c.key].color}
                icon={CARD_STYLE[c.key].icon}
                goodWhenUp={CARD_STYLE[c.key].goodWhenUp}
                previousText={d.cards.period ? `Graph: leads created per day, ${d.cards.from} → ${d.cards.to}; ▲▼ vs the ${d.cards.period} days before` : undefined}
                onClick={() => open('card', c.key, c.label)}
              />
            ))}
          </div>

          <Band title="Counsellors" sub="Leads with each counsellor, action taken, sources, stages and follow-ups" />
          <div className="grid gap-4">
            <Panel title="Leads with each counsellor and action taken" hint="Green = counsellor worked the lead (call, stage, note, follow-up, message); red = no action yet. Click a part to open those leads.">
              {d.counsellorAction.length ? (
                <>
                  <StackedBars
                    horizontal
                    rows={d.counsellorAction}
                    series={[{ key: 'acted', label: 'Action taken', color: COLORS.onTime }, { key: 'notActed', label: 'Action not taken', color: COLORS.missed }]}
                    value={(r, k) => r[k as 'acted']}
                    right={(r) => `${r.assigned} leads · ${r.pct}% actioned`}
                    onSelect={(row, sk) => {
                      const name = d.counsellorAction.find((r) => r.key === row)?.label ?? 'Counsellor'
                      open('acted', sk ? `${row}|${sk === 'acted' ? 'yes' : 'no'}` : row, `${name} · ${sk === 'acted' ? 'action taken' : sk ? 'action not taken' : 'leads'}`)
                    }}
                  />
                  <div className="mt-3 flex gap-4 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS.onTime }} />Action taken</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS.missed }} />Action not taken</span>
                  </div>
                </>
              ) : <Empty text="No assigned leads for these filters" />}
            </Panel>

            <Panel title="Who is taking action — counsellor scorecard" hint="Sorted weakest first. Red = below 50% actioned. Every number opens its leads.">
              {d.scorecard.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                      <tr className="border-b border-slate-200">
                        {['Counsellor', 'Leads', 'Action taken', 'Not taken', 'Action %', 'Calls', 'Connected', 'Connect %', '1st call (avg)', 'Overdue F/U', 'Enrolled', 'Conv. %'].map((hd) => (
                          <th key={hd} className="whitespace-nowrap px-2 py-2 font-semibold">{hd}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {d.scorecard.map((r) => {
                        const cell = (part: string, n: number, title: string, tone = 'text-slate-800') => (
                          <td className="px-2 py-2">
                            {n ? (
                              <button type="button" onClick={() => open('score', `${r.key}|${part}`, `${r.label} · ${title}`)} className={cn('cursor-pointer font-semibold tabular-nums hover:underline', tone)}>{n.toLocaleString('en-IN')}</button>
                            ) : <span className="text-slate-300">0</span>}
                          </td>
                        )
                        return (
                          <tr key={r.key} className={r.actedPct < 50 ? 'bg-red-50/60' : ''}>
                            <td className="whitespace-nowrap px-2 py-2 font-medium text-slate-800">{r.label}</td>
                            {cell('leads', r.leads, 'leads')}
                            {cell('acted', r.acted, 'action taken', 'text-emerald-700')}
                            {cell('notActed', r.notActed, 'action not taken', 'text-red-600')}
                            <td className={cn('px-2 py-2 font-bold tabular-nums', r.actedPct < 50 ? 'text-red-600' : r.actedPct < 80 ? 'text-amber-600' : 'text-emerald-700')}>{r.actedPct}%</td>
                            {cell('called', r.calls, 'leads called')}
                            {cell('connected', r.connected, 'leads connected')}
                            <td className="px-2 py-2 tabular-nums text-slate-600">{r.connectRate}%</td>
                            <td className={cn('px-2 py-2 tabular-nums', r.avgFirstCall !== null && r.avgFirstCall > d.firstCall.target ? 'font-semibold text-red-600' : 'text-slate-600')}>{r.avgFirstCall === null ? '—' : hms(r.avgFirstCall)}</td>
                            {cell('overdue', r.overdue, 'overdue follow-ups', 'text-red-600')}
                            {cell('enrolled', r.enrolled, 'enrolled', 'text-emerald-700')}
                            <td className="px-2 py-2 tabular-nums text-slate-600">{r.conversion}%</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : <Empty />}
            </Panel>

            <Panel title="Where each counsellor's leads come from" hint="Counsellor × source. Darker = more leads. Click a number to open those leads.">
              {d.counsellorSource.rows.length ? (
                <Heatmap {...d.counsellorSource} onCell={(row, col) => open('cs', `${row}|${col}`, 'Counsellor × source')} />
              ) : <Empty />}
            </Panel>

            <Panel title="Lead stage per counsellor" hint="Counsellor × stage (Untouched, Interested, Not Connected …). Click a stage name for its sub-stages, a number to open those leads.">
              {d.counsellorStage.rows.length ? (
                <>
                  <Heatmap
                    {...d.counsellorStage}
                    activeColumn={stageOpen}
                    onColumn={(col) => setStageOpen((c) => (c === col ? null : col))}
                    onCell={(row, col) => open('cst', `${row}|${col}`, 'Counsellor × stage')}
                  />
                  {stageOpen && (d.counsellorStage.subStages[stageOpen] ?? []).length > 0 && (() => {
                    const subs = d.counsellorStage.subStages[stageOpen] ?? []
                    const stageName = d.counsellorStage.columns.find((c) => c.key === stageOpen)?.label ?? 'Stage'
                    const rows = d.counsellorStage.rows
                      .map((r) => ({ key: r.key, label: r.label, cells: Object.fromEntries(subs.map((sub) => [sub.key, sub.cells[r.key] ?? 0])) }))
                      .map((r) => ({ ...r, total: Object.values(r.cells).reduce((x, y) => x + y, 0) }))
                      .filter((r) => r.total > 0)
                    const totals = Object.fromEntries(subs.map((sub) => [sub.key, Object.values(sub.cells).reduce((x, y) => x + y, 0)]))
                    return (
                      <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50/40 p-3">
                        <div className="mb-2 flex items-center justify-between text-xs font-semibold text-brand-800">
                          Sub-stages of {stageName}
                          <button type="button" onClick={() => setStageOpen(null)} className="cursor-pointer text-slate-500 hover:text-slate-800">Close</button>
                        </div>
                        <Heatmap columns={subs} rows={rows} totals={totals} total={rows.reduce((x, r) => x + r.total, 0)}
                          onCell={(row, col) => open('cst', `${row}|${stageOpen}${col ? `|${col}` : ''}`, `${stageName} sub-stage`)} />
                      </div>
                    )
                  })()}
                </>
              ) : <Empty />}
            </Panel>

            <Panel title="Follow-ups of each counsellor" hint="Today's follow-ups and every overdue one still open. Click a number to open those leads.">
              {d.counsellorFollowups.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                      <tr className="border-b border-slate-200">
                        <th className="px-2 py-2 font-semibold">Counsellor</th>
                        {FU_COLS.map((c) => <th key={c.key} className="whitespace-nowrap px-2 py-2 font-semibold">{c.label}</th>)}
                        <th className="px-2 py-2 font-semibold">Today</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {d.counsellorFollowups.map((r) => (
                        <tr key={r.key}>
                          <td className="whitespace-nowrap px-2 py-2 font-medium text-slate-800">{r.label}</td>
                          {FU_COLS.map((c) => (
                            <td key={c.key} className="px-2 py-2">
                              {r[c.key] ? (
                                <button type="button" onClick={() => open('cf', `${r.key}|${c.key}`, `${r.label} · ${c.label}`)} className={cn('cursor-pointer font-semibold tabular-nums hover:underline', c.tone)}>{r[c.key]}</button>
                              ) : <span className="text-slate-300">0</span>}
                            </td>
                          ))}
                          <td className="w-48 px-2 py-2">
                            {r.dueToday > 0 && (
                              <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100" title={`${r.onTime} on time · ${r.missed} missed of ${r.dueToday}`}>
                                <div style={{ width: `${(r.onTime / r.dueToday) * 100}%`, background: COLORS.onTime }} />
                                <div style={{ width: `${(r.missed / r.dueToday) * 100}%`, background: COLORS.missed }} />
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <Empty text="No follow-ups for these filters" />}
            </Panel>
          </div>

          <Band title="Calls" sub="How many calls each counsellor made, how many connected, and what came of them" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {[
              { label: 'Calls made', value: d.calls.totals.calls, hint: `${fmtN(d.calls.totals.leads)} leads called`, part: 'all', icon: PhoneOutgoing, accent: 'blue' as const, progress: d.calls.totals.calls ? 100 : 0 },
              { label: 'Connected', value: d.calls.totals.connected, hint: `${d.calls.totals.connectRate}% of calls`, part: 'connected', icon: PhoneCall, accent: 'green' as const, progress: d.calls.totals.connectRate },
              { label: 'Not connected', value: d.calls.totals.notConnected, hint: 'No answer / busy / failed', part: 'notConnected', icon: PhoneOff, accent: 'red' as const, progress: 100 - d.calls.totals.connectRate },
              { label: 'Positive outcome', value: d.calls.totals.positive, hint: `${d.calls.totals.conversion}% call conversion`, part: 'positive', icon: Sparkles, accent: 'amber' as const, progress: d.calls.totals.conversion },
              { label: 'Enrolled from calls', value: d.calls.totals.enrolled, hint: 'Disposition = Enrolled', part: 'enrolled', icon: GraduationCap, accent: 'leaf' as const, progress: d.calls.totals.connected ? (d.calls.totals.enrolled * 100) / d.calls.totals.connected : 0 },
              { label: 'Talk time', value: hms(d.calls.totals.talkMinutes), hint: `${fmtN(d.calls.totals.leadsConnected)} leads spoken to`, part: 'connected', icon: Timer, accent: 'indigo' as const, progress: d.calls.totals.talkMinutes ? 100 : 0 },
            ].map((k) => (
              <KpiCard key={k.label} label={k.label} value={k.value} hint={k.hint} icon={k.icon} accent={k.accent} progress={k.progress}
                onClick={() => open('calls', `all|${k.part}`, `All counsellors · ${k.label}`)} />
            ))}
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <Panel
              title={`Calls per ${callPeriod === 'day' ? 'day' : callPeriod === 'week' ? 'week' : 'month'}`}
              hint={filters.acted_from ? 'In the Activity date range' : callPeriod === 'day' ? 'Last 30 days' : callPeriod === 'week' ? 'Last 12 weeks' : 'Last 12 months'}
              className="lg:col-span-2"
              actions={
                <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
                  {(['day', 'week', 'month'] as const).map((p) => (
                    <button key={p} type="button" onClick={() => set({ call_period: p === 'day' ? '' : p })}
                      className={cn('cursor-pointer rounded-md px-3 py-1 font-medium', callPeriod === p ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-800')}>
                      {p === 'day' ? 'Daily' : p === 'week' ? 'Weekly' : 'Monthly'}
                    </button>
                  ))}
                </div>
              }
            >
              {d.calls.trend.some((b) => b.calls) ? (
                <>
                  <StackedBars
                    rows={d.calls.trend}
                    series={[{ key: 'connected', label: 'Connected', color: COLORS.onTime }, { key: 'notConnected', label: 'Not connected', color: COLORS.waiting }]}
                    value={(r, k) => r[k as 'connected']}
                    onSelect={(row, sk) => open('callbucket', `${callPeriod}|${row}|${sk ?? 'all'}`, `Calls from ${row}`)}
                  />
                  <div className="mt-2 flex gap-4 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS.onTime }} />Connected</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLORS.waiting }} />Not connected</span>
                    <span>Number on top = total calls</span>
                  </div>
                </>
              ) : <Empty text="No calls in this period" />}
            </Panel>
            <Panel title="Call conversion" hint="From calls made to enrolment; % = share of the step before">
              {d.calls.totals.calls ? (
                <Funnel
                  steps={d.calls.conversion.map((c, i, all) => ({
                    ...c,
                    color: null,
                    fromPrevious: i ? (all[i - 1].value ? Math.round((c.value * 1000) / all[i - 1].value) / 10 : 0) : null,
                  }))}
                  onSelect={(k) => open('calls', `all|${k === 'calls' ? 'all' : k === 'leadsConnected' ? 'connected' : k}`, `Call conversion · ${k}`)}
                />
              ) : <Empty text="No calls yet" />}
              <p className="mt-2 text-[11px] text-slate-400">Positive outcome = a connected call whose disposition moved the lead to a sales-funnel stage (Interested, NFET …) or Enrolled.</p>
            </Panel>
            <Panel title="Calls per counsellor" hint="Green = connected, red = not connected. Click a part to open those leads." className="lg:col-span-3">
              {d.calls.rows.length ? (
                <StackedBars
                  horizontal
                  rows={d.calls.rows}
                  series={[{ key: 'connected', label: 'Connected', color: COLORS.onTime }, { key: 'notConnected', label: 'Not connected', color: COLORS.waiting }]}
                  value={(r, k) => r[k as 'connected']}
                  right={(r) => `${fmtN(r.calls)} calls · ${r.connectRate}% connected · ${r.conversion}% conversion`}
                  onSelect={(row, sk) => open('calls', `${row}|${sk ?? 'all'}`, `${d.calls.rows.find((r) => r.key === row)?.label ?? ''} · calls`)}
                />
              ) : <Empty text="No calls for these filters" />}
            </Panel>
            <Panel title="Call details per counsellor" hint="Every number opens the leads behind it" className="lg:col-span-3">
              {d.calls.rows.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                      <tr className="border-b border-slate-200">
                        {['Counsellor', 'Calls', 'Connected', 'Not connected', 'Connect %', 'Positive', 'Conversion %', 'Enrolled', 'Leads called', 'Spoken to', 'Talk time', 'Avg talk', 'Inbound'].map((hd) => (
                          <th key={hd} className="whitespace-nowrap px-2 py-2 font-semibold">{hd}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {d.calls.rows.map((r) => {
                        const cell = (part: string, n: number, title: string, tone = 'text-slate-800') => (
                          <td className="px-2 py-2">
                            {n ? (
                              <button type="button" onClick={() => open('calls', `${r.key}|${part}`, `${r.label} · ${title}`)} className={cn('cursor-pointer font-semibold tabular-nums hover:underline', tone)}>{fmtN(n)}</button>
                            ) : <span className="text-slate-300">0</span>}
                          </td>
                        )
                        return (
                          <tr key={r.key}>
                            <td className="whitespace-nowrap px-2 py-2 font-medium text-slate-800">{r.label}</td>
                            {cell('all', r.calls, 'calls')}
                            {cell('connected', r.connected, 'connected calls', 'text-emerald-700')}
                            {cell('notConnected', r.notConnected, 'calls not connected', 'text-red-600')}
                            <td className={cn('px-2 py-2 font-semibold tabular-nums', r.connectRate < 30 ? 'text-red-600' : 'text-slate-700')}>{r.connectRate}%</td>
                            {cell('positive', r.positive, 'positive outcome', 'text-brand-600')}
                            <td className="px-2 py-2 font-semibold tabular-nums text-slate-700">{r.conversion}%</td>
                            {cell('enrolled', r.enrolled, 'enrolled', 'text-emerald-700')}
                            {cell('all', r.leads, 'leads called')}
                            {cell('connected', r.leadsConnected, 'leads spoken to')}
                            <td className="px-2 py-2 tabular-nums text-slate-600">{hms(r.talkMinutes)}</td>
                            <td className="px-2 py-2 tabular-nums text-slate-600">{r.avgTalkSeconds ? dur(r.avgTalkSeconds) : '—'}</td>
                            <td className="px-2 py-2 tabular-nums text-slate-600">{r.inbound}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : <Empty text="No calls for these filters" />}
            </Panel>
          </div>

          <Band title="Leads" sub="Where every lead stands" />
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="Actionable vs non-actionable" hint="Share of leads the team still has to work on">
              <Donut
                slices={CLASS_SLICE.map((c) => ({ key: c, label: CLASS_LABEL[c], value: d.stageSplit.find((p) => p.key === c)?.value ?? 0, color: COLORS[c] }))}
                centerLabel="leads"
                onSelect={(k) => open('class', k, CLASS_LABEL[k])}
              />
            </Panel>
            <Panel title="New leads per day" hint={filters.created_from ? 'In the Lead created range' : 'Last 30 days'} className="lg:col-span-2">
              {d.leadsPerDay.length ? <LineChart points={d.leadsPerDay} onSelect={(k) => open('day', k, `Leads created on ${k}`)} /> : <Empty />}
            </Panel>
            <Panel title="Leads by source" hint="Which sources bring leads, and how many enrol" className="lg:col-span-2">
              {d.bySource.length ? (
                <StackedBars
                  horizontal
                  rows={d.bySource}
                  series={[{ key: 'converted', label: 'Enrolled', color: COLORS.converted }, { key: 'open', label: 'Actionable', color: COLORS.open }, { key: 'lost', label: 'Non-actionable', color: COLORS.lost }]}
                  value={(r, k) => r[k as 'open' | 'lost' | 'converted']}
                  right={(r) => `${r.total.toLocaleString('en-IN')} · ${r.conversion}% enrolled`}
                  onSelect={(row, s) => open('source', s ? `${row}|${s}` : row, 'Source')}
                />
              ) : <Empty />}
            </Panel>
            <Panel title="Sales funnel" hint="Leads that reached each step; % from the step before">
              {d.funnel.length ? <Funnel steps={d.funnel} onSelect={(k) => open('funnel', k, 'Funnel step')} /> : <Empty text="Tick 'Show in Sales funnel' on stages in Masters → Stages" />}
            </Panel>
            <Panel title="Leads by stage" hint="Current stage of every lead (colour = class)" className="lg:col-span-3">
              <div className="grid gap-x-8 md:grid-cols-2">
                {[d.byStage.slice(0, Math.ceil(d.byStage.length / 2)), d.byStage.slice(Math.ceil(d.byStage.length / 2))].map((half, i) => (
                  <Bars key={i} rows={half.map((s) => ({ key: s.key, label: s.label, value: s.value, color: COLORS[s.class] }))} onSelect={(k) => open('stage', k, 'Stage')} />
                ))}
              </div>
            </Panel>
          </div>

          <Band title="Calls & follow-up discipline" sub="Outcome, speed of first call, on-time follow-ups" />
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Assigned leads and outcome" hint="Each counsellor's load, contact rate and result" className="lg:col-span-2">
              {d.counsellors.length ? (
                <>
                  <StackedBars
                    horizontal
                    rows={d.counsellors}
                    series={[
                      { key: 'enrolled', label: 'Enrolled', color: COLORS.enrolled },
                      { key: 'contacted', label: 'Contacted', color: COLORS.contacted },
                      { key: 'notConnected', label: 'Called, not connected', color: COLORS.notConnected },
                      { key: 'notCalled', label: 'Not called', color: COLORS.notCalled },
                      { key: 'lost', label: 'Closed / lost', color: COLORS.lost },
                    ]}
                    value={(r, k) => r[k as 'enrolled']}
                    right={(r) => `${r.assigned} · ${r.contactRate}% contacted`}
                    onSelect={(row, s) => open('owner', s ? `${row}|${s}` : row, 'Counsellor')}
                  />
                  <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-slate-500">
                    {[['Enrolled', COLORS.enrolled], ['Contacted', COLORS.contacted], ['Called, not connected', COLORS.notConnected], ['Not called', COLORS.notCalled], ['Closed / lost', COLORS.lost]].map(([l, c]) => (
                      <span key={l} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} />{l}</span>
                    ))}
                  </div>
                </>
              ) : <Empty />}
            </Panel>
            <Panel
              title="Time to first call"
              hint={`Average time from assignment to the first call (HH:MM:SS) · target ${hms(d.firstCall.target)} (red line)`}
              actions={
                canEdit &&
                (editTarget === null ? (
                  <Button size="sm" variant="ghost" onClick={() => setEditTarget(String(d.firstCall.target))}>
                    <Target className="h-3.5 w-3.5" /> Target
                  </Button>
                ) : (
                  <form
                    className="flex items-center gap-1"
                    onSubmit={async (e) => {
                      e.preventDefault()
                      const minutes = Number(editTarget)
                      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) return void toast.error('Minutes between 1 and 1440')
                      try {
                        await saveTarget({ firstCallTargetMinutes: minutes }).unwrap()
                        setEditTarget(null)
                        toast.success('First call target saved')
                      } catch {
                        toast.error('Could not save the target')
                      }
                    }}
                  >
                    <input type="number" min={1} max={1440} aria-label="Target minutes" value={editTarget} onChange={(e) => setEditTarget(e.target.value)} className="h-8 w-16 rounded-md border border-slate-300 px-2 text-xs" />
                    <span className="text-xs text-slate-500">min</span>
                    <Button size="sm" type="submit" loading={savingTarget}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditTarget(null)}>Cancel</Button>
                  </form>
                ))
              }
            >
              {d.firstCall.rows.length ? (
                <Bars
                  rows={d.firstCall.rows.map((r) => ({ key: r.key, label: r.label, value: r.avgMinutes, note: r.pending ? `· ${r.pending} not called` : undefined }))}
                  target={d.firstCall.target}
                  format={hms}
                  emptyText="no calls yet"
                  onSelect={(k) => {
                    const row = d.firstCall.rows.find((r) => r.key === k)
                    open('firstcall', row && row.late ? `${k}|late` : k, 'First calls')
                  }}
                />
              ) : <Empty />}
              <p className="mt-2 text-[11px] text-slate-400">Click a bar for the leads first called late (or all first calls when none are late).</p>
            </Panel>
            <Panel title="Follow-ups done on time" hint="Today, per counsellor, of follow-ups whose time has passed">
              {d.discipline.length ? (
                <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                  {d.discipline.map((r) => (
                    <Ring key={r.key} pct={r.pct} label={r.label} sub={`${r.onTime}/${r.passed} on time`} onClick={() => open('discipline', r.missed ? `${r.key}|missed` : r.key, 'Follow-ups')} />
                  ))}
                </div>
              ) : <Empty text="No follow-up time has passed yet today" />}
            </Panel>
          </div>

          <Band title="Follow-ups" sub="What needs action today" />
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="Today's follow-ups" hint={`${d.todayFollowups.due} due today`}>
              <Donut
                half
                slices={d.todayFollowups.parts.map((p) => ({ ...p, color: COLORS[p.key as 'onTime'] }))}
                center={String(d.todayFollowups.due)}
                centerLabel="due today"
                onSelect={(k) => open('today', k, "Today's follow-ups")}
              />
            </Panel>
            <Panel title="Needs attention now" hint="Closed and enrolled leads are never listed">
              <div className="space-y-2">
                {d.attention.map((a) => (
                  <button key={a.key} type="button" onClick={() => open('attention', a.key, a.label)}
                    className={cn('flex w-full cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5 text-left transition hover:shadow-sm',
                      a.value ? 'border-red-200 bg-red-50 hover:border-red-300' : 'border-slate-200 bg-slate-50')}>
                    <span className="text-sm text-slate-700">{a.label}</span>
                    <span className={cn('text-xl font-bold', a.value ? 'text-red-600' : 'text-slate-400')}>{a.value.toLocaleString('en-IN')}</span>
                  </button>
                ))}
              </div>
            </Panel>
            <Panel title="Follow-ups per day" hint="Last 14 days: on time, missed, still to come">
              <StackedBars
                rows={d.followupsPerDay}
                series={[{ key: 'onTime', label: 'Done on time', color: COLORS.onTime }, { key: 'missed', label: 'Missed', color: COLORS.missed }, { key: 'upcoming', label: 'Still to come', color: COLORS.upcoming }]}
                value={(r, k) => r[k as 'onTime']}
                onSelect={(row, s) => open('fday', s ? `${row}|${s}` : row, 'Follow-ups')}
              />
            </Panel>
            <Panel title="Longest overdue follow-ups" hint="The follow-ups to chase first" className="lg:col-span-3"
              actions={d.attention[0]?.value ? <Button size="sm" variant="outline" onClick={() => open('attention', 'overdue', 'Overdue follow-ups')}>View all {d.attention[0].value}</Button> : undefined}>
              {d.longestOverdue.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                      <tr><th className="py-2 pr-3">Lead</th><th className="pr-3">Follow-up</th><th className="pr-3">Due</th><th className="pr-3">Counsellor</th><th className="text-right">Overdue</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {d.longestOverdue.map((r) => (
                        <tr key={r.taskId}>
                          <td className="py-2 pr-3"><a href={`/app/leads/${r.leadId}`} className="font-medium text-brand-700 hover:underline">{r.name}</a> <span className="text-slate-400">{r.leadNo}</span></td>
                          <td className="pr-3">{r.type}</td>
                          <td className="pr-3">{formatDateTime(r.dueAt)}</td>
                          <td className="pr-3">{r.assignee ?? '—'}</td>
                          <td className="text-right font-semibold text-red-600">{dur(r.overdueSeconds)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <Empty text="No overdue follow-ups" />}
            </Panel>
          </div>
        </div>
      )}

    </div>
  )
}
