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
import { DirectionCell, HungUpCell, RingCell, SmartfloCallDialog, SmartfloStatusCell, TotalCell } from './SmartfloCallStatus'
import type { AttendanceCallRow } from '../../../types/models'

/**
 * Attendance → Call Proofs: every logged call with the duration the counsellor entered and its proofs. Preview
 * shows the screenshot large beside that duration (and plays the recording) so the Super Admin can compare them.
 * Nothing to approve: a call counts as soon as it is logged.
 */
export function CallProofsTab({ filters, setParam }: { filters: Record<string, unknown>; setParam: (key: string, value?: string | number) => void }) {
  const { data, isLoading, isFetching, isError, error, refetch } = useAttendanceCallsQuery(filters)
  const [selected, setSelected] = useState<AttendanceCallRow | null>(null)
  const [details, setDetails] = useState<AttendanceCallRow | null>(null)
  const describe = (c: AttendanceCallRow) =>
    `${c.lead ? `${c.lead.name} · ${c.lead.leadNo}` : `Unknown caller${c.customerNumber ? ` · ${c.customerNumber}` : ''}`} · ${dayjs(c.createdAt).format('ddd, D MMM YYYY · h:mm A')}`

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
    { key: 'direction', header: 'Direction', render: (c) => <DirectionCell call={c} /> },
    {
      key: 'duration',
      header: 'Talk Time',
      align: 'right',
      // a dialer call: the talk time with the lead, as Smartflo reports it (nothing when the lead was never on the line)
      render: (c) => {
        const seconds = c.smartflo ? (c.smartflo.connected ? c.smartflo.talkSeconds : null) : c.durationSeconds
        return <span className="whitespace-nowrap text-xs font-semibold tabular-nums text-slate-800">{seconds != null ? formatHms(seconds) : '—'}</span>
      },
    },
    { key: 'callStatus', header: 'Call Status', render: (c) => <SmartfloStatusCell call={c} /> },
    { key: 'hungUp', header: 'Who Hung Up', render: (c) => <HungUpCell call={c} /> },
    { key: 'ring', header: 'Ring Time', render: (c) => <RingCell call={c} /> },
    { key: 'total', header: 'Total Time', align: 'right', render: (c) => <TotalCell call={c} /> },
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
      render: (c) => (
        <div className="flex justify-end gap-1.5">
          {c.smartflo && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                setDetails(c)
              }}
            >
              Details
            </Button>
          )}
          {(c.screenshot || c.recording) && (
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
          )}
        </div>
      ),
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
        onRowClick={(c) => (c.screenshot || c.recording ? setSelected(c) : c.smartflo ? setDetails(c) : undefined)}
      />
      {selected && (
        <CallProofPreview
          call={selected}
          title={`Call by ${selected.user?.name ?? 'the dialer'}`}
          description={describe(selected)}
          onClose={() => setSelected(null)}
        />
      )}
      {details?.smartflo && (
        <SmartfloCallDialog
          call={details}
          title={`Call by ${details.user?.name ?? 'the dialer'} — Smartflo detail`}
          description={describe(details)}
          onClose={() => setDetails(null)}
        />
      )}
    </>
  )
}
