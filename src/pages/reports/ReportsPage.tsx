import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarClock } from 'lucide-react'
import { useCurrentUser } from '../../app/hooks'
import { can } from '../../constants/permissions'
import { Button } from '../../components/ui/Button'
import { PageHeader, Tabs } from '../../components/ui/misc'
import type { ReportSchedule } from '../../types/models'
import { ReportViewer } from './ReportViewer'
import { RunsTab } from './RunsTab'
import { ScheduleFormModal } from './ScheduleFormModal'
import { SchedulesTab } from './SchedulesTab'

type Tab = 'reports' | 'schedules' | 'history'
const TABS: { key: Tab; label: string }[] = [
  { key: 'reports', label: 'Reports' },
  { key: 'schedules', label: 'Scheduled emails' },
  { key: 'history', label: 'Send history' },
]

/**
 * Reports: every report on screen with Excel / CSV downloads (Reports tab), report emails on a schedule
 * (Scheduled emails) and every email that went out, with its file (Send history). All times IST.
 */
export default function ReportsPage() {
  const user = useCurrentUser()
  const canCreate = can(user, 'reports', 'create')
  const [params, setParams] = useSearchParams()
  const tab: Tab = TABS.find((t) => t.key === params.get('tab'))?.key ?? 'reports'
  const [form, setForm] = useState<{ schedule?: ReportSchedule; reportKey?: string } | null>(null)

  // each tab keeps only its own URL state
  const switchTab = (key: string, extra: Record<string, string> = {}) =>
    setParams(new URLSearchParams(key === 'reports' ? extra : { tab: key, ...extra }), { replace: true })

  return (
    <div>
      <PageHeader
        title="Reports"
        description="View and download reports, or have them emailed with the Excel file on a schedule."
        actions={
          tab !== 'reports' && canCreate ? (
            <Button onClick={() => setForm({})}>
              <CalendarClock className="h-4 w-4" /> Schedule a report
            </Button>
          ) : undefined
        }
      />
      <div className="mb-4">
        <Tabs tabs={TABS} active={tab} onChange={(key) => switchTab(key)} />
      </div>

      {tab === 'reports' && <ReportViewer onSchedule={(reportKey) => setForm({ reportKey })} />}
      {tab === 'schedules' && (
        <SchedulesTab
          onNew={() => setForm({})}
          onEdit={(schedule) => setForm({ schedule })}
          onHistory={(schedule) => switchTab('history', { schedule: schedule._id })}
        />
      )}
      {tab === 'history' && <RunsTab />}

      {form && <ScheduleFormModal schedule={form.schedule} reportKey={form.reportKey} onClose={() => setForm(null)} />}
    </div>
  )
}
