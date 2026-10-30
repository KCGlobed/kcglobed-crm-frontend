import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  GripVertical,
  Mic,
  MicOff,
  Pause,
  Phone,
  PhoneCall,
  PhoneForwarded,
  PhoneOff,
  Play,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  useClearDialerProgressMutation,
  useDialerProgressQuery,
  useDialerSessionMutation,
  useHangupCallMutation,
  useSoftphoneCallerQuery,
} from '../../services/telephonyApi'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/feedback'
import { formatHms, useNow } from '../../lib/durations'
import { cn, parseApiError } from '../../lib/utils'
import type { DialerProgressStatus } from '../../types/models'
import type { CallPhase } from './callState'
import { hangup, toggleMute, usePhone } from './softphone'
import { useLiveCalls, useStartCall, useTelephonyEnabled } from './useLiveCalls'

type Tone = 'green' | 'red' | 'amber' | 'blue' | 'slate'

const TONE: Record<DialerProgressStatus, Tone> = {
  adding: 'slate',
  waiting: 'slate',
  calling: 'amber',
  connected: 'green',
  dialled: 'blue',
  answered: 'green',
  not_answered: 'red',
  busy: 'amber',
  failed: 'red',
  error: 'red',
  skipped: 'slate',
}

const BAR: Partial<Record<DialerProgressStatus, string>> = {
  answered: 'bg-emerald-500',
  not_answered: 'bg-red-400',
  busy: 'bg-amber-400',
  failed: 'bg-red-600',
  error: 'bg-red-600',
  skipped: 'bg-slate-300',
}

const SUMMARY: { status: DialerProgressStatus[]; label: string; tone: Tone }[] = [
  { status: ['answered'], label: 'Answered', tone: 'green' },
  { status: ['not_answered', 'busy', 'failed'], label: 'Not answered', tone: 'red' },
  { status: ['calling', 'connected', 'dialled'], label: 'Calling', tone: 'amber' },
  { status: ['adding', 'waiting'], label: 'In queue', tone: 'slate' },
]

const FINISHED: DialerProgressStatus[] = ['answered', 'not_answered', 'busy', 'failed', 'error', 'skipped']
const LIVE_PHASES: CallPhase[] = ['dialing', 'ringing_agent', 'ringing_customer', 'connected']
const COLLAPSE_KEY = 'crm.progressive.collapsed'
const leadPath = (leadId: string) => `/app/leads/${leadId}`

/** Where the counsellor dragged the dock: an offset from the bottom-left corner, where it always opens. */
type Offset = { x: number; y: number }
const CORNER: Offset = { x: 0, y: 0 }

const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

/** The call on now, whichever way it was placed: who, and whether it still rings or they are talking. */
interface Current {
  leadId?: string
  name: string
  /** ringing: their phone rings · on: talking · line: the dialer's session line, waiting for its next lead */
  state: 'ringing' | 'on' | 'line'
  since?: number | null
}

/**
 * The calling dock, mounted once in the app layout and draggable anywhere: the call on now (who, ringing or the talk
 * timer, mute, hang up, open the lead) for any call — a Call button, an incoming call, the dialer line — and, during a
 * Progressive call, the whole run under it. A Progressive call is run from here: the CRM calls the leads one at a
 * time, in order — a click-to-call to the next lead only once the last call is over and the wrap-up time has passed
 * (seen live: Smartflo's own progressive dialer, without its agent panel, rang a second lead while the counsellor was
 * talking). The lead's page opens when they pick up.
 */
export function CallDock() {
  const { status } = useTelephonyEnabled()
  const dialerOn = !!status?.myDialer?.enabled
  const { enabled, phase, call: serverCall, timerFrom } = useLiveCalls()
  const navigate = useNavigate()
  const location = useLocation()
  const phone = usePhone()
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [offset, setOffset] = useState(CORNER)
  const [tabOffset, setTabOffset] = useState(CORNER)
  const panelRef = useRef<HTMLElement>(null)
  const tabRef = useRef<HTMLButtonElement>(null)
  const dragged = useRef(false)
  const { data } = useDialerProgressQuery(undefined, { skip: !dialerOn, pollingInterval: dialerOn ? 3000 : 0 })
  const [clear, { isLoading: closing }] = useClearDialerProgressMutation()
  const [runSession, { isLoading: ending }] = useDialerSessionMutation()
  const [hangupServer, { isLoading: hangingUp }] = useHangupCallMutation()
  const [confirmClose, setConfirmClose] = useState(false)
  const { startCall, dialing } = useStartCall()
  const run = data?.data.run ?? null
  const fired = useRef<string | null>(null)
  const opened = useRef(new Set<string>())
  // paused / going, per run (a run someone else queued for this counsellor waits for their Start)
  const [control, setControl] = useState<{ at: string; paused: boolean } | null>(null)
  const paused = !!run && (control?.at === run.at ? control.paused : run.auto === false)
  const [skipped, setSkipped] = useState<string | null>(null)
  const [wasShown, setWasShown] = useState(false)

  // an incoming call on the CRM phone: whose number it is (this number's answer only, never the previous call's)
  const inbound = phone.inCall?.kind === 'inbound' ? phone.inCall.number : null
  const { currentData: caller } = useSoftphoneCallerQuery(inbound ?? '', { skip: !inbound })

  const count = (statuses: DialerProgressStatus[]) => statuses.reduce((n, s) => n + (run?.counts[s] ?? 0), 0)
  const remaining = count(['adding', 'waiting'])
  const live = run?.leads.filter((l) => l.status === 'connected' || l.status === 'calling') ?? []
  const lineLead = phone.inCall?.kind === 'session' ? run?.leads.find((l) => l.status === 'connected') : undefined
  const serverLive = !!serverCall && LIVE_PHASES.includes(phase)

  // the call on now: the CRM phone knows first, else the CRM's call row (a call ringing the counsellor's mobile), else
  // the run's live calls
  const current: Current | null = (() => {
    const c = phone.inCall
    if (c?.kind === 'session') {
      return lineLead
        ? { leadId: lineLead._id, name: lineLead.name, state: 'on', since: lineLead.answeredAt ? Date.parse(lineLead.answeredAt) : null }
        : { name: 'Dialer line', state: 'line' }
    }
    if (c?.kind === 'outbound') {
      const name =
        run?.leads.find((l) => l._id === c.leadId)?.name ??
        (serverCall?.lead && serverCall.lead._id === c.leadId ? serverCall.lead.name : null) ??
        (serverCall?.lead?.name || 'Lead')
      return { leadId: c.leadId, name, state: c.calling ? 'ringing' : 'on', since: c.answeredAt }
    }
    if (c?.kind === 'inbound') {
      const lead = caller?.data.lead
      return { leadId: c.leadId ?? lead?._id, name: lead?.name || c.name || c.number || 'Incoming call', state: 'on', since: c.since }
    }
    if (serverLive && serverCall) {
      const on = phase === 'connected'
      const from = on ? serverCall.answeredAt ?? timerFrom : null
      return { leadId: serverCall.lead?._id, name: serverCall.lead?.name || serverCall.customerNumber || 'Call', state: on ? 'on' : 'ringing', since: from ? Date.parse(from) : null }
    }
    const l = live[0]
    if (l) return { leadId: l._id, name: l.name, state: l.status === 'connected' ? 'on' : 'ringing', since: l.answeredAt ? Date.parse(l.answeredAt) : null }
    return null
  })()

  // the wrap-up: from the end of this run's last call
  const last = phone.lastEnded
  const ended = run && last?.kind === 'outbound' && last.endedAt >= Date.parse(run.at) ? last : null
  const wrapUpMs = (run?.wrapUpSeconds ?? 30) * 1000
  const ready =
    !!run && !run.done && !paused && !!run.next && phone.status === 'ready' && !phone.inCall && !phone.ringing && !dialing && !live.length && !serverLive
  // the gap is for saving the outcome: once it is saved, the next lead is called at once
  const outcomeSaved = !!ended && !!run?.leads.find((l) => l._id === ended.leadId)?.disposed
  const nextAt = ready && ended && skipped !== ended.id && !outcomeSaved ? ended.endedAt + wrapUpMs : null
  const now = useNow(1000, !!nextAt || current?.state === 'on')
  const secondsLeft = nextAt ? Math.max(0, Math.ceil((nextAt - now) / 1000)) : null
  const clock = (since?: number | string | null) =>
    since ? formatHms(Math.max(0, Math.floor((now - (typeof since === 'number' ? since : Date.parse(since))) / 1000))) : null

  // the next lead: once nothing is on and the wrap-up is over — one call at a time
  const placeKey = run && run.next ? `${run.at}:${run.next}:${run.round ?? 1}` : null
  const due = ready && (secondsLeft === null || secondsLeft === 0)
  useEffect(() => {
    if (!due || !placeKey || !run?.next || fired.current === placeKey) return
    fired.current = placeKey
    void startCall(run.next).then((call) => {
      if (!call) setControl({ at: run.at, paused: true }) // refused (the toast says why): wait for the counsellor
    })
  }, [due, placeKey, run, startCall])

  // a lead of the run picked up: its page opens (once per call)
  const pickedUp = run && current?.state === 'on' && current.leadId && run.leads.some((l) => l._id === current.leadId) ? current.leadId : null
  const pickedKey = pickedUp ? `${run?.at}:${pickedUp}:${run?.round ?? 1}` : null
  useEffect(() => {
    if (!pickedUp || !pickedKey || opened.current.has(pickedKey)) return
    opened.current.add(pickedKey)
    if (location.pathname !== leadPath(pickedUp)) navigate(leadPath(pickedUp))
  }, [pickedUp, pickedKey, location.pathname, navigate])

  const pause = () => run && setControl({ at: run.at, paused: true })
  const resume = () => {
    if (!run) return
    setControl({ at: run.at, paused: false })
    if (ended) setSkipped(ended.id) // Start / Call next now: no more waiting
  }

  // hang up: the CRM phone's call; on the dialer line, only the lead's call (the line stays for the next one); a call
  // on the counsellor's mobile, through Smartflo
  const endCall = async () => {
    try {
      if (phone.inCall?.kind === 'session' && lineLead) await runSession({ action: 'hangup' }).unwrap()
      else if (phone.inCall) hangup()
      else if (serverCall) await hangupServer(serverCall._id).unwrap()
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  // Close: the queue is finished — the leads not called yet are not called
  const close = async () => {
    try {
      await clear().unwrap()
      setConfirmClose(false)
      toast.success('Progressive calling closed')
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }
  const askClose = () => (run && !run.done && remaining > 0 ? setConfirmClose(true) : void close())

  const toggle = () => {
    setOffset(CORNER) // opened again: back in the corner
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? '0' : '1')
      } catch {
        // storage blocked — the choice just isn't remembered
      }
      return !c
    })
  }

  // drag by the header; the dock always stays on screen; a double-click puts it back in the corner
  const drag = (e: ReactPointerEvent, el: HTMLElement | null, from: Offset, set: (o: Offset) => void) => {
    if (e.button !== 0) return
    const rect = el?.getBoundingClientRect()
    const start = { px: e.clientX, py: e.clientY, ...from }
    dragged.current = false
    const move = (ev: PointerEvent) => {
      let dx = ev.clientX - start.px
      let dy = ev.clientY - start.py
      if (Math.abs(dx) + Math.abs(dy) > 4) dragged.current = true // a click stays a click
      if (rect) {
        dx = Math.min(Math.max(dx, -rect.left), window.innerWidth - rect.right)
        dy = Math.min(Math.max(dy, -rect.top), window.innerHeight - rect.bottom)
      }
      set({ x: start.x + dx, y: start.y + dy })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  const startDrag = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    drag(e, panelRef.current, offset, setOffset)
  }
  const resetPosition = () => setOffset(CORNER)

  // it opens in the bottom-left corner every time: a drag moves it only while it is open
  const shown = enabled && (!!run || !!current)
  if (shown !== wasShown) {
    setWasShown(shown)
    setOffset(CORNER)
    setTabOffset(CORNER)
  }

  if (!shown) return null
  const finished = count(FINISHED)
  const on = current?.state === 'on'
  const talk = on ? clock(current?.since) : null

  if (collapsed) {
    return (
      <button
        ref={tabRef}
        type="button"
        style={{ transform: `translate(${tabOffset.x}px, ${tabOffset.y}px)` }}
        onPointerDown={(e) => drag(e, tabRef.current, tabOffset, setTabOffset)}
        onClick={() => {
          if (!dragged.current) toggle() // a drag moves it, a click opens it
        }}
        className={cn(
          'fixed bottom-4 left-2 z-[55] flex cursor-grab touch-none select-none items-center gap-1.5 rounded-xl border py-3 pl-1.5 pr-2 text-xs font-semibold shadow-lg active:cursor-grabbing',
          on ? 'border-emerald-300 bg-emerald-600 text-white' : current ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
        )}
        title="Click to open · drag to move"
      >
        <ChevronRight className="h-4 w-4" />
        <span className="[writing-mode:vertical-rl]">
          {current ? (on ? talk ?? 'On call' : 'Ringing…') : `Calling ${finished}/${run?.total ?? 0}`}
        </span>
        {secondsLeft !== null && <span className="rounded bg-brand-600 px-1 font-mono text-[10px] text-white">{secondsLeft}</span>}
      </button>
    )
  }

  return (
    <aside
      ref={panelRef}
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
      className="fixed bottom-4 left-4 z-[55] flex max-h-[min(32rem,calc(100vh-6rem))] w-80 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      data-testid="call-dock"
    >
      <div
        className="flex cursor-grab touch-none select-none items-center gap-2 border-b border-slate-200 bg-slate-50 px-2 py-2.5 active:cursor-grabbing"
        onPointerDown={startDrag}
        onDoubleClick={resetPosition}
        title="Drag to move · double-click to put it back"
      >
        <GripVertical className="h-4 w-4 shrink-0 text-slate-400" />
        {run ? <PhoneForwarded className="h-4 w-4 text-brand-600" /> : <Phone className="h-4 w-4 text-brand-600" />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800">{run ? 'Progressive calling' : current?.state === 'ringing' ? 'Calling' : 'Call'}</p>
          {run && (
            <p className="text-[11px] text-slate-500">
              {finished} of {run.total} done
              {(run.rounds ?? 1) > 1 && ` · round ${run.round ?? 1} of ${run.rounds}`}
              {run.done ? ' — all leads called' : paused ? ' · paused' : ''}
            </p>
          )}
        </div>
        <button type="button" className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700" title="Minimise" onClick={toggle}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        {run && (
          <button
            type="button"
            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
            title={current ? 'On a call — close once it ends' : 'Close — finish this queue'}
            disabled={closing || !!current}
            onClick={askClose}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {current && (
        <div className={cn('m-3 rounded-lg p-3 ring-1', on ? 'bg-emerald-50 ring-emerald-200' : current.state === 'line' ? 'bg-slate-50 ring-slate-200' : 'bg-amber-50 ring-amber-200')}>
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white',
                on ? 'bg-emerald-600' : current.state === 'line' ? 'bg-slate-400' : 'animate-pulse bg-amber-500'
              )}
            >
              <PhoneCall className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn('text-[10px] font-semibold uppercase tracking-wide', on ? 'text-emerald-700' : current.state === 'line' ? 'text-slate-500' : 'text-amber-700')}>
                {on ? 'On call' : current.state === 'line' ? 'Waiting for the next lead' : 'Ringing…'}
              </p>
              <p className="truncate text-sm font-semibold text-slate-800">{current.name}</p>
            </div>
            {talk && <span className="font-mono text-base font-semibold tabular-nums text-emerald-700">{talk}</span>}
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            {phone.inCall && (
              <Button size="sm" variant={phone.inCall.muted ? 'secondary' : 'outline'} title={phone.inCall.muted ? 'Unmute' : 'Mute'} onClick={toggleMute}>
                {phone.inCall.muted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                {phone.inCall.muted ? 'Unmute' : 'Mute'}
              </Button>
            )}
            {current.leadId && location.pathname !== leadPath(current.leadId) && (
              <Button size="sm" variant="outline" onClick={() => navigate(leadPath(current.leadId!))}>
                <ExternalLink className="h-3.5 w-3.5" /> Lead
              </Button>
            )}
            <Button
              size="sm"
              variant="danger"
              className="ml-auto"
              loading={ending || hangingUp}
              onClick={endCall}
              title={current.state === 'line' ? 'Ends your dialer line' : 'End this call'}
              data-testid="hangup-call"
            >
              <PhoneOff className="h-3.5 w-3.5" /> {current.state === 'line' ? 'Leave' : 'End call'}
            </Button>
          </div>
        </div>
      )}

      {run && (
        <>
          <div className="flex h-1.5 bg-slate-100">
            {run.leads.map((l) => (
              <span
                key={l._id}
                className={cn('h-full flex-1 border-r border-white last:border-r-0', BAR[l.status] ?? (live.includes(l) || l._id === current?.leadId ? 'animate-pulse bg-amber-300' : ''))}
              />
            ))}
          </div>

          <div className="grid grid-cols-4 gap-1 border-b border-slate-100 px-3 py-2.5 text-center">
            {SUMMARY.map((s) => (
              <div key={s.label}>
                <p className={cn('text-lg font-bold tabular-nums', s.tone === 'green' ? 'text-emerald-600' : s.tone === 'red' ? 'text-red-600' : s.tone === 'amber' ? 'text-amber-600' : 'text-slate-600')}>
                  {count(s.status)}
                </p>
                <p className="text-[10px] leading-tight text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>

          {nextAt && (
            <div className="mx-3 mt-3 rounded-lg bg-brand-50 px-3 py-2.5 ring-1 ring-brand-100">
              <p className="text-xs text-brand-800">
                Next call in <b className="font-mono text-base tabular-nums">{secondsLeft}s</b> — save the outcome meanwhile
              </p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={resume}>
                  <PhoneForwarded className="h-3.5 w-3.5" /> Call next now
                </Button>
                <Button size="sm" variant="outline" onClick={pause}>
                  <Pause className="h-3.5 w-3.5" /> Pause
                </Button>
              </div>
            </div>
          )}

          {!run.done && !current && phone.status !== 'ready' && (
            <p className="mx-3 mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
              Your CRM phone is not connected — calls start once it is (Dialer → Reconnect).
            </p>
          )}

          <ul className="mt-3 min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto border-t border-slate-100">
            {run.leads.map((l, i) => {
              const now_ = l._id === current?.leadId
              return (
                <li key={l._id}>
                  <button
                    type="button"
                    className={cn('flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50', now_ && 'bg-amber-50/60')}
                    onClick={() => navigate(leadPath(l._id))}
                  >
                    <span className="w-5 shrink-0 text-right text-[10px] tabular-nums text-slate-400">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-slate-800">{l.name}</span>
                      <span className="block truncate text-[10px] text-slate-500">
                        {l.leadNo}
                        {(l.round ?? 1) > 1 && <span className="font-semibold text-brand-700"> · calling again</span>}
                      </span>
                    </span>
                    {now_ && current ? (
                      <Badge tone={on ? 'green' : 'amber'} dot>
                        {on ? `On call${talk ? ` · ${talk}` : ''}` : 'Ringing'}
                      </Badge>
                    ) : (
                      <Badge tone={TONE[l.status]} dot={l.status === 'calling' || l.status === 'connected'} title={l.outcome ? `Outcome: ${l.outcome}` : undefined}>
                        {l.label}
                        {l.status === 'answered' && l.durationSeconds ? ` · ${formatHms(l.durationSeconds)}` : ''}
                        {l.disposed ? ' ✓' : ''}
                      </Badge>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>

          {!run.done && !nextAt && (
            <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-3 py-2">
              <span className="text-[11px] text-slate-500">{paused ? 'Paused — no new calls' : current ? 'Next lead after this call' : 'Calling the next lead…'}</span>
              {paused ? (
                <Button size="sm" onClick={resume}>
                  <Play className="h-3.5 w-3.5" /> {run.auto === false && control?.at !== run.at ? 'Start' : 'Resume'}
                </Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={pause}>
                  <Pause className="h-3.5 w-3.5" /> Pause
                </Button>
              )}
            </div>
          )}

          <ConfirmDialog
            open={confirmClose}
            onClose={() => setConfirmClose(false)}
            onConfirm={close}
            loading={closing}
            title="Close progressive calling?"
            message={`${remaining} lead${remaining === 1 ? ' is' : 's are'} not called yet. Closing finishes this queue: they will not be called.`}
            confirmLabel="Close queue"
            danger
          />
        </>
      )}
    </aside>
  )
}
