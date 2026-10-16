import { Fragment, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Badge, StatusBadge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Input, Select } from '../../../components/ui/fields'
import type { BadgeTone } from '../../../lib/status'
import { formatDateTime } from '../../../lib/utils'
import { useGetAuditLogQuery } from '../../../services/adminApi'
import { useCampaignRecipientsQuery } from '../../../services/messagingApi'
import type {
  AuditLeadRef,
  AuditLogEntry,
  AuditTemplateRef,
  CampaignAuditSnapshot,
  MessageAuditSnapshot,
} from '../../../types/models'

/**
 * The Activity Log drill-down for SMS / email / WhatsApp (GL-28): a single message with the text as it
 * went out, who sent it, the gateway's answer and its sent → delivered history; a bulk send with its
 * audience, report and every recipient one by one. The entry's own snapshot is shown at once; what the
 * message / campaign looks like now (delivered since? how many failed?) is loaded on top.
 */

const CHANNEL_LABELS: Record<string, string> = { sms: 'SMS', email: 'Email', whatsapp: 'WhatsApp' }
const CHANNEL_TONES: Record<string, BadgeTone> = { sms: 'blue', email: 'cyan', whatsapp: 'green' }
const ACTION_LABELS: Record<string, string> = {
  message_send: 'Sent from the CRM',
  message_sent: 'Accepted by the gateway',
  message_delivered: 'Delivered',
  message_failed: 'Failed',
  message_received: 'Received',
}
const RECIPIENT_STATUSES: [string, string][] = [
  ['', 'All statuses'],
  ['delivered', 'Delivered'],
  ['sent', 'Sent'],
  ['failed,bounced', 'Failed'],
  ['queued', 'Queued'],
]
const PAGE_SIZE = 25

const when = (value?: string | null) => (value ? formatDateTime(value) : '—')

export function ChannelBadge({ channel }: { channel?: string }) {
  if (!channel) return null
  return <Badge tone={CHANNEL_TONES[channel] ?? 'slate'}>{CHANNEL_LABELS[channel] ?? channel}</Badge>
}

function Fact({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-0.5 text-xs text-slate-700">{children ?? '—'}</div>
    </div>
  )
}

function LeadLine({ lead }: { lead?: AuditLeadRef }) {
  if (!lead) return <>—</>
  const contact = [lead.mobile, lead.email].filter(Boolean).join(' · ')
  return (
    <div>
      <Link to={`/app/leads/${lead._id}`} className="font-medium text-brand-700 hover:underline">
        {lead.name}
      </Link>
      <span className="text-slate-400"> · {lead.leadNo}</span>
      <p className="text-slate-500">
        {contact || '—'}
        {lead.owner ? ` · Counsellor: ${lead.owner}` : ''}
      </p>
    </div>
  )
}

function TemplateLine({ template }: { template?: AuditTemplateRef | null }) {
  if (!template) return <>Custom message</>
  const extra =
    template.channel === 'sms'
      ? [template.dltTemplateId && `DLT ${template.dltTemplateId}`, template.senderId && `Sender ${template.senderId}`, template.dltType]
      : template.channel === 'whatsapp'
        ? [template.waTemplateName, template.waLanguage, template.waCategory?.toLowerCase()]
        : []
  const parts = extra.filter(Boolean)
  return (
    <div>
      <span className="font-medium">{template.name}</span>
      {parts.length > 0 && <p className="text-slate-500">{parts.join(' · ')}</p>}
    </div>
  )
}

function MessageBody({ channel, subject, body }: { channel?: string; subject?: string; body?: string }) {
  if (!body && !subject) return <>—</>
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50">
      {subject && <p className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">{subject}</p>}
      {channel === 'email' ? (
        // the email's HTML exactly as it went out, isolated from the app (no scripts, no navigation)
        <iframe title="Email body" sandbox="" srcDoc={body} className="h-64 w-full rounded-b-lg bg-white" />
      ) : (
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words px-3 py-2 font-sans text-xs text-slate-700">{body}</pre>
      )}
    </div>
  )
}

function Variables({ values }: { values?: string[] }) {
  if (!values?.length) return null
  return (
    <Fact label="Template values">
      {values.map((v, i) => (
        <Badge key={i} className="mb-1 mr-1">
          {i + 1}: {v}
        </Badge>
      ))}
    </Fact>
  )
}

function RawJson({ value }: { value: unknown }) {
  if (value === undefined || value === null) return null
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-slate-500 hover:text-slate-700">Raw data</summary>
      <pre className="mt-1 max-h-60 overflow-auto rounded-lg bg-slate-50 p-3">{JSON.stringify(value, null, 2)}</pre>
    </details>
  )
}

function Technical({ entry }: { entry: AuditLogEntry }) {
  return (
    <p className="break-all text-[11px] text-slate-400">
      Entry {entry._id} · IP {entry.ip ?? '—'}
      {entry.userAgent ? ` · ${entry.userAgent}` : ''}
    </p>
  )
}

/** A single SMS / email / WhatsApp message: the snapshot at the time of the entry, plus how it stands now. */
export function MessageAuditDetail({ entry }: { entry: AuditLogEntry }) {
  const snap = (entry.after ?? {}) as MessageAuditSnapshot
  const { data, isLoading } = useGetAuditLogQuery(entry._id)
  const details = data?.data.details
  const live = details?.kind === 'message' ? details : undefined
  const message = live?.message
  const status = message?.status ?? snap.status
  const error = message?.error ?? snap.error
  const inbound = snap.direction === 'in'
  const providerMessageId = message?.providerMessageId ?? snap.providerMessageId
  return (
    <div className="space-y-4 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <ChannelBadge channel={snap.channel} />
        <Badge tone={inbound ? 'violet' : 'slate'}>{inbound ? 'Received from the lead' : 'Sent by the CRM'}</Badge>
        <StatusBadge status={status} />
        {message && message.status !== snap.status && <span className="text-slate-400">was “{snap.status}” when this entry was written</span>}
        <span className="ml-auto text-slate-400">{formatDateTime(entry.createdAt)}</span>
      </div>
      {error && <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-red-700">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Fact label={inbound ? 'From (lead)' : 'To (lead)'}>
          <LeadLine lead={message?.lead ?? snap.lead} />
        </Fact>
        <Fact label={inbound ? 'Number' : 'Sent to'}>{snap.to ?? message?.to ?? '—'}</Fact>
        <Fact label={inbound ? 'Sender name' : 'Sent by'}>
          {inbound ? entry.actorName : (entry.actor?.name ?? snap.sentBy ?? entry.actorName)}
          {snap.trigger ? <span className="text-slate-400"> · automation: {snap.trigger.replace(/_/g, ' ')}</span> : null}
        </Fact>
        <Fact label="Template">
          <TemplateLine template={message?.templateDetail ?? snap.template} />
        </Fact>
        {snap.campaign && <Fact label="Bulk send">{snap.campaign.name}</Fact>}
        <Fact label="Gateway">
          {snap.provider ?? message?.provider ?? '—'}
          {providerMessageId ? <span className="block break-all text-slate-400">id {providerMessageId}</span> : null}
        </Fact>
        <Fact label="Sent at">{when(message?.sentAt ?? snap.sentAt)}</Fact>
        <Fact label="Delivered at">{when(message?.deliveredAt ?? snap.deliveredAt)}</Fact>
      </div>
      <Variables values={snap.variables} />
      <Fact label="Message">
        <MessageBody channel={snap.channel} subject={snap.subject ?? message?.subject} body={snap.body ?? message?.body} />
      </Fact>
      <Fact label="History">
        {isLoading ? (
          <p className="text-slate-400">Loading…</p>
        ) : live?.history.length ? (
          <ol className="space-y-1">
            {live.history.map((h) => (
              <li key={h._id} className={h._id === entry._id ? 'font-medium text-slate-800' : 'text-slate-600'}>
                <span className="inline-block w-36 text-slate-400">{formatDateTime(h.createdAt)}</span>
                {ACTION_LABELS[h.action] ?? h.action.replace(/_/g, ' ')}
                {h.status ? ` · ${h.status}` : ''} · {h.actorName}
                {h.error ? <span className="text-red-600"> · {h.error}</span> : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-slate-400">{data ? 'This message no longer exists; the entry above is what was recorded.' : '—'}</p>
        )}
      </Fact>
      <Technical entry={entry} />
      <RawJson value={entry.after} />
    </div>
  )
}

/** A bulk send: who sent what to how many, how it went, and every recipient with the live status. */
export function CampaignAuditDetail({ entry }: { entry: AuditLogEntry }) {
  const snap = (entry.after ?? {}) as CampaignAuditSnapshot
  const { data } = useGetAuditLogQuery(entry._id)
  const details = data?.data.details
  const campaign = details?.kind === 'campaign' ? details.campaign : undefined
  const report = campaign?.report ?? snap.report
  const counts = campaign?.counts ?? { selected: snap.selected, final: snap.recipients, excluded: snap.excluded }
  const campaignId = entry.entityId ?? snap.campaignId
  return (
    <div className="space-y-4 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <ChannelBadge channel={snap.channel} />
        <StatusBadge status={campaign?.status ?? snap.status} />
        <span className="font-medium text-slate-800">{snap.name}</span>
        <span className="ml-auto text-slate-400">{formatDateTime(entry.createdAt)}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Fact label="Sent by">{entry.actor?.name ?? snap.createdBy ?? entry.actorName}</Fact>
        <Fact label="Template">
          <TemplateLine template={snap.template} />
        </Fact>
        <Fact label="Scheduled for">{when(campaign?.scheduledAt ?? snap.scheduledAt)}</Fact>
        <Fact label="Started → finished">
          {when(campaign?.startedAt ?? snap.startedAt)} → {when(campaign?.finishedAt ?? snap.finishedAt)}
        </Fact>
        <Fact label="Audience" className="sm:col-span-2">
          {counts.selected ?? '—'} selected · {counts.excluded?.optedOut ?? 0} opted out, {counts.excluded?.invalid ?? 0} invalid,{' '}
          {counts.excluded?.duplicate ?? 0} duplicate → <b>{counts.final ?? '—'} recipients</b>
        </Fact>
        {snap.filters && Object.keys(snap.filters).length > 0 && (
          <Fact label="List filters" className="sm:col-span-2">
            <code className="break-all">{JSON.stringify(snap.filters)}</code>
          </Fact>
        )}
      </div>
      <Variables values={snap.variables} />
      {report && (
        <div className="grid grid-cols-5 gap-2">
          {(['queued', 'sent', 'delivered', 'failed', 'bounced'] as const).map((k) => (
            <div key={k} className="rounded-lg border border-slate-200 p-2 text-center">
              <p className="text-base font-semibold text-slate-800">{report[k] ?? 0}</p>
              <p className="text-[11px] capitalize text-slate-500">{k}</p>
            </div>
          ))}
        </div>
      )}
      {campaignId && <Recipients campaignId={campaignId} channel={snap.channel} />}
      <Technical entry={entry} />
      <RawJson value={entry.after} />
    </div>
  )
}

function Recipients({ campaignId, channel }: { campaignId: string; channel?: string }) {
  const [status, setStatus] = useState('')
  const [typed, setTyped] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState<string | null>(null)
  const { data, isLoading, isError } = useCampaignRecipientsQuery({
    id: campaignId,
    page,
    page_size: PAGE_SIZE,
    status: status || undefined,
    search: search || undefined,
  })
  const rows = data?.data ?? []
  const pagination = data?.pagination
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="font-semibold text-slate-700">Recipients{pagination ? ` (${pagination.total_results})` : ''}</p>
        <form
          className="ml-auto flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            setSearch(typed.trim())
            setPage(1)
          }}
        >
          <Select
            className="!w-auto"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(1)
            }}
          >
            {RECIPIENT_STATUSES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Input className="!w-44" placeholder="Name, lead id, mobile…" value={typed} onChange={(e) => setTyped(e.target.value)} />
          <Button type="submit" variant="outline" size="sm">
            Search
          </Button>
        </form>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Lead</th>
              <th className="px-3 py-2">{channel === 'email' ? 'Email' : 'Mobile'}</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Sent</th>
              <th className="px-3 py-2">Delivered</th>
              <th className="px-3 py-2">Error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {isError && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-red-600">
                  Could not load the recipients.
                </td>
              </tr>
            )}
            {!isLoading && !isError && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-slate-400">
                  No recipients match.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <Fragment key={r._id}>
                <tr className="cursor-pointer hover:bg-slate-50" onClick={() => setOpen(open === r._id ? null : r._id)} title="Click for the message">
                  <td className="px-3 py-2">
                    <Link to={`/app/leads/${r.lead._id}`} className="font-medium text-brand-700 hover:underline" onClick={(e) => e.stopPropagation()}>
                      {r.lead.name}
                    </Link>
                    <span className="block text-slate-400">
                      {r.lead.leadNo}
                      {r.lead.owner ? ` · ${r.lead.owner}` : ''}
                    </span>
                  </td>
                  <td className="px-3 py-2">{r.to ?? '—'}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-3 py-2 text-slate-500">{when(r.sentAt)}</td>
                  <td className="px-3 py-2 text-slate-500">{when(r.deliveredAt)}</td>
                  <td className="max-w-[16rem] truncate px-3 py-2 text-red-600" title={r.error ?? undefined}>
                    {r.error ?? ''}
                  </td>
                </tr>
                {open === r._id && (
                  <tr className="bg-slate-50/60">
                    <td colSpan={6} className="px-3 py-2">
                      <MessageBody channel={channel} subject={r.subject} body={r.body} />
                      <p className="mt-1 text-[11px] text-slate-400">
                        Gateway {r.provider ?? '—'}
                        {r.providerMessageId ? ` · id ${r.providerMessageId}` : ''}
                      </p>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {pagination && pagination.total_pages > 1 && (
        <div className="mt-2 flex items-center justify-end gap-2 text-slate-500">
          <span>
            Page {pagination.current_page} of {pagination.total_pages}
          </span>
          <Button variant="outline" size="sm" disabled={!pagination.previous_page} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={!pagination.next_page} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
