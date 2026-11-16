import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Info, Plus, Search } from 'lucide-react'
import { useCurrentUser } from '../../../app/hooks'
import { Button } from '../../../components/ui/Button'
import { ErrorState, Skeleton } from '../../../components/ui/feedback'
import { Input } from '../../../components/ui/fields'
import { SegmentedTabs, StatusFilterButtons } from '../../../components/ui/segmented'
import { can } from '../../../constants/permissions'
import { useListAutomationsQuery, useListStaffAlertsQuery } from '../../../services/messagingApi'
import type { StaffAlertRow } from '../../../types/models'
import { AccountEmailsTable } from './AccountEmailsTable'
import { AutomationEditor } from './AutomationEditor'
import { AUTOMATION_RULES } from './automationText'
import { LeadAutomationsList } from './LeadAutomationsList'
import { NOTIFICATION_VIEWS, filterAlerts, newAlert, splitByKind, type NotificationsView, type StatusFilter } from './notifications'
import { StaffAlertDrawer, type DrawerPrefill } from './StaffAlertDrawer'
import { StaffAlertsTable } from './StaffAlertsTable'

const HINT: Record<NotificationsView, string> = {
  staff:
    "Every alert is always in each person's bell. Push also needs the person to allow push notifications in the bell menu. " +
    'Email goes to their address, SMS to their mobile — SMS needs the DLT sender and template ids when Webinfosys is the provider. ' +
    'Built-in alerts cannot be deleted: switch them off instead.',
  account: 'Sent to a user when their account is created, a temporary password is issued, or they ask to reset it. They are always on; edit the wording or send yourself a test.',
  lead: AUTOMATION_RULES,
}

/**
 * Communication → Notifications: everything the CRM sends its users, in three views — the staff alerts (bell /
 * push / email / SMS to counsellors and admins) as a table of rules with their switches, the account emails, and
 * the lead messages (the same lead automations as under Automation). The view lives in the URL (?view=…).
 */
export function NotificationsTab() {
  const user = useCurrentUser()
  const editable = can(user, 'automation', 'edit')
  const [params, setParams] = useSearchParams()
  const requested = params.get('view') as NotificationsView | null
  const view: NotificationsView = requested && NOTIFICATION_VIEWS.includes(requested) ? requested : 'staff'
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [editing, setEditing] = useState<{ row: StaffAlertRow; prefill?: DrawerPrefill } | null>(null)
  const [adding, setAdding] = useState(false)
  const [creating, setCreating] = useState(false)
  const { data, isLoading, isError, error, refetch } = useListStaffAlertsQuery({ scope: 'all' })
  const { data: automations } = useListAutomationsQuery(undefined, { pollingInterval: 30000 })
  const { staff, account } = useMemo(() => splitByKind(data?.data.items ?? []), [data])

  const setView = (next: string) => {
    const query = new URLSearchParams(params)
    if (next === 'staff') query.delete('view')
    else query.set('view', next)
    setParams(query, { replace: true })
    setSearch('')
    setStatus('all')
  }

  const leadRows = automations?.data ?? []
  const views = [
    { key: 'staff', label: 'Staff alerts', count: data ? staff.length : undefined },
    { key: 'account', label: 'Account emails', count: data ? account.length : undefined },
    { key: 'lead', label: 'Lead messages', count: automations ? leadRows.length : undefined },
  ]
  const filterRows = view === 'staff' ? staff : view === 'account' ? account : []
  const onCount = view === 'lead' ? leadRows.filter((r) => r.isActive).length : filterRows.filter((r) => r.isActive).length
  const total = view === 'lead' ? leadRows.length : filterRows.length

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SegmentedTabs tabs={views} active={view} onChange={setView} />
        <span className="text-slate-400" title={HINT[view]} aria-label={HINT[view]}>
          <Info className="h-4 w-4" />
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              aria-label={view === 'lead' ? 'Search automations' : view === 'account' ? 'Search account emails' : 'Search alerts'}
              className="w-44 pl-8"
            />
          </div>
          {view !== 'account' && total > 0 && <StatusFilterButtons value={status} onChange={setStatus} total={total} on={onCount} />}
          {editable && view === 'staff' && (
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="h-3.5 w-3.5" /> Add alert
            </Button>
          )}
          {editable && view === 'lead' && (
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-3.5 w-3.5" /> New automation
            </Button>
          )}
        </div>
      </div>

      {view === 'lead' ? (
        <LeadAutomationsList editable={editable} status={status} search={search} onNew={() => setCreating(true)} />
      ) : isLoading || (!data && !isError) ? (
        <Skeleton className="h-48 w-full" />
      ) : isError || !data ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : view === 'staff' ? (
        <StaffAlertsTable
          rows={filterAlerts(staff, search, status)}
          groups={data.data.groups}
          options={data.data}
          editable={editable}
          onEdit={(row, prefill) => setEditing({ row, prefill })}
          onAdd={() => setAdding(true)}
          hasAny={staff.length > 0}
        />
      ) : (
        <AccountEmailsTable rows={filterAlerts(account, search, 'all')} editable={editable} onEdit={(row, prefill) => setEditing({ row, prefill })} />
      )}

      {editing && data && <StaffAlertDrawer alert={editing.row} options={data.data} prefill={editing.prefill} onClose={() => setEditing(null)} />}
      {adding && data && <StaffAlertDrawer alert={newAlert(data.data)} isNew options={data.data} onClose={() => setAdding(false)} />}
      {creating && <AutomationEditor onClose={() => setCreating(false)} />}
    </>
  )
}
