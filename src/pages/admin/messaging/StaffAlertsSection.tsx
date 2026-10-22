import { useRef, useState } from 'react'
import { AlertTriangle, CalendarClock, Send, UserPlus, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useCurrentUser } from '../../../app/hooks'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Drawer } from '../../../components/ui/Drawer'
import { Skeleton } from '../../../components/ui/feedback'
import { FormField, Input, Select, Switch, Textarea } from '../../../components/ui/fields'
import { can } from '../../../constants/permissions'
import { cn, formatDateTime, parseApiError } from '../../../lib/utils'
import { useListStaffAlertsQuery, useTestStaffAlertMutation, useUpdateStaffAlertMutation } from '../../../services/messagingApi'
import type { StaffAlertBody, StaffAlertRow, StaffAlertTestResult, StaffAlertTrigger, StaffAlertsResponse } from '../../../types/models'
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

function ChannelHeader({ title, hint, checked, onChange }: { title: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
        <p className="text-[11px] text-slate-500">{hint}</p>
      </div>
      <label className="flex shrink-0 items-center gap-2 text-xs text-slate-700">
        <Switch checked={checked} onChange={onChange} label={`${title} on`} />
        {checked ? 'On' : 'Off'}
      </label>
    </div>
  )
}

function Preview({ label, lines, note }: { label: string; lines: string[]; note?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
      <p className="mb-1 text-[11px] text-slate-500">
        {label} · with sample values{note ? ` · ${note}` : ''}
      </p>
      {lines.map((line, i) => (
        <p key={i} className={cn('whitespace-pre-wrap text-xs text-slate-800', i === 0 && lines.length > 1 && 'mb-1 font-medium')}>
          {line || <span className="text-slate-400">—</span>}
        </p>
      ))}
    </div>
  )
}

function StaffAlertDrawer({ alert, options, onClose }: { alert: StaffAlertRow; options: StaffAlertsResponse; onClose: () => void }) {
  const [update, { isLoading: saving }] = useUpdateStaffAlertMutation()
  const [sendTest, { isLoading: testing }] = useTestStaffAlertMutation()
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
  })
  const [offset, setOffset] = useState(splitDelay(alert.offsetMinutes))
  const [early, setEarly] = useState(alert.earlyOffsetMinutes ? splitDelay(alert.earlyOffsetMinutes) : { amount: 0, unit: 1 })
  const [errors, setErrors] = useState<Record<string, string>>({})
  // the text box the cursor was last in — where a placeholder chip inserts
  const focused = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

  const placeholders = options.placeholders[alert.trigger] ?? []
  const samples: Record<string, string> = Object.fromEntries(placeholders.map((p) => [p.key, p.sample]))
  const untouched = alert.trigger === 'lead_untouched'
  const dlt = options.smsProvider === 'webinfosys'
  const hours = `${options.workingHours.start}–${options.workingHours.end} ${dayRange(options.workingHours.days)}`

  const set = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== key)))
  }
  const remember = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    focused.current = e.target
  }
  const insert = (key: string) => {
    const field = focused.current
    const target = field?.name as TextKey | undefined
    const snippet = `{{${key}}}`
    if (!field || !target) {
      toast.info('Click into a text box first, then the placeholder')
      return
    }
    const start = field.selectionStart ?? field.value.length
    const end = field.selectionEnd ?? start
    set(target, field.value.slice(0, start) + snippet + field.value.slice(end))
    requestAnimationFrame(() => {
      field.focus()
      field.selectionStart = field.selectionEnd = start + snippet.length
    })
  }

  const body = (): StaffAlertBody => ({
    ...form,
    smsSenderId: form.smsSenderId || null,
    smsDltTemplateId: form.smsDltTemplateId || null,
    offsetMinutes: joinDelay(offset.amount, offset.unit),
    earlyOffsetMinutes: early.amount > 0 ? joinDelay(early.amount, early.unit) : null,
  })

  const onSave = async () => {
    try {
      const res = await update({ trigger: alert.trigger, body: body() }).unwrap()
      toast.success(res.message)
      onClose()
    } catch (err) {
      const parsed = parseApiError(err)
      setErrors(parsed.errors)
      toast.error(parsed.message)
    }
  }
  const onTest = async () => {
    try {
      const res = await sendTest({ trigger: alert.trigger, body: body() }).unwrap()
      toast.success(`Test sent to you: ${describeTest(res.data)}`)
    } catch (err) {
      const parsed = parseApiError(err)
      setErrors(parsed.errors)
      toast.error(parsed.message)
    }
  }

  const smsPreview = fill(form.smsBody, samples)

  return (
    <Drawer
      open
      onClose={onClose}
      wide
      title={`Counsellor alert · ${alert.label}`}
      description="The wording and channels of this alert. {{Placeholders}} are filled from the lead / follow-up when it is sent; a missing value is removed, never sent raw."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="outline" onClick={onTest} loading={testing} title="Sends this draft to you with the sample values, on every channel that is on">
            <Send className="h-3.5 w-3.5" /> Send test to me
          </Button>
          <Button onClick={onSave} loading={saving}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <section className="space-y-3 rounded-xl border border-slate-200 p-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">When</p>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <Switch checked={form.isActive} onChange={(v) => set('isActive', v)} label="Active" /> {form.isActive ? 'Active' : 'Switched off'}
            </label>
          </div>
          {untouched ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Alert after" required error={errors.offsetMinutes} hint={`Working time since the lead was assigned (${hours}), with no call, message or stage change by the counsellor.`}>
                <div className="flex gap-2">
                  <Input type="number" min={1} value={offset.amount} onChange={(e) => { setOffset((d) => ({ ...d, amount: Number(e.target.value) })); setErrors((er) => ({ ...er, offsetMinutes: '' })) }} />
                  <Select value={offset.unit} onChange={(e) => setOffset((d) => ({ ...d, unit: Number(e.target.value) }))}>
                    {DELAY_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </FormField>
              <FormField label="Early nudge after" error={errors.earlyOffsetMinutes} hint="Optional, shorter than the alert — the same wording with the time filled in. 0 = no nudge.">
                <div className="flex gap-2">
                  <Input type="number" min={0} value={early.amount} onChange={(e) => { setEarly((d) => ({ ...d, amount: Number(e.target.value) })); setErrors((er) => ({ ...er, earlyOffsetMinutes: '' })) }} />
                  <Select value={early.unit} onChange={(e) => setEarly((d) => ({ ...d, unit: Number(e.target.value) }))}>
                    {DELAY_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </Select>
                </div>
              </FormField>
            </div>
          ) : (
            <p className="text-sm text-slate-700">
              {alert.when}
              {alert.trigger === 'follow_up_reminder' && (
                <span className="block text-xs text-slate-500">
                  The time comes from each follow-up ({options.reminderOptions.map((m) => (m >= 60 ? `${m / 60} h` : `${m} min`)).join(' / ')}); use{' '}
                  {'{{Reminder_Lead_Time}}'} in the text so it always reads right.
                </span>
              )}
            </p>
          )}
        </section>

        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-3">
          <p className="mb-1.5 text-[11px] text-slate-500">Placeholders — click into a text box, then a chip to insert it at the cursor</p>
          <div className="flex flex-wrap gap-1">
            {placeholders.map((p) => (
              <button
                key={p.key}
                type="button"
                title={`${p.label} · e.g. ${p.sample}`}
                onClick={() => insert(p.key)}
                className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-700 ring-1 ring-slate-200 hover:bg-brand-50 hover:text-brand-700"
              >
                {`{{${p.key}}}`}
              </button>
            ))}
          </div>
        </div>

        <section className="space-y-3 rounded-xl border border-slate-200 p-3">
          <ChannelHeader title="Email" hint="To the counsellor's email address, in the CRM frame with the lead's details and a button." checked={form.emailEnabled} onChange={(v) => set('emailEnabled', v)} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
            <FormField label="Subject" required={form.emailEnabled} error={errors.emailSubject}>
              <Input name="emailSubject" value={form.emailSubject} onFocus={remember} onChange={(e) => set('emailSubject', e.target.value)} maxLength={200} />
            </FormField>
            <FormField label="Button text" error={errors.ctaLabel}>
              <Input value={form.ctaLabel} onChange={(e) => set('ctaLabel', e.target.value)} maxLength={40} placeholder="Open in CRM" />
            </FormField>
          </div>
          <FormField label="Email text" required={form.emailEnabled} error={errors.emailBody} hint="Plain text: blank lines separate paragraphs, lines starting with • become a list.">
            <Textarea name="emailBody" rows={11} value={form.emailBody} onFocus={remember} onChange={(e) => set('emailBody', e.target.value)} />
          </FormField>
          <Preview label="Email" lines={[fill(form.emailSubject, samples), fill(form.emailBody, samples)]} />
        </section>

        <section className="space-y-3 rounded-xl border border-slate-200 p-3">
          <ChannelHeader
            title="SMS"
            hint={dlt ? 'To the counsellor\'s mobile through the DLT-registered sender — the approved template must match this text (a {#var#} where each placeholder is).' : 'To the counsellor\'s mobile (users without a number are skipped).'}
            checked={form.smsEnabled}
            onChange={(v) => set('smsEnabled', v)}
          />
          <FormField label="SMS text" required={form.smsEnabled} error={errors.smsBody}>
            <Textarea name="smsBody" rows={3} value={form.smsBody} onFocus={remember} onChange={(e) => set('smsBody', e.target.value)} maxLength={500} />
          </FormField>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <FormField label="DLT sender id" required={form.smsEnabled && dlt} error={errors.smsSenderId}>
              <Input value={form.smsSenderId ?? ''} onChange={(e) => set('smsSenderId', e.target.value)} maxLength={20} placeholder="GCCKCG" />
            </FormField>
            <FormField label="DLT template id" required={form.smsEnabled && dlt} error={errors.smsDltTemplateId}>
              <Input value={form.smsDltTemplateId ?? ''} onChange={(e) => set('smsDltTemplateId', e.target.value)} maxLength={40} />
            </FormField>
            <FormField label="DLT type" error={errors.smsDltType}>
              <Select value={form.smsDltType} onChange={(e) => set('smsDltType', e.target.value as 'implicit' | 'explicit')}>
                {(options.dltTypes ?? ['implicit', 'explicit']).map((t) => (
                  <option key={t} value={t}>
                    {t === 'implicit' ? 'Implicit (service — any hour)' : 'Explicit (promotional — 10 am to 9 pm)'}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <Preview label="SMS" lines={[smsPreview]} note={`${smsPreview.length} characters`} />
        </section>

        <section className="space-y-3 rounded-xl border border-slate-200 p-3">
          <ChannelHeader title="In-app & push" hint="Always in the counsellor's bell; the switch also pushes it to their registered devices." checked={form.pushEnabled} onChange={(v) => set('pushEnabled', v)} />
          <FormField label="Title" required error={errors.pushTitle}>
            <Input name="pushTitle" value={form.pushTitle} onFocus={remember} onChange={(e) => set('pushTitle', e.target.value)} maxLength={300} />
          </FormField>
          <FormField label="Message" error={errors.pushBody}>
            <Textarea name="pushBody" rows={3} value={form.pushBody} onFocus={remember} onChange={(e) => set('pushBody', e.target.value)} maxLength={500} />
          </FormField>
          <Preview label="Notification" lines={[fill(form.pushTitle, samples), fill(form.pushBody, samples)]} />
        </section>
      </div>
    </Drawer>
  )
}

/**
 * Communication → Automation → Counsellor alerts: the follow-up reminder, untouched-lead and new-lead-assigned
 * alerts — wording, channels and windows editable in one place; the timing itself stays dynamic.
 */
export function StaffAlertsSection() {
  const user = useCurrentUser()
  const editable = can(user, 'automation', 'edit')
  const { data, isLoading } = useListStaffAlertsQuery()
  const [update] = useUpdateStaffAlertMutation()
  const [editing, setEditing] = useState<StaffAlertRow | null>(null)
  const [switching, setSwitching] = useState<string | null>(null)

  const toggle = async (row: StaffAlertRow) => {
    setSwitching(row.trigger)
    try {
      const res = await update({ trigger: row.trigger, body: { isActive: !row.isActive } }).unwrap()
      toast.success(res.message)
    } catch (err) {
      toast.error(parseApiError(err).message)
    } finally {
      setSwitching(null)
    }
  }

  return (
    <section className="mb-6">
      <h2 className="text-sm font-semibold text-slate-800">Counsellor alerts</h2>
      <p className="mb-3 text-xs text-slate-500">
        What a counsellor gets — in the bell, as a push, by email and by SMS — before a follow-up, when a new lead sits untouched, and when a lead is
        assigned. The wording is yours; the timing follows each follow-up's reminder and the windows set here.
      </p>
      {isLoading || !data ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {data.data.items.map((row) => {
            const Icon = ICON[row.trigger] ?? CalendarClock
            return (
              <div key={row.trigger} className={cn('flex flex-col rounded-xl border bg-white p-3 shadow-sm', row.isActive ? 'border-slate-200' : 'border-dashed border-slate-300')}>
                <div className="flex items-start justify-between gap-2">
                  <button type="button" className="flex items-center gap-2 text-left font-medium text-slate-800 hover:text-brand-700" onClick={() => editable && setEditing(row)}>
                    <Icon className="h-4 w-4 shrink-0 text-brand-600" />
                    {row.label}
                  </button>
                  {editable && <Switch checked={row.isActive} onChange={() => toggle(row)} loading={switching === row.trigger} label={`${row.isActive ? 'Switch off' : 'Switch on'} ${row.label}`} />}
                </div>
                <p className="mt-1 text-xs text-slate-500">{row.when}</p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge tone={row.isActive ? 'green' : 'slate'} dot>
                    {row.isActive ? 'Active' : 'Off'}
                  </Badge>
                  <Badge tone={row.emailEnabled ? 'violet' : 'slate'}>Email</Badge>
                  <Badge tone={row.smsEnabled ? 'blue' : 'slate'}>SMS</Badge>
                  <Badge tone={row.pushEnabled ? 'cyan' : 'slate'}>Push</Badge>
                </div>
                <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-[11px] text-slate-500">
                  <span className="truncate">{row.updatedBy ? `${row.updatedBy} · ${formatDateTime(row.updatedAt)}` : 'Default wording'}</span>
                  {editable && (
                    <Button size="sm" variant="ghost" onClick={() => setEditing(row)}>
                      Edit
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
      {editing && data && <StaffAlertDrawer alert={editing} options={data.data} onClose={() => setEditing(null)} />}
    </section>
  )
}
