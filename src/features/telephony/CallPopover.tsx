import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ListOrdered, PhoneIncoming, SkipForward, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAppDispatch } from '../../app/hooks'
import { api } from '../../services/api'
import { useAttachLeadMutation } from '../../services/telephonyApi'
import { Button } from '../../components/ui/Button'
import { parseApiError } from '../../lib/utils'
import type { Lead, LiveCall } from '../../types/models'
import { QuickAddDrawer } from '../../pages/leads/QuickAddDrawer'
import type { CallPhase } from './callState'
import { advanceQueue, clearQueue, readQueue, remainingInQueue } from './callQueue'
import { usePhone } from './softphone'
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
 * The dialer's floating cards, mounted once in the app layout: incoming calls ringing this user (who is calling,
 * Create lead) and the "Start calling" queue. The call in progress shows in the calling dock (CallDock); an ended
 * call's outcome is asked on the lead's page, which opens by itself.
 */
export function CallPopover() {
  const { enabled, phase, call, incoming, pending } = useLiveCalls()
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useAppDispatch()
  const [attach] = useAttachLeadMutation()
  const [hiddenIncoming, setHiddenIncoming] = useState<string[]>([])
  const phone = usePhone()
  const [createFor, setCreateFor] = useState<LiveCall | null>(null)
  const [queueTick, setQueueTick] = useState(0)
  const live = LIVE_PHASES.includes(phase)
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

  // the auto-dialer connected this counsellor to a lead: open its page (once per call)
  const autoOpened = useRef<Set<string>>(new Set())
  const autoLeadId = call?.dialerMeta?.mode === 'campaign' ? call.lead?._id : undefined
  useEffect(() => {
    if (!call || !autoLeadId || autoOpened.current.has(call._id)) return
    autoOpened.current.add(call._id)
    if (location.pathname !== leadPath(autoLeadId)) navigate(leadPath(autoLeadId))
  }, [call, autoLeadId, location.pathname, navigate])

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
  // ringing the CRM phone: its own card (Answer / Decline) stands for the call
  const visibleIncoming = phone.ringing || phone.inCall ? [] : incoming.filter((c) => !hiddenIncoming.includes(c._id))
  const newestPending = pending[0]
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

  if (!visibleIncoming.length && !queue) return null

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
            {!c.lead && (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setCreateFor(c)}>
                  <UserPlus className="h-3.5 w-3.5" /> Create lead
                </Button>
              </div>
            )}
          </div>
        ))}

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
