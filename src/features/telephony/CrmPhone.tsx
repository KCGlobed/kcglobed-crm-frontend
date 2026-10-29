import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Phone, PhoneIncoming, PhoneOff } from 'lucide-react'
import { useLazySoftphoneCallerQuery, useLogPhoneCallMutation } from '../../services/telephonyApi'
import { Button } from '../../components/ui/Button'
import { answer, disconnectPhone, hangup, usePhone } from './softphone'
import { useConnectPhone } from './useConnectPhone'
import { useTelephonyEnabled } from './useLiveCalls'

const leadPath = (leadId: string) => `/app/leads/${leadId}`

/**
 * The CRM's phone, mounted once in the app layout: registers the counsellor's softphone as soon as they are signed in
 * (no Chrome extension needed), shows Answer / Decline for a call ringing it and opens the caller's lead on answer,
 * (the call itself then shows in the calling dock, CallDock).
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
      })
      .catch(() => {})
  }, [ended, logCall, navigate])

  // picked up: open the caller's lead (once per call)
  useEffect(() => {
    if (!phone.inCall || !lead || opened.current === phone.inCall.id) return
    opened.current = phone.inCall.id
    if (location.pathname !== leadPath(lead._id)) navigate(leadPath(lead._id))
  }, [phone.inCall, lead, location.pathname, navigate])

  if (!enabled || !live) return null
  const who = lead ? lead.name : live.name && live.name !== live.number ? live.name : live.number || 'Smartflo'
  const sub = lead ? [lead.leadNo, lead.stage].filter(Boolean).join(' · ') : live.number && who !== live.number ? live.number : ''

  if (!phone.inCall) {
    const initials = (lead?.name || who).replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" data-testid="phone-ringing">
        <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl" role="dialog" aria-label="Incoming call">
          <div className="flex flex-col items-center bg-gradient-to-b from-emerald-600 to-emerald-700 px-6 pb-6 pt-8 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">Incoming call</p>
            <span className="relative mt-5 flex h-24 w-24 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-white/30" />
              <span className="relative flex h-24 w-24 items-center justify-center rounded-full bg-white text-3xl font-bold text-emerald-700">
                {initials || <PhoneIncoming className="h-10 w-10" />}
              </span>
            </span>
            <p className="mt-5 max-w-full truncate text-2xl font-semibold">{who}</p>
            {sub && <p className="mt-1 max-w-full truncate text-sm text-emerald-100">{sub}</p>}
            {lead && live.number && <p className="mt-1 font-mono text-sm text-emerald-100">{live.number}</p>}
            {!lead && <p className="mt-1 text-sm text-emerald-100">No lead has this number yet</p>}
          </div>
          <div className="grid grid-cols-2 gap-3 p-5">
            <Button variant="danger" className="h-14 text-base" onClick={hangup}>
              <PhoneOff className="h-5 w-5" /> Decline
            </Button>
            <Button variant="success" className="h-14 text-base" onClick={answer} data-testid="phone-answer" autoFocus>
              <Phone className="h-5 w-5" /> Answer
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return null // on a call: the calling dock (CallDock) shows it
}
