import { useState } from 'react'
import { Download, RotateCw, X } from 'lucide-react'
import { toast } from 'sonner'
import { useCurrentUser } from '../../app/hooks'
import { can } from '../../constants/permissions'
import { useListParams } from '../../hooks/useListParams'
import { authorizedDownload } from '../../lib/download'
import { parseApiError } from '../../lib/utils'
import { useListReportRunsQuery, useListReportSchedulesQuery, useResendReportRunMutation } from '../../services/reportsApi'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Select } from '../../components/ui/fields'
import { FilterBar } from '../../components/ui/misc'
import type { ReportRun, ReportRunStatus } from '../../types/models'
import { RUN_STATUS, TRIGGER_LABEL, when } from './reportFormat'

/**
 * Send history: every scheduled, run-now and resent email — when, to whom, sent or why not, with the exact
 * Excel file that went out (download, or resend it to the same people).
 */
export function RunsTab() {
  const user = useCurrentUser()
  const canExport = can(user, 'reports', 'export')
  const canResend = can(user, 'reports', 'create')
  const { query, setParam } = useListParams({ sort_by: 'createdAt', sort_order: 'desc' }, ['schedule', 'status'])
  const runs = useListReportRunsQuery({ page: query.page, page_size: query.page_size, schedule: query.schedule, status: query.status })
  const { data: schedules } = useListReportSchedulesQuery()
  const [resendRun] = useResendReportRunMutation()
  const [busy, setBusy] = useState<string | null>(null)
  const scheduleName = schedules?.data.find((s) => s._id === query.schedule)?.name

  const download = (r: ReportRun) =>
    authorizedDownload(`/reports/runs/${r._id}/download`, r.fileName ?? 'report.xlsx').catch((e) => toast.error(parseApiError(e).message))

  const resend = async (r: ReportRun) => {
    setBusy(r._id)
    try {
      const run = (await resendRun(r._id).unwrap()).data
      if (run.status === 'sent') toast.success(`${r.name} resent`)
      else toast.error(`Not sent: ${run.error ?? 'unknown error'}`)
    } catch (e) {
      toast.error(parseApiError(e).message)
    } finally {
      setBusy(null)
    }
  }

  const columns: Column<ReportRun>[] = [
    {
      key: 'when',
      header: 'When',
      render: (r) => (
        <div className="flex flex-col">
          <span className="text-xs tabular-nums text-slate-700">{when(r.startedAt ?? r.createdAt)}</span>
          <span className="text-[11px] text-slate-400">
            {TRIGGER_LABEL[r.trigger]}
            {r.triggeredBy?.name ? ` by ${r.triggeredBy.name}` : ''}
          </span>
        </div>
      ),
    },
    {
      key: 'report',
      header: 'Report',
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-800">{r.name}</p>
          <p className="truncate text-[11px] text-slate-500">
            {r.periodLabel}
            {r.hasFile ? ` · ${r.rowCount} row${r.rowCount === 1 ? '' : 's'}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'to',
      header: 'To',
      render: (r) => (
        <span className="text-xs text-slate-700" title={[...r.recipients, ...r.cc].join(', ')}>
          {r.recipients[0]}
          {r.recipients.length + r.cc.length > 1 && <span className="text-slate-400"> +{r.recipients.length + r.cc.length - 1}</span>}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <div className="flex max-w-xs flex-col gap-0.5">
          <span>
            <Badge tone={RUN_STATUS[r.status].tone} dot>
              {RUN_STATUS[r.status].label}
            </Badge>
            {r.attempts > 1 && <span className="ml-1.5 text-[11px] text-slate-400">attempt {r.attempts}</span>}
          </span>
          {r.status === 'retry' && r.nextAttemptAt && <span className="text-[11px] text-amber-700">Next try {when(r.nextAttemptAt)}</span>}
          {r.error && r.status !== 'sent' && (
            <span className="whitespace-normal text-[11px] leading-4 text-red-600" title={r.error}>
              {r.error.length > 120 ? `${r.error.slice(0, 120)}…` : r.error}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (r) =>
        r.hasFile ? (
          <div className="flex items-center justify-end gap-1">
            {canExport && (
              <Button variant="ghost" size="sm" onClick={() => download(r)} title={r.fileName ?? undefined}>
                <Download className="h-3.5 w-3.5" /> Excel
              </Button>
            )}
            {canResend && (
              <Button variant="ghost" size="sm" onClick={() => resend(r)} loading={busy === r._id} title="Send the same file to the same people again">
                <RotateCw className="h-3.5 w-3.5" /> Resend
              </Button>
            )}
          </div>
        ) : null,
    },
  ]

  return (
    <div>
      <FilterBar>
        <Select className="!w-auto" value={(query.status as string) ?? ''} onChange={(e) => setParam('status', e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          {(Object.keys(RUN_STATUS) as ReportRunStatus[]).map((s) => (
            <option key={s} value={s}>
              {RUN_STATUS[s].label}
            </option>
          ))}
        </Select>
        <Select className="!w-auto" value={(query.schedule as string) ?? ''} onChange={(e) => setParam('schedule', e.target.value)} aria-label="Schedule">
          <option value="">All schedules</option>
          {schedules?.data.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name}
            </option>
          ))}
        </Select>
        {Boolean(query.schedule) && (
          <Button variant="ghost" size="sm" onClick={() => setParam('schedule', '')}>
            <X className="h-3.5 w-3.5" /> {scheduleName ? `Clear "${scheduleName}"` : 'Clear schedule'}
          </Button>
        )}
      </FilterBar>
      <DataTable
        columns={columns}
        rows={runs.data?.data}
        rowKey={(r) => r._id}
        loading={runs.isLoading}
        error={runs.isError}
        errorDetail={runs.error}
        onRetry={runs.refetch}
        pagination={runs.data?.pagination}
        onPageChange={(p) => setParam('page', p)}
        onPageSizeChange={(s) => setParam('page_size', s)}
        emptyTitle="No sends yet"
        emptyDescription="Scheduled report emails appear here as they go out, with the file that was sent."
      />
    </div>
  )
}
