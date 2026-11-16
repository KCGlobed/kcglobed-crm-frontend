// node --experimental-strip-types --test src/pages/admin/messaging/notifications.test.mjs  (npm test)
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  capabilitiesOf, dayRange, describeTest, errorChannel, fill, filterAlerts, groupRows, kindOf, needsDlt, refusalMessage,
  rowToBody, splitByKind,
} from './notifications.ts'

const row = (over = {}) => ({
  _id: 'id1', trigger: 'lead_reassigned', label: 'Lead reassigned away', notificationType: 'lead_reassigned', isActive: true,
  offsetMinutes: 120, earlyOffsetMinutes: null, emailEnabled: true, smsEnabled: false, pushEnabled: false,
  emailSubject: 'Lead reassigned away from you', emailBody: 'Hi', smsBody: '', smsSenderId: null, smsDltTemplateId: null,
  smsDltType: 'implicit', pushTitle: 'Lead reassigned away from you', pushBody: 'x', ctaLabel: 'Open in CRM', when: 'Immediately',
  notifyOwner: true, recipientRoles: [], recipientUsers: [], recipientsText: 'Previous counsellor', updatedBy: null, updatedAt: '', createdAt: '',
  ...over,
})

describe('which editor tab a refusal belongs to', () => {
  test('the first channel field names the tab, in email / sms / push order', () => {
    assert.equal(errorChannel({ smsSenderId: 'needed' }), 'sms')
    assert.equal(errorChannel({ smsBody: 'x', emailSubject: 'y' }), 'email')
    assert.equal(errorChannel({ pushTitle: 'x' }), 'push')
    assert.equal(errorChannel({ recipients: 'x' }), null)
    assert.equal(errorChannel({}), null)
  })
  test('the DLT panel opens for its fields only', () => {
    assert.equal(needsDlt({ smsDltTemplateId: 'x' }), true)
    assert.equal(needsDlt({ smsSenderId: 'x' }), true)
    assert.equal(needsDlt({ smsBody: 'x' }), false)
  })
  test('the toast names what to add', () => {
    assert.match(refusalMessage('sms', 'nope'), /SMS text and DLT details/)
    assert.match(refusalMessage('email', 'nope'), /subject and message/)
    assert.match(refusalMessage('push', 'nope'), /push title/)
    assert.equal(refusalMessage(null, 'nope'), 'nope')
  })
})

describe('what a row allows', () => {
  test('without capabilities a built-in keeps everything but delete and conditions', () => {
    assert.deepEqual(capabilitiesOf(row()), { toggle: true, push: true, email: true, sms: true, owner: true, recipients: true, conditions: false, delete: false, test: true })
  })
  test('without capabilities an added alert may be deleted once saved', () => {
    assert.equal(capabilitiesOf(row({ trigger: null })).delete, true)
    assert.equal(capabilitiesOf(row({ trigger: null }), true).delete, false)
  })
  test('the server capabilities win, except delete on a new row', () => {
    const caps = { toggle: false, push: false, email: true, sms: false, owner: true, recipients: false, conditions: false, delete: true, test: true }
    assert.deepEqual(capabilitiesOf(row({ capabilities: caps })), caps)
    assert.equal(capabilitiesOf(row({ capabilities: caps }), true).delete, false)
  })
  test('the kind falls back on the trigger', () => {
    assert.equal(kindOf(row({ kind: 'account' })), 'account')
    assert.equal(kindOf(row()), 'builtin')
    assert.equal(kindOf(row({ trigger: null })), 'custom')
    const { staff, account } = splitByKind([row(), row({ kind: 'account', trigger: 'account_credentials' }), row({ trigger: null })])
    assert.equal(staff.length, 2)
    assert.equal(account.length, 1)
  })
})

describe('grouping and filtering', () => {
  const groups = [{ key: 'assignment', label: 'Lead assignment' }, { key: 'calls', label: 'Calls' }, { key: 'system', label: 'System' }]
  const rows = [
    row({ _id: 'a', group: 'assignment', groupLabel: 'Lead assignment' }),
    row({ _id: 'b', trigger: 'missed_call', group: 'calls', groupLabel: 'Calls', label: 'Missed call', isActive: false, pushTitle: 'Missed call: {{Caller}}' }),
    row({ _id: 'c', trigger: 'oddity', group: 'weird', groupLabel: 'Weird', label: 'Odd' }),
    row({ _id: 'd', trigger: 'other', label: 'No group' }),
  ]
  test('groups keep the server order, unknown groups follow, empty groups vanish', () => {
    const grouped = groupRows(rows, groups)
    assert.deepEqual(grouped.map((g) => [g.key, g.label, g.rows.length]), [['assignment', 'Lead assignment', 1], ['calls', 'Calls', 1], ['weird', 'Weird', 1], ['other', 'Other alerts', 1]])
    assert.deepEqual(groupRows(rows).map((g) => g.key), ['assignment', 'calls', 'weird', 'other'])
  })
  test('search matches the label, the description, the recipients and the subject; status filters on/off', () => {
    assert.deepEqual(filterAlerts(rows, 'missed', 'all').map((r) => r._id), ['b'])
    assert.deepEqual(filterAlerts(rows, 'previous counsellor', 'all').length, 4)
    assert.deepEqual(filterAlerts(rows, 'REASSIGNED AWAY FROM', 'all').length, 4)
    assert.deepEqual(filterAlerts(rows, '', 'off').map((r) => r._id), ['b'])
    assert.deepEqual(filterAlerts(rows, 'odd', 'on').map((r) => r._id), ['c'])
  })
})

describe('bodies and small helpers', () => {
  test('a built-in row becomes a body without name / event / conditions; an added one carries them', () => {
    const body = rowToBody(row())
    assert.equal(body.pushTitle, 'Lead reassigned away from you')
    assert.equal('name' in body, false)
    const custom = rowToBody(row({ trigger: null, name: 'Fees paid', event: 'stage_changed', conditions: [{ field: 'stage', op: 'is', value: 's1' }] }))
    assert.deepEqual([custom.name, custom.event, custom.conditions?.length], ['Fees paid', 'stage_changed', 1])
  })
  test('the test-send summary and the preview fill', () => {
    assert.equal(describeTest({ push: 0 }), 'push: no device registered for you')
    assert.equal(describeTest({ push: 2, email: 'sent' }), 'push to 2 devices · email sent')
    assert.equal(describeTest({}), 'in the bell only')
    assert.equal(fill('Hi {{Name}}, {{ Nope }} ok', { Name: 'Asha' }), 'Hi Asha, ok')
    assert.equal(dayRange([0, 1, 2, 3, 4, 5]), 'Mon–Sat')
    assert.equal(dayRange([0, 2]), 'Mon, Wed')
  })
})
