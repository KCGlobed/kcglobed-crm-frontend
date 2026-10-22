import { useRef, useState } from 'react'
import { AlertTriangle, BellRing, CalendarClock, ChevronDown, Filter, Mail, MessageSquareText, Pencil, Send, Trash2, UserPlus, X, Zap, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useCurrentUser } from '../../../app/hooks'
import { Button } from '../../../components/ui/Button'
import { Drawer } from '../../../components/ui/Drawer'
import { ConfirmDialog, Skeleton } from '../../../components/ui/feedback'
import { Checkbox, FormField, Input, Select, Switch, Textarea } from '../../../components/ui/fields'
import { can } from '../../../constants/permissions'
import { cn, formatDateTime, parseApiError } from '../../../lib/utils'
import { useFilterFieldsQuery } from '../../../services/leadsApi'
import {
  useCreateStaffAlertMutation,
  useDeleteStaffAlertMutation,
  useListStaffAlertsQuery,
  useTestStaffAlertMutation,
  useUpdateStaffAlertMutation,
} from '../../../services/messagingApi'
import type { StaffAlertBody, StaffAlertRow, StaffAlertTestResult, StaffAlertTrigger, StaffAlertsResponse } from '../../../types/models'
import { LeadFilterPanel } from '../../leads/LeadFilterPanel'
import { describeCondition } from './automationText'
import { DELAY_UNITS, joinDelay, splitDelay } from './automationTime'

const ICON: Record<StaffAlertTrigger, LucideIcon> = {
  follow_up_reminder: CalendarClock,
  lead_untouched: AlertTriangle,
  lead_assigned: UserPlus,
}
const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
/** the text fields a placeholder can be inserted into (the `name` attribute of each box) */
type TextKey = 'emailSubject' | 'emailBody' | 'smsBody' | 'pushTitle' | 'pushBody'
type Form = Required<Omit<StaffAlertBody, 'offsetMinutes' | 'earlyOffsetMinutes'>>
type ChannelTab = 'email' | 'sms' | 'push'

// one tab per channel: its switch, its text boxes (the last one takes an inserted field when no box was clicked)
const TABS: { key: ChannelTab; label: string; icon: LucideIcon; toggle: 'emailEnabled' | 'smsEnabled' | 'pushEnabled'; boxes: TextKey[]; fields: string[] }[] = [
  { key: 'email', label: 'Email', icon: Mail, toggle: 'emailEnabled', boxes: ['emailSubject', 'emailBody'], fields: ['emailEnabled', 'emailSubject', 'emailBody', 'ctaLabel'] },
  { key: 'sms', label: 'SMS', icon: MessageSquareText, toggle: 'smsEnabled', boxes: ['smsBody'], fields: ['smsEnabled', 'smsBody', 'smsSenderId', 'smsDltTemplateId', 'smsDltType'] },
  { key: 'push', label: 'Bell & push', icon: BellRing, toggle: 'pushEnabled', boxes: ['pushTitle', 'pushBody'], fields: ['pushEnabled', 'pushTitle', 'pushBody'] },
]

/** A new alert as the editor starts it: the server's ready-made wording, on a lead event still to choose. */
function newAlert(options: StaffAlertsResponse): StaffAlertRow {
  const d = options.customDefaults ?? {}
  return {
    _id: '', trigger: null, custom: true, label: 'New alert', name: '', event: null, eventLabel: null, conditions: [],
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
const fill = (text: string, samples: Record<string, string>) =>
  text.replace(/\{\{\s*([A-Za-z][A-Za-z0-9_]*)\s*\}\}/g, (_m, key: string) => samples[key] ?? '').replace(/[ \t]{2,}/g, ' ')

function dayRange(days: number[]): string {
  if (!days.length) return ''
  const sorted = [...days].sort((a, b) => a - b)
  const contiguous = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1)
  return contiguous && sorted.length > 1 ? `${DAY[sorted[0]]}–${DAY[sorted[sorted.length - 1]]}` : sorted.map((d) => DAY[d]).join(', ')
}

function describeTest(result: StaffAlertTestResult): string {
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

function Preview({ lines, note }: { lines: string[]; note?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">Preview{note ? ` · ${note}` : ''}</p>
      {lines.map((line, i) => (
        <p key={i} className={cn('whitespace-pre-wrap text-xs text-slate-700', i === 0 && lines.length > 1 && 'mb-1 font-medium text-slate-800')}>
          {line || <span className="text-slate-400">—</span>}
        </p>
      ))}
    </div>
  )
}

/** Amount + unit, stored in minutes. */
function DelayInput({ value, onChange, min }: { value: { amount: number; unit: number }; onChange: (v: { amount: number; unit: number }) => void; min: number }) {
  return (
    <div className="flex gap-2">
      <Input type="number" min={min} value={value.amount} onChange={(e) => onChange({ ...value, amount: Number(e.target.value) })} className="w-24" />
      <Select value={value.unit} onChange={(e) => onChange({ ...value, unit: Number(e.target.value) })} className="w-32">
        {DELAY_UNITS.map((u) => (
          <option key={u.value} value={u.value}>
            {u.label}
          </option>
        ))}
      </Select>
    </div>
  )
}

function StaffAlertDrawer({ alert, isNew, options, onClose }: { alert: StaffAlertRow; isNew?: boolean; options: StaffAlertsResponse; onClose: () => void }) {
  const [update, { isLoading: updating }] = useUpdateStaffAlertMutation()
  const [create, { isLoading: creating }] = useCreateStaffAlertMutation()
  const [remove, { isLoading: removing }] = useDeleteStaffAlertMutation()
  const [sendTest, { isLoading: testing }] = useTestStaffAlertMutation()
  const { data: meta } = useFilterFieldsQuery()
  const custom = !alert.trigger // added in the CRM (or being added): name, event and conditions are its own
  // the API's key: a built-in trigger, an added alert's id, or "custom" for one not saved yet (Send test)
  const key = alert.trigger ?? (isNew ? 'custom' : alert._id)
  const fields = meta?.data.fields ?? []
  const [filterOpen, setFilterOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState<Form>({
    isActive: alert.isActive,
    emailEnabled: alert.emailEnabled,
    smsEnabled: alert.smsEnabled,
    pushEnabled: alert.pushEnabled,
    emailSubject: alert.emailSubject,
    emailBody: alert.emailBody,
    smsBody: alert.smsBody,
    smsSenderId: alert.smsSenderId ?? '',
    smsDltTemplateId: alert.smsDltTemplateId ?? '',
    smsDltType: alert.smsDltType,
    pushTitle: alert.pushTitle,
    pushBody: alert.pushBody,
    ctaLabel: alert.ctaLabel,
    notifyOwner: alert.notifyOwner ?? true,
    recipientRoles: alert.recipientRoles ?? [],
    recipientUsers: alert.recipientUsers ?? [],
    name: alert.name ?? '',
    event: alert.event ?? '',
    conditions: alert.conditions ?? [],
  })
  const [offset, setOffset] = useState(splitDelay(alert.offsetMinutes))
  const [early, setEarly] = useState(alert.earlyOffsetMinutes ? splitDelay(alert.earlyOffsetMinutes) : { amount: 0, unit: 1 })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [tab, setTab] = useState<ChannelTab>(alert.emailEnabled || !(alert.smsEnabled || alert.pushEnabled) ? 'email' : alert.smsEnabled ? 'sms' : 'push')
  const [dltOpen, setDltOpen] = useState(false)
  // the text box the cursor was last in — where "Insert a field" puts the placeholder
  const focused = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

  const placeholders = options.placeholders[alert.trigger ?? 'custom'] ?? []
  const samples: Record<string, string> = Object.fromEntries(placeholders.map((p) => [p.key, p.sample]))
  const untouched = alert.trigger === 'lead_untouched'
  const dlt = options.smsProvider === 'webinfosys'
  const hours = `${options.workingHours.start}–${options.workingHours.end} ${dayRange(options.workingHours.days)}`
  const current = TABS.find((t) => t.key === tab) ?? TABS[0]

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== key)))
  }
  /** A change to who gets it also clears the "choose who gets this alert" error. */
  const setWho = <K extends 'notifyOwner' | 'recipientRoles' | 'recipientUsers'>(key: K, value: Form[K]) => {
    set(key, value)
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'recipients')))
  }
  const toggleRole = (role: string) =>
    setWho('recipientRoles', form.recipientRoles.includes(role) ? form.recipientRoles.filter((r) => r !== role) : [...form.recipientRoles, role])
  const people = options.recipientUsers ?? []
  const remember = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    focused.current = e.target
  }
  /** {{Key}} at the cursor of the box last clicked in this tab — or at the end of the tab's main text. */
  const insert = (key: string) => {
    const last = focused.current
    const main = current.boxes[current.boxes.length - 1]
    const field = last && current.boxes.includes(last.name as TextKey) ? last : document.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${main}"]`)
    if (!field) return
    const target = field.name as TextKey
    const snippet = `{{${key}}}`
    const start = field === last ? (field.selectionStart ?? field.value.length) : field.value.length
    const end = field === last ? (field.selectionEnd ?? start) : start
    set(target, field.value.slice(0, start) + snippet + field.value.slice(end))
    requestAnimationFrame(() => {
      field.focus()
      field.selectionStart = field.selectionEnd = start + snippet.length
    })
  }

  const body = (): StaffAlertBody => {
    const { name, event, conditions, ...rest } = form
    return {
      ...rest,
      // a built-in alert's timing is its own: only an added one has a name, an event and conditions
      ...(custom ? { name, event, conditions } : {}),
      smsSenderId: form.smsSenderId || null,
      smsDltTemplateId: form.smsDltTemplateId || null,
      offsetMinutes: joinDelay(offset.amount, offset.unit),
      earlyOffsetMinutes: early.amount > 0 ? joinDelay(early.amount, early.unit) : null,
    }
  }

  /** A refusal names its fields: open the tab (and the DLT settings) that holds the first one. */
  const showErrors = (fieldErrors: Record<string, string>) => {
    setErrors(fieldErrors)
    const keys = Object.keys(fieldErrors)
    const holder = TABS.find((t) => keys.some((k) => t.fields.includes(k)))
    if (holder) setTab(holder.key)
    if (keys.some((k) => k.startsWith('smsDlt') || k === 'smsSenderId')) setDltOpen(true)
  }
  const onSave = async () => {
    try {
      const res = isNew ? await create(body()).unwrap() : await update({ trigger: key, body: body() }).unwrap()
      toast.success(res.message)
      onClose()
    } catch (err) {
      const parsed = parseApiError(err)
      showErrors(parsed.errors)
      toast.error(parsed.message)
    }
  }
  const onTest = async () => {
    try {
      const res = await sendTest({ trigger: key, body: body() }).unwrap()
      toast.success(`Test sent to you: ${describeTest(res.data)}`)
    } catch (err) {
      const parsed = parseApiError(err)
      showErrors(parsed.errors)
      toast.error(parsed.message)
    }
  }

  const onDelete = async () => {
    try {
      const res = await remove(key).unwrap()
      toast.success(res.message)
      onClose()
    } catch (err) {
      toast.error(parseApiError(err).message)
      setDeleting(false)
    }
  }

  const smsPreview = fill(form.smsBody, samples)
  const on = form[current.toggle]
  const saving = updating || creating

  return (
    <>
    <Drawer
      open
      onClose={onClose}
      wide
      title={isNew ? 'Add alert' : alert.label}
      description={
        custom
          ? 'Goes out straight away when the event happens, to the people chosen below.'
          : alert.trigger === 'follow_up_reminder'
            ? `${alert.when}. Use {{Reminder_Lead_Time}} in the text so the time always reads right.`
            : alert.when
      }
      footer={
        <>
          {custom && !isNew && (
            <Button variant="ghost" className="mr-auto text-red-600" onClick={() => setDeleting(true)}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="outline" onClick={onTest} loading={testing} title="Sends this draft to you with sample values, on every channel that is on">
            <Send className="h-3.5 w-3.5" /> Send test to me
          </Button>
          <Button onClick={onSave} loading={saving}>
            {isNew ? 'Add alert' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {custom && (
          <div className="space-y-3 rounded-xl border border-slate-200 px-4 py-3">
            <FormField label="Name" required error={errors.name}>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={150} placeholder="e.g. Fees paid → Support" />
            </FormField>
            <FormField label="When" required error={errors.event} hint="It goes out straight away when this happens to a lead.">
              <Select value={form.event} onChange={(e) => set('event', e.target.value)}>
                <option value="">Choose…</option>
                {(options.events ?? []).map((ev) => (
                  <option key={ev.value} value={ev.value}>
                    {ev.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-slate-700">Only for leads where…</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {form.conditions.length ? (
                  form.conditions.map((c, i) => (
                    <span key={i} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                      {describeCondition(c, fields)}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-500">Every lead</span>
                )}
                <Button type="button" size="sm" variant="outline" onClick={() => setFilterOpen(true)}>
                  <Filter className="h-3.5 w-3.5" /> {form.conditions.length ? 'Change' : 'Add a condition'}
                </Button>
              </div>
              <p className={cn('text-[11px]', errors.conditions ? 'font-medium text-red-600' : 'text-slate-500')}>
                {errors.conditions ?? 'For "Stage changed", add "Stage is …" to pick the stage.'}
              </p>
            </div>
          </div>
        )}
        <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3">
          <span>
            <span className="block text-sm font-medium text-slate-800">{form.isActive ? 'This alert is on' : 'This alert is off'}</span>
            <span className="block text-xs text-slate-500">{form.isActive ? 'Counsellors get it on the channels switched on below.' : 'Nothing is sent until it is switched on.'}</span>
          </span>
          <Switch checked={form.isActive} onChange={(v) => set('isActive', v)} label="Alert on" />
        </label>

        {/* who gets it: the counsellor, roles, people */}
        <div className="space-y-3 rounded-xl border border-slate-200 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-slate-800">Who gets it</p>
            <p className="text-xs text-slate-500">People in a role or added by name only get it for leads they can open.</p>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <Checkbox checked={form.notifyOwner} onChange={(e) => setWho('notifyOwner', e.target.checked)} />
            {alert.trigger === 'follow_up_reminder' ? "The follow-up's counsellor" : "The lead's counsellor"}
          </label>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-slate-600">Everyone in these roles</p>
            <p className="text-[11px] text-slate-500">To reach only some people in a role, leave the role off and add them under These people.</p>
            <div className="flex flex-wrap gap-1.5">
              {(options.recipientRoles ?? []).map((r) => {
                const on = form.recipientRoles.includes(r.value)
                return (
                  <button
                    key={r.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleRole(r.value)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                      on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    {r.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-slate-600">These people</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {form.recipientUsers.map((id) => {
                const person = people.find((p) => p.value === id)
                return (
                  <span key={id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-2.5 pr-1 text-xs text-slate-700">
                    {person?.label ?? 'Unknown user'}
                    <button
                      type="button"
                      aria-label={`Remove ${person?.label ?? 'person'}`}
                      onClick={() => setWho('recipientUsers', form.recipientUsers.filter((x) => x !== id))}
                      className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )
              })}
              <Select
                value=""
                aria-label="Add a person"
                className="h-8 w-auto text-xs"
                onChange={(e) => {
                  if (e.target.value) setWho('recipientUsers', [...form.recipientUsers, e.target.value])
                }}
              >
                <option value="">+ Add a person…</option>
                {people
                  .filter((p) => !form.recipientUsers.includes(p.value))
                  .map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label} · {p.role}
                    </option>
                  ))}
              </Select>
            </div>
          </div>
          {(errors.recipients || errors.recipientRoles || errors.recipientUsers) && (
            <p className="text-[11px] font-medium text-red-600">{errors.recipients || errors.recipientRoles || errors.recipientUsers}</p>
          )}
        </div>

        {untouched && (
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Alert after" required error={errors.offsetMinutes} hint={`Working time since assignment (${hours}) with no call, message or stage change.`}>
              <DelayInput min={1} value={offset} onChange={(v) => { setOffset(v); setErrors((er) => ({ ...er, offsetMinutes: '' })) }} />
            </FormField>
            <FormField label="Early nudge after" error={errors.earlyOffsetMinutes} hint="Optional, shorter than the alert. 0 = no nudge.">
              <DelayInput min={0} value={early} onChange={(v) => { setEarly(v); setErrors((er) => ({ ...er, earlyOffsetMinutes: '' })) }} />
            </FormField>
          </div>
        )}

        {/* one channel at a time */}
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div role="tablist" className="flex border-b border-slate-200 bg-slate-50">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  '-mb-px flex flex-1 items-center justify-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                  tab === t.key ? 'border-brand-600 bg-white text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
                )}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
                <span className={cn('h-1.5 w-1.5 rounded-full', form[t.toggle] ? 'bg-emerald-500' : 'bg-slate-300')} title={form[t.toggle] ? 'On' : 'Off'} />
              </button>
            ))}
          </div>

          <div className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                {tab === 'email'
                  ? "To the counsellor's email, with the lead's details and a button."
                  : tab === 'sms'
                    ? dlt
                      ? "To the counsellor's mobile. The DLT template must match this text."
                      : "To the counsellor's mobile (users without a number are skipped)."
                    : "Always in the counsellor's bell; switched on, it is also pushed to their devices."}
              </p>
              <label className="flex shrink-0 items-center gap-2 text-xs font-medium text-slate-700">
                <Switch checked={on} onChange={(v) => set(current.toggle, v)} label={`${current.label} on`} />
                {on ? 'On' : 'Off'}
              </label>
            </div>

            <div className={cn('space-y-3', !on && 'opacity-60')}>
              {placeholders.length > 0 && (
                <Select
                  value=""
                  aria-label="Insert a field"
                  className="w-auto"
                  onChange={(e) => {
                    if (e.target.value) insert(e.target.value)
                  }}
                >
                  <option value="">+ Insert a field…</option>
                  {placeholders.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label} (e.g. {p.sample})
                    </option>
                  ))}
                </Select>
              )}

              {tab === 'email' && (
                <>
                  <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
                    <FormField label="Subject" required={form.emailEnabled} error={errors.emailSubject}>
                      <Input name="emailSubject" value={form.emailSubject} onFocus={remember} onChange={(e) => set('emailSubject', e.target.value)} maxLength={200} />
                    </FormField>
                    <FormField label="Button text" error={errors.ctaLabel}>
                      <Input value={form.ctaLabel} onChange={(e) => set('ctaLabel', e.target.value)} maxLength={40} placeholder="Open in CRM" />
                    </FormField>
                  </div>
                  <FormField label="Message" required={form.emailEnabled} error={errors.emailBody} hint="Blank lines start a new paragraph; lines starting with • become a list.">
                    <Textarea name="emailBody" rows={8} value={form.emailBody} onFocus={remember} onChange={(e) => set('emailBody', e.target.value)} />
                  </FormField>
                  <Preview lines={[fill(form.emailSubject, samples), fill(form.emailBody, samples)]} />
                </>
              )}

              {tab === 'sms' && (
                <>
                  <FormField label="Message" required={form.smsEnabled} error={errors.smsBody}>
                    <Textarea name="smsBody" rows={3} value={form.smsBody} onFocus={remember} onChange={(e) => set('smsBody', e.target.value)} maxLength={500} />
                  </FormField>
                  <Preview lines={[smsPreview]} note={`${smsPreview.length} characters`} />
                  <div className="rounded-lg border border-slate-200">
                    <button type="button" onClick={() => setDltOpen((o) => !o)} aria-expanded={dltOpen} className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-slate-600">
                      <span>
                        DLT settings
                        {!dltOpen && (form.smsSenderId || form.smsDltTemplateId) ? (
                          <span className="ml-1.5 font-normal text-slate-400">
                            {[form.smsSenderId, form.smsDltTemplateId].filter(Boolean).join(' · ')}
                          </span>
                        ) : null}
                        {dlt && !(form.smsSenderId && form.smsDltTemplateId) && <span className="ml-1.5 font-normal text-amber-700">needed before SMS can go out</span>}
                      </span>
                      <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', dltOpen && 'rotate-180')} />
                    </button>
                    {dltOpen && (
                      <div className="grid gap-3 border-t border-slate-200 p-3 sm:grid-cols-3">
                        <FormField label="Sender id" required={form.smsEnabled && dlt} error={errors.smsSenderId}>
                          <Input value={form.smsSenderId ?? ''} onChange={(e) => set('smsSenderId', e.target.value)} maxLength={20} placeholder="GCCKCG" />
                        </FormField>
                        <FormField label="Template id" required={form.smsEnabled && dlt} error={errors.smsDltTemplateId}>
                          <Input value={form.smsDltTemplateId ?? ''} onChange={(e) => set('smsDltTemplateId', e.target.value)} maxLength={40} />
                        </FormField>
                        <FormField label="Type" error={errors.smsDltType}>
                          <Select value={form.smsDltType} onChange={(e) => set('smsDltType', e.target.value as 'implicit' | 'explicit')}>
                            {(options.dltTypes ?? ['implicit', 'explicit']).map((t) => (
                              <option key={t} value={t}>
                                {t === 'implicit' ? 'Service (any hour)' : 'Promotional (10 am–9 pm)'}
                              </option>
                            ))}
                          </Select>
                        </FormField>
                      </div>
                    )}
                  </div>
                </>
              )}

              {tab === 'push' && (
                <>
                  <FormField label="Title" required error={errors.pushTitle}>
                    <Input name="pushTitle" value={form.pushTitle} onFocus={remember} onChange={(e) => set('pushTitle', e.target.value)} maxLength={300} />
                  </FormField>
                  <FormField label="Message" error={errors.pushBody}>
                    <Textarea name="pushBody" rows={3} value={form.pushBody} onFocus={remember} onChange={(e) => set('pushBody', e.target.value)} maxLength={500} />
                  </FormField>
                  <Preview lines={[fill(form.pushTitle, samples), fill(form.pushBody, samples)]} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </Drawer>
      {filterOpen && (
        <LeadFilterPanel open onClose={() => setFilterOpen(false)} fields={fields} value={form.conditions} onApply={(next) => set('conditions', next)} />
      )}
      <ConfirmDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={onDelete}
        title="Delete alert"
        message={`Delete "${alert.label}"? It stops at once; the alerts it already sent stay in people's bells.`}
        confirmLabel="Delete"
        danger
        loading={removing}
      />
    </>
  )
}

/**
 * Communication → Automation → Team alerts (its own view beside the lead automations): the follow-up reminder,
 * untouched-lead and new-lead-assigned alerts, and the ones added here (`adding`: the toolbar's Add alert) — who gets
 * them (the counsellor, roles, people), wording, channels and windows editable in one place.
 */
export function StaffAlertsSection({ adding = false, onAddClose }: { adding?: boolean; onAddClose?: () => void }) {
  const user = useCurrentUser()
  const editable = can(user, 'automation', 'edit')
  const { data, isLoading } = useListStaffAlertsQuery()
  const [update] = useUpdateStaffAlertMutation()
  const [editing, setEditing] = useState<StaffAlertRow | null>(null)
  const [switching, setSwitching] = useState<string | null>(null)

  const toggle = async (row: StaffAlertRow) => {
    const key = row.trigger ?? row._id
    setSwitching(key)
    try {
      const res = await update({ trigger: key, body: { isActive: !row.isActive } }).unwrap()
      toast.success(res.message)
    } catch (err) {
      toast.error(parseApiError(err).message)
    } finally {
      setSwitching(null)
    }
  }

  if (isLoading || !data) return <Skeleton className="h-32 w-full" />
  return (
    <>
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {data.data.items.map((row) => {
          const Icon = row.trigger ? (ICON[row.trigger] ?? CalendarClock) : Zap
          const key = row.trigger ?? row._id
          const channels = [row.emailEnabled && 'Email', row.smsEnabled && 'SMS', row.pushEnabled && 'Push'].filter(Boolean).join(' · ')
          return (
            <li
              key={key}
              className={cn('group flex items-center gap-3 px-4 py-3', editable && 'cursor-pointer hover:bg-slate-50', !row.isActive && 'bg-slate-50/60')}
              onClick={() => editable && setEditing(row)}
            >
              <span className={cn('rounded-lg p-2', row.isActive ? 'bg-brand-50 text-brand-600' : 'bg-slate-100 text-slate-400')}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn('truncate text-sm font-medium', row.isActive ? 'text-slate-800' : 'text-slate-500')} title={row.when}>
                  {row.label}
                </p>
                <p className="truncate text-xs text-slate-500" title={row.updatedBy ? `Changed by ${row.updatedBy} · ${formatDateTime(row.updatedAt)}` : 'Default wording'}>
                  To {row.recipientsText ?? 'Counsellor'}
                  <span className="text-slate-300"> · </span>
                  {channels || 'no channel on'}
                </p>
              </div>
              {editable && (
                <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Switch checked={row.isActive} onChange={() => toggle(row)} loading={switching === key} label={`${row.isActive ? 'Switch off' : 'Switch on'} ${row.label}`} />
                  <Button size="icon" variant="ghost" className="text-slate-400 group-hover:text-slate-600" title="Edit" aria-label={`Edit ${row.label}`} onClick={() => setEditing(row)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {editing && <StaffAlertDrawer alert={editing} options={data.data} onClose={() => setEditing(null)} />}
      {adding && <StaffAlertDrawer alert={newAlert(data.data)} isNew options={data.data} onClose={() => onAddClose?.()} />}
    </>
  )
}
