/**
 * Pure call-state helpers for the dialer (no React, no API): what phase a call is in, what the
 * popover should show, and how often to poll. Tested in callState.test.mjs.
 */

/** The shape every helper needs; LiveCall / CallLog satisfy it. */
export interface CallLike {
  _id: string
  direction: 'outbound' | 'inbound'
  status: string
  startedAt?: string | null
  answeredAt?: string | null
  endedAt?: string | null
  durationSeconds?: number | null
  needsDisposition?: boolean
  createdAt?: string
}

export interface LiveFeed<T extends CallLike = CallLike> {
  active: T[]
  pending: T[]
}

export type CallPhase = 'idle' | 'dialing' | 'ringing_agent' | 'ringing_customer' | 'connected' | 'incoming' | 'ended' | 'failed'

export const LIVE_STATUSES = ['initiated', 'ringing', 'in_progress'] as const
export const FINAL_STATUSES = ['answered', 'not_answered', 'busy', 'failed'] as const

export const isLiveStatus = (status?: string | null) => (LIVE_STATUSES as readonly string[]).includes(status ?? '')
export const isFinalStatus = (status?: string | null) => (FINAL_STATUSES as readonly string[]).includes(status ?? '')

/** The phase one call is in. Smartflo rings the agent first (initiated), then the lead (ringing). */
export function phaseOf(call: Pick<CallLike, 'direction' | 'status'>): CallPhase {
  switch (call.status) {
    case 'initiated':
      return call.direction === 'inbound' ? 'incoming' : 'ringing_agent'
    case 'ringing':
      return call.direction === 'inbound' ? 'incoming' : 'ringing_customer'
    case 'in_progress':
      return 'connected'
    case 'answered':
    case 'not_answered':
    case 'busy':
      return 'ended'
    case 'failed':
      return 'failed'
    default:
      return isLiveStatus(call.status) ? 'connected' : 'ended'
  }
}

export const PHASE_LABELS: Record<CallPhase, string> = {
  idle: '',
  dialing: 'Placing the call…',
  ringing_agent: 'Calling your phone…',
  ringing_customer: 'Ringing the lead…',
  connected: 'Connected',
  incoming: 'Incoming call',
  ended: 'Call ended',
  failed: 'Call failed',
}

/** Short status text for a call row (Recent Calls, timeline, call log). */
export function statusLabel(status?: string | null): string {
  switch (status) {
    case 'initiated':
      return 'Dialing'
    case 'ringing':
      return 'Ringing'
    case 'in_progress':
      return 'On call'
    case 'answered':
      return 'Connected'
    case 'not_answered':
      return 'Not answered'
    case 'busy':
      return 'Busy'
    case 'failed':
      return 'Failed'
    default:
      return status ? status.replace(/_/g, ' ') : '—'
  }
}

export type StatusTone = 'green' | 'red' | 'amber' | 'blue' | 'slate' | 'cyan'

export function statusTone(status?: string | null): StatusTone {
  switch (status) {
    case 'answered':
      return 'green'
    case 'in_progress':
      return 'cyan'
    case 'initiated':
    case 'ringing':
      return 'blue'
    case 'busy':
      return 'amber'
    case 'not_answered':
    case 'failed':
      return 'red'
    default:
      return 'slate'
  }
}

export interface CallState<T extends CallLike = CallLike> {
  phase: CallPhase
  /** the outbound (or answered inbound) call in progress, if any */
  call: T | null
  /** inbound calls still ringing this user */
  incoming: T[]
  /** ended calls awaiting their outcome, newest first */
  pending: T[]
  /** ISO time the on-screen timer counts from: answered → talk time, otherwise since the call started */
  timerFrom: string | null
}

const byNewest = <T extends CallLike>(a: T, b: T) =>
  Date.parse(b.endedAt ?? b.createdAt ?? '') - Date.parse(a.endedAt ?? a.createdAt ?? '')

/**
 * What the popover shows from the live feed. `localDialing` is true while POST /telephony/calls is
 * in flight, so the card appears before the first poll answers.
 */
export function deriveCallState<T extends CallLike>(feed: LiveFeed<T> | undefined, localDialing = false): CallState<T> {
  const active = feed?.active ?? []
  const incoming = active.filter((c) => c.direction === 'inbound' && (c.status === 'ringing' || c.status === 'initiated'))
  const live = active.filter((c) => !incoming.includes(c) && isLiveStatus(c.status))
  const call = live[0] ?? null
  const pending = [...(feed?.pending ?? [])].sort(byNewest)
  if (call) {
    return { phase: phaseOf(call), call, incoming, pending, timerFrom: call.answeredAt ?? call.startedAt ?? call.createdAt ?? null }
  }
  if (localDialing) return { phase: 'dialing', call: null, incoming, pending, timerFrom: null }
  if (incoming.length) return { phase: 'incoming', call: null, incoming, pending, timerFrom: null }
  return { phase: 'idle', call: null, incoming, pending, timerFrom: null }
}

/** Polling interval (ms): quick while something is happening, relaxed when idle. `baseSeconds` comes from the server. */
export function pollIntervalFor(phase: CallPhase, hasPending: boolean, baseSeconds = 4): number {
  const base = Math.max(2, baseSeconds || 4)
  if (phase === 'dialing' || phase === 'ringing_agent' || phase === 'ringing_customer' || phase === 'connected' || phase === 'incoming') {
    return 2000
  }
  if (hasPending) return base * 1000
  // idle: still every few seconds — an incoming call rings for ~30 s and the server may learn of it by polling the dialer
  return Math.max(base, 4) * 1000
}

/** Seconds of talk time to show for a call: the saved duration once it ended, else the live timer. */
export function talkSeconds(call: Pick<CallLike, 'status' | 'answeredAt' | 'durationSeconds'>, now: number): number {
  if (isFinalStatus(call.status)) return call.durationSeconds ?? 0
  if (call.status === 'in_progress' && call.answeredAt) return Math.max(0, Math.floor((now - Date.parse(call.answeredAt)) / 1000))
  return 0
}

/**
 * True when the row carries a usable number, or when the caller cannot tell: `undefined` (the row has no
 * number field) and a masked value (field rules hide digits from this user, e.g. "••••••" or "98xxxx10")
 * both leave the check to the server, which dials the real number. Only a known-empty or short number
 * is refused here.
 */
export const hasDialableNumber = (mobile?: string | null) => {
  if (mobile === undefined) return true
  const value = mobile ?? ''
  if (/[•*xX]/.test(value)) return value.replace(/[^\d•*xX]/g, '').length >= 6
  return value.replace(/\D/g, '').length >= 10
}
