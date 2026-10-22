import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, CalendarClock, Check, Filter, Mail, MessageCircle, MessageSquareText, Sparkles, Users, Zap, type LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../../components/ui/Button'
import { Drawer } from '../../../components/ui/Drawer'
import { FormField, Input, Select, Switch } from '../../../components/ui/fields'
import { cn, parseApiError } from '../../../lib/utils'
import { useFilterFieldsQuery } from '../../../services/leadsApi'
import {
  useCreateAutomationMutation,
  useListMessageTemplatesQuery,
  useMessagingOptionsQuery,
  usePreviewAutomationAudienceMutation,
  useUpdateAutomationMutation,
} from '../../../services/messagingApi'
import type { AutomationBody, AutomationRow, FilterCondition } from '../../../types/models'
import { DltVariableFields } from '../../leads/DltVariableFields'
import { LeadFilterPanel } from '../../leads/LeadFilterPanel'
import { DELAY_UNITS, joinDelay, splitDelay } from './automationTime'
import { CHANNEL_LABEL, STARTERS, WEEKDAY_LABELS, describeCondition, ruleSentence, suggestName, type Channel, type Recurrence, type Starter } from './automationText'

const CHANNELS: { key: Channel; icon: LucideIcon; hint: string }[] = [
  { key: 'sms', icon: MessageSquareText, hint: 'DLT-approved templates' },
  { key: 'whatsapp', icon: MessageCircle, hint: 'Templates Meta approved' },
  { key: 'email', icon: Mail, hint: 'Email templates' },
]
const RECURRENCES: { key: Recurrence; label: string }[] = [
  { key: 'once', label: 'Once' },
  { key: 'daily', label: 'Every day' },
  { key: 'weekly', label: 'Every week' },
  { key: 'monthly', label: 'Every month' },
]
const STEPS = [
  { title: 'When', hint: 'What starts it' },
  { title: 'Send', hint: 'Channel and message' },
  { title: 'To whom', hint: 'Leads and name' },
] as const
type Step = 0 | 1 | 2
// which step shows the field a server error names
const STEP_OF: Record<string, Step> = {
  triggerType: 0, event: 0, delayMinutes: 0, recurrence: 0, runAt: 0, weekdays: 0, endAt: 0, channel: 1, template: 1, conditions: 2, name: 2,
}
const stepOf = (key: string): Step => (key.startsWith('variables') ? 1 : (STEP_OF[key] ?? 2))

const pad = (n: number) => String(n).padStart(2, '0')
/** an ISO instant → the "YYYY-MM-DD" and "HH:MM" the browser's date / time inputs take (local time) */
function localParts(iso?: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' }
  const d = new Date(iso)
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` }
}
const toIso = (date: string, time: string) => (date && time ? new Date(`${date}T${time}`).toISOString() : null)
const today = () => localParts(new Date().toISOString()).date

/** A big choice tile: icon, title, one line. */
function ChoiceCard({ active, icon: Icon, title, hint, onClick, disabled }: { active: boolean; icon: LucideIcon; title: string; hint: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'flex items-start gap-3 rounded-xl border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        active ? 'border-brand-500 bg-brand-50/60 ring-1 ring-brand-500' : 'border-slate-200 bg-white hover:border-slate-300'
      )}
    >
      <span className={cn('mt-0.5 rounded-lg p-1.5', active ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500')}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-800">{title}</span>
        <span className="block text-xs text-slate-500">{hint}</span>
      </span>
    </button>
  )
}

/** A row of small toggle buttons; one of them is chosen. */
function Pills<T extends string | number>({ value, options, onChange }: { value: T; options: { key: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={String(o.key)}
          type="button"
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          className={cn(
            'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
            value === o.key ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Question({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {children}
    </div>
  )
}

/**
 * Communication → Automation: create or edit a lead automation in three short steps — When (a lead event, or a
 * schedule), Send (channel + template + its values) and To whom (conditions with a live count, name, on / off) —
 * with the whole rule as one sentence on top. Starters fill step 1 of a new automation. Sends the same body the
 * server has always taken (apps/messaging/automations.py save_automation).
 */
export function AutomationEditor({ automation, onClose }: { automation?: AutomationRow; onClose: () => void }) {
  const { data: options } = useMessagingOptionsQuery()
  const { data: meta } = useFilterFieldsQuery()
  const [create, { isLoading: creating }] = useCreateAutomationMutation()
  const [update, { isLoading: updating }] = useUpdateAutomationMutation()
  const [preview, { data: audience, isLoading: counting }] = usePreviewAutomationAudienceMutation()
  const editing = !!automation

  const [step, setStep] = useState<Step>(0)
  const [name, setName] = useState(automation?.name ?? '')
  const [channel, setChannel] = useState<Channel>(automation?.channel ?? 'sms')
  const [template, setTemplate] = useState(automation?.template?._id ?? '')
  const [variables, setVariables] = useState<string[]>(automation?.variables ?? [])
  const [triggerType, setTriggerType] = useState<'event' | 'schedule'>(automation?.triggerType ?? 'event')
  const [event, setEvent] = useState(automation?.event ?? '')
  const [waits, setWaits] = useState((automation?.delayMinutes ?? 0) > 0)
  const [delay, setDelay] = useState(splitDelay(automation?.delayMinutes || 60))
  const [recurrence, setRecurrence] = useState<Recurrence>(automation?.recurrence ?? 'daily')
  const [run, setRun] = useState(localParts(automation?.runAt))
  const [weekdays, setWeekdays] = useState<number[]>(automation?.weekdays ?? [])
  const [ends, setEnds] = useState(!!automation?.endAt)
  const [endDate, setEndDate] = useState(localParts(automation?.endAt).date)
  const [conditions, setConditions] = useState<FilterCondition[]>(automation?.conditions ?? [])
  const [active, setActive] = useState(automation?.isActive ?? true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [filterOpen, setFilterOpen] = useState(false)

  const { data: templates } = useListMessageTemplatesQuery({ channel, active: true })
  const chosen = templates?.data.find((t) => t._id === template)
  const templated = channel !== 'email'
  const fields = useMemo(() => meta?.data.fields ?? [], [meta])
  const triggers = options?.data.triggers ?? []
  const eventLabel = triggers.find((t) => t.value === event)?.label ?? automation?.eventLabel ?? null
  const sendWindow = options?.data.bulkWindow ?? '09:00-21:00'
  const delayMinutes = waits ? joinDelay(delay.amount, delay.unit) : 0
  const runAt = toIso(run.date, run.time)
  const endAt = recurrence !== 'once' && ends && endDate ? toIso(endDate, '23:59') : null

  const clearError = (...keys: string[]) => setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !keys.includes(k))))

  // the live count: how many leads the conditions reach on this channel right now
  useEffect(() => {
    const handle = setTimeout(() => {
      preview({ channel, conditions }).catch(() => undefined)
    }, 300)
    return () => clearTimeout(handle)
  }, [channel, conditions, preview])

  const rule = {
    triggerType, eventLabel, delayMinutes, recurrence, runAt, weekdays, endAt, channel,
    templateName: chosen?.name ?? automation?.template?.name ?? null, conditions,
  }

  const applyStarter = (s: Starter) => {
    setTriggerType(s.triggerType)
    if (s.triggerType === 'event') {
      setEvent(s.event ?? '')
      setWaits(!!s.delayMinutes)
      if (s.delayMinutes) setDelay(splitDelay(s.delayMinutes))
    } else {
      setRecurrence(s.recurrence ?? 'daily')
      setWeekdays(s.weekdays ?? [])
      setRun({ date: run.date || today(), time: s.time ?? '10:00' })
    }
    setErrors({})
  }
  const pickChannel = (next: Channel) => {
    setChannel(next)
    setTemplate('')
    setVariables([])
    clearError('template', 'channel')
  }
  const pickTemplate = (id: string) => {
    setTemplate(id)
    clearError('template')
    const count = templated ? (templates?.data.find((t) => t._id === id)?.variableCount ?? 0) : 0
    // the same template as before keeps its typed values
    setVariables(id === automation?.template?._id ? (automation?.variables ?? []) : Array.from({ length: count }, () => ''))
  }
  const setVariable = (i: number, value: string) => {
    setVariables((vs) => vs.map((v, j) => (j === i ? value : v)))
    clearError(`variables.${i}`)
  }
  const toggleWeekday = (d: number) => {
    setWeekdays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d].sort()))
    clearError('weekdays')
  }

  /** The checks of one step (the server checks everything again on save). */
  const problems = (s: Step): Record<string, string> => {
    const local: Record<string, string> = {}
    if (s === 0) {
      if (triggerType === 'event') {
        if (!event) local.event = 'Choose what starts it'
        if (waits && delayMinutes <= 0) local.delayMinutes = 'Enter how long to wait'
      } else {
        if (!run.date || !run.time) local.runAt = 'Pick the date and time'
        if (recurrence === 'weekly' && !weekdays.length) local.weekdays = 'Pick at least one day'
        if (recurrence !== 'once' && ends && !endDate) local.endAt = 'Pick the last day, or choose "Never"'
      }
    }
    if (s === 1) {
      if (!template) local.template = `Choose a${channel === 'email' ? 'n' : ''} ${CHANNEL_LABEL[channel]} template`
      variables.forEach((v, i) => {
        if (!v.trim()) local[`variables.${i}`] = `Value ${i + 1} is needed`
      })
    }
    if (s === 2 && !name.trim()) local.name = 'Give the automation a name'
    return local
  }

  const goTo = (target: Step) => {
    // forward only past steps that are complete; back any time
    for (let s = step; s < target; s++) {
      const local = problems(s as Step)
      if (Object.keys(local).length) {
        setErrors(local)
        setStep(s as Step)
        return
      }
    }
    if (target === 2 && !name.trim()) setName(suggestName(rule))
    setErrors({})
    setStep(target)
  }

  const body = (): AutomationBody => ({
    name: name.trim(),
    channel,
    template,
    variables: templated ? variables.map((v) => v.trim()) : [],
    triggerType,
    conditions,
    isActive: active,
    ...(triggerType === 'event'
      ? { event, delayMinutes, recurrence: null, runAt: null, weekdays: [], endAt: null }
      : { event: null, delayMinutes: 0, recurrence, runAt, weekdays: recurrence === 'weekly' ? weekdays : [], endAt }),
  })

  const onSave = async () => {
    const all = { ...problems(0), ...problems(1), ...problems(2) }
    if (Object.keys(all).length) {
      setErrors(all)
      setStep(Math.min(...Object.keys(all).map(stepOf)) as Step)
      return
    }
    try {
      if (automation) await update({ id: automation._id, body: body() }).unwrap()
      else await create(body()).unwrap()
      toast.success(automation ? 'Automation saved' : 'Automation created')
      onClose()
    } catch (err) {
      const parsed = parseApiError(err)
      setErrors(parsed.errors)
      const keys = Object.keys(parsed.errors)
      if (keys.length) setStep(Math.min(...keys.map(stepOf)) as Step)
      toast.error(parsed.message)
    }
  }

  const saving = creating || updating
  return (
    <>
      <Drawer
        open
        onClose={onClose}
        wide
        title={editing ? `Edit · ${automation.name}` : 'New automation'}
        footer={
          <div className="flex w-full items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <div className="ml-auto flex gap-2">
              {step > 0 && (
                <Button variant="outline" onClick={() => goTo((step - 1) as Step)}>
                  <ArrowLeft className="h-3.5 w-3.5" /> Back
                </Button>
              )}
              {step < 2 && (
                <Button variant={editing ? 'outline' : 'primary'} onClick={() => goTo((step + 1) as Step)}>
                  Next <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
              {(step === 2 || editing) && (
                <Button onClick={onSave} loading={saving}>
                  <Check className="h-3.5 w-3.5" /> {editing ? 'Save' : 'Create automation'}
                </Button>
              )}
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          {/* the rule as one sentence, live */}
          <p className="rounded-xl border border-brand-100 bg-brand-50/50 px-4 py-3 text-sm leading-6 text-slate-700">{ruleSentence(rule, fields)}.</p>

          {/* steps: done ones can be reopened */}
          <ol className="grid grid-cols-3 gap-2">
            {STEPS.map((s, i) => {
              const state = i === step ? 'current' : i < step ? 'done' : 'next'
              return (
                <li key={s.title}>
                  <button
                    type="button"
                    onClick={() => goTo(i as Step)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left',
                      state === 'current' ? 'border-brand-500 bg-white ring-1 ring-brand-500' : 'border-slate-200 bg-white hover:border-slate-300'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                        state === 'done' ? 'bg-emerald-500 text-white' : state === 'current' ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500'
                      )}
                    >
                      {state === 'done' ? <Check className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-slate-800">{s.title}</span>
                      <span className="hidden truncate text-[11px] text-slate-500 sm:block">{s.hint}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>

          {step === 0 && (
            <div className="space-y-5">
              {!editing && (
                <Question title="Start from an idea (optional)">
                  <div className="flex flex-wrap gap-2">
                    {STARTERS.filter((s) => !s.event || triggers.some((t) => t.value === s.event)).map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => applyStarter(s)}
                        title={s.hint}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-brand-300 hover:bg-brand-50/60"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-amber-500" /> {s.title}
                      </button>
                    ))}
                  </div>
                </Question>
              )}

              <Question title="What starts it?">
                <div className="grid gap-2 sm:grid-cols-2">
                  <ChoiceCard active={triggerType === 'event'} icon={Zap} title="Something happens to a lead" hint="A new lead, a stage change, a missed call …" onClick={() => { setTriggerType('event'); setErrors({}) }} />
                  <ChoiceCard active={triggerType === 'schedule'} icon={CalendarClock} title="A date and time" hint="Once, or every day / week / month" onClick={() => { setTriggerType('schedule'); setErrors({}) }} />
                </div>
              </Question>

              {triggerType === 'event' ? (
                <>
                  <FormField label="Which event?" required error={errors.event}>
                    <Select value={event} onChange={(e) => { setEvent(e.target.value); clearError('event') }}>
                      <option value="">Choose…</option>
                      {triggers.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <Question title="When should it send?">
                    <Pills value={waits ? 'wait' : 'now'} options={[{ key: 'now', label: 'Straight away' }, { key: 'wait', label: 'After a wait' }]} onChange={(v) => { setWaits(v === 'wait'); clearError('delayMinutes') }} />
                    {waits && (
                      <div className="flex max-w-xs gap-2">
                        <Input type="number" min={1} aria-label="Wait" value={delay.amount} onChange={(e) => { setDelay((d) => ({ ...d, amount: Number(e.target.value) })); clearError('delayMinutes') }} />
                        <Select aria-label="Unit" value={delay.unit} onChange={(e) => setDelay((d) => ({ ...d, unit: Number(e.target.value) }))}>
                          {DELAY_UNITS.map((u) => (
                            <option key={u.value} value={u.value}>
                              {u.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                    )}
                    {errors.delayMinutes && <p className="text-[11px] font-medium text-red-600">{errors.delayMinutes}</p>}
                    {waits && <p className="text-[11px] text-slate-500">The lead is checked again when the wait is over.</p>}
                  </Question>
                </>
              ) : (
                <>
                  <Question title="How often?">
                    <Pills value={recurrence} options={RECURRENCES} onChange={(v) => { setRecurrence(v); clearError('recurrence', 'weekdays', 'endAt') }} />
                  </Question>
                  {recurrence === 'weekly' && (
                    <Question title="On which days?">
                      <div className="flex flex-wrap gap-1.5">
                        {WEEKDAY_LABELS.map((label, d) => (
                          <button
                            key={label}
                            type="button"
                            aria-pressed={weekdays.includes(d)}
                            onClick={() => toggleWeekday(d)}
                            className={cn(
                              'h-8 w-11 rounded-lg border text-xs font-medium',
                              weekdays.includes(d) ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {errors.weekdays && <p className="text-[11px] font-medium text-red-600">{errors.weekdays}</p>}
                    </Question>
                  )}
                  <div className="grid max-w-md grid-cols-2 gap-3">
                    <FormField label={recurrence === 'once' ? 'Date' : 'Starting'} required error={errors.runAt}>
                      <Input type="date" value={run.date} onChange={(e) => { setRun((r) => ({ ...r, date: e.target.value })); clearError('runAt') }} />
                    </FormField>
                    <FormField label="Time" required hint={`Between ${sendWindow.replace('-', ' and ')}`}>
                      <Input type="time" value={run.time} onChange={(e) => { setRun((r) => ({ ...r, time: e.target.value })); clearError('runAt') }} />
                    </FormField>
                  </div>
                  {recurrence !== 'once' && (
                    <Question title="Until">
                      <Pills value={ends ? 'on' : 'never'} options={[{ key: 'never', label: 'No end date' }, { key: 'on', label: 'A date' }]} onChange={(v) => { setEnds(v === 'on'); clearError('endAt') }} />
                      {ends && <Input type="date" aria-label="Last day" value={endDate} min={run.date || undefined} onChange={(e) => { setEndDate(e.target.value); clearError('endAt') }} className="max-w-[12rem]" />}
                      {errors.endAt && <p className="text-[11px] font-medium text-red-600">{errors.endAt}</p>}
                    </Question>
                  )}
                </>
              )}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <Question title="Send by">
                <div className="grid gap-2 sm:grid-cols-3">
                  {CHANNELS.map((c) => (
                    <ChoiceCard
                      key={c.key}
                      active={channel === c.key}
                      icon={c.icon}
                      title={CHANNEL_LABEL[c.key]}
                      hint={editing && channel !== c.key ? 'Fixed once created' : c.hint}
                      onClick={() => pickChannel(c.key)}
                      disabled={editing && channel !== c.key}
                    />
                  ))}
                </div>
                {errors.channel && <p className="text-[11px] font-medium text-red-600">{errors.channel}</p>}
              </Question>
              <FormField label="Message" required error={errors.template} hint={templates && !templates.data.length ? `No active ${CHANNEL_LABEL[channel]} templates yet — add one on the Templates tab.` : undefined}>
                <Select value={template} onChange={(e) => pickTemplate(e.target.value)}>
                  <option value="">Choose a template…</option>
                  {templates?.data.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <DltVariableFields variables={variables} errors={errors} onChange={setVariable} perRecipient />
              {chosen && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">{channel === 'email' ? `Subject: ${chosen.subject ?? ''}` : 'Message'}</p>
                  <p className="line-clamp-5 whitespace-pre-wrap text-sm text-slate-800">
                    {channel === 'email' ? chosen.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : chosen.body}
                  </p>
                  <p className="mt-2 text-[11px] text-slate-400">{'{Lead fields}'} are filled in for each lead.</p>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <Question title="Which leads?">
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap gap-1.5">
                      {conditions.length ? (
                        conditions.map((c, i) => (
                          <span key={i} className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                            {describeCondition(c, fields)}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-slate-700">Every lead</span>
                      )}
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={() => setFilterOpen(true)}>
                      <Filter className="h-3.5 w-3.5" /> {conditions.length ? 'Change' : 'Only some leads'}
                    </Button>
                  </div>
                  <p className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-2 text-xs text-slate-600">
                    <Users className="h-3.5 w-3.5 text-slate-400" />
                    {counting ? (
                      'Counting…'
                    ) : audience ? (
                      <span>
                        <span className="font-semibold text-slate-800">{audience.data.final}</span> lead{audience.data.final === 1 ? '' : 's'} right now
                        {audience.data.matching !== audience.data.final && (
                          <span className="text-slate-400">
                            {' '}
                            ({audience.data.matching - audience.data.final} left out: opted out or no valid {channel === 'email' ? 'email' : 'mobile'})
                          </span>
                        )}
                      </span>
                    ) : null}
                  </p>
                </div>
                {errors.conditions && <p className="text-[11px] font-medium text-red-600">{errors.conditions}</p>}
                {triggerType === 'event' && <p className="text-[11px] text-slate-500">For an event, these are checked on the lead it happened to.</p>}
              </Question>
              <FormField label="Name" required error={errors.name} hint="How it shows in the list">
                <Input value={name} onChange={(e) => { setName(e.target.value); clearError('name') }} maxLength={150} />
              </FormField>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <Switch checked={active} onChange={setActive} label="Switched on" /> {active ? 'Switched on — it starts sending once saved' : 'Switched off — saved, but it sends nothing'}
              </label>
            </div>
          )}
        </div>
      </Drawer>
      {filterOpen && (
        <LeadFilterPanel
          open
          onClose={() => setFilterOpen(false)}
          fields={fields}
          value={conditions}
          onApply={(next) => {
            setConditions(next)
            clearError('conditions')
          }}
        />
      )}
    </>
  )
}
