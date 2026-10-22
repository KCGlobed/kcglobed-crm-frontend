import { Badge } from '../ui/Badge'
import type { BadgeTone } from '../../lib/status'

// Meta's review statuses, plus DRAFT (built in the CRM, not submitted) and NOT_IN_ACCOUNT (gone from WhatsApp Manager)
const STATUSES: Record<string, [string, BadgeTone]> = {
  DRAFT: ['Draft', 'slate'],
  PENDING: ['Pending review', 'amber'],
  IN_APPEAL: ['In appeal', 'amber'],
  APPROVED: ['Approved', 'green'],
  FLAGGED: ['Flagged', 'amber'],
  REJECTED: ['Rejected', 'red'],
  PAUSED: ['Paused', 'slate'],
  DISABLED: ['Disabled', 'slate'],
  PENDING_DELETION: ['Being deleted', 'slate'],
  NOT_IN_ACCOUNT: ['Not in account', 'slate'],
}

/** A WhatsApp template's review status; Meta's reason (rejected, paused …) shows on hover. */
export function WhatsAppStatusBadge({ status, reason, className }: { status?: string | null; reason?: string | null; className?: string }) {
  const [label, tone]: [string, BadgeTone] = status
    ? (STATUSES[status] ?? [status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' '), 'slate'])
    : ['Manual', 'slate']
  return (
    <Badge tone={tone} dot className={className} title={reason ?? (status ? undefined : 'Typed in by hand, before the builder: not checked with Meta')}>
      {label}
    </Badge>
  )
}
