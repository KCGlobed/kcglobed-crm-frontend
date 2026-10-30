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
  ringing: PhoneCall | null // the first of `incoming`
  incoming: PhoneCall[] // every call ringing this phone now, oldest first (shown stacked, bottom right)
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

let state: PhoneState = {
  status: 'off', error: null, ringing: null, incoming: [], inCall: null, lastEnded: null, autoAnswerAll: readAutoAnswer(), log: [],
}
const listeners = new Set<() => void>()
let ua: UA | null = null
let session: RTCSession | null = null // the call being answered or talked on
const ringingSessions = new Map<string, RTCSession>() // calls still ringing, waiting for Answer / Decline
const answeredLead = new Map<string, string>() // a ringing call answered from its card → the lead the card showed
// the microphone, opened while a call rings (or the CRM places one) so Answer does not wait for it
let mic: Promise<MediaStream | null> | null = null
let micStream: MediaStream | null = null
let micRelease: number | null = null
// a public address usually comes within ~200 ms; past this the answer goes with what the browser has
const ICE_WAIT_MS = 800
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
  warmMic()
  releaseMicLater(EXPECT_MS + 1000)
}

/** Opens the microphone ahead of the answer (no prompt: the permission was given when the phone connected). */
function warmMic() {
  if (micRelease !== null) window.clearTimeout(micRelease)
  micRelease = null
  if (mic) return
  mic = navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => (micStream = stream))
    .catch(() => null)
}

function releaseMic() {
  if (micRelease !== null) window.clearTimeout(micRelease)
  micRelease = null
  micStream?.getTracks().forEach((t) => t.stop())
  micStream = null
  mic = null
}

/** The microphone closes once nothing rings and no call is on (it never stays open unused). */
function releaseMicLater(ms: number) {
  if (micRelease !== null) window.clearTimeout(micRelease)
  micRelease = window.setTimeout(() => {
    micRelease = null
    if (!session && !ringingSessions.size) releaseMic()
  }, ms)
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

/** One marimba note: a soft mallet hit (the base tone plus the bar's bright overtones, each dying away fast). */
function marimbaNote(c: AudioContext, freq: number, at: number, volume: number) {
  for (const [mult, share, decay] of [[1, 1, 1.1], [4, 0.22, 0.28], [9.2, 0.05, 0.09]]) {
    const osc = c.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq * mult
    const gain = c.createGain()
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(volume * share, at + 0.006)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + decay)
    osc.connect(gain).connect(c.destination)
    osc.start(at)
    osc.stop(at + decay + 0.05)
  }
}

// the incoming-call ring: an iPhone-style marimba phrase (our own tune), [seconds from the start, Hz]
const RING_PHRASE: [number, number][] = [
  [0, 659.25], [0.14, 987.77], [0.28, 830.61], [0.42, 1318.51], [0.56, 987.77], [0.7, 830.61],
  [0.98, 739.99], [1.12, 1108.73], [1.26, 987.77], [1.4, 1479.98], [1.54, 1108.73], [1.68, 987.77],
]
const RING_EVERY_MS = 2600

function marimbaRing(c: AudioContext, volume: number) {
  const t0 = c.currentTime + 0.02
  for (const [at, freq] of RING_PHRASE) marimbaNote(c, freq, t0 + at, volume)
}

/** One Indian-style "tring-tring": two short bursts of two mixed tones (the ringback while the lead's phone rings). */
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
  const play = () => (kind === 'ring' ? marimbaRing(c, 0.3) : burst(c, [400, 450], 0.12))
  play()
  tone = { timer: window.setInterval(play, kind === 'ring' ? RING_EVERY_MS : 3000), until: Date.now() + 60_000 }
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

/** A ringing tone (one or two close frequencies, e.g. 400 + 450 Hz) keeps nearly all its sound near its loudest
 * frequency; a voice spreads it over many harmonics. */
function isRingingTone(spectrum: Float32Array, hz: number): boolean {
  const from = Math.floor(300 / hz)
  const to = Math.min(Math.ceil(3400 / hz), spectrum.length - 1)
  let all = 0
  let peak = from
  for (let i = from; i <= to; i++) {
    all += 10 ** (spectrum[i] / 10)
    if (spectrum[i] > spectrum[peak]) peak = i
  }
  let near = 0
  for (let i = Math.max(from, peak - Math.round(130 / hz)); i <= Math.min(to, peak + Math.round(130 / hz)); i++) near += 10 ** (spectrum[i] / 10)
  return all <= 0 || near / all > 0.7
}

const ANSWER_FALLBACK_MS = 60_000

/**
 * A call the CRM placed: "Ringing" until the lead's side speaks. Smartflo already plays the lead's ringing (or their
 * caller tune) down this line — seen live: any sound at all counted the call as picked up 3–5 s after the click —
 * so no ringback of our own, and only a voice counts as the pick-up. This drives only the live timer and opening the
 * lead: whether the lead picked up, and the talk time, come from Smartflo's call record.
 */
function ringbackUntilAnswered(stream: MediaStream) {
  const c = audioContext()
  if (!c || !state.inCall?.calling) return
  const callId = state.inCall.id
  const until = Date.now() + ANSWER_FALLBACK_MS
  try {
    const analyser = c.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0.2
    c.createMediaStreamSource(stream).connect(analyser)
    const wave = new Uint8Array(analyser.fftSize)
    const spectrum = new Float32Array(analyser.frequencyBinCount)
    const hz = c.sampleRate / analyser.fftSize
    const recent: boolean[] = [] // the last 1.5 s: was it a voice?
    if (level !== null) window.clearInterval(level)
    level = window.setInterval(() => {
      if (state.inCall?.id !== callId || !state.inCall.calling) {
        window.clearInterval(level!)
        level = null
        return
      }
      analyser.getByteTimeDomainData(wave)
      let sum = 0
      for (const v of wave) sum += ((v - 128) / 128) ** 2
      let voice = false
      if (Math.sqrt(sum / wave.length) > 0.02) {
        analyser.getFloatFrequencyData(spectrum)
        voice = !isRingingTone(spectrum, hz)
      }
      recent.push(voice)
      if (recent.length > 10) recent.shift()
      if (recent.filter(Boolean).length >= 4 || Date.now() > until) leadAnswered()
    }, 150)
  } catch {
    window.setTimeout(() => state.inCall?.id === callId && leadAnswered(), 15_000)
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

function setIncoming(incoming: PhoneCall[]) {
  set({ incoming, ringing: incoming[0] ?? null })
}

function onSession(e: RTCSessionEvent) {
  if (e.originator !== 'remote') return
  const s = e.session
  if (session?.isEnded()) session = null // a call whose end event never came
  if (session) {
    // one call at a time: busy, so Smartflo hands it to the next counsellor instead of ringing here
    s.terminate({ status_code: 486, reason_phrase: 'Busy Here' })
    return
  }
  let call = callerOf(s)
  const done = () => {
    if (ringingSessions.delete(s.id)) {
      // a call that rang here and was never answered (the caller hung up, or Decline)
      const rest = state.incoming.filter((c) => c.id !== s.id)
      if (!rest.length) stopRinging()
      setIncoming(rest)
    }
    if (session === s) {
      session = null
      set({ inCall: null, lastEnded: { ...(state.inCall ?? call), endedAt: Date.now() } })
    }
    if (!session && !ringingSessions.size) releaseMicLater(0)
  }
  note(`incoming call from ${call.number || 'unknown'}${call.name ? ` (${call.name})` : ''}`)
  s.on('accepted', () => {
    note('call answered')
    stopRinging()
    // inbound: talking from now; a click-to-call: our leg is up, the lead's phone rings next (answeredAt then)
    call = {
      ...call,
      since: Date.now(),
      answeredAt: call.kind === 'inbound' ? Date.now() : null,
      leadId: call.leadId ?? answeredLead.get(s.id),
    }
    answeredLead.delete(s.id)
    set({ inCall: call })
  })
  // answer as soon as a public (STUN) address is known instead of waiting for every candidate — and never wait
  // longer than ICE_WAIT_MS for it
  let iceSent = false
  let iceTimer: number | null = null
  s.on('icecandidate', (e) => {
    const go = () => {
      if (iceTimer !== null) window.clearTimeout(iceTimer)
      if (iceSent) return
      iceSent = true
      e.ready()
    }
    if (e.candidate.type === 'srflx') go()
    else if (iceTimer === null && !iceSent) iceTimer = window.setTimeout(go, ICE_WAIT_MS)
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
    pickUp(s, call) // no incoming card: the CRM placed this call, the calling dock shows it at once
  } else {
    ringingSessions.set(s.id, s)
    setIncoming([...state.incoming, call])
    warmMic()
    if (state.incoming.length === 1) startRinging(call.name || call.number || 'Smartflo')
  }
}

function pickUp(s: RTCSession, call?: PhoneCall) {
  stopRinging()
  session = s
  ringingSessions.delete(s.id)
  // the calling dock shows the call from the click on (talking from when the line is up — 'accepted')
  if (call) set({ inCall: { ...call, leadId: call.leadId ?? answeredLead.get(s.id) } })
  // one call at a time: the others still ringing go busy, so Smartflo hands them to the next counsellor
  const others = [...ringingSessions.values()]
  ringingSessions.clear()
  setIncoming([])
  for (const other of others) {
    try {
      other.terminate({ status_code: 486, reason_phrase: 'Busy Here' })
    } catch {
      // already gone
    }
  }
  try {
    // the microphone opened while it rang: no wait for it now (else the browser opens it, a little slower)
    s.answer(micStream?.active ? { mediaStream: micStream, pcConfig: PC_CONFIG } : { mediaConstraints: { audio: true, video: false }, pcConfig: PC_CONFIG })
  } catch (err) {
    note(`could not answer: ${err instanceof Error ? err.message : err}`)
    set({ error: err instanceof Error ? err.message : 'Could not answer the call' })
    if (session === s) session = null // never left "busy" by a call that did not come up
    try {
      s.terminate()
    } catch {
      // already gone
    }
  }
}

/** Answer a ringing call (the oldest when none is named); `leadId`: the lead its card showed, opened on pick-up. */
export function answer(id?: string, leadId?: string) {
  const target = id ?? state.incoming[0]?.id
  const s = target ? ringingSessions.get(target) : undefined
  if (!s || session) return
  if (leadId) answeredLead.set(s.id, leadId)
  pickUp(s, state.incoming.find((c) => c.id === s.id))
}

/** Decline one ringing call; the others keep ringing. */
export function decline(id: string) {
  try {
    ringingSessions.get(id)?.terminate({ status_code: 486, reason_phrase: 'Busy Here' })
  } catch {
    // already gone
  }
}

/** End the call on now. */
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
  for (const s of ringingSessions.values()) {
    try {
      s.terminate()
    } catch {
      // already gone
    }
  }
  ringingSessions.clear()
  releaseMic()
  if (ua) {
    const old = ua
    ua = null
    try {
      old.stop()
    } catch {
      // already stopped
    }
  }
  set({ status: 'off', ringing: null, incoming: [], inCall: null })
}
