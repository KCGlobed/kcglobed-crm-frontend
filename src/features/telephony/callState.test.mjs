// node --experimental-strip-types --test src/features/telephony/callState.test.mjs  (npm test)
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  deriveCallState,
  hasDialableNumber,
  isFinalStatus,
  isLiveStatus,
  phaseOf,
  pollIntervalFor,
  statusLabel,
  statusTone,
  talkSeconds,
} from './callState.ts'

const call = (over = {}) => ({
  _id: 'c1',
  direction: 'outbound',
  status: 'initiated',
  startedAt: '2026-10-22T10:00:00Z',
  createdAt: '2026-10-22T10:00:00Z',
  ...over,
})

describe('phases', () => {
  test('Smartflo rings the agent first, then the lead, then the call connects', () => {
    assert.equal(phaseOf(call()), 'ringing_agent')
    assert.equal(phaseOf(call({ status: 'ringing' })), 'ringing_customer')
    assert.equal(phaseOf(call({ status: 'in_progress' })), 'connected')
    assert.equal(phaseOf(call({ status: 'answered' })), 'ended')
    assert.equal(phaseOf(call({ status: 'not_answered' })), 'ended')
    assert.equal(phaseOf(call({ status: 'failed' })), 'failed')
  })

  test('an inbound call ringing the user is incoming', () => {
    assert.equal(phaseOf(call({ direction: 'inbound', status: 'ringing' })), 'incoming')
    assert.equal(phaseOf(call({ direction: 'inbound', status: 'in_progress' })), 'connected')
  })

  test('live vs final statuses', () => {
    for (const s of ['initiated', 'ringing', 'in_progress']) assert.ok(isLiveStatus(s) && !isFinalStatus(s), s)
    for (const s of ['answered', 'not_answered', 'busy', 'failed']) assert.ok(isFinalStatus(s) && !isLiveStatus(s), s)
    assert.ok(!isLiveStatus(undefined) && !isFinalStatus(null))
  })
})

describe('deriveCallState', () => {
  test('idle without a feed; dialing while the start request is in flight', () => {
    assert.equal(deriveCallState(undefined).phase, 'idle')
    assert.equal(deriveCallState(undefined, true).phase, 'dialing')
    assert.equal(deriveCallState({ active: [], pending: [] }, true).phase, 'dialing')
  })

  test('the outbound call in progress drives the phase and the timer', () => {
    const live = call({ status: 'in_progress', answeredAt: '2026-10-22T10:00:30Z' })
    const state = deriveCallState({ active: [live], pending: [] }, true)
    assert.equal(state.phase, 'connected')
    assert.equal(state.call, live)
    assert.equal(state.timerFrom, '2026-10-22T10:00:30Z')
    // before it is answered the timer counts from the start
    assert.equal(deriveCallState({ active: [call()], pending: [] }).timerFrom, '2026-10-22T10:00:00Z')
  })

  test('incoming calls are kept apart from the call in progress', () => {
    const ringing = call({ _id: 'in1', direction: 'inbound', status: 'ringing' })
    const alone = deriveCallState({ active: [ringing], pending: [] })
    assert.equal(alone.phase, 'incoming')
    assert.equal(alone.call, null)
    assert.deepEqual(alone.incoming, [ringing])
    const busy = deriveCallState({ active: [ringing, call({ status: 'in_progress' })], pending: [] })
    assert.equal(busy.phase, 'connected')
    assert.deepEqual(busy.incoming, [ringing])
  })

  test('pending outcomes come newest first', () => {
    const older = call({ _id: 'p1', status: 'answered', endedAt: '2026-10-22T09:00:00Z' })
    const newer = call({ _id: 'p2', status: 'not_answered', endedAt: '2026-10-22T09:30:00Z' })
    const state = deriveCallState({ active: [], pending: [older, newer] })
    assert.equal(state.phase, 'idle')
    assert.deepEqual(state.pending.map((c) => c._id), ['p2', 'p1'])
  })
})

describe('polling', () => {
  test('2 s while anything is happening, the server interval with outcomes pending, 15 s idle', () => {
    for (const phase of ['dialing', 'ringing_agent', 'ringing_customer', 'connected', 'incoming']) {
      assert.equal(pollIntervalFor(phase, false, 4), 2000, phase)
    }
    assert.equal(pollIntervalFor('idle', true, 4), 4000)
    assert.equal(pollIntervalFor('ended', true, 6), 6000)
    assert.equal(pollIntervalFor('idle', false, 4), 4000)
    // a silly server value never polls faster than every 2 s
    assert.equal(pollIntervalFor('idle', true, 0), 4000)
    assert.equal(pollIntervalFor('idle', true, 1), 2000)
  })
})

describe('labels and timers', () => {
  test('status text and tone', () => {
    assert.equal(statusLabel('answered'), 'Connected')
    assert.equal(statusLabel('not_answered'), 'Not answered')
    assert.equal(statusLabel('in_progress'), 'On call')
    assert.equal(statusLabel('something_else'), 'something else')
    assert.equal(statusLabel(undefined), '—')
    assert.equal(statusTone('answered'), 'green')
    assert.equal(statusTone('busy'), 'amber')
    assert.equal(statusTone('failed'), 'red')
    assert.equal(statusTone('ringing'), 'blue')
  })

  test('talk time: the saved duration after the call, the live timer while connected, nothing while ringing', () => {
    const now = Date.parse('2026-10-22T10:01:35Z')
    assert.equal(talkSeconds(call({ status: 'answered', durationSeconds: 95 }), now), 95)
    assert.equal(talkSeconds(call({ status: 'in_progress', answeredAt: '2026-10-22T10:00:05Z' }), now), 90)
    assert.equal(talkSeconds(call({ status: 'ringing' }), now), 0)
    assert.equal(talkSeconds(call({ status: 'not_answered', durationSeconds: null }), now), 0)
  })

  test('unknown and masked numbers are left to the server; an empty or short number is refused', () => {
    assert.equal(hasDialableNumber(undefined), true)
    assert.equal(hasDialableNumber('9876543210'), true)
    assert.equal(hasDialableNumber('+91 98765 43210'), true)
    assert.equal(hasDialableNumber('••••••'), true)
    assert.equal(hasDialableNumber('98xxxxxx10'), true)
    assert.equal(hasDialableNumber(null), false)
    assert.equal(hasDialableNumber(''), false)
    assert.equal(hasDialableNumber('12345'), false)
  })
})
