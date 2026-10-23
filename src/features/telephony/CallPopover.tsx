import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ListOrdered, PhoneCall, PhoneIncoming, PhoneOff, SkipForward, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAppDispatch } from '../../app/hooks'
import { api } from '../../services/api'
import { useAttachLeadMutation, useDismissCallMutation, useHangupCallMutation } from '../../services/telephonyApi'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { formatHms, useNow } from '../../lib/durations'
import { cn, parseApiError } from '../../lib/utils'
import type { Lead, LiveCall } from '../../types/models'
import { QuickAddDrawer } from '../../pages/leads/QuickAddDrawer'
import { PHASE_LABELS, isFinalStatus, statusLabel, statusTone, talkSeconds, type CallPhase } from './callState'
import { advanceQueue, clearQueue, readQueue, remainingInQueue } from './callQueue'
import { requestOpenDisposition } from './events'
import { useLiveCalls } from './useLiveCalls'

const leadPath = (leadId: string) => `/app/leads/${leadId}`
const LIVE_PHASES: CallPhase[] = ['dialing', 'ringing_agent', 'ringing_customer', 'connected']

function Who({ call }: { call: LiveCall }) {
  if (call.lead) {
    return (
      <p className="min-w-0 text-sm">
        <span className="block truncate font-semibold text-slate-800">{call.lead.name}</span>
        <span className="block truncate text-[11px] text-slate-500">
          {call.lead.leadNo}
          {call.lead.stage ? ` · ${call.lead.stage}` : ''}
          {call.lead.owner ? ` · ${call.lead.owner.name}` : ''}
        </span>
      </p>
    )
  }
  return (
    <p className="min-w-0 text-sm">
      <span className="block font-semibold text-slate-800">Unknown number</span>
      <span className="block text-[11px] text-slate-500">{call.customerNumber ?? 'number withheld'} · no lead has this number</span>
    </p>
  )
}

/**
 * The dialer's floating card, mounted once in the app layout: the outbound call in progress
 * (phase + timer + Hang up), incoming calls ringing this user (who is calling, Open lead / Create
 * lead), ended calls whose outcome is still to be saved, and the "Start calling" queue.
 */
export function CallPopover() {
  const { enabled, phase, call, incoming, pending, timerFrom } = useLiveCalls()
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useAppDispatch()
  const [hangup, { isLoading: hangingUp }] = useHangupCallMutation()
  const [dismiss, { isLoading: dismissing }] = useDismissCallMutation()
  const [attach] = useAttachLeadMutation()
  const [hiddenIncoming, setHiddenIncoming] = useState<string[]>([])
  const [createFor, setCreateFor] = useState<LiveCall | null>(null)
  const [queueTick, setQueueTick] = useState(0)
  const live = LIVE_PHASES.includes(phase)
  const now = useNow(1000, live)
  const seenActive = useRef<Map<string, string | null>>(new Map())

  // a call that just left the live list: its lead's calls and timeline changed
  useEffect(() => {
    const current = new Map<string, string | null>()
    for (const c of [...(call ? [call] : []), ...incoming]) current.set(c._id, c.lead?._id ?? null)
    for (const [id, leadId] of seenActive.current) {
      if (!current.has(id) && leadId) {
        dispatch(api.util.invalidateTags([{ type: 'LeadCalls', id: leadId }, { type: 'LeadTimeline', id: leadId }, { type: 'Lead', id: leadId }, 'Dashboard']))
      }
    }
    seenActive.current = current
  }, [call, incoming, dispatch])

  // the queue lives in localStorage; re-render when it changes (this tab or another)
  useEffect(() => {
    const bump = () => setQueueTick((t) => t + 1)
    window.addEventListener('crm:call-queue', bump)
    window.addEventListener('storage', bump)
    return () => {
      window.removeEventListener('crm:call-queue', bump)
      window.removeEventListener('storage', bump)
    }
  }, [])

  if (!enabled) return null

  const queue = readQueue()
  const remaining = remainingInQueue(queue)
  void queueTick
  const visibleIncoming = incoming.filter((c) => !hiddenIncoming.includes(c._id))
  const newestPending = pending[0]
  const onLeadPage = (leadId: string) => location.pathname === leadPath(leadId)

  const openDisposition = (c: LiveCall) => {
    if (!c.lead) return
    if (onLeadPage(c.lead._id)) {
      requestOpenDisposition({ callId: c._id, leadId: c.lead._id })
    } else {
      navigate(`${leadPath(c.lead._id)}?disposition=${c._id}`)
    }
  }
  const skip = async (c: LiveCall) => {
    try {
      await dismiss(c._id).unwrap()
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }
  const endCall = async (c: LiveCall) => {
    try {
      await hangup(c._id).unwrap()
      toast.success('Hanging up…')
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }
  const nextInQueue = () => {
    const next = advanceQueue()
    if (next) navigate(`${leadPath(next)}?dial=1`)
    else toast.success('Calling list finished')
  }
  const onLeadCreated = async (lead: Lead) => {
    const c = createFor
    setCreateFor(null)
    if (!c) return
    try {
      await attach({ callId: c._id, leadId: lead._id }).unwrap()
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  const nothing = !live && !visibleIncoming.length && !newestPending && !queue
  if (nothing) return null

  const elapsed = timerFrom ? Math.max(0, Math.floor((now - Date.parse(timerFrom)) / 1000)) : 0

  return (
    <>
      <div className="pointer-events-none fixed bottom-4 right-4 z-40 flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-2" data-testid="call-popover">
        {visibleIncoming.map((c) => (
          <div key={c._id} className="pointer-events-auto rounded-xl border border-emerald-200 bg-white p-3 shadow-xl ring-1 ring-emerald-100" data-testid="incoming-call">
            <div className="flex items-start gap-3">
              <span className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-60" />
                <PhoneIncoming className="relative h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Incoming call</p>
                <Who call={c} />
              </div>
              <button
                type="button"
                aria-label="Dismiss"
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                onClick={() => setHiddenIncoming((h) => [...h, c._id])}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {c.lead ? (
                <Button size="sm" onClick={() => navigate(leadPath(c.lead!._id))}>
                  Open lead
                </Button>
              ) : (
                <Button size="sm" onClick={() => setCreateFor(c)}>
                  <UserPlus className="h-3.5 w-3.5" /> Create lead
                </Button>
              )}
            </div>
          </div>
        ))}

        {live && (
          <div className="pointer-events-auto rounded-xl border border-slate-200 bg-white p-3 shadow-xl" data-testid="active-call">
            <div className="flex items-start gap-3">
              <span className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white', phase === 'connected' ? 'bg-emerald-600' : 'bg-brand-600')}>
                <PhoneCall className={cn('h-4 w-4', phase !== 'connected' && 'animate-pulse')} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <span>{PHASE_LABELS[phase]}</span>
                  {call && (
                    <span className="font-mono text-xs tabular-nums text-slate-700" data-testid="call-timer">
                      {formatHms(phase === 'connected' ? talkSeconds(call, now) : elapsed)}
                    </span>
                  )}
                </p>
                {call ? <Who call={call} /> : <p className="text-sm text-slate-700">Placing the call…</p>}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {call && (
                <Button variant="danger" size="sm" loading={hangingUp} onClick={() => endCall(call)} data-testid="hangup-call">
                  <PhoneOff className="h-3.5 w-3.5" /> Hang up
                </Button>
              )}
              {call?.lead && !onLeadPage(call.lead._id) && (
                <Button variant="outline" size="sm" onClick={() => navigate(leadPath(call.lead!._id))}>
                  Open lead
                </Button>
              )}
            </div>
          </div>
        )}

        {!live && newestPending && (
          <div className="pointer-events-auto rounded-xl border border-amber-200 bg-white p-3 shadow-xl" data-testid="pending-call">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
                <PhoneCall className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Call ended
                  <Badge tone={statusTone(newestPending.status)}>{statusLabel(newestPending.status)}</Badge>
                  {isFinalStatus(newestPending.status) && newestPending.durationSeconds ? (
                    <span className="font-mono normal-case tabular-nums">{formatHms(newestPending.durationSeconds)}</span>
                  ) : null}
                </p>
                <Who call={newestPending} />
                {pending.length > 1 && <p className="mt-0.5 text-[11px] text-slate-400">+{pending.length - 1} more call{pending.length > 2 ? 's' : ''} awaiting an outcome</p>}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {newestPending.lead ? (
                <Button size="sm" onClick={() => openDisposition(newestPending)} data-testid="save-disposition">
                  Save outcome
                </Button>
              ) : (
                <Button size="sm" onClick={() => setCreateFor(newestPending)}>
                  <UserPlus className="h-3.5 w-3.5" /> Create lead
                </Button>
              )}
              <Button variant="ghost" size="sm" loading={dismissing} onClick={() => skip(newestPending)} data-testid="skip-disposition">
                Skip
              </Button>
            </div>
          </div>
        )}

        {queue && (
          <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg" data-testid="call-queue">
            <ListOrdered className="h-4 w-4 shrink-0 text-brand-600" />
            <span className="min-w-0 flex-1 truncate text-slate-700">
              <b>Calling list</b> · {queue.index + 1} of {queue.ids.length}
              {queue.label ? ` · ${queue.label}` : ''}
            </span>
            <Button size="sm" variant="secondary" disabled={live || !!newestPending} title={live || newestPending ? 'Finish this call first' : 'Open and call the next lead'} onClick={nextInQueue}>
              <SkipForward className="h-3.5 w-3.5" /> {remaining ? `Next (${remaining})` : 'Finish'}
            </Button>
            <Button size="icon" variant="ghost" aria-label="Stop calling list" title="Stop" onClick={() => clearQueue()}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {createFor && <QuickAddDrawer open onClose={() => setCreateFor(null)} initialMobile={createFor.customerNumber ?? ''} onCreated={onLeadCreated} />}
    </>
  )
}
