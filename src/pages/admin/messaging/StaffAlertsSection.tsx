import { useState } from 'react'
import { AlertTriangle, CalendarClock, MessageCircle, Pencil, UserPlus, Zap, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useCurrentUser } from '../../../app/hooks'
import { Button } from '../../../components/ui/Button'
import { Skeleton } from '../../../components/ui/feedback'
import { Switch } from '../../../components/ui/fields'
import { can } from '../../../constants/permissions'
import { cn, formatDateTime, parseApiError } from '../../../lib/utils'
import { useListStaffAlertsQuery, useUpdateStaffAlertMutation } from '../../../services/messagingApi'
import type { StaffAlertRow } from '../../../types/models'
import { newAlert } from './notifications'
import { StaffAlertDrawer } from './StaffAlertDrawer'

const ICON: Record<string, LucideIcon> = {
  follow_up_reminder: CalendarClock,
  lead_untouched: AlertTriangle,
  lead_assigned: UserPlus,
  whatsapp_reply: MessageCircle,
}

/**
 * Communication → Automation → Team alerts (its own view beside the lead automations): the follow-up reminder,
 * untouched-lead, new-lead-assigned and WhatsApp-reply alerts, and the ones added here (`adding`: the toolbar's Add
 * alert) — who gets them (the counsellor, roles, people), wording, channels and windows editable in one place.
 * Every other alert the CRM sends is under Communication → Notifications, on the same rows.
 */
export function StaffAlertsSection({ adding = false, onAddClose }: { adding?: boolean; onAddClose?: () => void }) {
  const user = useCurrentUser()
  const editable = can(user, 'automation', 'edit')
  const { data, isLoading } = useListStaffAlertsQuery()
  const [update] = useUpdateStaffAlertMutation()
  const [editing, setEditing] = useState<StaffAlertRow | null>(null)
  const [switching, setSwitching] = useState<string | null>(null)

  const toggle = async (row: StaffAlertRow) => {
    const key = row.trigger ?? row._id
    setSwitching(key)
    try {
      const res = await update({ trigger: key, body: { isActive: !row.isActive } }).unwrap()
      toast.success(res.message)
    } catch (err) {
      toast.error(parseApiError(err).message)
    } finally {
      setSwitching(null)
    }
  }

  if (isLoading || !data) return <Skeleton className="h-32 w-full" />
  return (
    <>
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {data.data.items.map((row) => {
          const Icon = row.trigger ? (ICON[row.trigger] ?? CalendarClock) : Zap
          const key = row.trigger ?? row._id
          const channels = [row.emailEnabled && 'Email', row.smsEnabled && 'SMS', row.pushEnabled && 'Push'].filter(Boolean).join(' · ')
          return (
            <li
              key={key}
              className={cn('group flex items-center gap-3 px-4 py-3', editable && 'cursor-pointer hover:bg-slate-50', !row.isActive && 'bg-slate-50/60')}
              onClick={() => editable && setEditing(row)}
            >
              <span className={cn('rounded-lg p-2', row.isActive ? 'bg-brand-50 text-brand-600' : 'bg-slate-100 text-slate-400')}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn('truncate text-sm font-medium', row.isActive ? 'text-slate-800' : 'text-slate-500')} title={row.when}>
                  {row.label}
                </p>
                <p className="truncate text-xs text-slate-500" title={row.updatedBy ? `Changed by ${row.updatedBy} · ${formatDateTime(row.updatedAt)}` : 'Default wording'}>
                  To {row.recipientsText ?? 'Counsellor'}
                  <span className="text-slate-300"> · </span>
                  {channels || 'no channel on'}
                </p>
              </div>
              {editable && (
                <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Switch checked={row.isActive} onChange={() => toggle(row)} loading={switching === key} label={`${row.isActive ? 'Switch off' : 'Switch on'} ${row.label}`} />
                  <Button size="icon" variant="ghost" className="text-slate-400 group-hover:text-slate-600" title="Edit" aria-label={`Edit ${row.label}`} onClick={() => setEditing(row)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {editing && <StaffAlertDrawer alert={editing} options={data.data} onClose={() => setEditing(null)} />}
      {adding && <StaffAlertDrawer alert={newAlert(data.data)} isNew options={data.data} onClose={() => onAddClose?.()} />}
    </>
  )
}
