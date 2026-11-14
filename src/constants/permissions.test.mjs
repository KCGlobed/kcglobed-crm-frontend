import { test } from 'node:test'
import assert from 'node:assert/strict'
import { can, moduleLabel } from './permissions.ts'

const user = (...permissions) => ({ isSuperAdmin: false, permissions })
const RR = 'round_robin'
const INSIDE = 'round_robin.inside_sales'
const PARTNERS = 'round_robin.partners'

test('Round Robin alone gives both of its parts, as the backend reads it', () => {
  // access given before the parts existed stays exactly as it was
  const before = user({ module: RR, actions: ['view', 'edit'] })
  assert.equal(can(before, INSIDE, 'edit'), true)
  assert.equal(can(before, PARTNERS), true)
  assert.equal(can(before, PARTNERS, 'delete'), false)
})

test('ticked parts are exact, and a part needs Round Robin itself', () => {
  const partnersOnly = user({ module: RR, actions: ['view'] }, { module: PARTNERS, actions: ['view', 'edit'] })
  assert.equal(can(partnersOnly, PARTNERS, 'edit'), true)
  assert.equal(can(partnersOnly, INSIDE), false)
  assert.equal(can(user({ module: INSIDE, actions: ['view'] }), INSIDE), false)
  assert.equal(can({ isSuperAdmin: true, permissions: [] }, PARTNERS, 'edit'), true)
})

test('a part is named with its module', () => {
  assert.equal(moduleLabel(PARTNERS), 'Round Robin › Partners')
  assert.equal(moduleLabel(RR), 'Round Robin')
  assert.equal(moduleLabel('nope'), 'nope')
})
