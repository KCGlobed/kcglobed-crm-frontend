import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarClock } from 'lucide-react'
import { useCurrentUser } from '../../app/hooks'
import { can } from '../../constants/permissions'
import { Button } from '../../components/ui/Button'
import { PageHeader } from '../../components/ui/misc'
import type { ReportSchedule } from '../../types/models'
import { CP_LEADS_PATH } from './cpShared'
import { CpReportViewer } from './CpReportViewer'
import { CpRunsTab } from './CpRunsTab'
import { CpScheduleFormModal } from './CpScheduleFormModal'
import { CpSchedulesTab } from './CpSchedulesTab'
import { CpTabs } from './CpTabs'

type Tab = 'reports' | 'schedules' | 'history'
const TABS: { key: Tab; label: string }[] = [
  { key: 'reports', label: 'Reports' },
  { key: 'schedules', label: 'Scheduled emails' },
  { key: 'history', label: 'Send history' },
]

/**
 * Channel Partners › Reports: the partnership team's reports on screen with Excel / CSV downloads (Reports tab),
 * report emails on a schedule (Scheduled emails) and every email that went out, with its file (Send history).
 * The student Reports screens on the /consultants/reports endpoints and their own tables. All times IST.
 */
export default function CpReportsPage() {
  const user = useCurrentUser()
  const canCreate = can(user, 'consultants.reports', 'create')
  const [params, setParams] = useSearchParams()
  const tab: Tab = TABS.find((t) => t.key === params.get('tab'))?.key ?? 'reports'
  const [form, setForm] = useState<{ schedule?: ReportSchedule; reportKey?: string; team?: string } | null>(null)

  // each tab keeps only its own URL state
  const switchTab = (key: string, extra: Record<string, string> = {}) =>
    setParams(new URLSearchParams(key === 'reports' ? extra : { tab: key, ...extra }), { replace: true })

  return (
    <>
      <PageHeader
        title="Reports"
        description="Partnership team reports that read only Channel Partners data, never the student leads. View and download them, or have them emailed with the Excel file on a schedule."
        breadcrumbs={[{ label: 'Channel Partners', to: CP_LEADS_PATH }, { label: 'Reports' }]}
        actions={
          tab !== 'reports' && canCreate ? (
            <Button data-testid="cp-schedule-add" onClick={() => setForm({})}>
              <CalendarClock className="h-4 w-4" /> Schedule a report
            </Button>
          ) : undefined
        }
      />
      <CpTabs testIdPrefix="cp-reports-tab" tabs={TABS} active={tab} onChange={(key) => switchTab(key)} />

      <div className="mt-4">
        {tab === 'reports' && <CpReportViewer onSchedule={(reportKey, team) => setForm({ reportKey, team })} />}
        {tab === 'schedules' && (
          <CpSchedulesTab
            onNew={() => setForm({})}
            onEdit={(schedule) => setForm({ schedule })}
            onHistory={(schedule) => switchTab('history', { schedule: schedule._id })}
          />
        )}
        {tab === 'history' && <CpRunsTab />}
      </div>

      {form && <CpScheduleFormModal schedule={form.schedule} reportKey={form.reportKey} team={form.team} onClose={() => setForm(null)} />}
    </>
  )
}
