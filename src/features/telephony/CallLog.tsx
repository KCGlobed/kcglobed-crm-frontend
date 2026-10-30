import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Download, PhoneIncoming, PhoneOutgoing } from 'lucide-react'
import { toast } from 'sonner'
import { callLogQuery, useTelephonyCallsQuery, type CallLogParams, type CallMetric } from '../../services/telephonyApi'
import { CALL_METRICS } from './callMetrics'
import { useUserOptionsQuery } from '../../services/adminApi'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { DateRangeFilter } from '../../components/ui/DateRangeFilter'
import { Select } from '../../components/ui/fields'
import { Card } from '../../components/ui/misc'
import { authorizedDownload } from '../../lib/download'
import { formatHms } from '../../lib/durations'
import { formatDateTime, parseApiError } from '../../lib/utils'
import type { LiveCall } from '../../types/models'
import { RecordingPlayer } from './RecordingPlayer'
import { statusLabel, statusTone } from './callState'

const columns: Column<LiveCall>[] = [
  { key: 'when', header: 'Date & Time', render: (c) => <span className="whitespace-nowrap text-xs text-slate-600">{formatDateTime(c.startedAt ?? c.createdAt)}</span> },
  {
    key: 'direction',
    header: '',
    className: 'w-8',
    render: (c) =>
      c.direction === 'inbound' ? <PhoneIncoming className="h-3.5 w-3.5 text-emerald-600" aria-label="Inbound" /> : <PhoneOutgoing className="h-3.5 w-3.5 text-brand-600" aria-label="Outbound" />,
  },
  { key: 'user', header: 'Counsellor', render: (c) => <span className="text-xs text-slate-800">{c.user?.name ?? <span className="text-slate-400">—</span>}</span> },
  {
    key: 'lead',
    header: 'Lead / caller',
    render: (c) =>
      c.lead ? (
        <Link to={`/app/leads/${c.lead._id}`} onClick={(e) => e.stopPropagation()} className="block text-xs hover:underline">
          <span className="font-medium text-brand-700">{c.lead.name}</span>
          <span className="block text-[11px] text-slate-400">
            {c.lead.leadNo}
            {c.customerNumber ? ` · ${c.customerNumber}` : ''}
          </span>
        </Link>
      ) : (
        <span className="text-xs text-slate-500">{c.customerNumber ?? 'Unknown'}</span>
      ),
  },
  { key: 'status', header: 'Status', render: (c) => <Badge tone={statusTone(c.status)}>{statusLabel(c.status)}</Badge> },
  { key: 'talk', header: 'Talk time', align: 'right', render: (c) => <span className="font-mono text-xs tabular-nums">{c.status === 'answered' && c.durationSeconds != null ? formatHms(c.durationSeconds) : '—'}</span> },
  { key: 'outcome', header: 'Outcome', render: (c) => <span className="text-xs text-slate-600">{c.subStage ?? c.stage ?? (c.needsDisposition ? <span className="text-amber-700">pending</span> : '—')}</span> },
  { key: 'source', header: 'Source', render: (c) => <Badge tone={c.source === 'dialer' ? 'cyan' : 'slate'}>{c.source}</Badge> },
  {
    key: 'recording',
    header: 'Recording',
    render: (c) =>
      c.recording || c.recordingPending ? (
        <RecordingPlayer callId={c._id} proofId={c.recording?._id} fileName={c.recording?.fileName} pending={c.recordingPending} compact />
      ) : (
        <span className="text-xs text-slate-400">—</span>
      ),
  },
]

/**
 * The call log: filters, the calls (newest first) and the Excel export of the same filters. Used by Communication →
 * Calling and by the Calls page each dashboard call card opens (so a card's count is this list's total).
 */
export function CallLog({
  filters,
  onChange,
  title = 'Call log',
  showPeople = true,
  extraActions,
}: {
  filters: CallLogParams
  onChange: (filters: CallLogParams) => void
  title?: ReactNode
  /** the counsellor picker (needs the users list: admins) */
  showPeople?: boolean
  extraActions?: ReactNode
}) {
  const { data: people } = useUserOptionsQuery(undefined, { skip: !showPeople })
  const { data, isLoading, isFetching, isError, error, refetch } = useTelephonyCallsQuery(filters)
  const set = (patch: Partial<CallLogParams>) => onChange({ ...filters, ...patch, page: patch.page ?? 1 })
  const exportXlsx = () =>
    authorizedDownload(`/telephony/calls/export?${callLogQuery({ ...filters, page: undefined, page_size: undefined })}`, 'call-log.xlsx').catch((e) =>
      toast.error(parseApiError(e).message)
    )

  return (
    <Card
      title={title}
      actions={
        <div className="flex gap-2">
          {extraActions}
          <Button variant="outline" size="sm" onClick={exportXlsx}>
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <DateRangeFilter from={filters.from} to={filters.to} onChange={(from, to) => set({ from: from || undefined, to: to || undefined })} label="Call Date" heading="Calls Between" />
        {showPeople && (
          <Select className="!w-auto" value={filters.userId ?? ''} onChange={(e) => set({ userId: e.target.value || undefined })} aria-label="Counsellor">
            <option value="">All counsellors</option>
            {people?.data.map((u) => (
              <option key={u._id} value={u._id}>
                {u.name}
              </option>
            ))}
          </Select>
        )}
        <Select className="!w-auto" value={filters.metric ?? ''} onChange={(e) => set({ metric: (e.target.value || undefined) as CallMetric | undefined })} aria-label="Calls">
          <option value="">All calls</option>
          {CALL_METRICS.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </Select>
        <Select className="!w-auto" value={filters.direction ?? ''} onChange={(e) => set({ direction: e.target.value || undefined })} aria-label="Direction">
          <option value="">In & out</option>
          <option value="outbound">Outbound</option>
          <option value="inbound">Inbound</option>
        </Select>
        <Select className="!w-auto" value={filters.status ?? ''} onChange={(e) => set({ status: e.target.value || undefined })} aria-label="Status">
          <option value="">Any status</option>
          <option value="answered">Connected</option>
          <option value="not_answered">Not answered</option>
          <option value="busy">Busy</option>
          <option value="failed">Failed</option>
        </Select>
        <Select className="!w-auto" value={filters.source ?? ''} onChange={(e) => set({ source: e.target.value || undefined })} aria-label="Source">
          <option value="">Dialer & manual</option>
          <option value="dialer">Dialer</option>
          <option value="manual">Manual</option>
        </Select>
      </div>
      <DataTable
        columns={columns}
        rows={data?.data}
        rowKey={(c) => c._id}
        loading={isLoading || isFetching}
        error={isError}
        errorMessage={isError ? parseApiError(error).message : undefined}
        onRetry={refetch}
        emptyTitle="No calls"
        emptyDescription="No calls match these filters."
        pagination={data?.pagination}
        onPageChange={(page) => set({ page })}
        onPageSizeChange={(page_size) => set({ page_size })}
      />
    </Card>
  )
}
