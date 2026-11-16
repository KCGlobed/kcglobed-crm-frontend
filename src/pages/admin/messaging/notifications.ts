/**
 * Communication → Notifications, the plain functions: what a row allows, how rows are grouped and filtered, which
 * editor tab a refusal belongs to, and the drawer's small helpers (a new alert, the preview fill, the test-send
 * summary). Type-only imports, so node runs the tests (npm test).
 */
import type {
  StaffAlertBody, StaffAlertCapabilities, StaffAlertKind, StaffAlertRow, StaffAlertTestResult, StaffAlertsResponse,
} from '../../../types/models'

export type ChannelTab = 'email' | 'sms' | 'push'
export type StatusFilter = 'all' | 'on' | 'off'
export type NotificationsView = 'staff' | 'account' | 'lead'
export const NOTIFICATION_VIEWS: NotificationsView[] = ['staff', 'account', 'lead']
export const CHANNEL_TABS: ChannelTab[] = ['email', 'sms', 'push']

/** The body fields each channel tab owns — which tab a server error belongs to. */
export const CHANNEL_FIELDS: Record<ChannelTab, string[]> = {
  email: ['emailEnabled', 'emailSubject', 'emailBody', 'ctaLabel'],
  sms: ['smsEnabled', 'smsBody', 'smsSenderId', 'smsDltTemplateId', 'smsDltType'],
  push: ['pushEnabled', 'pushTitle', 'pushBody'],
}

/** The channel tab holding the first field a refusal names; null when none is a channel field. */
export function errorChannel(errors: Record<string, string>): ChannelTab | null {
  const keys = Object.keys(errors)
  return CHANNEL_TABS.find((tab) => keys.some((k) => CHANNEL_FIELDS[tab].includes(k))) ?? null
}

/** A refusal about the DLT sender / template id (the collapsed DLT settings must open). */
export function needsDlt(errors: Record<string, string>): boolean {
  return Object.keys(errors).some((k) => k.startsWith('smsDlt') || k === 'smsSenderId')
}

/** The API key of a row: a built-in trigger, or an added alert's id. */
export const alertKey = (row: Pick<StaffAlertRow, 'trigger' | '_id'>): string => row.trigger ?? row._id

export const kindOf = (row: Pick<StaffAlertRow, 'kind' | 'trigger'>): StaffAlertKind => row.kind ?? (row.trigger ? 'builtin' : 'custom')

/** Rows from a response without `capabilities` (the unscoped list) behave as the Team alerts always did. */
export function capabilitiesOf(row: StaffAlertRow, isNew = false): StaffAlertCapabilities {
  if (row.capabilities) return isNew ? { ...row.capabilities, delete: false } : row.capabilities
  const custom = !row.trigger
  return { toggle: true, push: true, email: true, sms: true, owner: true, recipients: true, conditions: custom, delete: custom && !isNew, test: true }
}

/** Staff alerts (built-in + custom) vs account emails. */
export function splitByKind(items: StaffAlertRow[]): { staff: StaffAlertRow[]; account: StaffAlertRow[] } {
  const staff: StaffAlertRow[] = []
  const account: StaffAlertRow[] = []
  for (const row of items) (kindOf(row) === 'account' ? account : staff).push(row)
  return { staff, account }
}

/** Rows under their group in the server's order; unknown groups after, in first-seen order; empty groups dropped. */
export function groupRows(rows: StaffAlertRow[], groups?: { key: string; label: string }[]): { key: string; label: string; rows: StaffAlertRow[] }[] {
  const out: { key: string; label: string; rows: StaffAlertRow[] }[] = []
  const index = new Map<string, number>()
  for (const g of groups ?? []) {
    index.set(g.key, out.length)
    out.push({ key: g.key, label: g.label, rows: [] })
  }
  for (const row of rows) {
    const key = row.group ?? 'other'
    if (!index.has(key)) {
      index.set(key, out.length)
      out.push({ key, label: row.groupLabel ?? 'Other alerts', rows: [] })
    }
    out[index.get(key)!].rows.push(row)
  }
  return out.filter((g) => g.rows.length > 0)
}

/** Search over the label, when it fires, who gets it and the titles; the status filter on isActive. */
export function filterAlerts(rows: StaffAlertRow[], query: string, status: StatusFilter): StaffAlertRow[] {
  const q = query.trim().toLowerCase()
  return rows.filter((row) => {
    if (status !== 'all' && row.isActive !== (status === 'on')) return false
    if (!q) return true
    return [row.label, row.description ?? row.when, row.recipientsText, row.pushTitle, row.emailSubject, row.groupLabel]
      .some((text) => (text ?? '').toLowerCase().includes(q))
  })
}

/** What the toast says when an inline channel switch is refused for missing wording / DLT details. */
export function refusalMessage(channel: ChannelTab | null, fallback: string): string {
  if (channel === 'sms') return 'Add the SMS text and DLT details first — the editor is open on SMS.'
  if (channel === 'email') return 'Add the email subject and message first — the editor is open on Email.'
  if (channel === 'push') return 'Add the push title first — the editor is open on Bell & push.'
  return fallback
}

/** The saved row as a full PUT / test body (what the table's "Send test" sends). */
export function rowToBody(row: StaffAlertRow): StaffAlertBody {
  const body: StaffAlertBody = {
    isActive: row.isActive, offsetMinutes: row.offsetMinutes, earlyOffsetMinutes: row.earlyOffsetMinutes,
    emailEnabled: row.emailEnabled, smsEnabled: row.smsEnabled, pushEnabled: row.pushEnabled,
    emailSubject: row.emailSubject, emailBody: row.emailBody, smsBody: row.smsBody,
    smsSenderId: row.smsSenderId, smsDltTemplateId: row.smsDltTemplateId, smsDltType: row.smsDltType,
    pushTitle: row.pushTitle, pushBody: row.pushBody, ctaLabel: row.ctaLabel,
    notifyOwner: row.notifyOwner, recipientRoles: row.recipientRoles, recipientUsers: row.recipientUsers,
  }
  if (kindOf(row) === 'custom') {
    body.name = row.name ?? ''
    body.event = row.event ?? ''
    body.conditions = row.conditions ?? []
  }
  return body
}

/** A new alert as the editor starts it: the server's ready-made wording, on a lead event still to choose. */
export function newAlert(options: StaffAlertsResponse): StaffAlertRow {
  const d = options.customDefaults ?? {}
  return {
    _id: '', trigger: null, custom: true, kind: 'custom', label: 'New alert', name: '', event: null, eventLabel: null, conditions: [],
    notificationType: 'team_alert', isActive: true, offsetMinutes: 120, earlyOffsetMinutes: null,
    emailEnabled: d.emailEnabled ?? true, smsEnabled: d.smsEnabled ?? false, pushEnabled: d.pushEnabled ?? true,
    emailSubject: d.emailSubject ?? '', emailBody: d.emailBody ?? '', smsBody: d.smsBody ?? '',
    smsSenderId: null, smsDltTemplateId: null, smsDltType: 'implicit',
    pushTitle: d.pushTitle ?? '', pushBody: d.pushBody ?? '', ctaLabel: d.ctaLabel ?? 'Open Lead', when: '',
    notifyOwner: d.notifyOwner ?? true, recipientRoles: [], recipientUsers: [], recipientsText: '',
    updatedBy: null, updatedAt: '', createdAt: '',
  }
}

/** {{Key}} → the sample value (the server fills the real lead / follow-up at send time). */
export const fill = (text: string, samples: Record<string, string>): string =>
  text.replace(/\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g, (_m, key: string) => samples[key] ?? '').replace(/[ \t]{2,}/g, ' ')

const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function dayRange(days: number[]): string {
  if (!days.length) return ''
  const sorted = [...days].sort((a, b) => a - b)
  const contiguous = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1)
  return contiguous && sorted.length > 1 ? `${DAY[sorted[0]]}–${DAY[sorted[sorted.length - 1]]}` : sorted.map((d) => DAY[d]).join(', ')
}

export function describeTest(result: StaffAlertTestResult): string {
  const parts: string[] = []
  if (result.push !== undefined) parts.push(result.push ? `push to ${result.push} device${result.push === 1 ? '' : 's'}` : 'push: no device registered for you')
  if (result.email) parts.push(result.email === 'sent' ? 'email sent' : `email ${result.email}`)
  if (result.sms) {
    const ok = result.sms.status === 'sent' || result.sms.status === 'delivered'
    parts.push(ok ? 'SMS sent' : `SMS ${result.sms.status}${result.sms.error ? `: ${result.sms.error}` : ''}`)
  }
  if (result.warning) parts.push(result.warning)
  return parts.join(' · ') || 'in the bell only'
}
