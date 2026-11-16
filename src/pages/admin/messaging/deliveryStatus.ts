import type { CampaignRow, DeliveryMetrics, MetricStatus, ReasonCount } from '../../../types/models'

/** Every status a message report shows, in column order (the backend's METRIC_STATUSES). */
export const STATUS_COLUMNS: { key: MetricStatus; label: string; title: string; color: string }[] = [
  { key: 'queued', label: 'Queued', title: 'Waiting to go out', color: 'text-amber-600' },
  { key: 'sent', label: 'Sent', title: 'Accepted by the gateway / mail server, no delivery report yet', color: 'text-blue-700' },
  { key: 'delivered', label: 'Delivered', title: 'Reached the phone / inbox', color: 'text-green-700' },
  { key: 'read', label: 'Read', title: 'WhatsApp: the lead opened it (blue ticks), part of Delivered', color: 'text-emerald-700' },
  { key: 'undelivered', label: 'Undelivered', title: 'Accepted, but the operator could not deliver it (DND, expired, switched off …)', color: 'text-orange-600' },
  { key: 'bounced', label: 'Bounced', title: 'Email: the receiving server sent it back (wrong ID, mailbox full, spam block …)', color: 'text-rose-600' },
  { key: 'failed', label: 'Failed', title: 'Never went out (template problem, not on WhatsApp, no credits, gateway error …)', color: 'text-red-600' },
  { key: 'cancelled', label: 'Cancelled', title: 'Stopped before it went out (bulk send stopped, schedule cancelled …)', color: 'text-slate-500' },
]

/** Why a status reads N/A for a channel. */
export function naReason(channel: string, key: MetricStatus): string {
  if (channel === 'email' && (key === 'delivered' || key === 'bounced'))
    return 'Email delivery / bounce reports are not connected yet: the CRM only knows the mail server accepted it (Sent)'
  if (key === 'read') return channel === 'sms' ? 'SMS has no read receipt' : 'Email opens are not tracked'
  if (key === 'undelivered') return channel === 'whatsapp' ? 'WhatsApp reports a non-delivery as Failed' : 'Email reports a non-delivery as Bounced'
  if (key === 'bounced') return channel === 'sms' ? 'SMS reports a non-delivery as Undelivered' : 'WhatsApp reports a non-delivery as Failed'
  return 'This channel does not report it'
}

/** The counts of a bulk send: `metrics` from the backend, or the older `report` (no N/A) as a fallback. */
export function metricsOf(c: Pick<CampaignRow, 'metrics' | 'report'>): DeliveryMetrics {
  if (c.metrics) return c.metrics
  const r = c.report
  return {
    queued: r.queued ?? 0, sent: r.sent ?? 0, delivered: r.delivered ?? 0, read: null, undelivered: r.undelivered ?? 0,
    bounced: r.bounced ?? 0, failed: r.failed ?? 0, cancelled: r.cancelled ?? 0,
  }
}

export const REASON_STATUS_LABELS: Record<ReasonCount['status'], string> = {
  undelivered: 'Undelivered',
  bounced: 'Bounced',
  failed: 'Failed',
  cancelled: 'Cancelled',
}
