export type BadgeTone = 'slate' | 'green' | 'red' | 'amber' | 'blue' | 'violet' | 'cyan'

/**
 * One mapping from status words to colours, used by every module:
 * active/completed/done/delivered → green, inactive/draft/cancelled → gray,
 * pending/scheduled/queued → yellow, rejected/failed/lost → red, processing/sent/open → blue.
 */
export const STATUS_TONES: Record<string, BadgeTone> = {
  active: 'green', completed: 'green', done: 'green', delivered: 'green', converted: 'green', processed: 'green',
  approved: 'green', match: 'green', accepted: 'green',
  inactive: 'slate', draft: 'slate', cancelled: 'slate', closed: 'slate', unassigned: 'amber',
  pending: 'amber', scheduled: 'amber', queued: 'amber', retrying: 'amber', overdue: 'red',
  rejected: 'red', failed: 'red', lost: 'red', error: 'red', bounced: 'red', mismatch: 'red',
  processing: 'blue', sending: 'blue', sent: 'blue', open: 'blue', running: 'blue',
}

export function statusTone(status?: string | null): BadgeTone {
  return STATUS_TONES[(status ?? '').toLowerCase()] ?? 'slate'
}

