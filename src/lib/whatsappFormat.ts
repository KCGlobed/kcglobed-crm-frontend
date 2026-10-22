/**
 * WhatsApp's text formatting for previews (the WhatsApp template builder and the send dialogs): *bold*,
 * _italic_, ~strike~ and ```monospace```, the way WhatsApp itself shows them; plus the small text helpers
 * the builder's toolbar and checks use. Plain functions, so they are tested with node (npm test).
 */

export interface WaSegment {
  text: string
  bold?: boolean
  italic?: boolean
  strike?: boolean
  mono?: boolean
}

type WaStyle = Omit<WaSegment, 'text'>

const STYLE_OF: Record<string, keyof WaStyle> = { '*': 'bold', _: 'italic', '~': 'strike' }
// a marker pair opens and closes on one line, hugging its text, never inside a word (snake_case stays as typed)
const TOKEN = /```([\s\S]+?)```|(?<![\p{L}\p{N}])([*_~])(?!\s)([^\n]*?\S)\2(?![\p{L}\p{N}])/gu
const VAR = /\{\{(\d+)\}\}/g

/** The text split into styled runs; markers can nest (*_bold italic_*), monospace keeps its text as typed. */
export function parseWhatsApp(text: string, style: WaStyle = {}): WaSegment[] {
  const out: WaSegment[] = []
  const token = new RegExp(TOKEN.source, TOKEN.flags)
  let at = 0
  for (let m = token.exec(text); m; m = token.exec(text)) {
    if (m.index > at) out.push({ ...style, text: text.slice(at, m.index) })
    if (m[1] !== undefined) out.push({ ...style, mono: true, text: m[1] })
    else out.push(...parseWhatsApp(m[3], { ...style, [STYLE_OF[m[2]]]: true }))
    at = m.index + m[0].length
  }
  if (at < text.length) out.push({ ...style, text: text.slice(at) })
  return out
}

/** The highest {{n}} in a text: how many values the template takes. */
export function waVariableCount(text: string): number {
  let max = 0
  for (const m of text.matchAll(VAR)) max = Math.max(max, Number(m[1]))
  return max
}

/** Each {{n}} replaced by its value; one without a value stays as {{n}}. */
export function fillWaVariables(text: string, values: string[]): string {
  return text.replace(VAR, (marker, n: string) => values[Number(n) - 1]?.trim() || marker)
}

/** Meta's template name: lowercase letters, digits and _ — spaces and dashes typed become _. */
export function toWaTemplateName(typed: string): string {
  return typed.toLowerCase().replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 120)
}

/** The toolbar: wraps the selection in a marker (an empty pair at the caret); the new text and where the caret goes. */
export function wrapSelection(text: string, start: number, end: number, marker: string): { text: string; caret: number } {
  const picked = text.slice(start, end)
  return {
    text: `${text.slice(0, start)}${marker}${picked}${marker}${text.slice(end)}`,
    caret: end + marker.length * (picked ? 2 : 1),
  }
}

/** "Add variable": the next {{n}} at the caret. */
export function insertNextVariable(text: string, at: number): { text: string; caret: number } {
  const marker = `{{${waVariableCount(text) + 1}}}`
  return { text: text.slice(0, at) + marker + text.slice(at), caret: at + marker.length }
}

/** Meta's variable rules, checked while typing (the server checks them again on save). */
export function waBodyProblem(body: string): string | null {
  const text = body.trim()
  const rest = text.replace(VAR, '')
  if (rest.includes('{{') || rest.includes('}}')) return 'Variables are written {{1}}, {{2}} … (a number between double braces)'
  const numbers = [...new Set([...text.matchAll(VAR)].map((m) => Number(m[1])))].sort((a, b) => a - b)
  if (!numbers.length) return null
  if (numbers.some((n, i) => n !== i + 1)) return 'Number the variables {{1}}, {{2}}, {{3}} … in order, without gaps'
  if (text.startsWith('{{') || text.endsWith('}}')) return 'The text cannot start or end with a variable: add words before or after it'
  if (/\}\}\s*\{\{/.test(text)) return 'Two variables cannot be side by side: put words between them'
  return null
}

/** Can this template be picked for a send? WhatsApp: only what Meta approved (or flagged — still delivered); a
 * template without a status was typed in by hand before the builder. */
export function waSendable(t: { channel: string; waStatus?: string }): boolean {
  return t.channel !== 'whatsapp' || !t.waStatus || t.waStatus === 'APPROVED' || t.waStatus === 'FLAGGED'
}

/** A template in a send picker: its name, and for WhatsApp the category and language ("Reminder · Utility · en"). */
export function sendOptionLabel(t: { name: string; channel: string; waCategory?: string; waLanguage?: string; dltTemplateId?: string }): string {
  if (t.channel === 'whatsapp') {
    const category = t.waCategory ? t.waCategory.charAt(0) + t.waCategory.slice(1).toLowerCase() : ''
    return [t.name, category, t.waLanguage].filter(Boolean).join(' · ')
  }
  return t.dltTemplateId ? `${t.name} · DLT ${t.dltTemplateId}` : t.name
}

/** Meta keeps the quick replies side by side: they come first, the other buttons after, each group in its order. */
export function orderWaButtons<T extends { type: string }>(buttons: T[]): T[] {
  return [...buttons.filter((b) => b.type === 'QUICK_REPLY'), ...buttons.filter((b) => b.type !== 'QUICK_REPLY')]
}
