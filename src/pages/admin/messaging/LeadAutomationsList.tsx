import { useMemo, useState } from 'react'
import { AlertTriangle, CalendarClock, Mail, MessageCircle, MessageSquareText, Pencil, Plus, Trash2, Zap, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../../components/ui/Button'
import { ConfirmDialog, EmptyState, Skeleton } from '../../../components/ui/feedback'
import { Switch } from '../../../components/ui/fields'
import { cn, formatDateTime, parseApiError } from '../../../lib/utils'
import { useFilterFieldsQuery } from '../../../services/leadsApi'
import {
  useDeleteAutomationMutation,
  useListAutomationsQuery,
  useMessagingOptionsQuery,
  useUpdateAutomationMutation,
} from '../../../services/messagingApi'
import type { AutomationRow } from '../../../types/models'
import { AutomationEditor } from './AutomationEditor'
import { audienceText, whenText, type Channel } from './automationText'
import type { StatusFilter } from './notifications'

const CHANNEL_LOOK: Record<Channel, { icon: LucideIcon; disc: string }> = {
  sms: { icon: MessageSquareText, disc: 'bg-brand-50 text-brand-600' },
  whatsapp: { icon: MessageCircle, disc: 'bg-emerald-50 text-emerald-600' },
  email: { icon: Mail, disc: 'bg-pink-50 text-pink-600' },
}

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

/**
 * The lead automations (messages that go out on their own) as a list with on/off, edit and delete — shown under
 * Communication → Automation and again under Communication → Notifications → Lead messages. It owns its data; the
 * caller provides the search / status filter and the "new automation" action.
 */
export function LeadAutomationsList({ editable, status, search, onNew }: { editable: boolean; status: StatusFilter; search: string; onNew: () => void }) {
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
