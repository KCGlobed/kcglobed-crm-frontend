import type { BadgeTone } from '../../../lib/status'
import type { AttendanceCallKind } from '../../../types/models'

/** How a call happened (Call Proofs): logged by hand, the counsellor's Call button, an auto-dialer run, or a lead calling in. */
export const CALL_KINDS: Record<AttendanceCallKind, { label: string; tone: BadgeTone; hint: string }> = {
  manual: { label: 'Manual', tone: 'amber', hint: 'Logged by the counsellor: duration, screenshot and recording entered by hand' },
  click_to_call: { label: 'Click-to-call', tone: 'blue', hint: "Placed from the CRM with the lead's Call button" },
  auto_dialer: { label: 'Auto dialer', tone: 'violet', hint: 'Placed by an auto-dialer run (Attendance → Auto Dialer)' },
  incoming: { label: 'Incoming', tone: 'cyan', hint: 'The lead called the dialer number' },
}

export const CALL_KIND_OPTIONS = (Object.keys(CALL_KINDS) as AttendanceCallKind[]).map((value) => ({ value, label: CALL_KINDS[value].label }))
