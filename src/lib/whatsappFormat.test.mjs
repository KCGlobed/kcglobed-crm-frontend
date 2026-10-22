// node --experimental-strip-types --test src/lib/whatsappFormat.test.mjs  (npm test)
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  fillWaVariables,
  insertNextVariable,
  orderWaButtons,
  parseWhatsApp,
  toWaTemplateName,
  waBodyProblem,
  waVariableCount,
  wrapSelection,
} from './whatsappFormat.ts'

describe('parseWhatsApp', () => {
  test('bold, italic, strike and monospace runs', () => {
    assert.deepEqual(parseWhatsApp('Hi *Asha*, _see_ ~old~ ```CODE 1```'), [
      { text: 'Hi ' },
      { bold: true, text: 'Asha' },
      { text: ', ' },
      { italic: true, text: 'see' },
      { text: ' ' },
      { strike: true, text: 'old' },
      { text: ' ' },
      { mono: true, text: 'CODE 1' },
    ])
  })

  test('markers nest', () => {
    assert.deepEqual(parseWhatsApp('*_both_*'), [{ bold: true, italic: true, text: 'both' }])
  })

  test('markers inside a word, around spaces or across lines stay as typed', () => {
    for (const text of ['snake_case_name', '2*3*4', '* not bold *', '*one\ntwo*', 'a lone * star']) {
      assert.deepEqual(parseWhatsApp(text), [{ text }], text)
    }
  })
})

describe('variables', () => {
  test('counts and fills {{n}}; a missing value keeps its marker', () => {
    assert.equal(waVariableCount('Hi {{1}}, id {{2}} / {{1}}'), 2)
    assert.equal(waVariableCount('no variables'), 0)
    assert.equal(fillWaVariables('Hi {{1}}, id {{2}}.', ['Asha']), 'Hi Asha, id {{2}}.')
  })

  test('Add variable inserts the next number at the caret', () => {
    assert.deepEqual(insertNextVariable('Hi , id', 3), { text: 'Hi {{1}}, id', caret: 8 })
    assert.deepEqual(insertNextVariable('Hi {{1}}, id ', 13), { text: 'Hi {{1}}, id {{2}}', caret: 18 })
  })

  test("Meta's rules on the body", () => {
    assert.equal(waBodyProblem('Hi {{1}}, your id is {{2}}.'), null)
    assert.match(waBodyProblem('Hi {{1}}, on {{3}}.'), /in order, without gaps/)
    assert.match(waBodyProblem('{{1}} is your id.'), /start or end/)
    assert.match(waBodyProblem('Your id is {{1}}'), /start or end/)
    assert.match(waBodyProblem('Hi {{1}} {{2}} thanks'), /side by side/)
    assert.match(waBodyProblem('Hi {{name}} thanks'), /double braces/)
  })
})

describe('the builder toolbar', () => {
  test('wraps the selection, or puts an empty pair at the caret', () => {
    assert.deepEqual(wrapSelection('Hi Asha', 3, 7, '*'), { text: 'Hi *Asha*', caret: 9 })
    assert.deepEqual(wrapSelection('Hi ', 3, 3, '_'), { text: 'Hi __', caret: 4 })
  })

  test("Meta's template name", () => {
    assert.equal(toWaTemplateName('Admission Follow-up 2026!'), 'admission_follow_up_2026')
  })

  test('quick replies come first, each group in its order', () => {
    const buttons = [{ type: 'URL', text: 'Site' }, { type: 'QUICK_REPLY', text: 'Yes' }, { type: 'PHONE_NUMBER', text: 'Call' }, { type: 'QUICK_REPLY', text: 'No' }]
    assert.deepEqual(orderWaButtons(buttons).map((b) => b.text), ['Yes', 'No', 'Site', 'Call'])
  })
})
