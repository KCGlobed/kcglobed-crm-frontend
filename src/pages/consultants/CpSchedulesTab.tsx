import { useState } from 'react'
import { CalendarClock, History, Pencil, Send, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useCurrentUser } from '../../app/hooks'
import { can } from '../../constants/permissions'
import { parseApiError } from '../../lib/utils'
import {
  useCpDeleteReportScheduleMutation,
  useCpReportSchedulesQuery,
  useCpRunReportScheduleMutation,
  useCpUpdateReportScheduleMutation,
} from '../../services/consultantsApi'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { ConfirmDialog } from '../../components/ui/feedback'
import { Switch } from '../../components/ui/fields'
import type { ReportSchedule } from '../../types/models'
import { RUN_STATUS, scheduleWhen, when } from '../reports/reportFormat'

/**
 * Scheduled Channel Partners report emails: the Super Admin sees every schedule, anyone else their own. Run now
 * sends at once (to check a new schedule, or to send a missed day by hand); History opens the sends of one schedule.
 */
export function CpSchedulesTab({
  onNew,
  onEdit,
  onHistory,
}: {
  onNew: () => void
  onEdit: (schedule: ReportSchedule) => void
  onHistory: (schedule: ReportSchedule) => void
}) {
  const user = useCurrentUser()
  const canCreate = can(user, 'consultants.reports', 'create')
  const canEdit = can(user, 'consultants.reports', 'edit')
  const canDelete = can(user, 'consultants.reports', 'delete')
  const list = useCpReportSchedulesQuery()
  const [updateSchedule] = useCpUpdateReportScheduleMutation()
  const [runSchedule] = useCpRunReportScheduleMutation()
  const [deleteSchedule, { isLoading: deleting }] = useCpDeleteReportScheduleMutation()
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
        // DataTable takes no row attributes, so the row's test id sits on its first cell
        <div className="min-w-0" data-testid="cp-schedule-row" data-schedule-id={s._id}>
          <p className="truncate text-xs font-medium text-slate-800">{s.name}</p>
          <p className="truncate text-[11px] text-slate-500">
            {s.reportName} · {s.periodLabel}
            {s.filters.map((f) => ` · ${f.label}: ${f.value}`).join('')}
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
        <div className="flex items-center justify-end gap-0.5">
          {canCreate && (
            <Button
              variant="ghost"
              size="sm"
              data-testid="cp-schedule-run-now"
              onClick={() => runNow(s)}
              loading={sending === s._id}
              title="Send this report now"
            >
              <Send className="h-3.5 w-3.5" /> Run now
            </Button>
          )}
          {canEdit && (
            <Button variant="ghost" size="icon" data-testid="cp-schedule-edit" aria-label={`Edit ${s.name}`} title="Edit" onClick={() => onEdit(s)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            data-testid="cp-schedule-history"
            aria-label={`Send history of ${s.name}`}
            title="Send history"
            onClick={() => onHistory(s)}
          >
            <History className="h-3.5 w-3.5" />
          </Button>
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              data-testid="cp-schedule-delete"
              aria-label={`Delete ${s.name}`}
              title="Delete"
              onClick={() => setRemoving(s)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
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
        errorMessage={list.isError ? parseApiError(list.error).message : undefined}
        errorDetail={list.error}
        onRetry={list.refetch}
        emptyTitle="No scheduled reports"
        emptyDescription="Schedule a Channel Partners report to have it emailed with the Excel file attached — every day, week or month."
        emptyAction={
          canCreate ? (
            <Button size="sm" data-testid="cp-schedule-add-empty" onClick={onNew}>
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
