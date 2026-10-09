import { useState, type ReactNode } from 'react'
import { Activity, Inbox, RefreshCw, UserCheck, UserRoundCheck, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import {
  useRoundRobinStatusQuery,
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
import type { RoundRobinChannel, RoundRobinMember, RoundRobinSettings, RoundRobinStatus } from '../../types/models'

const POLL_MS = 30_000

const CHANNELS: { value: RoundRobinChannel; label: string }[] = [
  { value: 'meta', label: 'Meta Ads' },
  { value: 'google', label: 'Google' },
  { value: 'capture', label: 'Website' },
]
/** index = API value (0=Mon … 6=Sun) */
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

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

function StatusPill({ status }: { status: RoundRobinStatus }) {
  if (status.activeNow) return <Badge tone="green" dot>Running</Badge>
  if (!status.settings.enabled) return <Badge tone="slate" dot>Paused</Badge>
  return <Badge tone="amber" dot>Outside window</Badge>
}

// ---------- settings card ----------

interface Draft {
  enabled: boolean
  channels: RoundRobinChannel[]
  allDay: boolean
  windowStart: string
  windowEnd: string
  days: number[]
}

const toDraft = (s: RoundRobinSettings): Draft => ({
  enabled: s.enabled,
  channels: s.channels,
  allDay: s.windowStart === null && s.windowEnd === null,
  windowStart: s.windowStart ?? '',
  windowEnd: s.windowEnd ?? '',
  days: s.days,
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
              {draft.enabled ? `On · ${window} · ${days}` : 'Off — new leads wait in the Unassigned pool'}
            </p>
          </div>
          <Switch label="Round-robin enabled" checked={draft.enabled} onChange={(v) => set({ enabled: v })} disabled={!editable} />
        </div>

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

        <FormField label="Time window (IST)" error={errors.window ?? errors.windowStart ?? errors.windowEnd} hint="Leads that arrive outside the window wait in the pool and go out when it opens.">
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

// ---------- rotation table ----------

function memberStatus(m: RoundRobinMember): { label: string; tone: 'green' | 'slate' | 'amber' } {
  if (m.eligible) return { label: 'Eligible', tone: 'green' }
  if (!m.receivesLeads) return { label: 'Opted out', tone: 'slate' }
  if (m.teamPaused) return { label: 'Paused team', tone: 'amber' }
  return { label: 'Offline', tone: 'slate' }
}

/** Eligible counsellors in rotation order, then everyone else by name. */
function sortRotation(rows: RoundRobinMember[]) {
  return [...rows].sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1
    if (a.eligible) return (a.position ?? 0) - (b.position ?? 0)
    return a.name.localeCompare(b.name)
  })
}

/**
 * Round-robin control room: who gets the next Meta / Google / Website lead,
 * the Super Admin's on/off, channel and IST window settings, and a per-counsellor
 * in/out toggle. Polls so online state follows counsellors logging in and out.
 */
export default function RoundRobinPage() {
  const me = useCurrentUser()
  const { data, isLoading, isFetching, isError, error, refetch } = useRoundRobinStatusQuery(undefined, { pollingInterval: POLL_MS })
  const [setUser] = useSetRoundRobinUserMutation()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const canToggle = can(me, 'round_robin', 'edit')

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

  const columns: Column<RoundRobinMember>[] = [
    {
      key: 'position',
      header: '#',
      className: 'w-12',
      render: (m) => <span className="text-xs tabular-nums text-slate-500">{m.position ?? '—'}</span>,
    },
    {
      key: 'name',
      header: 'Counsellor',
      render: (m) => (
        <div className="min-w-0">
          <p className="font-medium text-slate-800">{m.name}</p>
          <p className="text-[11px] text-slate-500">{m.team ?? m.email}</p>
        </div>
      ),
    },
    {
      key: 'online',
      header: 'Online',
      render: (m) => (
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
          <span className={cn('h-2 w-2 rounded-full', m.online ? 'bg-emerald-500' : 'bg-slate-300')} />
          {m.online ? 'Online' : 'Offline'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (m) => {
        const s = memberStatus(m)
        return <Badge tone={s.tone}>{s.label}</Badge>
      },
    },
    {
      key: 'receivesLeads',
      header: 'Receives leads',
      align: 'right',
      className: 'w-32',
      render: (m) => (
        <Switch
          label={`${m.name} receives leads`}
          checked={m.receivesLeads}
          disabled={!canToggle}
          loading={pendingId === m._id}
          onChange={(v) => onToggle(m, v)}
        />
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Round Robin"
        description="New Meta, Google and Website leads go to online counsellors in turn. Manual leads are unaffected."
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} /> Refresh
          </Button>
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : isError || !data ? (
        <ErrorState message={isError ? parseApiError(error).message : undefined} onRetry={refetch} error={error} />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Rotation" value={<StatusPill status={data.data} />} icon={Activity} accent="from-brand-400 to-brand-600 shadow-brand-500/40" />
            <Stat label="Next up" value={data.data.nextUp?.name ?? '—'} hint={data.data.nextUp ? 'gets the next lead' : 'nobody eligible right now'} icon={UserRoundCheck} accent="from-emerald-400 to-emerald-600 shadow-emerald-500/40" />
            <Stat label="Last assigned" value={data.data.lastAssigned?.name ?? '—'} icon={UserCheck} accent="from-sky-500 to-sky-600 shadow-sky-500/40" />
            <Stat
              label="Unassigned pool"
              value={data.data.unassignedPoolCount.toLocaleString()}
              hint="waiting for the window / someone online"
              icon={Inbox}
              accent={data.data.unassignedPoolCount ? 'from-gold-300 to-gold-500 shadow-gold-400/50' : 'from-slate-400 to-slate-500 shadow-slate-400/40'}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <SettingsCard settings={data.data.settings} editable={!!me?.isSuperAdmin} />
            <div>
              <div className="mb-2 flex items-center justify-between gap-3 px-1">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <span aria-hidden className="h-3.5 w-1 shrink-0 rounded-full bg-gold-400" />
                  Rotation
                </h3>
                <span className="text-[11px] text-slate-400">Updates every {POLL_MS / 1000}s</span>
              </div>
              <DataTable
                columns={columns}
                rows={sortRotation(data.data.rotation)}
                rowKey={(m) => m._id}
                emptyTitle="No counsellors in the pool"
                emptyDescription="Tick “In round-robin lead pool” on a counsellor in Users & Access."
                rowClassName={(m) => (m.eligible ? undefined : 'opacity-70')}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
