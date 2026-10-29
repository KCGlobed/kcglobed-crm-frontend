import { useState, type ReactNode } from 'react'
import {
  Activity,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  FileText,
  Inbox,
  RefreshCw,
  Sunrise,
  UserCheck,
  UserRoundCheck,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import dayjs from 'dayjs'
import { authorizedDownload } from '../../lib/download'
import {
  useRoundRobinStatusQuery,
  useSetRoundRobinSequenceMutation,
  useSetRoundRobinUserMutation,
  useUpdateRoundRobinSettingsMutation,
} from '../../services/leadsApi'
import { useCurrentUser } from '../../app/hooks'
import { can } from '../../constants/permissions'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Card, PageHeader } from '../../components/ui/misc'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Checkbox, FormField, Input, Switch } from '../../components/ui/fields'
import { ErrorState, LoadingState } from '../../components/ui/feedback'
import { cn, parseApiError } from '../../lib/utils'
import type { RoundRobinChannel, RoundRobinMember, RoundRobinMorning, RoundRobinSettings, RoundRobinStatus } from '../../types/models'

const POLL_MS = 30_000

const CHANNELS: { value: RoundRobinChannel; label: string }[] = [
  { value: 'meta', label: 'Meta Ads' },
  { value: 'google', label: 'Google' },
  { value: 'capture', label: 'Website' },
  { value: 'telephony', label: 'Telephony' },
  { value: 'chatbot', label: 'Chatbot' },
]
/** index = API value (0=Mon … 6=Sun) */
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const NOT_THEIR_HOD = "Only the team's manager or the Super Admin can change this member"

function Stat({ label, value, hint, icon: Icon, accent }: { label: string; value: ReactNode; hint?: string; icon: LucideIcon; accent: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-md">
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br text-white shadow-lg', accent)}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <div className="truncate text-base font-bold leading-6 text-slate-900">{value}</div>
        {hint && <p className="truncate text-[11px] text-slate-400">{hint}</p>}
      </div>
    </div>
  )
}

/** local YYYY-MM-DD, `daysAgo` days back — toISOString() would be UTC and lag IST until 05:30 */
const isoDay = (daysAgo = 0) => {
  const d = new Date(Date.now() - daysAgo * 86_400_000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Date-ranged export of every assignment the rotation made, as Excel or PDF. */
function ReportsCard() {
  const [from, setFrom] = useState(() => isoDay(29))
  const [to, setTo] = useState(() => isoDay())
  const [busy, setBusy] = useState<'xlsx' | 'pdf' | null>(null)

  const download = async (fmt: 'xlsx' | 'pdf') => {
    setBusy(fmt)
    try {
      await authorizedDownload(
        `/leads/round-robin/report?date_from=${from}&date_to=${to}&format=${fmt}`,
        `round-robin-${from}-to-${to}.${fmt}`
      )
      toast.success('Report downloaded')
    } catch (err) {
      toast.error(parseApiError(err).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card title="Assignment reports">
      <p className="mb-3 text-xs text-slate-500">
        Every lead the rotation handed out in the period — morning quota, checkpoint split, pool or live, with the sequence
        number — and a per-user summary.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <FormField label="From">
          <Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </FormField>
        <FormField label="To">
          <Input type="date" value={to} min={from} max={isoDay()} onChange={(e) => setTo(e.target.value)} />
        </FormField>
        <Button variant="outline" size="sm" className="mb-1" loading={busy === 'xlsx'} disabled={!!busy} onClick={() => download('xlsx')}>
          <FileSpreadsheet className="h-3.5 w-3.5" /> Export Excel
        </Button>
        <Button variant="outline" size="sm" className="mb-1" loading={busy === 'pdf'} disabled={!!busy} onClick={() => download('pdf')}>
          <FileText className="h-3.5 w-3.5" /> Export PDF
        </Button>
      </div>
    </Card>
  )
}

function StatusPill({ status }: { status: RoundRobinStatus }) {
  if (!status.settings.enabled) return <Badge tone="slate" dot>Paused</Badge>
  if (status.phase === 'live') return <Badge tone="green" dot>Running</Badge>
  if (status.phase === 'morning') return <Badge tone="cyan" dot>Morning quotas</Badge>
  return <Badge tone="amber" dot>Outside window</Badge>
}

function poolHint(status: RoundRobinStatus) {
  if (!status.settings.enabled) return 'round-robin is off'
  if (status.phase === 'closed') return 'goes out when the window opens'
  if (status.phase === 'morning') return `new leads wait for the ${status.settings.checkpoint} split`
  return status.unassignedPoolCount ? 'waiting for someone eligible' : 'nothing waiting'
}

// ---------- settings card ----------

interface Draft {
  enabled: boolean
  channels: RoundRobinChannel[]
  allDay: boolean
  windowStart: string
  windowEnd: string
  days: number[]
  /** '' = no morning phase */
  checkpoint: string
}

const toDraft = (s: RoundRobinSettings): Draft => ({
  enabled: s.enabled,
  channels: s.channels,
  allDay: s.windowStart === null && s.windowEnd === null,
  windowStart: s.windowStart ?? '',
  windowEnd: s.windowEnd ?? '',
  days: s.days,
  checkpoint: s.checkpoint ?? '',
})

const sameList = (a: unknown[], b: unknown[]) => a.length === b.length && a.every((v) => b.includes(v))

/** Only the fields that differ from what the server has — the API accepts partial bodies. */
function diff(draft: Draft, server: RoundRobinSettings): Partial<RoundRobinSettings> {
  const body: Partial<RoundRobinSettings> = {}
  if (draft.enabled !== server.enabled) body.enabled = draft.enabled
  if (!sameList(draft.channels, server.channels)) body.channels = draft.channels
  if (!sameList(draft.days, server.days)) body.days = draft.days
  const start = draft.allDay ? null : draft.windowStart
  const end = draft.allDay ? null : draft.windowEnd
  // start and end always travel together
  if (start !== server.windowStart || end !== server.windowEnd) Object.assign(body, { windowStart: start, windowEnd: end })
  if ((draft.checkpoint || null) !== server.checkpoint) body.checkpoint = draft.checkpoint || null
  return body
}

function SettingsCard({ settings, editable }: { settings: RoundRobinSettings; editable: boolean }) {
  const [save, { isLoading }] = useUpdateRoundRobinSettingsMutation()
  const [draft, setDraft] = useState<Draft>(() => toDraft(settings))
  const [synced, setSynced] = useState(settings)
  const [dirty, setDirty] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Adopt what the poll brings in (another admin saved) unless this form has unsaved edits.
  if (settings !== synced) {
    setSynced(settings)
    if (!dirty) setDraft(toDraft(settings))
  }

  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }))
    setDirty(true)
    setErrors({})
  }

  const onSave = async () => {
    if (!draft.allDay && (!draft.windowStart || !draft.windowEnd)) {
      setErrors({ window: 'Set both start and end times, or choose 24×7' })
      return
    }
    const body = diff(draft, settings)
    if (!Object.keys(body).length) {
      setDirty(false)
      return
    }
    try {
      const res = await save(body).unwrap()
      setDraft(toDraft(res.data.settings))
      setDirty(false)
      toast.success(res.message)
    } catch (err) {
      const parsed = parseApiError(err)
      setErrors(parsed.errors)
      toast.error(parsed.message)
    }
  }

  const window = draft.allDay ? '24×7' : draft.windowStart && draft.windowEnd ? `${draft.windowStart}–${draft.windowEnd} IST` : 'window not set'
  const days = draft.days.length ? [...draft.days].sort().map((d) => DAYS[d]).join(', ') : 'every day'
  const morning = !draft.allDay && draft.checkpoint ? ` · morning till ${draft.checkpoint}` : ''

  return (
    <Card
      title="Settings"
      actions={
        editable ? (
          <Button size="sm" onClick={onSave} loading={isLoading} disabled={!dirty}>
            Save
          </Button>
        ) : (
          <span className="text-[11px] text-slate-400">Only the Super Admin can change these</span>
        )
      }
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
          <div>
            <p className="text-sm font-medium text-slate-800">Auto-assign new leads</p>
            <p className="text-[11px] text-slate-500">
              {draft.enabled ? `On · ${window} · ${days}${morning}` : 'Off — new leads wait in the Unassigned pool'}
            </p>
          </div>
          <Switch label="Round-robin enabled" checked={draft.enabled} onChange={(v) => set({ enabled: v })} disabled={!editable} />
        </div>

        <p className="rounded-lg bg-brand-50/60 px-3 py-2 text-[11px] leading-5 text-slate-600">
          A member gets leads only while logged in, with the toggle on and not on a break — in the sequence set by their team's
          manager. Logging in alone hands out nothing unless leads are waiting.
        </p>

        <FormField label="Channels" error={errors.channels} hint="Leads from these sources are handed out in rotation. Quick Add still picks an owner by hand.">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {CHANNELS.map((c) => (
              <label key={c.value} className="flex items-center gap-2 text-sm text-slate-700">
                <Checkbox
                  checked={draft.channels.includes(c.value)}
                  disabled={!editable}
                  onChange={(e) =>
                    set({ channels: e.target.checked ? [...draft.channels, c.value] : draft.channels.filter((v) => v !== c.value) })
                  }
                />
                {c.label}
              </label>
            ))}
          </div>
        </FormField>

        <FormField label="Time window (IST)" error={errors.window ?? errors.windowStart ?? errors.windowEnd} hint="Leads that arrive outside the window (the end time included) wait in the pool for the next morning.">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="time"
              className="!w-32"
              value={draft.windowStart}
              disabled={!editable || draft.allDay}
              aria-label="Window start"
              aria-invalid={!!(errors.window || errors.windowStart)}
              onChange={(e) => set({ windowStart: e.target.value })}
            />
            <span className="text-xs text-slate-400">to</span>
            <Input
              type="time"
              className="!w-32"
              value={draft.windowEnd}
              disabled={!editable || draft.allDay}
              aria-label="Window end"
              aria-invalid={!!(errors.window || errors.windowEnd)}
              onChange={(e) => set({ windowEnd: e.target.value })}
            />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <Checkbox checked={draft.allDay} disabled={!editable} onChange={(e) => set({ allDay: e.target.checked })} /> 24×7
            </label>
          </div>
        </FormField>

        <FormField
          label="Morning checkpoint (IST)"
          error={errors.checkpoint}
          hint={
            draft.allDay
              ? 'Needs a time window.'
              : 'From the window start until this time, the leads that waited overnight go out as equal shares (pool ÷ members with the toggle on) to whoever logs in. At this time the rest is split in sequence among those online.'
          }
        >
          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="time"
              className="!w-32"
              value={draft.checkpoint}
              disabled={!editable || draft.allDay}
              aria-label="Morning checkpoint"
              aria-invalid={!!errors.checkpoint}
              onChange={(e) => set({ checkpoint: e.target.value })}
            />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <Checkbox checked={!draft.checkpoint} disabled={!editable || draft.allDay} onChange={(e) => set({ checkpoint: e.target.checked ? '' : '10:00' })} />
              No morning quotas
            </label>
          </div>
        </FormField>

        <FormField label="Days" error={errors.days} hint="None selected = every day.">
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((label, i) => {
              const on = draft.days.includes(i)
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={on}
                  disabled={!editable}
                  onClick={() => set({ days: on ? draft.days.filter((d) => d !== i) : [...draft.days, i] })}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                    on ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white text-slate-600 ring-slate-300 hover:bg-brand-50 hover:text-brand-700'
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </FormField>
      </div>
    </Card>
  )
}

// ---------- today's morning ----------

function MorningStrip({ morning, checkpoint }: { morning: RoundRobinMorning; checkpoint: string | null }) {
  const left = Math.max(morning.backlog - morning.given, 0)
  const items: [string, ReactNode][] = [
    ['Overnight backlog', morning.backlog],
    ['Quota each', `${morning.quota} (÷ ${morning.members} with toggle on)`],
    ['Quotas handed out', morning.given],
    [
      `Split at ${checkpoint ?? 'checkpoint'}`,
      morning.closedAt ? `${morning.split} · ${dayjs(morning.closedAt).format('h:mm A')}` : `${left} waiting`,
    ],
  ]
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-sky-100 bg-sky-50/60 px-4 py-3">
      <span className="flex items-center gap-2 text-sm font-semibold text-sky-800">
        <Sunrise className="h-4 w-4" /> This morning
      </span>
      {items.map(([label, value]) => (
        <span key={label} className="text-xs text-slate-600">
          {label}: <span className="font-semibold tabular-nums text-slate-900">{value}</span>
        </span>
      ))}
    </div>
  )
}

// ---------- rotation table ----------

function memberStatus(m: RoundRobinMember): { label: string; tone: 'green' | 'slate' | 'amber' } {
  if (m.eligible) return { label: 'Eligible', tone: 'green' }
  if (!m.receivesLeads) return { label: 'Toggle off', tone: 'slate' }
  if (!m.hasLeadsAccess) return { label: 'No leads access', tone: 'amber' }
  if (m.teamPaused) return { label: 'Paused team', tone: 'amber' }
  if (m.onBreak) return { label: `${m.onBreak.label} · ${dayjs(m.onBreak.startedAt).format('h:mm A')}`, tone: 'amber' }
  return { label: 'Offline', tone: 'slate' }
}

const bySequence = (rows: RoundRobinMember[]) => [...rows].sort((a, b) => (a.sequence ?? 1e6) - (b.sequence ?? 1e6))

/** The members the caller manages in their new order after moving `m` one place up (-1) or down (+1) among them. */
function moved(rows: RoundRobinMember[], m: RoundRobinMember, step: -1 | 1): string[] | null {
  const mine = rows.filter((r) => r.canManage).map((r) => r._id)
  const at = mine.indexOf(m._id)
  const to = at + step
  if (at < 0 || to < 0 || to >= mine.length) return null
  ;[mine[at], mine[to]] = [mine[to], mine[at]]
  return mine
}

/**
 * Round-robin control room: who gets the next Meta / Google / Website lead, the
 * Super Admin's on/off, channel, IST window and morning-checkpoint settings, and
 * the fixed sequence. A member gets leads only while logged in, with the toggle
 * on and not on a break; the team's manager (HOD) — or the Super Admin — flips
 * the toggle and moves members up and down. Polls so online state follows
 * members logging in and out.
 */
export default function RoundRobinPage() {
  const me = useCurrentUser()
  const { data, isLoading, isFetching, isError, error, refetch } = useRoundRobinStatusQuery(undefined, { pollingInterval: POLL_MS })
  const [setUser] = useSetRoundRobinUserMutation()
  const [setSequence, { isLoading: reordering }] = useSetRoundRobinSequenceMutation()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const canEdit = can(me, 'round_robin', 'edit')

  const onToggle = async (m: RoundRobinMember, receivesLeads: boolean) => {
    setPendingId(m._id)
    try {
      const res = await setUser({ userId: m._id, receivesLeads }).unwrap()
      toast.success(res.message)
    } catch (err) {
      toast.error(parseApiError(err).message)
    } finally {
      setPendingId(null)
    }
  }

  const rows = bySequence(data?.data.rotation ?? [])

  const onMove = async (m: RoundRobinMember, step: -1 | 1) => {
    const order = moved(rows, m, step)
    if (!order) return
    try {
      await setSequence(order).unwrap()
      toast.success(`${m.name} moved ${step < 0 ? 'up' : 'down'}`)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  const reorderable = canEdit && !!data?.data.canReorder
  const nextUpId = data?.data.nextUp?._id

  const columns: Column<RoundRobinMember>[] = [
    {
      key: 'sequence',
      header: '#',
      className: 'w-24',
      render: (m) => (
        <div className="flex items-center gap-1">
          <span className="w-6 text-xs font-semibold tabular-nums text-slate-600">{m.sequence ?? '—'}</span>
          {reorderable && m.canManage && (
            <>
              <Button variant="ghost" size="icon" className="!h-6 !w-6" aria-label={`Move ${m.name} up`} disabled={reordering || !moved(rows, m, -1)} onClick={() => onMove(m, -1)}>
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="!h-6 !w-6" aria-label={`Move ${m.name} down`} disabled={reordering || !moved(rows, m, 1)} onClick={() => onMove(m, 1)}>
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      ),
    },
    {
      key: 'name',
      header: 'User',
      render: (m) => (
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium text-slate-800">
            {m.name}
            {m._id === nextUpId && <Badge tone="green">Next</Badge>}
          </p>
          <p className="text-[11px] text-slate-500">{[m.roleLabel, m.team ?? m.email].filter(Boolean).join(' · ')}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (m) => {
        const s = memberStatus(m)
        return (
          <span className="inline-flex items-center gap-2" title={m.online ? 'Logged in' : 'Not logged in'}>
            <span className={cn('h-2 w-2 shrink-0 rounded-full', m.online ? 'bg-emerald-500' : 'bg-slate-300')} />
            <Badge tone={s.tone}>{s.label}</Badge>
          </span>
        )
      },
    },
    {
      key: 'today',
      header: 'Today',
      render: (m) => (
        <div className="text-xs text-slate-600">
          <span className="font-semibold tabular-nums text-slate-900">{m.assignedToday}</span>
          {m.morningLeads > 0 && <span className="text-slate-500"> · {m.morningLeads} morning</span>}
          {m.lastAssignedAt && <p className="text-[11px] text-slate-400">last {dayjs(m.lastAssignedAt).format('h:mm A')}</p>}
        </div>
      ),
    },
    {
      key: 'receivesLeads',
      header: 'Toggle',
      align: 'right',
      className: 'w-20',
      render: (m) => (
        <span title={!m.hasLeadsAccess ? 'Grant View on the Leads module first' : !m.canManage ? NOT_THEIR_HOD : undefined}>
          <Switch
            label={`${m.name} receives leads`}
            checked={m.receivesLeads}
            disabled={!canEdit || !m.canManage || !m.hasLeadsAccess}
            loading={pendingId === m._id}
            onChange={(v) => onToggle(m, v)}
          />
        </span>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Round Robin"
        description="New Meta, Google, Website, Telephony and Chatbot leads go to logged-in members in a fixed sequence. Manual leads are unaffected."
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} /> Refresh
          </Button>
        }
      />

      {/* Reports do not depend on the live status, so they sit above it and stay available while it loads */}
      <div className="mb-4">
        <ReportsCard />
      </div>

      {isLoading ? (
        <LoadingState />
      ) : isError || !data ? (
        <ErrorState message={isError ? parseApiError(error).message : undefined} onRetry={refetch} error={error} />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Rotation" value={<StatusPill status={data.data} />} icon={Activity} accent="from-brand-400 to-brand-600 shadow-brand-500/40" />
            <Stat label="Next up" value={data.data.nextUp?.name ?? '—'} hint={data.data.nextUp ? 'gets the next lead' : 'nobody eligible right now'} icon={UserRoundCheck} accent="from-emerald-400 to-emerald-600 shadow-emerald-500/40" />
            <Stat
              label="Last assigned"
              value={data.data.lastAssigned?.name ?? '—'}
              hint={`${data.data.assignedToday.toLocaleString()} assigned today`}
              icon={UserCheck}
              accent="from-sky-500 to-sky-600 shadow-sky-500/40"
            />
            <Stat
              label="Unassigned pool"
              value={data.data.unassignedPoolCount.toLocaleString()}
              hint={poolHint(data.data)}
              icon={Inbox}
              accent={data.data.unassignedPoolCount ? 'from-gold-300 to-gold-500 shadow-gold-400/50' : 'from-slate-400 to-slate-500 shadow-slate-400/40'}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <SettingsCard settings={data.data.settings} editable={!!me?.isSuperAdmin} />
            <div className="min-w-0">
              <div className="mb-2 flex items-center justify-between gap-3 px-1">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <span aria-hidden className="h-3.5 w-1 shrink-0 rounded-full bg-gold-400" />
                  Sequence
                </h3>
                <span className="text-[11px] text-slate-400">
                  {reorderable ? 'Move your team up or down · ' : ''}Updates every {POLL_MS / 1000}s
                </span>
              </div>
              {data.data.morning && <MorningStrip morning={data.data.morning} checkpoint={data.data.settings.checkpoint} />}
              <DataTable
                columns={columns}
                rows={rows}
                rowKey={(m) => m._id}
                emptyTitle="No users in the pool"
                emptyDescription="Tick 'In round-robin lead pool' on any user with Leads access, except a Super Admin, in Users & Access."
                rowClassName={(m) => (m.eligible ? undefined : 'opacity-70')}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
