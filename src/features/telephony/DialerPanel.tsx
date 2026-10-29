import { useEffect, useRef, useState } from 'react'
import { Coffee, Copy, ExternalLink, Eye, EyeOff, Headset, Minus, Play, RefreshCw, Square } from 'lucide-react'
import { toast } from 'sonner'
import { useDialerSessionMutation, useLazyMyDialerQuery, useMyDialerQuery } from '../../services/telephonyApi'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/fields'
import { cn, parseApiError } from '../../lib/utils'
import type { DialerRingOn, DialerSession } from '../../types/models'
import { DIALER_START_EVENT, DIALER_TOGGLE_EVENT, toggleDialer } from './events'
import { cancelExpectedCall, expectCall, setAutoAnswerAll, usePhone, type PhoneStatus } from './softphone'
import { useConnectPhone } from './useConnectPhone'
import { useTelephonyEnabled } from './useLiveCalls'

const OPEN_KEY = 'crm.dialer.open'
const SOFTPHONE_URL = 'https://chrome.google.com/webstore/detail/smartflo-softphone/dbhcchccbhpnohpmcallfdfcfnogdfpo'

const STATE: Record<NonNullable<DialerSession['state']> | 'idle', { label: string; tone: 'green' | 'amber' | 'blue' | 'slate'; hint: string }> = {
  idle: { label: 'Not dialling', tone: 'slate', hint: 'Press Start: Smartflo calls you first, pick up and your leads are dialled one after the other.' },
  calling_you: { label: 'Calling you…', tone: 'amber', hint: 'Smartflo is calling your CRM phone — it picks up by itself; dialling starts once it is answered.' },
  ready: { label: 'Dialling your leads', tone: 'green', hint: 'Stay on the line: each lead that answers is put through to you and opens in the CRM.' },
  on_break: { label: 'On break', tone: 'blue', hint: 'No calls while you are on break. Resume to continue.' },
  stopped: { label: 'Stopped', tone: 'slate', hint: 'Dialling is stopped. Start again whenever you are ready.' },
  logged_out: { label: 'Logged out', tone: 'slate', hint: 'Press Start to log in to the dialer again.' },
}

const PHONE: Record<PhoneStatus, { label: string; tone: 'green' | 'amber' | 'slate' | 'red' }> = {
  ready: { label: 'Connected', tone: 'green' },
  connecting: { label: 'Connecting…', tone: 'amber' },
  failed: { label: 'Not connected', tone: 'red' },
  off: { label: 'Off', tone: 'slate' },
}

const RING_ON: { value: DialerRingOn; label: string }[] = [
  { value: 'laptop', label: 'CRM phone on this laptop (headset)' },
  { value: 'both', label: 'CRM phone, else my mobile' },
  { value: 'mobile', label: 'My mobile' },
]

function useDialerEnabled() {
  const { status } = useTelephonyEnabled()
  return !!status?.myDialer?.enabled
}

const copy = (text: string, what: string) =>
  navigator.clipboard
    .writeText(text)
    .then(() => toast.success(`${what} copied`))
    .catch(() => toast.error('Could not copy — select the text and copy it by hand'))

/** The header's Dialer button: shown to counsellors on the auto-dialer. */
export function DialerButton() {
  const enabled = useDialerEnabled()
  if (!enabled) return null
  return (
    <Button variant="ghost" size="sm" onClick={() => toggleDialer()} title="Your auto-dialer: start, break, stop">
      <Headset className="h-4 w-4" />
      <span className="hidden md:inline">Dialer</span>
    </Button>
  )
}

/**
 * The counsellor's auto-dialer, run from the CRM: Start logs them in to their own Smartflo campaign and asks Smartflo
 * to call them (the "session call"); once they pick up, the leads of their list are dialled one after the other and
 * each connected lead opens in the CRM (CallPopover). Break / Resume / Stop work the same way, so nobody needs the
 * Smartflo agent panel. Audio comes on the Smartflo softphone (Chrome extension, logged in once with the login shown
 * here) or on the counsellor's mobile.
 */
export function DialerPanel() {
  const enabled = useDialerEnabled()
  const [open, setOpen] = useState(() => {
    try {
      return sessionStorage.getItem(OPEN_KEY) === '1'
    } catch {
      return false
    }
  })
  const [showPassword, setShowPassword] = useState(false)
  const [breakCode, setBreakCode] = useState('')
  const { data } = useMyDialerQuery(undefined, { skip: !enabled || !open, pollingInterval: open ? 10000 : 0 })
  const [run, { isLoading: busy, originalArgs }] = useDialerSessionMutation()
  const phone = usePhone()
  const { connect, loading: connecting } = useConnectPhone()
  const me = data?.data
  // the CRM phone holds Smartflo's session line: dialling runs even when no "answered" webhook reached the CRM
  const onSessionLine = phone.inCall?.kind === 'session'
  const session = { ...(me?.session ?? {}), ...(onSessionLine && me?.session?.state === 'calling_you' ? { state: 'ready' as const } : {}) }
  const state = STATE[session.state ?? 'idle'] ?? STATE.idle
  const live = session.state === 'calling_you' || session.state === 'ready' || session.state === 'on_break'
  const [loadMe] = useLazyMyDialerQuery()
  const startFromList = useRef<() => void>(() => {})

  useEffect(() => {
    const onToggle = (e: Event) => {
      const wanted = (e as CustomEvent<boolean | undefined>).detail
      setOpen((current) => {
        const next = typeof wanted === 'boolean' ? wanted : !current
        try {
          sessionStorage.setItem(OPEN_KEY, next ? '1' : '0')
        } catch {
          // storage blocked — the drawer just starts closed next time
        }
        return next
      })
    }
    window.addEventListener(DIALER_TOGGLE_EVENT, onToggle)
    return () => window.removeEventListener(DIALER_TOGGLE_EVENT, onToggle)
  }, [])

  const act = async (action: 'start' | 'stop' | 'break' | 'resume' | 'logout' | 'ring-on', extra: { breakCode?: string; ringOn?: DialerRingOn } = {}) => {
    try {
      if (action === 'start') expectCall({ ringback: false }) // the CRM phone picks up Smartflo's session call by itself
      await run({ action, ...extra }).unwrap()
      if (action === 'start') toast.success(phone.status === 'ready' ? 'Connecting your dialer…' : 'Smartflo is calling you — pick up to start dialling')
    } catch (err) {
      if (action === 'start') cancelExpectedCall()
      toast.error(parseApiError(err).message)
    }
  }
  const loading = (action: string) => busy && originalArgs?.action === action

  // "Auto-dial first" on the leads list: the Dialer opens and starts, unless it is already dialling (the new leads are
  // simply the next calls then)
  useEffect(() => {
    startFromList.current = async () => {
      const fresh = await loadMe().unwrap().catch(() => null)
      const current = fresh?.data.session?.state
      if (onSessionLine || current === 'ready' || current === 'on_break') {
        toast.info('Your dialer is already running — these leads are the next calls')
        return
      }
      void act('start')
    }
  })
  useEffect(() => {
    const onStart = () => startFromList.current()
    window.addEventListener(DIALER_START_EVENT, onStart)
    return () => window.removeEventListener(DIALER_START_EVENT, onStart)
  }, [])

  if (!enabled || !open) return null

  return (
    <div
      className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100vh-4rem)] w-[400px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl"
      data-testid="dialer-panel"
    >
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <Headset className="h-4 w-4 text-brand-600" />
        <p className="flex-1 text-sm font-semibold text-slate-800">Auto-dialer</p>
        <Badge tone={state.tone}>{session.state === 'on_break' && session.breakName ? `Break · ${session.breakName}` : state.label}</Badge>
        <Button variant="ghost" size="icon" title="Hide (the dialer keeps running)" onClick={() => toggleDialer(false)}>
          <Minus className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-3 px-3 py-3">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-2 py-1.5 text-xs">
          <span className="font-semibold text-slate-700">CRM phone</span>
          <Badge tone={PHONE[phone.status].tone}>{PHONE[phone.status].label}</Badge>
          <span className="flex-1" />
          {phone.status !== 'ready' && (
            <Button size="sm" variant="outline" loading={connecting} onClick={async () => {
              const error = await connect()
              if (error) toast.error(error)
            }}>
              <RefreshCw className="h-3.5 w-3.5" /> Connect
            </Button>
          )}
        </div>
        {phone.error && phone.status !== 'ready' && <p className="text-[11px] text-red-700">{phone.error}</p>}
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input type="checkbox" checked={phone.autoAnswerAll} onChange={(e) => setAutoAnswerAll(e.target.checked)} />
          Pick up incoming calls by themselves (off: answer each call from the pop-up)
        </label>
        {phone.log.length > 0 && (
          <details className="rounded-lg border border-slate-200 text-[11px]">
            <summary className="cursor-pointer px-2 py-1 font-semibold text-slate-600">Phone log</summary>
            <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap px-2 pb-2 font-mono text-slate-600">{phone.log.join('\n')}</pre>
          </details>
        )}
        <p className="text-xs text-slate-600">{state.hint}</p>
        {session.lastError && <p className="rounded-lg bg-red-50 px-2 py-1.5 text-[11px] text-red-700">{session.lastError}</p>}
        <div className="flex flex-wrap gap-2">
          {!live || session.state === 'calling_you' ? (
            <Button size="sm" loading={loading('start')} disabled={busy} onClick={() => act('start')}>
              <Play className="h-3.5 w-3.5" /> {session.state === 'calling_you' ? 'Call me again' : 'Start dialling'}
            </Button>
          ) : null}
          {session.state === 'on_break' ? (
            <Button size="sm" variant="success" loading={loading('resume')} disabled={busy} onClick={() => act('resume')}>
              <Play className="h-3.5 w-3.5" /> Resume
            </Button>
          ) : (
            live && (
              <div className="flex gap-1">
                <Select className="!h-8 !w-32 text-xs" value={breakCode} onChange={(e) => setBreakCode(e.target.value)} aria-label="Break reason">
                  <option value="">Break…</option>
                  {(me?.breakCodes ?? []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
                <Button size="sm" variant="outline" disabled={!breakCode || busy} loading={loading('break')} onClick={() => act('break', { breakCode })}>
                  <Coffee className="h-3.5 w-3.5" /> Break
                </Button>
              </div>
            )
          )}
          {live && (
            <Button size="sm" variant="outline" loading={loading('stop')} disabled={busy} onClick={() => act('stop')}>
              <Square className="h-3.5 w-3.5" /> Stop
            </Button>
          )}
        </div>

        <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Calls ring on
          <Select
            className="mt-1 !h-8 text-xs font-normal normal-case tracking-normal"
            value={me?.ringOn ?? 'laptop'}
            disabled={busy}
            onChange={(e) => act('ring-on', { ringOn: e.target.value as DialerRingOn })}
          >
            {RING_ON.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {me?.loginId && (
        <div className="space-y-1.5 border-t border-slate-200 bg-slate-50/60 px-3 py-2.5 text-[11px] text-slate-600">
          <p className="font-semibold text-slate-700">Smartflo Softphone extension (optional — the CRM phone above replaces it)</p>
          <p>
            Install the{' '}
            <a href={SOFTPHONE_URL} target="_blank" rel="noreferrer" className="font-medium text-brand-700 underline">
              Smartflo Softphone
            </a>{' '}
            Chrome extension and log in once with:
          </p>
          <div className="flex items-center gap-2">
            <span className="w-16 text-slate-500">Login ID</span>
            <code className="flex-1 truncate font-mono text-slate-800">{me.loginId}</code>
            <button type="button" className="text-slate-400 hover:text-brand-600" onClick={() => copy(me.loginId ?? '', 'Login ID')} title="Copy">
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
          {me.password && (
            <div className="flex items-center gap-2">
              <span className="w-16 text-slate-500">Password</span>
              <code className="flex-1 truncate font-mono text-slate-800">{showPassword ? me.password : '••••••••••'}</code>
              <button type="button" className="text-slate-400 hover:text-brand-600" onClick={() => setShowPassword((s) => !s)} title={showPassword ? 'Hide' : 'Show'}>
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
              <button type="button" className="text-slate-400 hover:text-brand-600" onClick={() => copy(me.password ?? '', 'Password')} title="Copy">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <p className="text-slate-500">
            Campaign <b className="text-slate-700">{me.campaignName}</b>
            {me.didNumber ? ` · calls from ${me.didNumber}` : ''}
          </p>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-slate-500 underline hover:text-brand-700"
            onClick={() => window.open(me.panelUrl, 'kcg-dialer', 'width=420,height=720')}
            title="Smartflo's own agent panel (manual dial, transfers). Logging in there signs the CRM's dialer session out."
          >
            <ExternalLink className="h-3 w-3" /> Advanced: Smartflo agent panel
          </button>
        </div>
      )}
      {live && (
        <div className="border-t border-slate-200 px-3 py-2 text-right">
          <button type="button" className={cn('text-[11px] text-slate-500 underline hover:text-red-600', busy && 'pointer-events-none opacity-50')} onClick={() => act('logout')}>
            Log out of the dialer
          </button>
        </div>
      )}
    </div>
  )
}
