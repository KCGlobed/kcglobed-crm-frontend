import { test } from 'node:test'
import assert from 'node:assert/strict'
import { afterLoginPath } from './afterLogin.ts'

test('the page a session ended on is reopened for the same person only', () => {
  // the same user signing back in (session expired) returns to the lead / tab they were on
  assert.equal(afterLoginPath('/app/leads/abc', 'u1', 'u1'), '/app/leads/abc')
  // someone else on this computer goes to their own home instead of the previous user's page
  assert.equal(afterLoginPath('/app/admin/users', 'superadmin', 'counsellor'), '/app')
  assert.equal(afterLoginPath('/app/leads/abc', 'superadmin', 'counsellor'), '/app')
  // nobody signed in on this browser before: a deep link (bookmark, email link) is honoured
  assert.equal(afterLoginPath('/app/leads/abc', null, 'u1'), '/app/leads/abc')
  // no page to return to
  assert.equal(afterLoginPath(undefined, 'u1', 'u1'), '/app')
  assert.equal(afterLoginPath('/login', null, 'u1'), '/app')
})
