import { useRef, useState } from 'react'
import { BellRing, ChevronDown, Filter, Mail, MessageSquareText, Send, Trash2, X, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../../components/ui/Button'
import { Drawer } from '../../../components/ui/Drawer'
import { ConfirmDialog } from '../../../components/ui/feedback'
import { Checkbox, FormField, Input, Select, Switch, Textarea } from '../../../components/ui/fields'
import { cn, parseApiError } from '../../../lib/utils'
import { useFilterFieldsQuery } from '../../../services/leadsApi'
import {
  useCreateStaffAlertMutation,
  useDeleteStaffAlertMutation,
  useTestStaffAlertMutation,
  useUpdateStaffAlertMutation,
} from '../../../services/messagingApi'
import type { StaffAlertBody, StaffAlertRow, StaffAlertsResponse } from '../../../types/models'
import { LeadFilterPanel } from '../../leads/LeadFilterPanel'
import { describeCondition } from './automationText'
import { DELAY_UNITS, joinDelay, splitDelay } from './automationTime'
import { CHANNEL_FIELDS, capabilitiesOf, dayRange, describeTest, errorChannel, fill, kindOf, needsDlt, type ChannelTab } from './notifications'

/** the text fields a placeholder can be inserted into (the `name` attribute of each box) */
type TextKey = 'emailSubject' | 'emailBody' | 'smsBody' | 'pushTitle' | 'pushBody'
type Form = Required<Omit<StaffAlertBody, 'offsetMinutes' | 'earlyOffsetMinutes'>>

/** Opened from a refused inline switch: start on that channel's tab with the switch already flipped and the errors shown. */
export interface DrawerPrefill {
  tab?: ChannelTab
  body?: StaffAlertBody
  errors?: Record<string, string>
}

// one tab per channel: its switch, its text boxes (the last one takes an inserted field when no box was clicked)
const TABS: { key: ChannelTab; label: string; icon: LucideIcon; toggle: 'emailEnabled' | 'smsEnabled' | 'pushEnabled'; boxes: TextKey[] }[] = [
  { key: 'email', label: 'Email', icon: Mail, toggle: 'emailEnabled', boxes: ['emailSubject', 'emailBody'] },
  { key: 'sms', label: 'SMS', icon: MessageSquareText, toggle: 'smsEnabled', boxes: ['smsBody'] },
  { key: 'push', label: 'Bell & push', icon: BellRing, toggle: 'pushEnabled', boxes: ['pushTitle', 'pushBody'] },
]

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

/** The row as the form holds it, with a prefilled body (a flipped switch) laid over it. */
function initialForm(alert: StaffAlertRow, body?: StaffAlertBody): Form {
  const base: Form = {
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
  }
  if (!body) return base
  const timing = ['offsetMinutes', 'earlyOffsetMinutes']
  const overlay = Object.fromEntries(Object.entries(body).filter(([k, v]) => v !== undefined && !timing.includes(k))) as Partial<Form>
  return { ...base, ...overlay, smsSenderId: overlay.smsSenderId ?? base.smsSenderId ?? '', smsDltTemplateId: overlay.smsDltTemplateId ?? base.smsDltTemplateId ?? '' }
}

/**
 * The editor of one alert rule: who gets it, the untouched windows, and one tab per channel with its switch, text
 * and preview. What it shows follows the row's capabilities — an account email is an Email tab only, with no on/off
 * and no recipients; a fixed-audience alert has no "Who gets it". Used by Automation → Team alerts and by
 * Communication → Notifications (which may open it on a channel with a refused switch already flipped: `prefill`).
 */
export function StaffAlertDrawer({ alert, isNew, options, onClose, prefill }: {
  alert: StaffAlertRow
  isNew?: boolean
  options: StaffAlertsResponse
  onClose: () => void
  prefill?: DrawerPrefill
}) {
  const [update, { isLoading: updating }] = useUpdateStaffAlertMutation()
  const [create, { isLoading: creating }] = useCreateStaffAlertMutation()
  const [remove, { isLoading: removing }] = useDeleteStaffAlertMutation()
  const [sendTest, { isLoading: testing }] = useTestStaffAlertMutation()
  const { data: meta } = useFilterFieldsQuery()
  const caps = capabilitiesOf(alert, isNew)
  const account = kindOf(alert) === 'account'
  const custom = !alert.trigger // added in the CRM (or being added): name, event and conditions are its own
  // the API's key: a built-in trigger, an added alert's id, or "custom" for one not saved yet (Send test)
  const key = alert.trigger ?? (isNew ? 'custom' : alert._id)
  const fields = meta?.data.fields ?? []
  const tabs = TABS.filter((t) => caps[t.key])
  const [filterOpen, setFilterOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState<Form>(() => initialForm(alert, prefill?.body))
  const [offset, setOffset] = useState(splitDelay(alert.offsetMinutes))
  const [early, setEarly] = useState(alert.earlyOffsetMinutes ? splitDelay(alert.earlyOffsetMinutes) : { amount: 0, unit: 1 })
  const [errors, setErrors] = useState<Record<string, string>>(prefill?.errors ?? {})
  const [tab, setTab] = useState<ChannelTab>(() => {
    if (prefill?.tab && tabs.some((t) => t.key === prefill.tab)) return prefill.tab
    const on = tabs.find((t) => alert[t.toggle])
    return (on ?? tabs[0] ?? TABS[0]).key
  })
  const [dltOpen, setDltOpen] = useState(() => needsDlt(prefill?.errors ?? {}))
  // the text box the cursor was last in — where "Insert a field" puts the placeholder
  const focused = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

  const placeholders = options.placeholders[alert.trigger ?? 'custom'] ?? []
  const samples: Record<string, string> = Object.fromEntries(placeholders.map((p) => [p.key, p.sample]))
  const untouched = alert.trigger === 'lead_untouched'
  const dlt = options.smsProvider === 'webinfosys'
  const hours = `${options.workingHours.start}–${options.workingHours.end} ${dayRange(options.workingHours.days)}`
  const current = tabs.find((t) => t.key === tab) ?? tabs[0] ?? TABS[0]
  const subject = alert.subjectLabel ?? (alert.trigger === 'follow_up_reminder' ? "The follow-up's counsellor" : "The lead's counsellor")

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

  /** What is sent: only the parts this row shows (a hidden channel, a fixed audience or an account email's timing stay out). */
  const body = (): StaffAlertBody => {
    const { name, event, conditions, ...rest } = form
    const out: StaffAlertBody = {
      ...rest,
      // a built-in alert's timing is its own: only an added one has a name, an event and conditions
      ...(custom ? { name, event, conditions } : {}),
      smsSenderId: form.smsSenderId || null,
      smsDltTemplateId: form.smsDltTemplateId || null,
      offsetMinutes: joinDelay(offset.amount, offset.unit),
      earlyOffsetMinutes: early.amount > 0 ? joinDelay(early.amount, early.unit) : null,
    }
    for (const t of TABS) {
      if (!caps[t.key]) for (const field of CHANNEL_FIELDS[t.key]) delete out[field as keyof StaffAlertBody]
    }
    if (!caps.recipients) {
      delete out.notifyOwner
      delete out.recipientRoles
      delete out.recipientUsers
    }
    if (!caps.toggle) delete out.isActive
    if (account) {
      delete out.offsetMinutes
      delete out.earlyOffsetMinutes
    }
    return out
  }

  /** A refusal names its fields: open the tab (and the DLT settings) that holds the first one. */
  const showErrors = (fieldErrors: Record<string, string>) => {
    setErrors(fieldErrors)
    const holder = errorChannel(fieldErrors)
    if (holder && tabs.some((t) => t.key === holder)) setTab(holder)
    if (needsDlt(fieldErrors)) setDltOpen(true)
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
            : (alert.description ?? alert.when)
      }
      footer={
        <>
          {caps.delete && !isNew && (
            <Button variant="ghost" className="mr-auto text-red-600" onClick={() => setDeleting(true)}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {caps.test && (
            <Button variant="outline" onClick={onTest} loading={testing} title="Sends this draft to you with sample values, on every channel that is on">
              <Send className="h-3.5 w-3.5" /> Send test to me
            </Button>
          )}
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
        {caps.toggle ? (
          <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3">
            <span>
              <span className="block text-sm font-medium text-slate-800">{form.isActive ? 'This alert is on' : 'This alert is off'}</span>
              <span className="block text-xs text-slate-500">{form.isActive ? 'It goes out on the channels switched on below.' : 'Nothing is sent until it is switched on.'}</span>
            </span>
            <Switch checked={form.isActive} onChange={(v) => set('isActive', v)} label="Alert on" />
          </label>
        ) : (
          <p className="rounded-xl border border-slate-200 px-4 py-3 text-xs text-slate-500">
            {account ? 'Always sent, by email only, to the user it concerns. Edit the wording below.' : 'Always on.'}
          </p>
        )}

        {/* who gets it: the person it is about, roles, people */}
        {caps.recipients && (
          <div className="space-y-3 rounded-xl border border-slate-200 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-800">Who gets it</p>
              <p className="text-xs text-slate-500">People in a role or added by name get it — about a lead, only when they can open that lead.</p>
            </div>
            {caps.owner && (
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <Checkbox checked={form.notifyOwner} onChange={(e) => setWho('notifyOwner', e.target.checked)} />
                {subject}
              </label>
            )}
            {alert.trigger === 'whatsapp_reply' && (
              <p className="-mt-1.5 text-[11px] text-slate-500">A reply on an unassigned lead goes to the Admins when nobody else is chosen.</p>
            )}
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
        )}
        {!caps.recipients && !account && (
          <p className="rounded-xl border border-slate-200 px-4 py-3 text-xs text-slate-500">
            Goes to {(alert.subjectLabel ?? 'the person it concerns').toLowerCase()} only.
          </p>
        )}

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
          {tabs.length > 1 ? (
            <div role="tablist" className="flex border-b border-slate-200 bg-slate-50">
              {tabs.map((t) => (
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
          ) : (
            <div className="flex items-center gap-1.5 border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-brand-700">
              <current.icon className="h-3.5 w-3.5" />
              {current.label}
            </div>
          )}

          <div className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                {account
                  ? "To the user's own email address, with the links clickable."
                  : tab === 'email'
                    ? "To the person's email, with the lead's details and a button."
                    : tab === 'sms'
                      ? dlt
                        ? "To the person's mobile. The DLT template must match this text."
                        : "To the person's mobile (users without a number are skipped)."
                      : "Always in the person's bell; switched on, it is also pushed to their devices."}
              </p>
              {caps.toggle && (
                <label className="flex shrink-0 items-center gap-2 text-xs font-medium text-slate-700">
                  <Switch checked={on} onChange={(v) => set(current.toggle, v)} label={`${current.label} on`} />
                  {on ? 'On' : 'Off'}
                </label>
              )}
            </div>

            <div className={cn('space-y-3', !on && caps.toggle && 'opacity-60')}>
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
                    {!account && (
                      <FormField label="Button text" error={errors.ctaLabel}>
                        <Input value={form.ctaLabel} onChange={(e) => set('ctaLabel', e.target.value)} maxLength={40} placeholder="Open in CRM" />
                      </FormField>
                    )}
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
