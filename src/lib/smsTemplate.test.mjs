// node --experimental-strip-types --test src/lib/smsTemplate.test.mjs  (npm test)
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { DLT_VAR_MAX, dltVariableCount, fillDltVariables } from './smsTemplate.ts'

const BODY = 'Dear {#var#}, thank you for registering with GCC School. Your registration ID is {#var#}. Team KC GlobEd'

describe('dltVariableCount', () => {
  test('counts the {#var#} markers', () => {
    assert.equal(dltVariableCount(BODY), 2)
    assert.equal(dltVariableCount('Hi {first_name}, no variables here'), 0)
  })
})

describe('fillDltVariables', () => {
  test('fills the markers in order', () => {
    assert.equal(
      fillDltVariables(BODY, ['Asha', 'R-1']),
      'Dear Asha, thank you for registering with GCC School. Your registration ID is R-1. Team KC GlobEd',
    )
  })

  test('a blank value leaves its marker so the preview shows what is missing', () => {
    assert.equal(fillDltVariables('A {#var#} B {#var#}', ['x']), 'A x B {#var#}')
    assert.equal(fillDltVariables('A {#var#} B {#var#}', ['', 'y']), 'A {#var#} B y')
    assert.equal(fillDltVariables('A {#var#} B {#var#}', ['  ', 'y']), 'A {#var#} B y')
  })

  test('trims the values and ignores extra ones', () => {
    assert.equal(fillDltVariables('Code {#var#}', ['  123 ', 'unused']), 'Code 123')
  })

  test('leaves lead placeholders alone', () => {
    assert.equal(fillDltVariables('Hi {first_name}, code {#var#}', ['9']), 'Hi {first_name}, code 9')
  })

  test('the DLT length rule is 30 characters', () => {
    assert.equal(DLT_VAR_MAX, 30)
  })
})
