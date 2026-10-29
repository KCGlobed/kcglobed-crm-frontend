import { useState } from 'react'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { formatHms } from '../../../lib/durations'
import { parseApiError } from '../../../lib/utils'
import { useAttendanceCallsQuery } from '../../../services/attendanceApi'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { DataTable, type Column } from '../../../components/ui/DataTable'
import { CallProofPreview } from '../../leads/CallProofDialogs'
import type { AttendanceCallRow } from '../../../types/models'

/**
 * Attendance → Call Proofs: every logged call with the duration the counsellor entered and its proofs. Preview
 * shows the screenshot large beside that duration (and plays the recording) so the Super Admin can compare them.
 * Nothing to approve: a call counts as soon as it is logged.
 */
export function CallProofsTab({ filters, setParam }: { filters: Record<string, unknown>; setParam: (key: string, value?: string | number) => void }) {
  const { data, isLoading, isFetching, isError, error, refetch } = useAttendanceCallsQuery(filters)
  const [selected, setSelected] = useState<AttendanceCallRow | null>(null)

  const columns: Column<AttendanceCallRow>[] = [
    {
      key: 'when',
      header: 'Date & Time',
      render: (c) => <span className="whitespace-nowrap text-xs text-slate-600">{dayjs(c.createdAt).format('ddd, D MMM YYYY · h:mm A')}</span>,
    },
    {
      key: 'user',
      header: 'Sales Executive',
      render: (c) => (
        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-800">
          {c.user?.name ?? <span className="text-slate-400">Not answered</span>}
          {c.source === 'dialer' && <Badge tone="cyan">Dialer</Badge>}
        </span>
      ),
    },
    {
      key: 'lead',
      header: 'Lead',
      render: (c) =>
        c.lead ? (
          <Link to={`/app/leads/${c.lead._id}`} onClick={(e) => e.stopPropagation()} className="block min-w-0 text-xs hover:underline">
            <span className="font-medium text-brand-700">{c.lead.name}</span>
            <span className="block text-[11px] text-slate-400">{c.lead.leadNo}</span>
          </Link>
        ) : (
          <span className="block text-xs text-slate-500">
            Unknown caller
            {c.customerNumber && <span className="block text-[11px] text-slate-400">{c.customerNumber}</span>}
          </span>
        ),
    },
    {
      key: 'duration',
      header: 'Call Duration',
      align: 'right',
      render: (c) => <span className="whitespace-nowrap text-xs font-semibold tabular-nums text-slate-800">{c.durationSeconds != null ? formatHms(c.durationSeconds) : '—'}</span>,
    },
    { key: 'stage', header: 'Disposition', render: (c) => <span className="text-xs text-slate-600">{c.subStage ?? c.stage ?? '—'}</span> },
    {
      key: 'proofs',
      header: 'Proof',
      render: (c) => (
        <div className="flex flex-wrap gap-1">
          {c.screenshot ? (
            <Badge tone="blue">{c.screenshots && c.screenshots.length > 1 ? `${c.screenshots.length} screenshots` : 'Screenshot'}</Badge>
          ) : c.source === 'dialer' ? (
            <Badge tone="slate">Dialer log</Badge>
          ) : (
            <Badge tone="slate">No screenshot</Badge>
          )}
          {c.recording && <Badge tone="violet">Recording</Badge>}
        </div>
      ),
    },
    {
      key: 'preview',
      header: '',
      align: 'right',
      render: (c) =>
        c.screenshot || c.recording ? (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              setSelected(c)
            }}
          >
            Preview
          </Button>
        ) : null,
    },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        rows={data?.data}
        rowKey={(c) => c._id}
        loading={isLoading || isFetching}
        error={isError}
        errorMessage={isError ? parseApiError(error).message : undefined}
        onRetry={refetch}
        emptyTitle="No calls"
        emptyDescription="No calls were logged for these filters."
        pagination={data?.pagination}
        onPageChange={(p) => setParam('page', p)}
        onPageSizeChange={(s) => setParam('page_size', s)}
        onRowClick={(c) => (c.screenshot || c.recording ? setSelected(c) : undefined)}
      />
      {selected && (
        <CallProofPreview
          call={selected}
          title={`Call by ${selected.user?.name ?? 'the dialer'}`}
          description={`${selected.lead ? `${selected.lead.name} · ${selected.lead.leadNo}` : `Unknown caller${selected.customerNumber ? ` · ${selected.customerNumber}` : ''}`} · ${dayjs(selected.createdAt).format('ddd, D MMM YYYY · h:mm A')}`}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}
