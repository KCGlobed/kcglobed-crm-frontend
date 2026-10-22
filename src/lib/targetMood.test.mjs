// node --experimental-strip-types --test src/lib/targetMood.test.mjs  (npm test)
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { targetMood } from './targetMood.ts'

const DAY = 24 * 60 * 60 * 1000
const start = Date.UTC(2026, 9, 1)
// a 10-day target of 10 leads
const target = (achieved, status = 'active') => ({
  targetCount: 10,
  achieved,
  percent: achieved * 10,
  startAt: new Date(start).toISOString(),
  endAt: new Date(start + 10 * DAY).toISOString(),
  status,
})

describe('targetMood', () => {
  test('compares progress with the share of the range gone by', () => {
    assert.equal(targetMood(target(5), start + 5 * DAY).label, 'On track') // 50% at half time
    assert.equal(targetMood(target(8), start + 5 * DAY).label, 'Ahead')
    assert.equal(targetMood(target(3), start + 5 * DAY).label, 'Slightly behind')
    assert.equal(targetMood(target(1), start + 5 * DAY).label, 'Behind')
  })

  test('the last day short of 75% is a hurry; completion and an unstarted range have their own mood', () => {
    assert.equal(targetMood(target(5), start + 9.5 * DAY).label, 'Hurry up')
    assert.equal(targetMood(target(10, 'completed'), start + 6 * DAY).emoji, '🤩')
    assert.equal(targetMood(target(0), start - DAY).label, 'Starts soon')
  })

  test('the pace line spreads what remains over the days left', () => {
    const mood = targetMood(target(4), start + 7 * DAY) // 6 left, 3 days to go
    assert.equal(mood.pace, 'need 2/day')
    assert.equal(mood.timeLeft, '3 days left')
    assert.equal(targetMood(target(7), start + 9.8 * DAY).pace, '3 more today')
  })
})
