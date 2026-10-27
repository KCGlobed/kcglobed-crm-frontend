import { useState } from 'react'
import { CalendarClock, History, Pencil, Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useCurrentUser } from '../../app/hooks'
import { can } from '../../constants/permissions'
import { parseApiError } from '../../lib/utils'
import {
  useDeleteReportScheduleMutation,
  useListReportSchedulesQuery,
  useRunReportScheduleMutation,
  useUpdateReportScheduleMutation,
} from '../../services/reportsApi'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { ConfirmDialog } from '../../components/ui/feedback'
import { Switch } from '../../components/ui/fields'
import { RowActions } from '../../components/ui/RowActions'
import type { ReportSchedule } from '../../types/models'
import { RUN_STATUS, scheduleWhen, when } from './reportFormat'

/**
 * Scheduled report emails: the Super Admin sees every schedule, anyone else their own. Run now sends at once
 * (to check a new schedule, or to send a missed day by hand); History opens the sends of one schedule.
 */
export function SchedulesTab({
  onNew,
  onEdit,
  onHistory,
}: {
  onNew: () => void
  onEdit: (schedule: ReportSchedule) => void
  onHistory: (schedule: ReportSchedule) => void
}) {
  const user = useCurrentUser()
  const canCreate = can(user, 'reports', 'create')
  const canEdit = can(user, 'reports', 'edit')
  const canDelete = can(user, 'reports', 'delete')
  const list = useListReportSchedulesQuery()
  const [updateSchedule] = useUpdateReportScheduleMutation()
  const [runSchedule] = useRunReportScheduleMutation()
  const [deleteSchedule, { isLoading: deleting }] = useDeleteReportScheduleMutation()
  const [toggling, setToggling] = useState<string | null>(null)
  const [sending, setSending] = useState<string | null>(null)
  const [removing, setRemoving] = useState<ReportSchedule | null>(null)

  const toggle = async (s: ReportSchedule, isActive: boolean) => {
    setToggling(s._id)
    try {
      await updateSchedule({ id: s._id, body: { isActive } }).unwrap()
      toast.success(isActive ? `${s.name} resumed` : `${s.name} paused`)
    } catch (e) {
      toast.error(parseApiError(e).message)
    } finally {
      setToggling(null)
    }
  }

  const runNow = async (s: ReportSchedule) => {
    setSending(s._id)
    try {
      const run = (await runSchedule(s._id).unwrap()).data
      if (run.status === 'sent') toast.success(`${s.name} sent to ${run.recipients.length} recipient${run.recipients.length === 1 ? '' : 's'}`)
      else toast.error(`${s.name} was not sent: ${run.error ?? 'unknown error'}`)
    } catch (e) {
      toast.error(parseApiError(e).message)
    } finally {
      setSending(null)
    }
  }

  const remove = async () => {
    if (!removing) return
    try {
      await deleteSchedule(removing._id).unwrap()
      toast.success('Schedule deleted')
      setRemoving(null)
    } catch (e) {
      toast.error(parseApiError(e).message)
    }
  }

  const columns: Column<ReportSchedule>[] = [
    {
      key: 'name',
      header: 'Schedule',
      render: (s) => (
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-800">{s.name}</p>
          <p className="truncate text-[11px] text-slate-500">
            {s.reportName} · {s.periodLabel}
          </p>
        </div>
      ),
    },
    { key: 'when', header: 'Sends', render: (s) => <span className="text-xs text-slate-700">{scheduleWhen(s)}</span> },
    {
      key: 'recipients',
      header: 'To',
      render: (s) => (
        <span className="text-xs text-slate-700" title={[...s.recipients, ...s.cc].join(', ')}>
          {s.recipients[0]}
          {s.recipients.length + s.cc.length > 1 && <span className="text-slate-400"> +{s.recipients.length + s.cc.length - 1}</span>}
        </span>
      ),
    },
    {
      key: 'next',
      header: 'Next send',
      render: (s) => <span className="text-xs tabular-nums text-slate-600">{s.isActive ? when(s.nextRunAt) : 'Paused'}</span>,
    },
    {
      key: 'last',
      header: 'Last send',
      render: (s) =>
        s.lastStatus ? (
          <div className="flex flex-col gap-0.5">
            <Badge tone={RUN_STATUS[s.lastStatus].tone} dot>
              {RUN_STATUS[s.lastStatus].label}
            </Badge>
            <span className="text-[11px] tabular-nums text-slate-400">{when(s.lastRunAt)}</span>
          </div>
        ) : (
          <span className="text-xs text-slate-400">Not sent yet</span>
        ),
    },
    ...(user?.isSuperAdmin
      ? [{ key: 'owner', header: 'Owner', render: (s: ReportSchedule) => <span className="text-xs text-slate-600">{s.owner?.name ?? '—'}</span> }]
      : []),
    {
      key: 'active',
      header: 'Active',
      align: 'center',
      render: (s) => (
        <Switch
          checked={s.isActive}
          onChange={(v) => toggle(s, v)}
          loading={toggling === s._id}
          disabled={!canEdit}
          label={s.isActive ? `Pause ${s.name}` : `Resume ${s.name}`}
        />
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (s) => (
        <div className="flex items-center justify-end gap-1">
          {canCreate && (
            <Button variant="ghost" size="sm" onClick={() => runNow(s)} loading={sending === s._id} title="Send this report now">
              <Send className="h-3.5 w-3.5" /> Run now
            </Button>
          )}
          <RowActions
            actions={[
              { label: 'Edit', icon: Pencil, onClick: () => onEdit(s), hidden: !canEdit },
              { label: 'Send history', icon: History, onClick: () => onHistory(s) },
              { label: 'Delete', icon: Trash2, onClick: () => setRemoving(s), danger: true, hidden: !canDelete },
            ]}
          />
        </div>
      ),
    },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        rows={list.data?.data}
        rowKey={(s) => s._id}
        loading={list.isLoading}
        error={list.isError}
        errorDetail={list.error}
        onRetry={list.refetch}
        emptyTitle="No scheduled reports"
        emptyDescription="Schedule a report to have it emailed with the Excel file attached — every day, week or month."
        emptyAction={
          canCreate ? (
            <Button size="sm" onClick={onNew}>
              <CalendarClock className="h-3.5 w-3.5" /> Schedule a report
            </Button>
          ) : undefined
        }
      />
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={remove}
        loading={deleting}
        danger
        title="Delete schedule?"
        message={`"${removing?.name}" will stop sending. Its past sends stay in the send history.`}
        confirmLabel="Delete"
      />
    </>
  )
}
