import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, CheckCheck, FileText, Send } from 'lucide-react'
import { toast } from 'sonner'
import { useSendWhatsAppTextMutation, useWhatsAppChatQuery } from '../../services/messagingApi'
import { Button } from '../../components/ui/Button'
import { Textarea } from '../../components/ui/fields'
import { EmptyState, Skeleton } from '../../components/ui/feedback'
import { cn, formatDateTime, parseApiError } from '../../lib/utils'
import type { Lead, WhatsAppChatMessage } from '../../types/models'
import { SendMessageModal } from './LeadActionModals'

const POLL_MS = 10_000

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (same(d, today)) return 'Today'
  if (same(d, yesterday)) return 'Yesterday'
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

function StatusTick({ m }: { m: WhatsAppChatMessage }) {
  if (m.status === 'failed') {
    return (
      <span title={m.error} className="inline-flex items-center gap-0.5 text-red-600">
        <AlertTriangle className="h-3 w-3" /> failed
      </span>
    )
  }
  if (m.status === 'delivered') return <CheckCheck className="h-3.5 w-3.5 text-sky-600" aria-label="Delivered" />
  if (m.status === 'sent') return <Check className="h-3.5 w-3.5 text-slate-400" aria-label="Sent" />
  return <span>{m.status}</span>
}

/**
 * The lead's WhatsApp thread inside the CRM (GL-39): what we sent (templates and typed replies) and
 * what the lead answered, refreshed every 10 seconds. A typed reply is allowed only inside Meta's
 * 24-hour window after the lead's last message; outside it the composer points to an approved template.
 */
export function WhatsAppChat({ lead, canSend }: { lead: Lead; canSend: boolean }) {
  const { data, isLoading, isError } = useWhatsAppChatQuery(lead._id, { pollingInterval: POLL_MS })
  const [sendText, { isLoading: sending }] = useSendWhatsAppTextMutation()
  const [text, setText] = useState('')
  const [templateModal, setTemplateModal] = useState(false)
  const bottom = useRef<HTMLDivElement>(null)
  const chat = data?.data
  const count = chat?.messages.length ?? 0
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [count])

  const submit = async () => {
    const body = text.trim()
    if (!body || sending) return
    try {
      const res = await sendText({ id: lead._id, text: body }).unwrap()
      if (res.data.status === 'failed') toast.error(res.data.error ?? 'WhatsApp failed')
      setText('')
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  if (isLoading) return <Skeleton className="h-96 w-full" />
  if (isError || !chat) return <EmptyState title="Could not load the WhatsApp chat" />
  const windowUntil = chat.windowOpenUntil ? formatDateTime(chat.windowOpenUntil) : null
  return (
    <div className="flex h-[70vh] min-h-[480px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
        <div>
          <span className="font-semibold text-slate-800">WhatsApp</span> · {chat.to ?? 'no valid mobile'}
          {chat.optedOut && <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-amber-800">Opted out</span>}
        </div>
        <div>{windowUntil ? `Typed replies allowed until ${windowUntil}` : 'Reply window closed · templates only until the lead writes back'}</div>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto bg-[#efeae2] px-4 py-3" data-testid="whatsapp-thread">
        {!count && (
          <p className="py-10 text-center text-sm text-slate-500">
            No WhatsApp messages with this lead yet. Replies the lead sends to the business number appear here.
          </p>
        )}
        {chat.messages.map((m, i) => {
          const day = dayLabel(m.sentAt)
          const prev = chat.messages[i - 1]
          const showDay = !prev || dayLabel(prev.sentAt) !== day
          const mine = m.direction === 'out'
          return (
            <div key={m._id}>
              {showDay && (
                <div className="my-2 text-center">
                  <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] text-slate-500">{day}</span>
                </div>
              )}
              <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[78%] rounded-lg px-3 py-2 text-sm shadow-sm', mine ? 'bg-[#d9fdd3] text-slate-900' : 'bg-white text-slate-900')}>
                  {m.template && (
                    <p className="mb-0.5 flex items-center gap-1 text-[11px] text-slate-500">
                      <FileText className="h-3 w-3" /> Template · {m.template}
                    </p>
                  )}
                  {!mine && m.sentBy && <p className="mb-0.5 text-[11px] font-medium text-emerald-700">{m.sentBy}</p>}
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-500">
                    {mine && m.sentBy && <span className="mr-1">{m.sentBy} ·</span>}
                    {timeOf(m.sentAt)}
                    {mine && <StatusTick m={m} />}
                  </p>
                  {m.status === 'failed' && m.error && <p className="mt-1 text-[11px] text-red-600">{m.error}</p>}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottom} />
      </div>
      {canSend && (
        <div className="border-t border-slate-200 bg-white p-3">
          {chat.canSendText ? (
            <div className="flex items-end gap-2">
              <Textarea
                rows={2}
                value={text}
                maxLength={4096}
                placeholder="Type a reply… (Enter sends, Shift+Enter for a new line)"
                className="flex-1"
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void submit()
                  }
                }}
              />
              <Button onClick={submit} loading={sending} disabled={!text.trim()}>
                <Send className="h-3.5 w-3.5" /> Send
              </Button>
              <Button variant="outline" onClick={() => setTemplateModal(true)}>
                Template
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              <span>
                {chat.to
                  ? "WhatsApp allows a typed reply only within 24 hours of the lead's last message. Until then, send an approved template."
                  : 'This lead has no valid mobile number.'}
              </span>
              {chat.to && (
                <Button size="sm" onClick={() => setTemplateModal(true)}>
                  Send template
                </Button>
              )}
            </div>
          )}
        </div>
      )}
      {templateModal && <SendMessageModal lead={lead} channel="whatsapp" onClose={() => setTemplateModal(false)} />}
    </div>
  )
}
