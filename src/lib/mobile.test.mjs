// node --experimental-strip-types --test src/lib/mobile.test.mjs  (npm test)
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { mobileDigits } from './mobile.ts'

describe('mobileDigits', () => {
  test('keeps digits only', () => {
    assert.equal(mobileDigits('98765 43210'), '9876543210')
    assert.equal(mobileDigits('98a7b6'), '9876')
    assert.equal(mobileDigits('jhscdvwuscdvwujs'), '')
  })

  test('ignores anything typed past the tenth digit', () => {
    assert.equal(mobileDigits('98765432105'), '9876543210')
    assert.equal(mobileDigits('9876543210987'), '9876543210')
  })

  test('drops a pasted +91 / 91 / leading-0 prefix', () => {
    assert.equal(mobileDigits('+91 98765 43210'), '9876543210')
    assert.equal(mobileDigits('919876543210'), '9876543210')
    assert.equal(mobileDigits('09876543210'), '9876543210')
  })

  test('leaves a short or empty value as typed', () => {
    assert.equal(mobileDigits(''), '')
    assert.equal(mobileDigits('91'), '91')
    assert.equal(mobileDigits('0987'), '0987')
  })
})
