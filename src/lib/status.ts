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

/**
 * Display words that differ from the backend key. The key itself (`lost` on a
 * lead's status, a stage's type, the stats) never changes — only what people read.
 */
export const STATUS_LABELS: Record<string, string> = {
  lost: 'Not Interested',
}

/** "not_answered" → "Not answered"; keys in STATUS_LABELS use their own wording. */
export function statusLabel(status?: string | null): string {
  if (!status) return '—'
  return STATUS_LABELS[status.toLowerCase()] ?? status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')
}

