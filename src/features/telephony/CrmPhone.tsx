import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Phone, PhoneIncoming, PhoneOff } from 'lucide-react'
import { useAppDispatch } from '../../app/hooks'
import { api } from '../../services/api'
import { useLazySoftphoneCallerQuery, useLogPhoneCallMutation, useSoftphoneCallerQuery } from '../../services/telephonyApi'
import { Button } from '../../components/ui/Button'
import { answer, decline, disconnectPhone, usePhone, type PhoneCall } from './softphone'
import { useConnectPhone } from './useConnectPhone'
import { useTelephonyEnabled } from './useLiveCalls'

const leadPath = (leadId: string) => `/app/leads/${leadId}`

/**
 * The CRM's phone, mounted once in the app layout: registers the counsellor's softphone as soon as they are signed in
 * (no Chrome extension needed) and opens the caller's lead on answer (the call itself then shows in the calling dock,
 * CallDock). Calls ringing it show as cards, bottom right (PhoneIncomingCards, in the CallPopover stack).
 */
export function CrmPhone() {
  const { status } = useTelephonyEnabled()
  const enabled = !!status?.myDialer?.enabled
  const phone = usePhone()
  const { connect } = useConnectPhone()
  const navigate = useNavigate()
  const location = useLocation()
  const [lookup, { data: caller }] = useLazySoftphoneCallerQuery()
  const opened = useRef<string | null>(null)
  const [logCall] = useLogPhoneCallMutation()
  const dispatch = useAppDispatch()
  const leadOfCall = useRef(new Map<string, string>()) // phone call id → the caller's lead (looked up while it rang)
  const reported = useRef<string | null>(null)
  const pathname = useRef(location.pathname)
  useEffect(() => {
    pathname.current = location.pathname
  }, [location.pathname])
  const live = phone.inCall ?? phone.ringing

  useEffect(() => {
    if (!enabled) return
    void connect()
    return () => disconnectPhone()
    // connect once per sign-in; the drawer has Reconnect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  const number = live?.number
  useEffect(() => {
    if (number) void lookup(number, true)
  }, [number, lookup])

  const lead = number && caller?.data ? caller.data.lead : null
  useEffect(() => {
    if (live && lead) leadOfCall.current.set(live.id, lead._id)
  }, [live, lead])

  // the call ended: the CRM closes its row with what the phone saw, then the lead page opens the outcome drawer by
  // itself (only now — never while the call is on)
  const ended = phone.lastEnded
  useEffect(() => {
    if (!ended || reported.current === ended.id || ended.kind === 'session') return
    reported.current = ended.id
    if (!ended.answeredAt && ended.kind !== 'outbound') return // a missed incoming call: Smartflo reports it
    const leadId = ended.leadId ?? leadOfCall.current.get(ended.id)
    const iso = (t: number) => new Date(t).toISOString()
    logCall({
      leadId,
      number: ended.kind === 'inbound' ? ended.number : undefined,
      direction: ended.kind === 'inbound' ? 'inbound' : 'outbound',
      startedAt: iso(ended.startedAt),
      answeredAt: ended.answeredAt ? iso(ended.answeredAt) : null,
      endedAt: iso(ended.endedAt),
    })
      .unwrap()
      .then((res) => {
        const due = res.data
        if (due?.needsDisposition && due.lead && pathname.current !== leadPath(due.lead._id)) navigate(leadPath(due.lead._id))
        // a click-to-call's outcome and talk time come from Smartflo's call record, which can land a few seconds after
        // the call: read the lead's calls again so the outcome drawer shows them
        const settledLead = ended.kind === 'outbound' ? due?.lead?._id : undefined
        if (settledLead) {
          for (const ms of [6000, 15000]) {
            window.setTimeout(() => dispatch(api.util.invalidateTags([{ type: 'LeadCalls', id: settledLead }, { type: 'LeadTimeline', id: settledLead }])), ms)
          }
        }
      })
      .catch(() => {})
  }, [ended, logCall, navigate, dispatch])

  // picked up: open the caller's lead (once per call)
  useEffect(() => {
    if (!phone.inCall || !lead || opened.current === phone.inCall.id) return
    opened.current = phone.inCall.id
    if (location.pathname !== leadPath(lead._id)) navigate(leadPath(lead._id))
  }, [phone.inCall, lead, location.pathname, navigate])

  return null // ringing: the cards bottom right (PhoneIncomingCards) · on a call: the calling dock (CallDock)
}

/** One call ringing the CRM phone: who it is (the lead, looked up by the number) with Answer / Decline. */
function IncomingCard({ call }: { call: PhoneCall }) {
  const { data } = useSoftphoneCallerQuery(call.number, { skip: !call.number })
  const lead = data?.data.lead ?? null
  const who = lead ? lead.name : call.name && call.name !== call.number ? call.name : call.number || 'Smartflo'
  const sub = lead ? [lead.leadNo, lead.stage, call.number].filter(Boolean).join(' · ') : call.number && who !== call.number ? `${call.number} · not a lead yet` : 'Not a lead yet'
  const initials = (lead?.name || who).replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  return (
    <div
      className="pointer-events-auto overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-2xl ring-1 ring-emerald-100"
      role="dialog"
      aria-label={`Incoming call from ${who}`}
      data-testid="phone-ringing"
    >
      <div className="flex items-center gap-3 p-3">
        <span className="relative flex h-11 w-11 shrink-0 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/50" />
          <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
            {initials || <PhoneIncoming className="h-5 w-5" />}
          </span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Incoming call</p>
          <p className="truncate text-sm font-semibold text-slate-800">{who}</p>
          {sub && <p className="truncate text-[11px] text-slate-500">{sub}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-slate-100 bg-slate-50/60 p-2">
        <Button variant="danger" size="sm" onClick={() => decline(call.id)}>
          <PhoneOff className="h-4 w-4" /> Decline
        </Button>
        <Button variant="success" size="sm" onClick={() => answer(call.id)} data-testid="phone-answer">
          <Phone className="h-4 w-4" /> Answer
        </Button>
      </div>
    </div>
  )
}

/** Every call ringing the CRM phone, stacked bottom right — the page stays usable while they ring. */
export function PhoneIncomingCards() {
  const phone = usePhone()
  if (!phone.incoming.length) return null
  return (
    <>
      {phone.incoming.map((call) => (
        <IncomingCard key={call.id} call={call} />
      ))}
    </>
  )
}
