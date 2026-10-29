import { useSyncExternalStore } from 'react'
import { UA, WebSocketInterface } from 'jssip'
import type { RTCSession } from 'jssip/lib/RTCSession'
import type { RTCSessionEvent } from 'jssip/lib/UA'
import type { SoftphoneLogin } from '../../types/models'

/**
 * The CRM's own phone: the counsellor's Smartflo softphone extension registered in this tab (JsSIP over WSS, the
 * same way the Smartflo Softphone Chrome extension does it). Calls Smartflo puts through to the extension ring here:
 * the ones the CRM just asked for (Call button, Dialer Start) are picked up by themselves, the others show Answer.
 */

export type PhoneStatus = 'off' | 'connecting' | 'ready' | 'failed'

export interface PhoneCall {
  id: string
  number: string
  name: string
  since: number | null // answered at
  muted: boolean
  calling: boolean // a call the CRM placed: the lead's phone is still ringing (ringback tone playing)
  kind: 'inbound' | 'outbound' | 'session' // a call to the counsellor | their click-to-call | the dialer's session line
  leadId?: string // the lead a click-to-call was placed for
  startedAt: number
  answeredAt: number | null // the two sides talking (for a click-to-call: the lead picked up)
}

/** A call the phone just finished: reported to the CRM so the outcome drawer opens at once. */
export type EndedCall = PhoneCall & { endedAt: number }

export interface PhoneState {
  status: PhoneStatus
  error: string | null
  ringing: PhoneCall | null
  inCall: PhoneCall | null
  lastEnded: EndedCall | null
  autoAnswerAll: boolean // the counsellor's own choice: pick up incoming calls too (off by default)
  log: string[] // the last few things the phone did, newest first (shown in the Dialer drawer)
}

// a public address for the call audio: without it the browser offers only its LAN address (or an mDNS name), Smartflo
// cannot send the other side's voice back and the counsellor hears nothing while the lead hears them
const PC_CONFIG: RTCConfiguration = { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }] }
// Smartflo rings the counsellor's own leg within seconds of a click-to-call / Dialer Start; anything later is a real
// incoming call and waits for Answer
const EXPECT_MS = 20_000

// a new key: whatever the old switch was set to, everyone starts with incoming calls answered by hand
const AUTO_ANSWER_KEY = 'crm.phone.autoAnswerAll'

function readAutoAnswer() {
  try {
    localStorage.removeItem('crm.phone.autoAnswer')
    return localStorage.getItem(AUTO_ANSWER_KEY) === '1'
  } catch {
    return false
  }
}

let state: PhoneState = { status: 'off', error: null, ringing: null, inCall: null, lastEnded: null, autoAnswerAll: readAutoAnswer(), log: [] }
const listeners = new Set<() => void>()
let ua: UA | null = null
let session: RTCSession | null = null
let expectUntil = 0
let expectRingback = false
let expectLeadId: string | undefined
let audio: HTMLAudioElement | null = null
let ctx: AudioContext | null = null
let tone: { timer: number; until: number } | null = null
let level: number | null = null
let notification: Notification | null = null

function set(patch: Partial<PhoneState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

function note(text: string) {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  console.info('[crm-phone]', text)
  set({ log: [`${time} ${text}`, ...state.log].slice(0, 30) })
}

export function usePhone(): PhoneState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state
  )
}

/** The CRM just placed a call that rings the counsellor first (Call button, Dialer Start): pick it up by itself. */
export function expectCall({ ringback = true, leadId }: { ringback?: boolean; leadId?: string } = {}) {
  expectUntil = Date.now() + EXPECT_MS
  expectLeadId = leadId
  expectRingback = ringback // a click-to-call rings the lead next; the dialer's session line stays quiet until a lead connects
}

export function setAutoAnswerAll(on: boolean) {
  try {
    localStorage.setItem(AUTO_ANSWER_KEY, on ? '1' : '0')
  } catch {
    // storage blocked — only this tab remembers it
  }
  set({ autoAnswerAll: on })
}

/** The click-to-call / Dialer Start did not go through: no leg of ours is coming, the next call rings as usual. */
export function cancelExpectedCall() {
  expectUntil = 0
}

// ------------------------------------------------------------ tones (Web Audio: nothing to download)

function audioContext(): AudioContext | null {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
    return ctx
  } catch {
    return null
  }
}

// browsers keep sound off until the page is clicked once: wake the context on the first click / key
if (typeof window !== 'undefined') {
  const unlock = () => {
    audioContext()
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}

/** One Indian-style "tring-tring": two short bursts of two mixed tones. */
function burst(c: AudioContext, freqs: number[], volume: number) {
  const gain = c.createGain()
  gain.connect(c.destination)
  const t0 = c.currentTime
  gain.gain.setValueAtTime(0, t0)
  for (const [from, to] of [[0, 0.4], [0.6, 1.0]]) {
    gain.gain.setValueAtTime(volume, t0 + from + 0.01)
    gain.gain.setValueAtTime(0, t0 + to)
  }
  for (const f of freqs) {
    const osc = c.createOscillator()
    osc.frequency.value = f
    osc.connect(gain)
    osc.start(t0)
    osc.stop(t0 + 1.05)
  }
}

function playTone(kind: 'ring' | 'ringback') {
  stopTone()
  const c = audioContext()
  if (!c) return
  const play = () => (kind === 'ring' ? burst(c, [800, 850], 0.35) : burst(c, [400, 450], 0.12))
  play()
  tone = { timer: window.setInterval(play, 3000), until: Date.now() + 60_000 }
}

function stopTone() {
  if (tone) window.clearInterval(tone.timer)
  tone = null
  if (level !== null) window.clearInterval(level)
  level = null
}

function startRinging(who: string) {
  playTone('ring')
  try {
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      notification = new Notification('Incoming call', { body: who, tag: 'crm-phone', requireInteraction: true })
      notification.onclick = () => window.focus()
    }
  } catch {
    // notifications unavailable
  }
}

function stopRinging() {
  stopTone()
  notification?.close()
  notification = null
}

/** A call the CRM placed: ringback until the lead's side makes a sound (they answered, or Smartflo plays its own tone). */
function ringbackUntilAnswered(stream: MediaStream) {
  const c = audioContext()
  if (!c || !state.inCall?.calling) return
  playTone('ringback')
  try {
    const analyser = c.createAnalyser()
    analyser.fftSize = 512
    c.createMediaStreamSource(stream).connect(analyser)
    const data = new Uint8Array(analyser.fftSize)
    let loud = 0
    level = window.setInterval(() => {
      analyser.getByteTimeDomainData(data)
      let sum = 0
      for (const v of data) sum += ((v - 128) / 128) ** 2
      loud = Math.sqrt(sum / data.length) > 0.02 ? loud + 1 : 0
      if (loud >= 2 || !tone || Date.now() > tone.until) leadAnswered()
    }, 150)
  } catch {
    window.setTimeout(leadAnswered, 15_000)
  }
}

function leadAnswered() {
  stopTone()
  if (state.inCall?.calling) {
    note('the other side is on the line')
    set({ inCall: { ...state.inCall, calling: false, since: Date.now(), answeredAt: Date.now() } })
  }
}

function playRemote(s: RTCSession) {
  if (!audio) {
    audio = new Audio()
    audio.autoplay = true
  }
  const pc = s.connection
  if (!pc) return
  const attach = (stream: MediaStream) => {
    if (audio!.srcObject === stream) return
    audio!.srcObject = stream
    note(`audio from Smartflo: ${stream.getAudioTracks().length} track(s)`)
    ringbackUntilAnswered(stream)
    void audio!
      .play()
      .then(() => note('playing the call audio'))
      .catch((err) => note(`browser blocked the call audio: ${err instanceof Error ? err.message : err} — click anywhere on the page`))
  }
  pc.addEventListener('iceconnectionstatechange', () => note(`media connection: ${pc.iceConnectionState}`))
  pc.addEventListener('track', (e) => attach(e.streams[0] ?? new MediaStream([e.track])))
  const tracks = pc.getReceivers().map((r) => r.track).filter(Boolean)
  if (tracks.length) attach(new MediaStream(tracks))
}

/** Phone log: is the other side's audio reaching this browser, and over which path. */
async function reportAudio(s: RTCSession) {
  const pc = s.connection
  if (!pc || s.isEnded()) return
  try {
    const stats = await pc.getStats()
    let received = 0
    let sent = 0
    let path = ''
    stats.forEach((r) => {
      if (r.type === 'inbound-rtp' && r.kind === 'audio') received += r.bytesReceived ?? 0
      if (r.type === 'outbound-rtp' && r.kind === 'audio') sent += r.bytesSent ?? 0
      if (r.type === 'candidate-pair' && r.state === 'succeeded' && r.nominated) {
        const local = stats.get(r.localCandidateId)
        const remote = stats.get(r.remoteCandidateId)
        path = `${local?.candidateType ?? '?'} → ${remote?.address ?? '?'}`
      }
    })
    note(`audio in ${Math.round(received / 1024)} KB, out ${Math.round(sent / 1024)} KB${path ? ` (${path})` : ''}`)
    if (!received) note('no audio is arriving from Smartflo — the network is blocking it')
  } catch {
    // stats unavailable
  }
}

function callerOf(s: RTCSession): PhoneCall {
  const id = s.remote_identity
  return { id: s.id, number: id?.uri?.user ?? '', name: id?.display_name ?? '', since: null, muted: false, calling: false,
    kind: 'inbound', startedAt: Date.now(), answeredAt: null }
}

function onSession(e: RTCSessionEvent) {
  if (e.originator !== 'remote') return
  const s = e.session
  if (session) {
    s.terminate({ status_code: 486, reason_phrase: 'Busy Here' }) // one call at a time
    return
  }
  session = s
  let call = callerOf(s)
  const done = () => {
    stopRinging()
    if (session === s) session = null
    set({ ringing: null, inCall: null, lastEnded: { ...(state.inCall ?? call), endedAt: Date.now() } })
  }
  note(`incoming call from ${call.number || 'unknown'}${call.name ? ` (${call.name})` : ''}`)
  s.on('accepted', () => {
    note('call answered')
    stopRinging()
    // inbound: talking from now; a click-to-call: our leg is up, the lead's phone rings next (answeredAt then)
    call = { ...call, since: Date.now(), answeredAt: call.kind === 'inbound' ? Date.now() : null }
    set({ ringing: null, inCall: call })
  })
  // answer as soon as a public (STUN) address is known instead of waiting for every candidate
  s.on('icecandidate', (e) => {
    if (e.candidate.type === 'srflx') e.ready()
  })
  s.on('confirmed', () => {
    note('call connected')
    playRemote(s)
    window.setTimeout(() => void reportAudio(s), 4000)
  })
  s.on('ended', (e) => {
    note(`call ended by ${e.originator} (${e.cause})`)
    done()
  })
  s.on('failed', (e) => {
    note(`call failed: ${e.cause} (${e.originator})`)
    done()
  })
  const placedByCrm = Date.now() < expectUntil
  if (placedByCrm || state.autoAnswerAll) {
    note('picking up by itself')
    expectUntil = 0
    const kind = !placedByCrm ? 'inbound' : expectRingback ? 'outbound' : 'session'
    call = { ...call, calling: kind === 'outbound', kind, leadId: placedByCrm ? expectLeadId : undefined }
    answer() // no Incoming-call modal: the CRM placed this call, the in-call bar shows once it is up
  } else {
    set({ ringing: call })
    startRinging(call.name || call.number || 'Smartflo')
  }
}

export function answer() {
  if (!session || session.isEstablished()) return
  stopRinging()
  try {
    session.answer({ mediaConstraints: { audio: true, video: false }, pcConfig: PC_CONFIG })
  } catch (err) {
    note(`could not answer: ${err instanceof Error ? err.message : err}`)
    set({ error: err instanceof Error ? err.message : 'Could not answer the call' })
  }
}

export function hangup() {
  stopRinging()
  try {
    session?.terminate()
  } catch {
    // already gone
  }
}

export function toggleMute() {
  if (!session || !state.inCall) return
  if (state.inCall.muted) session.unmute({ audio: true })
  else session.mute({ audio: true })
  set({ inCall: { ...state.inCall, muted: !state.inCall.muted } })
}

export async function connectPhone(login: SoftphoneLogin) {
  disconnectPhone()
  set({ status: 'connecting', error: null })
  try {
    // ask for the microphone now, so the first call is not held up by the browser prompt
    const mic = await navigator.mediaDevices.getUserMedia({ audio: true })
    mic.getTracks().forEach((t) => t.stop())
  } catch {
    set({ status: 'failed', error: 'Allow the microphone for this site to talk from the CRM' })
    return
  }
  if ('Notification' in window && Notification.permission === 'default') void Notification.requestPermission().catch(() => {})
  const next = new UA({
    sockets: [new WebSocketInterface(login.socket)],
    uri: `sip:${login.user}@${login.host}`,
    authorization_user: login.user,
    realm: login.host,
    password: login.password,
    display_name: login.displayName || undefined,
    user_agent: 'KCG CRM phone',
    session_timers: false,
    register: true,
  })
  next.on('registered', () => {
    note(`connected as ${login.user}`)
    set({ status: 'ready', error: null })
  })
  next.on('unregistered', () => ua === next && set({ status: 'connecting' }))
  next.on('disconnected', () => ua === next && note('lost the connection to Smartflo, retrying'))
  next.on('disconnected', () => ua === next && set({ status: 'connecting', error: 'Reconnecting to Smartflo…' }))
  next.on('registrationFailed', (e) => note(`login refused: ${e.cause}`))
  next.on('registrationFailed', (e) => set({ status: 'failed', error: `Smartflo refused the phone login (${e.cause ?? 'registration failed'})` }))
  next.on('newRTCSession', onSession)
  ua = next
  next.start()
}

export function disconnectPhone() {
  hangup()
  if (ua) {
    const old = ua
    ua = null
    try {
      old.stop()
    } catch {
      // already stopped
    }
  }
  set({ status: 'off', ringing: null, inCall: null })
}
