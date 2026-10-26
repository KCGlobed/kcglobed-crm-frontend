import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Download, FileAudio, Image as ImageIcon, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import dayjs from 'dayjs'
import { authorizedDownload, useAuthorizedObjectUrl } from '../../../lib/download'
import { formatHms } from '../../../lib/durations'
import { parseApiError } from '../../../lib/utils'
import { useAttendanceCallsQuery } from '../../../services/attendanceApi'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { DataTable, type Column } from '../../../components/ui/DataTable'
import { Modal } from '../../../components/ui/Modal'
import type { AttendanceCallRow, CallProofFile } from '../../../types/models'

const proofPath = (call: AttendanceCallRow, proof: CallProofFile) => `/calls/${call._id}/proofs/${proof._id}`

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
      {selected && <CallProofPreview call={selected} onClose={() => setSelected(null)} />}
    </>
  )
}

function CallProofPreview({ call, onClose }: { call: AttendanceCallRow; onClose: () => void }) {
  // every screenshot of the call (older rows carry only the first one)
  const shots = call.screenshots?.length ? call.screenshots : call.screenshot ? [call.screenshot] : []
  const [index, setIndex] = useState(0)
  const shown = shots[index] ?? null
  const shot = useAuthorizedObjectUrl(shown ? proofPath(call, shown) : null)
  const rec = useAuthorizedObjectUrl(call.recording ? proofPath(call, call.recording) : null)
  const download = (proof: CallProofFile) =>
    authorizedDownload(`${proofPath(call, proof)}?download=1`, proof.fileName).catch((e) => toast.error(parseApiError(e).message))

  return (
    <Modal
      open
      onClose={onClose}
      title={`Call by ${call.user?.name ?? 'the dialer'}`}
      description={`${call.lead ? `${call.lead.name} · ${call.lead.leadNo}` : `Unknown caller${call.customerNumber ? ` · ${call.customerNumber}` : ''}`} · ${dayjs(call.createdAt).format('ddd, D MMM YYYY · h:mm A')}`}
      size="xl"
    >
      <div className="grid gap-5 md:grid-cols-[1fr_15rem]">
        <div className="space-y-2">
          <div className="flex min-h-72 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            {!shown ? (
              <p className="flex items-center gap-2 text-sm text-slate-400">
                <ImageIcon className="h-4 w-4" /> No screenshot
              </p>
            ) : shot.loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            ) : shot.error ? (
              <p className="text-sm text-red-600">{shot.error}</p>
            ) : (
              <a href={shot.url} target="_blank" rel="noreferrer" title="Open full size">
                <img src={shot.url} alt={`Call screenshot ${index + 1}`} className="max-h-[65vh] w-auto object-contain" />
              </a>
            )}
          </div>
          {shots.length > 1 && (
            <div className="flex items-center justify-center gap-3 text-xs text-slate-600" data-testid="screenshot-pager">
              <Button variant="ghost" size="sm" aria-label="Previous screenshot" disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="tabular-nums">
                Screenshot {index + 1} of {shots.length}
                {shown ? <span className="text-slate-400"> · {shown.fileName}</span> : null}
              </span>
              <Button variant="ghost" size="sm" aria-label="Next screenshot" disabled={index >= shots.length - 1} onClick={() => setIndex((i) => Math.min(shots.length - 1, i + 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-brand-100 bg-brand-50/50 p-4 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{call.source === 'dialer' ? 'Talk time (dialer)' : 'Entered duration'}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{call.durationSeconds != null ? formatHms(call.durationSeconds) : '—'}</p>
            <p className="mt-1 text-[11px] text-slate-500">{call.source === 'dialer' ? 'Reported by the dialer' : 'Compare it with the call time in the screenshot'}</p>
          </div>
          <dl className="space-y-1 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-400">Disposition</dt>
              <dd className="text-right font-medium text-slate-700">{call.subStage ?? call.stage ?? '—'}</dd>
            </div>
          </dl>
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <FileAudio className="h-3.5 w-3.5" /> Recording
            </p>
            {!call.recording ? (
              <p className="text-xs text-slate-400">No recording uploaded</p>
            ) : rec.loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            ) : rec.error ? (
              <p className="text-xs text-red-600">{rec.error}</p>
            ) : (
              <audio controls src={rec.url} className="w-full" />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {shown && (
              <Button variant="outline" size="sm" onClick={() => download(shown)}>
                <Download className="h-3.5 w-3.5" /> {shots.length > 1 ? `Screenshot ${index + 1}` : 'Screenshot'}
              </Button>
            )}
            {call.recording && (
              <Button variant="outline" size="sm" onClick={() => download(call.recording!)}>
                <Download className="h-3.5 w-3.5" /> Recording
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
