import { useMemo, useState } from 'react'
import { AlertTriangle, CalendarClock, Info, Mail, MessageCircle, MessageSquareText, Pencil, Plus, Search, Trash2, Zap, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useCurrentUser } from '../../../app/hooks'
import { Button } from '../../../components/ui/Button'
import { ConfirmDialog, EmptyState, Skeleton } from '../../../components/ui/feedback'
import { Input, Switch } from '../../../components/ui/fields'
import { can } from '../../../constants/permissions'
import { cn, formatDateTime, parseApiError } from '../../../lib/utils'
import { useFilterFieldsQuery } from '../../../services/leadsApi'
import {
  useDeleteAutomationMutation,
  useListAutomationsQuery,
  useListStaffAlertsQuery,
  useMessagingOptionsQuery,
  useUpdateAutomationMutation,
} from '../../../services/messagingApi'
import type { AutomationRow } from '../../../types/models'
import { AutomationEditor } from './AutomationEditor'
import { audienceText, whenText, type Channel } from './automationText'
import { StaffAlertsSection } from './StaffAlertsSection'

const CHANNEL_LOOK: Record<Channel, { icon: LucideIcon; disc: string }> = {
  sms: { icon: MessageSquareText, disc: 'bg-brand-50 text-brand-600' },
  whatsapp: { icon: MessageCircle, disc: 'bg-emerald-50 text-emerald-600' },
  email: { icon: Mail, disc: 'bg-pink-50 text-pink-600' },
}
const RULES = 'Automations never reach Junk leads, skip leads who opted out of the channel, and send the same automation to a lead at most once a day.'
type View = 'automations' | 'alerts'
type StatusFilter = 'all' | 'on' | 'off'

/** What it has done, only when there is something to say: "24 sent · last 21 Oct, 10:30" / "next 23 Oct, 10:30". */
function activityLine(row: AutomationRow): string {
  const parts: string[] = []
  if (row.sentCount) parts.push(`${row.sentCount} sent`)
  const last = row.lastRun?.scheduledAt ?? row.lastRunAt
  if (last) parts.push(`last ${formatDateTime(last)}`)
  if (row.isActive && row.nextRunAt) parts.push(`next ${formatDateTime(row.nextRunAt)}`)
  return parts.join(' · ')
}

/** Why it cannot send, if it cannot. */
const templateProblem = (row: AutomationRow) =>
  !row.template ? 'Its template was deleted — choose another one' : !row.template.isActive ? 'Its template is switched off' : null

function LeadAutomations({ editable, status, search, onNew }: { editable: boolean; status: StatusFilter; search: string; onNew: () => void }) {
  const { data, isLoading } = useListAutomationsQuery(undefined, { pollingInterval: 30000 })
  const { data: meta } = useFilterFieldsQuery()
  const { data: options } = useMessagingOptionsQuery()
  const [update] = useUpdateAutomationMutation()
  const [remove, { isLoading: removing }] = useDeleteAutomationMutation()
  const [editing, setEditing] = useState<AutomationRow | null>(null)
  const [deleting, setDeleting] = useState<AutomationRow | null>(null)
  const [switching, setSwitching] = useState<string | null>(null)
  const fields = useMemo(() => meta?.data.fields ?? [], [meta])
  const eventLabels = useMemo(() => new Map((options?.data.triggers ?? []).map((t) => [t.value, t.label])), [options])

  const rows = data?.data ?? []
  const query = search.trim().toLowerCase()
  const shown = rows.filter((r) => (status === 'all' || r.isActive === (status === 'on')) && (!query || r.name.toLowerCase().includes(query)))

  const toggle = async (row: AutomationRow) => {
    setSwitching(row._id)
    try {
      const res = await update({ id: row._id, body: { isActive: !row.isActive } }).unwrap()
      toast.success(res.message)
    } catch (err) {
      toast.error(parseApiError(err).message)
    } finally {
      setSwitching(null)
    }
  }
  const onDelete = async () => {
    if (!deleting) return
    try {
      const res = await remove(deleting._id).unwrap()
      toast.success(res.message)
    } catch (err) {
      toast.error(parseApiError(err).message)
    } finally {
      setDeleting(null)
    }
  }

  if (isLoading) return <Skeleton className="h-48 w-full" />
  if (!rows.length) {
    return (
      <EmptyState
        title="No automations yet"
        description="Send a welcome message to every new lead, a note after a missed call, or a weekly reminder — set it up once and it runs by itself."
        action={
          editable ? (
            <Button size="sm" onClick={onNew}>
              <Plus className="h-3.5 w-3.5" /> Create your first automation
            </Button>
          ) : undefined
        }
      />
    )
  }
  return (
    <>
      {!shown.length ? (
        <EmptyState title="Nothing matches" description="Try another name, or show all automations." />
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {shown.map((row) => {
            const look = CHANNEL_LOOK[row.channel]
            const problem = templateProblem(row)
            const activity = activityLine(row)
            const eventLabel = (row.event && eventLabels.get(row.event)) ?? row.eventLabel
            return (
              <li
                key={row._id}
                className={cn('group flex items-center gap-3 px-4 py-3', editable && 'cursor-pointer hover:bg-slate-50', !row.isActive && 'bg-slate-50/60')}
                onClick={() => editable && setEditing(row)}
              >
                <span className={cn('rounded-lg p-2', row.isActive ? look.disc : 'bg-slate-100 text-slate-400')} title={row.channelLabel}>
                  <look.icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2">
                    <span className={cn('truncate text-sm font-medium', row.isActive ? 'text-slate-800' : 'text-slate-500')}>{row.name}</span>
                    {problem && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800" title={`${problem} — it cannot send until then.`}>
                        <AlertTriangle className="h-3 w-3" /> Can’t send
                      </span>
                    )}
                  </p>
                  {/* the rule, left to right: when → what (→ to whom, when not every lead) */}
                  <p className="flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
                    {row.triggerType === 'event' ? <Zap className="h-3 w-3 shrink-0 text-amber-500" /> : <CalendarClock className="h-3 w-3 shrink-0 text-sky-600" />}
                    <span className="truncate">
                      {whenText({ ...row, eventLabel })} → {row.channelLabel} “{row.template?.name ?? '—'}”
                      {row.conditions.length > 0 && ` · ${audienceText(row.conditions, fields)}`}
                    </span>
                  </p>
                </div>
                {activity && <p className="hidden w-48 shrink-0 text-right text-[11px] text-slate-400 lg:block">{activity}</p>}
                {editable && (
                  <div className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <Switch checked={row.isActive} onChange={() => toggle(row)} loading={switching === row._id} label={`${row.isActive ? 'Switch off' : 'Switch on'} ${row.name}`} />
                    <Button size="icon" variant="ghost" className="ml-1 text-slate-400 group-hover:text-slate-600" title="Edit" aria-label={`Edit ${row.name}`} onClick={() => setEditing(row)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="text-slate-300 hover:text-red-600 group-hover:text-red-500" title="Delete" aria-label={`Delete ${row.name}`} onClick={() => setDeleting(row)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {editing && <AutomationEditor automation={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={onDelete}
        title="Delete automation"
        message={`Delete "${deleting?.name}" permanently? Messages still waiting on its timer are cancelled; what it already sent stays in the history.`}
        confirmLabel="Delete"
        danger
        loading={removing}
      />
    </>
  )
}

/**
 * Communication → Automation, in two views: the lead automations (messages that go out on their own) and the
 * team alerts (what the team gets before a follow-up, on an untouched lead, on a new assignment). One
 * toolbar: the view switch, then — for the automations — search, the On / Off filter and New.
 */
export function AutomationsTab() {
  const user = useCurrentUser()
  const editable = can(user, 'automation', 'edit')
  const [view, setView] = useState<View>('automations')
  const [creating, setCreating] = useState(false)
  const [addingAlert, setAddingAlert] = useState(false)
  const [status, setStatus] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const { data: automations } = useListAutomationsQuery(undefined, { pollingInterval: 30000 })
  const { data: alerts } = useListStaffAlertsQuery()

  const rows = automations?.data ?? []
  const onCount = rows.filter((r) => r.isActive).length
  const views: { key: View; label: string; count?: number }[] = [
    { key: 'automations', label: 'Lead automations', count: automations?.data.length },
    { key: 'alerts', label: 'Team alerts', count: alerts?.data.items.length },
  ]
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="tablist" className="inline-flex rounded-lg bg-slate-100 p-1">
          {views.map((v) => (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={view === v.key}
              onClick={() => setView(v.key)}
              className={cn('rounded-md px-3 py-1.5 text-sm font-medium transition-colors', view === v.key ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-800')}
            >
              {v.label}
              {v.count !== undefined && <span className="ml-1.5 text-xs text-slate-400">{v.count}</span>}
            </button>
          ))}
        </div>
        {view === 'automations' && (
          <span className="text-slate-400" title={RULES} aria-label={RULES}>
            <Info className="h-4 w-4" />
          </span>
        )}
        {view === 'alerts' && editable && (
          <Button size="sm" className="ml-auto" onClick={() => setAddingAlert(true)}>
            <Plus className="h-3.5 w-3.5" /> Add alert
          </Button>
        )}
        {view === 'automations' && rows.length > 0 && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" aria-label="Search automations" className="w-44 pl-8" />
            </div>
            <div className="flex overflow-hidden rounded-md border border-slate-300 text-xs font-medium">
              {(
                [
                  ['all', `All ${rows.length}`],
                  ['on', `On ${onCount}`],
                  ['off', `Off ${rows.length - onCount}`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatus(key)}
                  className={status === key ? 'bg-brand-600 px-2.5 py-1.5 text-white' : 'bg-white px-2.5 py-1.5 text-slate-600 hover:bg-slate-100'}
                >
                  {label}
                </button>
              ))}
            </div>
            {editable && (
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus className="h-3.5 w-3.5" /> New automation
              </Button>
            )}
          </div>
        )}
      </div>
      {view === 'alerts' ? (
        <StaffAlertsSection adding={addingAlert} onAddClose={() => setAddingAlert(false)} />
      ) : (
        <LeadAutomations editable={editable} status={status} search={search} onNew={() => setCreating(true)} />
      )}
      {creating && <AutomationEditor onClose={() => setCreating(false)} />}
    </>
  )
}
