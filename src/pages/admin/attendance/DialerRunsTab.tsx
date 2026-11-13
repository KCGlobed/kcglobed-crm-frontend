import { useState } from 'react'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { Loader2, Play, Radio } from 'lucide-react'
import { useAuthorizedObjectUrl } from '../../../lib/download'
import { formatHms, useNow } from '../../../lib/durations'
import { parseApiError } from '../../../lib/utils'
import { useAttendanceDialerRunQuery, useAttendanceDialerRunsQuery } from '../../../services/attendanceApi'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { DataTable, type Column } from '../../../components/ui/DataTable'
import { Modal } from '../../../components/ui/Modal'
import { proofPath } from '../../leads/callProofFiles'
import { SmartfloResultBadge } from './SmartfloCallStatus'
import type { BadgeTone } from '../../../lib/status'
import type { DialerRunCall, DialerRunDetail, DialerRunRow } from '../../../types/models'

const STATUS: Record<DialerRunRow['status'], { text: string; tone: BadgeTone }> = {
  running: { text: 'Running', tone: 'green' },
  idle: { text: 'Idle', tone: 'amber' },
  finished: { text: 'Finished', tone: 'slate' },
}

const OUTCOME: Record<DialerRunDetail['rows'][number]['outcome'], { text: string; tone: BadgeTone }> = {
  on_call: { text: 'On call now', tone: 'cyan' },
  connected: { text: 'Connected', tone: 'green' },
  not_connected: { text: 'Not connected', tone: 'red' },
  not_called: { text: 'Not called yet', tone: 'slate' },
}

const time = (value: string | null | undefined) => (value ? dayjs(value).format('h:mm:ss A') : '—')
const dateTime = (value: string) => dayjs(value).format('ddd, D MMM · h:mm A')
const num = (n: number, tone = 'text-slate-800') => <span className={`text-xs font-semibold tabular-nums ${tone}`}>{n}</span>

/** A run's length that keeps ticking while it runs. */
function RunLength({ run, now }: { run: DialerRunRow; now: number }) {
  const seconds = run.status === 'running' ? Math.max(0, Math.floor((now - dayjs(run.startedAt).valueOf()) / 1000)) : run.runSeconds
  return <span className="whitespace-nowrap text-xs font-semibold tabular-nums text-slate-800">{formatHms(seconds)}</span>
}

/**
 * Attendance → Auto Dialer: each counsellor's progressive runs — who is dialing right now, when a run started and how
 * long it ran, how many of its leads were called, connected or not, and the talk time. View opens the run lead by lead
 * with every call's outcome, talk time, who hung up and its recording.
 */
export function DialerRunsTab({ filters, setParam }: { filters: Record<string, unknown>; setParam: (key: string, value?: string | number) => void }) {
  const [polling, setPolling] = useState(0)
  const { data, isLoading, isFetching, isError, error, refetch } = useAttendanceDialerRunsQuery(filters, { pollingInterval: polling })
  const running = data?.runningNow ?? []
  const wantPolling = running.length > 0 || (data?.data ?? []).some((r) => r.status === 'running') ? 15000 : 0
  if (wantPolling !== polling) setPolling(wantPolling)
  const now = useNow(1000, running.length > 0)
  const [selected, setSelected] = useState<DialerRunRow | null>(null)

  const columns: Column<DialerRunRow>[] = [
    { key: 'user', header: 'Counsellor', render: (r) => <span className="whitespace-nowrap text-xs font-medium text-slate-800">{r.user.name ?? '—'}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <Badge tone={STATUS[r.status].tone} dot>
          {STATUS[r.status].text}
        </Badge>
      ),
    },
    { key: 'started', header: 'Started', render: (r) => <span className="whitespace-nowrap text-xs text-slate-600">{dateTime(r.startedAt)}</span> },
    {
      key: 'ended',
      header: 'Ended / Last Call',
      render: (r) => <span className="whitespace-nowrap text-xs text-slate-600">{r.status === 'running' ? 'Still running' : time(r.endedAt ?? r.lastActivityAt)}</span>,
    },
    { key: 'length', header: 'Run Length', align: 'right', render: (r) => <RunLength run={r} now={now} /> },
    { key: 'leads', header: 'Leads', align: 'right', render: (r) => num(r.leads) },
    { key: 'called', header: 'Called', align: 'right', render: (r) => num(r.called) },
    { key: 'connected', header: 'Connected', align: 'right', render: (r) => num(r.connected, 'text-emerald-700') },
    { key: 'notConnected', header: 'Not Connected', align: 'right', render: (r) => num(r.notConnected, 'text-red-600') },
    { key: 'notCalled', header: 'Not Called', align: 'right', render: (r) => num(r.notCalled, 'text-slate-500') },
    { key: 'calls', header: 'Total Calls', align: 'right', render: (r) => num(r.totalCalls) },
    {
      key: 'talk',
      header: 'Talk Time',
      align: 'right',
      render: (r) => <span className="whitespace-nowrap text-xs font-semibold tabular-nums text-slate-800">{formatHms(r.talkSeconds)}</span>,
    },
    {
      key: 'view',
      header: '',
      align: 'right',
      render: (r) => (
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            setSelected(r)
          }}
        >
          View
        </Button>
      ),
    },
  ]

  return (
    <>
      {running.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700">
            <Radio className="h-3.5 w-3.5 animate-pulse" /> Dialing right now
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {running.map((r) => (
              <button
                key={r._id}
                type="button"
                onClick={() => setSelected(r)}
                className="rounded-xl bg-white p-4 text-left ring-1 ring-emerald-200 transition hover:ring-emerald-400"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-slate-800">{r.user.name}</span>
                  <RunLength run={r} now={now} />
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500">Started {time(r.startedAt)}{r.onCallNow ? ' · on a call now' : ''}</p>
                <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                  <Stat label="Called" value={`${r.called}/${r.leads}`} />
                  <Stat label="Connected" value={r.connected} tone="text-emerald-700" />
                  <Stat label="Not conn." value={r.notConnected} tone="text-red-600" />
                  <Stat label="Talk" value={formatHms(r.talkSeconds)} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      <DataTable
        columns={columns}
        rows={data?.data}
        rowKey={(r) => r._id}
        loading={isLoading || (isFetching && !polling)}
        error={isError}
        errorMessage={isError ? parseApiError(error).message : undefined}
        onRetry={refetch}
        emptyTitle="No dialer runs"
        emptyDescription="Nobody ran the progressive dialer in these dates."
        pagination={data?.pagination}
        onPageChange={(p) => setParam('page', p)}
        onPageSizeChange={(s) => setParam('page_size', s)}
        onRowClick={(r) => setSelected(r)}
      />
      {selected && <DialerRunDialog run={selected} polling={selected.status === 'running'} onClose={() => setSelected(null)} />}
    </>
  )
}

function Stat({ label, value, tone = 'text-slate-800' }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-1 py-1.5">
      <p className={`text-sm font-bold tabular-nums ${tone}`}>{value}</p>
      <p className="text-[10px] text-slate-500">{label}</p>
    </div>
  )
}

/** One run, lead by lead: every call with its outcome, talk time, ring time, who hung up, disposition and recording. */
function DialerRunDialog({ run, polling, onClose }: { run: DialerRunRow; polling: boolean; onClose: () => void }) {
  const { data, isLoading, isError, error } = useAttendanceDialerRunQuery(run._id, { pollingInterval: polling ? 15000 : 0 })
  const detail = data?.data
  const s = detail ?? run
  const now = useNow(1000, s.status === 'running')
  return (
    <Modal
      open
      onClose={onClose}
      size="2xl"
      title={`${run.user.name ?? 'Counsellor'} — progressive run`}
      description={`Started ${dateTime(run.startedAt)}${s.rounds > 1 ? ` · ${s.rounds} rounds` : ''}`}
      footer={
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <Tile label="Status">
          <Badge tone={STATUS[s.status].tone} dot>
            {STATUS[s.status].text}
          </Badge>
        </Tile>
        <Tile label="Run length">
          <RunLength run={s} now={now} />
        </Tile>
        <Tile label="First call">{time(s.firstCallAt)}</Tile>
        <Tile label={s.status === 'running' ? 'Last activity' : 'Ended'}>{time(s.endedAt ?? s.lastActivityAt)}</Tile>
        <Tile label="Leads called">{`${s.called} / ${s.leads}`}</Tile>
        <Tile label="Connected">
          <span className="text-emerald-700">{s.connected}</span>
        </Tile>
        <Tile label="Not connected">
          <span className="text-red-600">{s.notConnected}</span>
        </Tile>
        <Tile label="Talk time">{formatHms(s.talkSeconds)}</Tile>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-sm text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading the run…
        </div>
      ) : isError || !detail ? (
        <p className="py-6 text-center text-sm text-red-600">{isError ? parseApiError(error).message : 'Not found'}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg ring-1 ring-slate-200">
          <table className="w-full min-w-[960px] text-left">
            <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Lead</th>
                <th className="px-3 py-2">Call Time</th>
                <th className="px-3 py-2">Call Status</th>
                <th className="px-3 py-2 text-right">Talk Time</th>
                <th className="px-3 py-2">Ring Time</th>
                <th className="px-3 py-2">Who Hung Up</th>
                <th className="px-3 py-2">Disposition</th>
                <th className="px-3 py-2">Recording</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {detail.rows.map((row, i) => {
                const calls: (DialerRunCall | null)[] = row.calls.length ? row.calls : [null]
                return calls.map((call, j) => (
                  <tr key={`${row.lead._id}-${call?._id ?? 'none'}`} className="align-top">
                    {j === 0 && (
                      <>
                        <td rowSpan={calls.length} className="px-3 py-2 text-xs tabular-nums text-slate-400">
                          {i + 1}
                        </td>
                        <td rowSpan={calls.length} className="px-3 py-2">
                          <Link to={`/app/leads/${row.lead._id}`} className="block text-xs font-medium text-brand-700 hover:underline">
                            {row.lead.name}
                          </Link>
                          <span className="block text-[11px] text-slate-400">{row.lead.leadNo}</span>
                          <span className="mt-1 inline-block">
                            <Badge tone={OUTCOME[row.outcome].tone}>{OUTCOME[row.outcome].text}</Badge>
                          </span>
                        </td>
                      </>
                    )}
                    {call ? <CallCells call={call} /> : <td colSpan={7} className="px-3 py-2 text-xs text-slate-400">Not called in this run</td>}
                  </tr>
                ))
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-0.5 text-sm font-semibold tabular-nums text-slate-800">{children}</div>
    </div>
  )
}

function CallCells({ call }: { call: DialerRunCall }) {
  const d = call.smartflo
  return (
    <>
      <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600">{time(call.createdAt)}</td>
      <td className="px-3 py-2">
        {call.live ? (
          <Badge tone="cyan" dot>
            On call now
          </Badge>
        ) : d ? (
          <span className="flex flex-col items-start gap-1">
            <SmartfloResultBadge detail={d} />
            <span className="text-[11px] leading-4 text-slate-500">{d.label}</span>
          </span>
        ) : (
          <Badge tone={call.connected ? 'green' : 'slate'}>{call.connected ? 'Connected' : call.status.replace(/_/g, ' ')}</Badge>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold tabular-nums text-slate-800">
        {call.connected ? formatHms(call.talkSeconds) : '—'}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-[11px] text-slate-600">
        {d ? (
          <>
            {d.leadRingSeconds != null && <span className="block">Lead {d.leadRingSeconds}s</span>}
            <span className="block">Counsellor {d.counsellorRingSeconds}s</span>
          </>
        ) : (
          '—'
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-700">
        {d?.endedBy ? (d.endedBy === 'lead' ? 'Lead' : 'Counsellor') : <span className="text-slate-400">—</span>}
      </td>
      <td className="px-3 py-2 text-xs text-slate-600">{call.subStage ?? call.stage ?? '—'}</td>
      <td className="px-3 py-2">{call.recording ? <RecordingPlayer call={call} /> : <span className="text-[11px] text-slate-400">No recording</span>}</td>
    </>
  )
}

/** The recording loads only when Play is pressed (a run can have dozens). */
function RecordingPlayer({ call }: { call: DialerRunCall }) {
  const [open, setOpen] = useState(false)
  const { url, loading, error } = useAuthorizedObjectUrl(open && call.recording ? proofPath(call._id, call.recording) : null)
  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Play className="h-3.5 w-3.5" /> Play
      </Button>
    )
  }
  if (error) return <span className="text-[11px] text-red-600">{error}</span>
  if (loading || !url) return <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
  return <audio src={url} controls autoPlay className="h-8 w-56" />
}
