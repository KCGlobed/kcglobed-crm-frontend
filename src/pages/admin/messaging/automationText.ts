/**
 * Communication → Automation in plain English: the one-line summary of a rule ("1 hour after “New lead created”,
 * send WhatsApp “Welcome” to every lead") and its parts, shared by the list and the step-by-step editor; plus the
 * ready-made starters. Plain functions, tested with node (npm test).
 */
import type { FilterCondition, FilterField } from '../../../types/models'

export type Channel = 'sms' | 'email' | 'whatsapp'
export type Recurrence = 'once' | 'daily' | 'weekly' | 'monthly'

export const CHANNEL_LABEL: Record<Channel, string> = { sms: 'SMS', email: 'Email', whatsapp: 'WhatsApp' }
export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] // Monday = 0, as the server
/** The rules every lead automation follows (the Info tooltip beside the list). */
export const AUTOMATION_RULES = 'Automations never reach Junk leads, skip leads who opted out of the channel, and send the same automation to a lead at most once a day.'

const OP_TEXT: Record<string, string> = {
  is: 'is', is_not: 'is not', any_of: 'is any of', none_of: 'is none of', contains: 'contains', empty: 'is empty',
  not_empty: 'is not empty', before: 'before', after: 'after', between: 'between', today: 'is today',
  yesterday: 'is yesterday', last_7_days: 'in the last 7 days', this_month: 'this month', eq: '=', gte: '≥', lte: '≤',
}

/** What a rule is made of, as the editor holds it (dates as ISO instants, the wait in minutes). */
export interface RuleDraft {
  triggerType: 'event' | 'schedule'
  /** the event's label as the server lists it ("New lead created (Meta, Quick Add)") */
  eventLabel?: string | null
  delayMinutes?: number
  recurrence?: Recurrence | null
  runAt?: string | null
  weekdays?: number[]
  endAt?: string | null
  channel?: Channel
  templateName?: string | null
  conditions?: FilterCondition[]
}

/** "New lead created (Meta, Quick Add)" → "New lead created"; "Lead assigned / reassigned — counsellor …" → "Lead assigned / reassigned". */
export function shortEventLabel(label: string): string {
  return label.split(' — ')[0].replace(/\s*\([^)]*\)\s*$/, '').trim()
}

/** 90 → "90 minutes", 60 → "1 hour", 2880 → "2 days"; 0 → "". */
export function waitText(minutes: number): string {
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
  if (!minutes) return ''
  if (minutes % 1440 === 0) return unit(minutes / 1440, 'day')
  if (minutes % 60 === 0) return unit(minutes / 60, 'hour')
  return unit(minutes, 'minute')
}

const pad = (n: number) => String(n).padStart(2, '0')
const clock = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const dayText = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`

/** ["Mon", "Wed", "Fri"] → "Mon, Wed and Fri". */
function joinWords(words: string[]): string {
  return words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}` : (words[0] ?? '')
}

/** When the rule sends: "As soon as “New lead created”", "1 hour after “…”", "Every Mon and Wed at 10:30 until 30 Nov 2026". */
export function whenText(rule: RuleDraft): string {
  if (rule.triggerType === 'event') {
    const what = `“${rule.eventLabel ? shortEventLabel(rule.eventLabel) : '…'}”`
    const wait = waitText(rule.delayMinutes ?? 0)
    return wait ? `${wait} after ${what}` : `As soon as ${what}`
  }
  const at = rule.runAt ? new Date(rule.runAt) : null
  const time = at ? ` at ${clock(at)}` : ''
  let text: string
  if (rule.recurrence === 'once') text = at ? `On ${dayText(at)}${time}` : 'Once'
  else if (rule.recurrence === 'weekly') {
    const days = [...new Set(rule.weekdays ?? [])].sort((a, b) => a - b).map((d) => WEEKDAY_LABELS[d])
    text = `Every ${days.length ? joinWords(days) : 'week'}${time}`
  } else if (rule.recurrence === 'monthly') text = at ? `On day ${at.getDate()} of every month${time}` : 'Every month'
  else text = `Every day${time}`
  if (rule.recurrence !== 'once' && rule.endAt) text += ` until ${dayText(new Date(rule.endAt))}`
  return text
}

/** "Stage is Interested" — one condition as people read it. */
export function describeCondition(c: FilterCondition, fields: FilterField[]): string {
  const field = fields.find((f) => f.key === c.field)
  const values = Array.isArray(c.value) ? c.value : c.value !== undefined && c.value !== '' ? [c.value] : []
  const text = values.map((v) => field?.options?.find((o) => o.value === v)?.label ?? v).join(c.op === 'between' ? ' – ' : ', ')
  return [field?.label ?? c.field, OP_TEXT[c.op] ?? c.op, text].filter(Boolean).join(' ')
}

/** "every lead", "leads where Stage is Interested", "leads where Stage is Interested and 2 more conditions". */
export function audienceText(conditions: FilterCondition[] = [], fields: FilterField[] = []): string {
  if (!conditions.length) return 'every lead'
  const first = `leads where ${describeCondition(conditions[0], fields)}`
  const more = conditions.length - 1
  return more ? `${first} and ${more} more condition${more === 1 ? '' : 's'}` : first
}

/** The whole rule in one sentence: "1 hour after “New lead created”, send WhatsApp “Welcome” to every lead". */
export function ruleSentence(rule: RuleDraft, fields: FilterField[] = []): string {
  const what = `${rule.channel ? CHANNEL_LABEL[rule.channel] : 'a message'} “${rule.templateName || '…'}”`
  return `${whenText(rule)}, send ${what} to ${audienceText(rule.conditions, fields)}`
}

/** A name for a new rule when none was typed: "WhatsApp · Welcome · New lead created". */
export function suggestName(rule: RuleDraft): string {
  const when = rule.triggerType === 'event'
    ? (rule.eventLabel ? shortEventLabel(rule.eventLabel) : '')
    : whenText({ ...rule, endAt: null })
  return [rule.channel ? CHANNEL_LABEL[rule.channel] : '', rule.templateName ?? '', when].filter(Boolean).join(' · ').slice(0, 150)
}

/** Ready-made beginnings for a new automation: they fill in step 1; the message and the leads are still chosen. */
export interface Starter {
  key: string
  title: string
  hint: string
  triggerType: 'event' | 'schedule'
  event?: string
  delayMinutes?: number
  recurrence?: Recurrence
  weekdays?: number[]
  /** the schedule's time of day, "HH:MM" */
  time?: string
}

export const STARTERS: Starter[] = [
  { key: 'welcome', title: 'Welcome new leads', hint: 'As soon as a new lead comes in', triggerType: 'event', event: 'lead_created', delayMinutes: 0 },
  { key: 'missed', title: 'After a missed call', hint: 'When the first call is “Not connected”', triggerType: 'event', event: 'first_not_connected', delayMinutes: 0 },
  { key: 'interested', title: 'Follow up interest', hint: '1 hour after a lead moves to Interested', triggerType: 'event', event: 'stage_interested', delayMinutes: 60 },
  { key: 'weekly', title: 'Weekly reminder', hint: 'Every Monday at 10:00', triggerType: 'schedule', recurrence: 'weekly', weekdays: [0], time: '10:00' },
]
