import type { ReactNode } from 'react'
import { PhoneIncoming, PhoneOutgoing } from 'lucide-react'
import { formatHms } from '../../../lib/durations'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'
import type { BadgeTone } from '../../../lib/status'
import type { AttendanceCallRow, SmartfloCallDetail, SmartfloCallResult } from '../../../types/models'

/** The short badge of each Smartflo outcome. */
const RESULT: Record<SmartfloCallResult, { text: string; tone: BadgeTone }> = {
  connected: { text: 'Connected', tone: 'green' },
  not_answered: { text: 'Not answered', tone: 'red' },
  cancelled: { text: 'Cut while ringing', tone: 'amber' },
  busy: { text: 'Busy', tone: 'amber' },
  rejected: { text: 'Rejected', tone: 'red' },
  invalid: { text: 'Invalid number', tone: 'slate' },
  unreachable: { text: 'Not reachable', tone: 'slate' },
  network: { text: 'Network issue', tone: 'slate' },
  dropped: { text: 'Dropped', tone: 'slate' },
  agent_missed: { text: 'Missed', tone: 'amber' },
}

const CRM_STATUS: Record<string, string> = { not_answered: 'Not answered', busy: 'Busy', failed: 'Failed' }

const ENDED_BY ={ lead: 'Lead hung up', counsellor: 'Counsellor hung up' } as const

function seconds(value: number | null | undefined) {
  return value ? `${value}s` : '0s'
}

/** The Call Status cell: the badge, what happened in plain words, and who put the phone down. */
export function SmartfloStatusCell({ call }: { call: AttendanceCallRow }) {
  const d = call.smartflo
  if (!d) {
    // no dialer detail: a call the counsellor logged by hand (or a server without it): only the CRM's own status
    const answered = call.status === 'answered'
    return (
      <span className="flex flex-col items-start gap-1">
        <Badge tone={answered ? 'green' : 'slate'}>{answered ? 'Connected' : CRM_STATUS[call.status] ?? call.status.replace(/_/g, ' ')}</Badge>
        <span className="text-[11px] text-slate-400">{call.source === 'dialer' ? 'No Smartflo detail' : 'Logged manually'}</span>
      </span>
    )
  }
  const r = RESULT[d.result] ?? RESULT.dropped
  return (
    <span className="flex min-w-[170px] flex-col items-start gap-1">
      <Badge tone={r.tone} dot>
        {r.text}
      </Badge>
      <span className="text-[11px] leading-4 text-slate-600">{d.label}</span>
    </span>
  )
}

const dash = <span className="text-xs text-slate-400">—</span>

/** Direction column: who called whom. */
export function DirectionCell({ call }: { call: AttendanceCallRow }) {
  const inbound = (call.smartflo?.direction ?? call.direction) === 'inbound'
  const Icon = inbound ? PhoneIncoming : PhoneOutgoing
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-slate-700">
      <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      {inbound ? 'Incoming' : 'Outgoing'}
    </span>
  )
}

/** Who Hung Up column. */
export function HungUpCell({ call }: { call: AttendanceCallRow }) {
  const d = call.smartflo
  if (!d) return dash
  if (d.endedBy) return <span className="whitespace-nowrap text-xs font-medium text-slate-800">{d.endedBy === 'lead' ? 'Lead' : 'Counsellor'}</span>
  return <span className="whitespace-nowrap text-xs text-slate-400">{d.connected ? 'Not reported' : '—'}</span>
}

/** Ring Time column: how long each phone rang before it was picked up / given up. */
export function RingCell({ call }: { call: AttendanceCallRow }) {
  const d = call.smartflo
  if (!d) return dash
  return (
    <span className="flex flex-col whitespace-nowrap text-[11px] leading-4 text-slate-600">
      {d.direction === 'outbound' && (
        <span>
          Lead <span className="font-semibold tabular-nums text-slate-800">{seconds(d.leadRingSeconds)}</span>
        </span>
      )}
      <span>
        Counsellor <span className="font-semibold tabular-nums text-slate-800">{seconds(d.counsellorRingSeconds)}</span>
      </span>
    </span>
  )
}

/** Total Time column: the whole call as Smartflo billed it (ringing included). */
export function TotalCell({ call }: { call: AttendanceCallRow }) {
  const d = call.smartflo
  if (!d || !d.totalSeconds) return dash
  return <span className="whitespace-nowrap text-xs tabular-nums text-slate-700">{formatHms(d.totalSeconds)}</span>
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2 last:border-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-right text-xs font-medium text-slate-800">{children ?? '—'}</dd>
    </div>
  )
}

/** Everything Smartflo said about one call. */
export function SmartfloCallDialog({ call, title, description, onClose }: { call: AttendanceCallRow; title: string; description?: string; onClose: () => void }) {
  const d = call.smartflo as SmartfloCallDetail
  const r = RESULT[d.result] ?? RESULT.dropped
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge tone={r.tone} dot>
          {r.text}
        </Badge>
        <span className="text-sm text-slate-700">{d.label}</span>
      </div>
      {d.fromCallRecord && (
        <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Smartflo's hang-up report for this call did not reach this server, so this is from the call record — who hung up and the
          ring times may be missing.
        </p>
      )}
      <dl>
        <Row label="Direction">{d.direction === 'inbound' ? 'Incoming (lead called)' : 'Outgoing (counsellor called)'}</Row>
        <Row label="Connected with the lead">{d.connected ? 'Yes' : 'No'}</Row>
        <Row label="Who hung up">{d.endedBy ? ENDED_BY[d.endedBy] : d.connected ? 'Not reported' : '—'}</Row>
        <Row label="Talk time (with the lead)">{formatHms(d.talkSeconds)}</Row>
        {d.direction === 'outbound' && <Row label="Lead's phone rang for">{seconds(d.leadRingSeconds)}</Row>}
        <Row label="Counsellor's phone rang for">{seconds(d.counsellorRingSeconds)}</Row>
        <Row label="Total call time (Smartflo)">{formatHms(d.totalSeconds)}</Row>
        <Row label="Started">{d.startedAt}</Row>
        <Row label="Ended">{d.endedAt}</Row>
        <Row label="Counsellor line">{d.counsellorLine}</Row>
        <Row label="Lead's network">{d.operator}</Row>
        <Row label="Smartflo status">{d.smartfloStatus}</Row>
        <Row label="Smartflo reason">{d.smartfloReason}</Row>
        <Row label="Hang-up cause">{d.hangupCause}</Row>
        <Row label="Smartflo call ID">
          <span className="font-mono text-[11px]">{d.callId}</span>
        </Row>
      </dl>
    </Modal>
  )
}
