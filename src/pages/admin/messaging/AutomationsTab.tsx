import { useState } from 'react'
import { Info, Plus, Search } from 'lucide-react'
import { useCurrentUser } from '../../../app/hooks'
import { Button } from '../../../components/ui/Button'
import { Input } from '../../../components/ui/fields'
import { SegmentedTabs, StatusFilterButtons } from '../../../components/ui/segmented'
import { can } from '../../../constants/permissions'
import { useListAutomationsQuery, useListStaffAlertsQuery } from '../../../services/messagingApi'
import { AutomationEditor } from './AutomationEditor'
import { AUTOMATION_RULES } from './automationText'
import { LeadAutomationsList } from './LeadAutomationsList'
import type { StatusFilter } from './notifications'
import { StaffAlertsSection } from './StaffAlertsSection'

type View = 'automations' | 'alerts'

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
        <SegmentedTabs tabs={views} active={view} onChange={(key) => setView(key as View)} />
        {view === 'automations' && (
          <span className="text-slate-400" title={AUTOMATION_RULES} aria-label={AUTOMATION_RULES}>
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
            <StatusFilterButtons value={status} onChange={setStatus} total={rows.length} on={onCount} />
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
        <LeadAutomationsList editable={editable} status={status} search={search} onNew={() => setCreating(true)} />
      )}
      {creating && <AutomationEditor onClose={() => setCreating(false)} />}
    </>
  )
}
