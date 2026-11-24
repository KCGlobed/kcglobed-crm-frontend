// node --experimental-strip-types --test src/lib/search.test.mjs  (npm test)
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { highlightParts, normalize, queryWords, searchRank } from './search.ts'

const templates = [
  { id: 'app', name: 'Application received', subject: 'We received your application, {first_name}', body: '<p>Contact support for any opportunity</p>' },
  { id: 'nc', name: 'Not Connected - Ringing / No answer', subject: 'A convenient time to discuss your GCC School enquiry', body: '<div style="color:red">We tried calling you</div>' },
  { id: 'cb', name: 'Interested - Call Back', subject: 'Your callback request has been noted', body: 'Hi' },
  { id: 'ppo', name: 'Promotional Email 1 : 10 LPA PPO + Scholarship', subject: 'What If You Received a ₹10 LPA Offer Before Enrolling?', body: 'x' },
  { id: 'pre', name: 'Pre-Screening Email', subject: 'Invitation for Pre-Screening | AEUAP With US CPA Hiring Drive', body: 'Opportunity awaits' },
]
const fields = (t) => [
  { text: t.name, weight: 10 },
  { text: t.subject, weight: 5 },
  { text: t.body, weight: 1 },
]
const ids = (q) => searchRank(templates, q, fields).map((t) => t.id)

describe('normalize', () => {
  test('lower case, punctuation and HTML gone, accents dropped', () => {
    assert.equal(normalize('Promotional Email 1 : 10 LPA PPO + Scholarship'), 'promotional email 1 10 lpa ppo scholarship')
    assert.equal(normalize('<style>.a{color:red}</style><p class="x">Café&nbsp;₹10</p>'), 'cafe 10')
    assert.deepEqual(queryWords('  PPO  ppo, 10 '), ['ppo', '10'])
  })
})

describe('searchRank', () => {
  test('ppo puts the PPO template first, body-only hits after it', () => {
    const r = ids('ppo')
    assert.equal(r[0], 'ppo')
    assert.ok(r.includes('app')) // "support" / "opportunity" in the body still found, but lower
    assert.ok(r.indexOf('app') > 0)
  })
  test('any part of a word matches, words in any order, case ignored', () => {
    assert.deepEqual(ids('ship'), ['ppo'])
    assert.deepEqual(ids('10 ppo'), ['ppo'])
    assert.deepEqual(ids('PPO 10'), ['ppo'])
    assert.deepEqual(ids('lpa'), ['ppo'])
    assert.equal(ids('ringing')[0], 'nc')
    assert.equal(ids('call back')[0], 'cb')
    assert.equal(ids('prescreen').length, 0) // "pre-screening" is two words, typed as one word does not match
    assert.equal(ids('pre screen')[0], 'pre')
  })
  test('every word must match somewhere', () => {
    assert.deepEqual(ids('ppo xyz'), [])
  })
  test('HTML tags and inline CSS never match', () => {
    assert.deepEqual(ids('color'), [])
    assert.deepEqual(ids('div'), [])
    assert.deepEqual(ids('style'), [])
  })
  test('a name hit beats a subject hit; empty query keeps everything in order', () => {
    // "received": name of "app", subject of "ppo"
    assert.deepEqual(ids('received'), ['app', 'ppo'])
    assert.deepEqual(ids('  '), templates.map((t) => t.id))
  })
})

describe('highlightParts', () => {
  test('marks every typed word, merges overlaps, keeps the original text', () => {
    assert.deepEqual(highlightParts('10 LPA PPO + Scholarship', 'ppo ship'), [
      { text: '10 LPA ', hit: false },
      { text: 'PPO', hit: true },
      { text: ' + Scholar', hit: false },
      { text: 'ship', hit: true },
    ])
    assert.deepEqual(highlightParts('Scholarship', 'schol hola'), [
      { text: 'Schola', hit: true },
      { text: 'rship', hit: false },
    ])
    assert.deepEqual(highlightParts('Abc', ''), [{ text: 'Abc', hit: false }])
    assert.deepEqual(highlightParts('Abc', 'zz'), [{ text: 'Abc', hit: false }])
  })
})
