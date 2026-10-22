// node --experimental-strip-types --test src/pages/admin/messaging/automationText.test.mjs  (npm test)
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { audienceText, ruleSentence, shortEventLabel, suggestName, waitText, whenText } from './automationText.ts'

// local wall-clock times, so the expected "10:30" holds in any time zone
const at = (y, m, d, h, min) => new Date(y, m - 1, d, h, min).toISOString()
const FIELDS = [
  { key: 'stage', label: 'Stage', type: 'fk', group: 'Lead', ops: ['is'], options: [{ value: 's1', label: 'Interested' }] },
  { key: 'city', label: 'City', type: 'text', group: 'Lead', ops: ['contains'] },
]

describe('labels and waits', () => {
  test('event labels lose their explanations', () => {
    assert.equal(shortEventLabel('New lead created (Meta, Quick Add)'), 'New lead created')
    assert.equal(shortEventLabel('Lead assigned / reassigned — counsellor name and number'), 'Lead assigned / reassigned')
    assert.equal(shortEventLabel('Stage → Interested — program details'), 'Stage → Interested')
  })

  test('waits read in the largest whole unit', () => {
    assert.equal(waitText(0), '')
    assert.equal(waitText(1), '1 minute')
    assert.equal(waitText(90), '90 minutes')
    assert.equal(waitText(60), '1 hour')
    assert.equal(waitText(2880), '2 days')
  })
})

describe('whenText', () => {
  test('events: straight away or after a wait', () => {
    assert.equal(whenText({ triggerType: 'event', eventLabel: 'New lead created (Meta, Quick Add)' }), 'As soon as “New lead created”')
    assert.equal(whenText({ triggerType: 'event', eventLabel: 'New lead created (Meta, Quick Add)', delayMinutes: 60 }), '1 hour after “New lead created”')
    assert.equal(whenText({ triggerType: 'event' }), 'As soon as “…”')
  })

  test('schedules: once, daily, weekly, monthly, with an end date', () => {
    assert.equal(whenText({ triggerType: 'schedule', recurrence: 'once', runAt: at(2026, 10, 23, 10, 30) }), 'On 23 Oct 2026 at 10:30')
    assert.equal(whenText({ triggerType: 'schedule', recurrence: 'daily', runAt: at(2026, 10, 23, 9, 5) }), 'Every day at 09:05')
    assert.equal(
      whenText({ triggerType: 'schedule', recurrence: 'weekly', weekdays: [4, 0, 2], runAt: at(2026, 10, 23, 10, 30), endAt: at(2026, 11, 30, 23, 59) }),
      'Every Mon, Wed and Fri at 10:30 until 30 Nov 2026',
    )
    assert.equal(whenText({ triggerType: 'schedule', recurrence: 'monthly', runAt: at(2026, 10, 5, 11, 0) }), 'On day 5 of every month at 11:00')
    assert.equal(whenText({ triggerType: 'schedule', recurrence: 'once', runAt: at(2026, 10, 23, 10, 30), endAt: at(2026, 11, 30, 23, 59) }), 'On 23 Oct 2026 at 10:30')
  })
})

describe('the whole rule', () => {
  test('audience: every lead, one condition, more conditions', () => {
    assert.equal(audienceText([], FIELDS), 'every lead')
    assert.equal(audienceText([{ field: 'stage', op: 'is', value: 's1' }], FIELDS), 'leads where Stage is Interested')
    assert.equal(
      audienceText([{ field: 'stage', op: 'is', value: 's1' }, { field: 'city', op: 'contains', value: 'Pune' }], FIELDS),
      'leads where Stage is Interested and 1 more condition',
    )
  })

  test('one sentence, with … for what is not chosen yet', () => {
    assert.equal(
      ruleSentence({ triggerType: 'event', eventLabel: 'New lead created (Meta, Quick Add)', delayMinutes: 60, channel: 'whatsapp', templateName: 'Welcome' }, FIELDS),
      '1 hour after “New lead created”, send WhatsApp “Welcome” to every lead',
    )
    assert.equal(ruleSentence({ triggerType: 'event' }), 'As soon as “…”, send a message “…” to every lead')
  })

  test('a suggested name from the choices', () => {
    assert.equal(
      suggestName({ triggerType: 'event', eventLabel: 'New lead created (Meta, Quick Add)', channel: 'sms', templateName: 'Welcome SMS' }),
      'SMS · Welcome SMS · New lead created',
    )
    assert.equal(
      suggestName({ triggerType: 'schedule', recurrence: 'weekly', weekdays: [0], runAt: at(2026, 10, 26, 10, 0), endAt: at(2026, 12, 1, 0, 0), channel: 'email', templateName: 'Reminder' }),
      'Email · Reminder · Every Mon at 10:00',
    )
  })
})
