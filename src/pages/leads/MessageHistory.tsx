import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, CheckCheck, Clock, FileText, Mail, MessageSquareText, Paperclip } from 'lucide-react'
import { useLeadMessagesQuery } from '../../services/messagingApi'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { EmailPreview } from '../../components/email/EmailPreview'
import { EmptyState, Skeleton } from '../../components/ui/feedback'
import { formatDateTime } from '../../lib/utils'
import { statusTone } from '../../lib/status'
import type { Lead, LeadMessage } from '../../types/models'
import { SendMessageModal } from './LeadActionModals'
import { dayLabel, timeOf } from './chatTime'

/** Delivery reports land after the send, so the pane refreshes while it is open. */
const POLL_MS = 30_000

type Channel = 'sms' | 'email'

const CHANNEL = {
  sms: {
    label: 'SMS',
    icon: MessageSquareText,
    send: 'Send SMS',
    missing: 'no mobile number',
    empty: 'No SMS sent to this lead yet. Every SMS the CRM sends, by hand or by an automation, appears here.',
    hint: 'SMS goes out from a DLT-approved template.',
  },
  email: {
    label: 'Email',
    icon: Mail,
    send: 'Send Email',
    missing: 'no email address',
    empty: 'No email sent to this lead yet. Every email the CRM sends, by hand or by an automation, appears here.',
    hint: 'Emails go out from a template; the subject and text can be edited before sending.',
  },
} as const

/** Console providers only log the message, so their "sent" / "delivered" is not a real delivery status. */
const isSimulated = (m: LeadMessage) =>
  (m.status === 'sent' || m.status === 'delivered') && (!m.provider || m.provider.startsWith('console'))

const isFailed = (m: LeadMessage) => m.status === 'failed' || m.status === 'bounced'

const fileSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

const whenOf = (m: LeadMessage) => m.sentAt ?? m.createdAt

function statusTitle(m: LeadMessage): string {
  const simulated = isSimulated(m) ? ' · console provider: logged, not actually delivered' : ''
  if (m.status === 'delivered') return `Delivered${m.deliveredAt ? ` ${formatDateTime(m.deliveredAt)}` : ''}${simulated}`
  if (m.status === 'sent') return `Sent${m.sentAt ? ` ${formatDateTime(m.sentAt)}` : ''}${simulated}`
  if (m.status === 'scheduled') return `Scheduled for ${m.scheduledAt ? formatDateTime(m.scheduledAt) : 'later'}`
  return m.error ?? m.status
}

/** The WhatsApp-style tick for an SMS bubble. */
function StatusTick({ m }: { m: LeadMessage }) {
  if (isFailed(m)) {
    return (
      <span title={m.error} className="inline-flex items-center gap-0.5 text-red-600">
        <AlertTriangle className="h-3 w-3" /> {m.status}
      </span>
    )
  }
  if (m.status === 'scheduled') {
    return (
      <span title={statusTitle(m)} className="inline-flex items-center gap-0.5 text-amber-700">
        <Clock className="h-3 w-3" /> scheduled{m.scheduledAt ? ` · ${formatDateTime(m.scheduledAt)}` : ''}
      </span>
    )
  }
  if (m.status === 'delivered') {
    return (
      <span title={statusTitle(m)}>
        <CheckCheck className="h-3.5 w-3.5 text-sky-600" aria-label="Delivered" />
      </span>
    )
  }
  if (m.status === 'sent') {
    return (
      <span title={statusTitle(m)}>
        <Check className="h-3.5 w-3.5 text-slate-400" aria-label="Sent" />
      </span>
    )
  }
  return <span>{m.status}</span>
}

function SmsBubble({ m }: { m: LeadMessage }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[78%] rounded-lg bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ring-1 ring-slate-200">
        {m.template && (
          <p className="mb-0.5 flex items-center gap-1 text-[11px] text-slate-500">
            <FileText className="h-3 w-3" /> Template · {m.template}
          </p>
        )}
        <p className="whitespace-pre-wrap break-words">{m.body}</p>
        <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-500">
          {m.sentBy && <span className="mr-1">{m.sentBy} ·</span>}
          {timeOf(whenOf(m))}
          <StatusTick m={m} />
        </p>
        {isFailed(m) && m.error && <p className="mt-1 text-[11px] text-red-600">{m.error}</p>}
      </div>
    </div>
  )
}

/** One email as a mail client lists it: subject line and status, the body (as it went out) on demand. */
function EmailCard({ m }: { m: LeadMessage }) {
  const attachments = m.attachments ?? []
  return (
    <details className="group rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
      <summary className="cursor-pointer list-none px-3 py-2 [&::-webkit-details-marker]:hidden">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-800">{m.subject || '(no subject)'}</p>
            <p className="truncate text-[11px] text-slate-500">
              To {m.to}
              {m.template && ` · Template · ${m.template}`}
              {attachments.length > 0 && ` · ${attachments.length} attachment${attachments.length === 1 ? '' : 's'}`}
            </p>
          </div>
          <Badge tone={statusTone(m.status)} dot title={statusTitle(m)}>
            {m.status}
          </Badge>
        </div>
        <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
          {m.sentBy && <span>{m.sentBy} ·</span>}
          <span>{m.status === 'scheduled' && m.scheduledAt ? `Scheduled for ${formatDateTime(m.scheduledAt)}` : formatDateTime(whenOf(m))}</span>
          <span className="ml-auto font-medium text-brand-700 group-open:hidden">Show email</span>
          <span className="ml-auto hidden font-medium text-brand-700 group-open:inline">Hide email</span>
        </p>
        {isFailed(m) && m.error && <p className="mt-1 text-[11px] text-red-600">{m.error}</p>}
      </summary>
      <div className="border-t border-slate-100 p-3">
        <EmailPreview html={m.body} height="20rem" />
        {attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
            {attachments.map((a) => (
              <a
                key={a._id}
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-slate-700 hover:bg-slate-200"
              >
                <Paperclip className="h-3 w-3" /> {a.name} <span className="text-slate-400">· {fileSize(a.size)}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </details>
  )
}

/**
 * The SMS or Email history of a lead, laid out like the WhatsApp thread next to it: everything the CRM sent
 * (by hand or by an automation), oldest at the top, with day separators and the delivery status per message.
 * Both channels are outbound only, so there are no replies here. The footer opens the usual send dialog.
 */
export function MessageHistory({ lead, channel, canSend }: { lead: Lead; channel: Channel; canSend: boolean }) {
  const { data, isLoading, isError } = useLeadMessagesQuery(lead._id, { pollingInterval: POLL_MS })
  const [composer, setComposer] = useState(false)
  const bottom = useRef<HTMLDivElement>(null)
  const meta = CHANNEL[channel]
  const Icon = meta.icon
  // the API lists newest first; the pane reads like the WhatsApp thread, oldest at the top
  const messages = (data?.data ?? []).filter((m) => m.channel === channel && m.direction !== 'in').slice().reverse()
  const count = messages.length
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [count])
  const to = channel === 'sms' ? lead.mobile : lead.email
  const optedOut = lead.optedOut?.[channel]

  if (isLoading) return <Skeleton className="h-96 w-full" />
  if (isError) return <EmptyState title={`Could not load the ${meta.label} history`} />
  return (
    <div
      className="flex h-[70vh] min-h-[480px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      data-testid={`${channel}-history`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
        <div>
          <span className="font-semibold text-slate-800">{meta.label}</span> · {to || meta.missing}
          {optedOut && <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-amber-800">Opted out</span>}
        </div>
        <div>{count > 0 && `${count} message${count === 1 ? '' : 's'}`}</div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto bg-slate-50 px-4 py-3" data-testid={`${channel}-thread`}>
        {!count && <p className="py-10 text-center text-sm text-slate-500">{meta.empty}</p>}
        {messages.map((m, i) => {
          const day = dayLabel(whenOf(m))
          const prev = messages[i - 1]
          const showDay = !prev || dayLabel(whenOf(prev)) !== day
          return (
            <div key={m._id}>
              {showDay && (
                <div className="my-2 text-center">
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-500 ring-1 ring-slate-200">{day}</span>
                </div>
              )}
              {channel === 'sms' ? <SmsBubble m={m} /> : <EmailCard m={m} />}
            </div>
          )
        })}
        <div ref={bottom} />
      </div>
      {canSend && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white p-3 text-xs text-slate-600">
          <span>{to ? meta.hint : `This lead has ${meta.missing}.`}</span>
          <Button size="sm" onClick={() => setComposer(true)} disabled={!to}>
            <Icon className="h-3.5 w-3.5" /> {meta.send}
          </Button>
        </div>
      )}
      {composer && <SendMessageModal lead={lead} channel={channel} onClose={() => setComposer(false)} />}
    </div>
  )
}
