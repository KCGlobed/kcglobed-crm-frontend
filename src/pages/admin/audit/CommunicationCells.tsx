import { Link } from 'react-router-dom'
import { Bot, CalendarClock, MessageCircleReply, Send, Users, type LucideIcon } from 'lucide-react'
import { StatusBadge } from '../../../components/ui/Badge'
import { formatDateTime } from '../../../lib/utils'
import type { AuditLogEntry, MessageSource } from '../../../types/models'
import { STATUS_COLUMNS } from '../messaging/deliveryStatus'
import { ChannelBadge } from './CommunicationDetails'

/**
 * The Activity Log → Communications list cells: for each SMS / email / WhatsApp entry, how its message (or bulk
 * send) stands NOW — channel, lead, where it was sent from, live status and why it failed. `entry.live` comes
 * from the list endpoint; entries without one (opt-outs, template edits …) fall back to their summary line.
 */

const SOURCE_ICONS: Record<MessageSource['kind'], LucideIcon> = {
  bulk: Users,
  automation: Bot,
  scheduled: CalendarClock,
  manual: Send,
  reply: MessageCircleReply,
}

const snapshotChannel = (e: AuditLogEntry) => ((e.after ?? {}) as { channel?: string }).channel

export function ChannelCell({ entry }: { entry: AuditLogEntry }) {
  const channel = entry.live?.channel ?? snapshotChannel(entry)
  return channel ? <ChannelBadge channel={channel} /> : <span className="text-xs text-slate-400">—</span>
}

export function LeadCell({ entry }: { entry: AuditLogEntry }) {
  const live = entry.live
  if (live?.kind === 'campaign') return <span className="text-xs text-slate-600">{live.final ?? '—'} leads</span>
  if (live?.kind !== 'message' || !live.lead) return <span className="text-xs text-slate-400">—</span>
  return (
    <div className="text-xs">
      <Link to={`/app/leads/${live.lead._id}`} onClick={(e) => e.stopPropagation()} className="font-medium text-brand-700 hover:underline">
        {live.lead.name}
      </Link>
      <span className="block text-slate-400">
        {live.lead.leadNo}
        {live.to ? ` · ${live.to}` : ''}
      </span>
    </div>
  )
}

export function SourceCell({ entry }: { entry: AuditLogEntry }) {
  const source = entry.live?.source
  if (!source) return <span className="text-xs text-slate-400">—</span>
  const Icon = SOURCE_ICONS[source.kind] ?? Send
  return (
    <div className="flex items-start gap-1 text-xs text-slate-700">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
      <span>
        {source.label}
        {entry.live?.template && <span className="block text-slate-400">Template · {entry.live.template}</span>}
      </span>
    </div>
  )
}

export function StatusCell({ entry }: { entry: AuditLogEntry }) {
  const live = entry.live
  if (!live) return <span className="text-xs text-slate-400">—</span>
  if (live.kind === 'campaign') {
    // the counts that are not zero; N/A ones left out (hover the bulk send for them)
    const parts = STATUS_COLUMNS.filter((s) => (live.metrics[s.key] ?? 0) > 0)
    return (
      <div className="space-y-0.5 text-xs">
        <StatusBadge status={live.status} />
        <p className="text-slate-600">
          {parts.length
            ? parts.map((s, i) => (
                <span key={s.key}>
                  {i ? ' · ' : ''}
                  <span className={s.color}>{live.metrics[s.key]}</span> {s.label.toLowerCase()}
                </span>
              ))
            : 'nothing sent yet'}
        </p>
      </div>
    )
  }
  let when: string | null = null
  if (live.readAt) when = `Read ${formatDateTime(live.readAt)}`
  else if (live.deliveredAt) when = `Delivered ${formatDateTime(live.deliveredAt)}`
  else if (live.status === 'sent' && live.deliveryTracked === false) when = 'Delivery not tracked (email)'
  else if (live.status === 'scheduled' && live.scheduledAt) when = `For ${formatDateTime(live.scheduledAt)}`
  else if (live.sentAt) when = `${live.direction === 'in' ? 'Received' : 'Sent'} ${formatDateTime(live.sentAt)}`
  return (
    <div className="space-y-0.5 text-xs">
      <StatusBadge status={live.readAt ? 'read' : live.status} />
      {when && <p className="text-slate-400">{when}</p>}
    </div>
  )
}

export function ReasonCell({ entry }: { entry: AuditLogEntry }) {
  const live = entry.live
  const reason = live?.kind === 'message' ? live.reason : live?.kind === 'campaign' ? live.topReasons : undefined
  const detail = live?.kind === 'message' && live.error !== live.reason ? live.error : undefined
  if (!reason)
    return (
      <span className="block w-72 max-w-xs truncate text-xs text-slate-500" title={entry.summary}>
        {entry.summary ?? '—'}
      </span>
    )
  // a bulk send's top reasons ("A 3150; B 508") one per line; every line cut to the cell, the full text on hover
  const lines = live?.kind === 'campaign' ? reason.split('; ') : [reason]
  const tone = live?.kind === 'message' && live.status === 'cancelled' ? 'text-slate-700' : 'text-red-600'
  return (
    <div className="w-72 max-w-xs text-xs" title={[...lines, detail].filter(Boolean).join('\n')}>
      {lines.map((line) => (
        <p key={line} className={`truncate ${tone}`}>
          {line}
        </p>
      ))}
      {detail && <p className="truncate text-slate-400">{detail}</p>}
    </div>
  )
}
