// node --experimental-strip-types --test src/lib/stageColors.test.mjs  (npm test)
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { STAGE_COLORS, contrastRatio, paletteColor, stageColor, textOn, DARK_TEXT, LIGHT_TEXT, WCAG_AA } from './stageColors.ts'

const APPROVED = {
  'Interested': '#16A34A',
  'Prospects': '#0F766E',
  'Not Interested': '#FCA5A5',
  'Invalid': '#DC2626',
  'Not Eligible': '#B91C1C',
  'Not Connected': '#F59E0B',
  'NFET': '#2563EB',
  'Interview': '#4F46E5',
  'PPO': '#7C3AED',
  'Registration & Fee': '#0891B2',
  'Risk': '#EA580C',
  'Future Batch': '#7DD3FC',
  'Closed - Lost': '#64748B',
  'Enrolled': '#15803D',
}

describe('approved palette', () => {
  test('all 14 statuses map to their exact HEX values and nothing else is in the map', () => {
    assert.deepEqual(STAGE_COLORS, APPROVED)
    assert.equal(Object.keys(STAGE_COLORS).length, 14)
    for (const [name, hex] of Object.entries(APPROVED)) assert.equal(paletteColor(name), hex, name)
  })

  test('names match exactly (case, spaces, punctuation); surrounding whitespace is forgiven', () => {
    assert.equal(paletteColor(' Interested '), '#16A34A')
    assert.equal(paletteColor('interested'), undefined)
    assert.equal(paletteColor('Not interested'), undefined)
    assert.equal(paletteColor('Closed-Lost'), undefined)
    assert.equal(paletteColor('Registration and Fee'), undefined)
    assert.equal(paletteColor(''), undefined)
    assert.equal(paletteColor(null), undefined)
  })

  test('an unknown status never inherits another status colour: Masters colour or neutral', () => {
    assert.equal(stageColor({ name: 'Untouched', color: '#8b5cf6' }), '#8b5cf6')
    // a Masters colour that is one of the palette's is reserved for that status: the stage renders neutral instead
    assert.equal(stageColor({ name: 'Untouched', color: '#64748b' }), undefined)
    assert.equal(stageColor({ name: 'Custom', color: '#16a34a' }), undefined)
    assert.equal(stageColor({ name: 'Brand New Status', color: null }), undefined)
    assert.equal(stageColor({ name: 'Brand New Status', color: '' }), undefined)
    assert.equal(stageColor('Something Else'), undefined)
    assert.equal(stageColor(null), undefined)
    // the palette wins over a different Masters colour for an approved status
    assert.equal(stageColor({ name: 'Interested', color: '#2563eb' }), '#16A34A')
    assert.equal(stageColor('Enrolled'), '#15803D')
  })
})

describe('text contrast', () => {
  test('every approved colour gets a text colour that reaches WCAG AA (4.5:1)', () => {
    const report = []
    for (const [name, hex] of Object.entries(APPROVED)) {
      const text = textOn(hex)
      const ratio = contrastRatio(hex, text)
      report.push(`${name} ${hex} → ${text === DARK_TEXT ? 'dark' : 'white'} text, ${ratio.toFixed(2)}:1`)
      assert.ok(ratio >= WCAG_AA, `${name} ${hex}: ${ratio.toFixed(2)}:1 with ${text}`)
    }
    console.log(report.join('\n'))
  })

  test('light fills take dark text, dark fills take white text', () => {
    assert.equal(textOn('#FCA5A5'), DARK_TEXT)
    assert.equal(textOn('#7DD3FC'), DARK_TEXT)
    assert.equal(textOn('#F59E0B'), DARK_TEXT)
    assert.equal(textOn('#0F766E'), LIGHT_TEXT)
    assert.equal(textOn('#B91C1C'), LIGHT_TEXT)
    assert.equal(textOn('#64748B'), LIGHT_TEXT)
  })

  test('contrast maths matches the WCAG reference points', () => {
    assert.equal(Math.round(contrastRatio('#000000', '#ffffff')), 21)
    assert.equal(contrastRatio('#ffffff', '#ffffff'), 1)
    assert.equal(contrastRatio('not-a-colour', '#ffffff'), 1)
    assert.equal(textOn('garbage'), DARK_TEXT, 'an unparseable colour falls back to dark text')
  })
})
