import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, Filter, Plus, Trash2, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { useCurrentUser } from '../../../app/hooks'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Drawer } from '../../../components/ui/Drawer'
import { ConfirmDialog, EmptyState, Skeleton } from '../../../components/ui/feedback'
import { FormField, Input, Select, Switch } from '../../../components/ui/fields'
import { can } from '../../../constants/permissions'
import { formatDateTime, parseApiError } from '../../../lib/utils'
import { useFilterFieldsQuery } from '../../../services/leadsApi'
import {
  useCreateAutomationMutation,
  useDeleteAutomationMutation,
  useListAutomationsQuery,
  useListMessageTemplatesQuery,
  useMessagingOptionsQuery,
  usePreviewAutomationAudienceMutation,
  useUpdateAutomationMutation,
} from '../../../services/messagingApi'
import type { AutomationBody, AutomationRecurrence, AutomationRow, AutomationTriggerType, FilterCondition, FilterField } from '../../../types/models'
import { DltVariableFields } from '../../leads/DltVariableFields'
import { LeadFilterPanel } from '../../leads/LeadFilterPanel'
import { DELAY_UNITS, splitDelay } from './automationTime'
import { StaffAlertsSection } from './StaffAlertsSection'

type Channel = 'sms' | 'email' | 'whatsapp'
const CHANNEL_TONE = { sms: 'blue', whatsapp: 'green', email: 'violet' } as const
const CHANNEL_LABEL: Record<Channel, string> = { sms: 'SMS', email: 'Email', whatsapp: 'WhatsApp' }
const OP_TEXT: Record<string, string> = {
  is: 'is', is_not: 'is not', any_of: 'any of', none_of: 'none of', contains: 'contains', empty: 'is empty', not_empty: 'is not empty',
  before: 'before', after: 'after', between: 'between', today: 'today', yesterday: 'yesterday', last_7_days: 'last 7 days',
  this_month: 'this month', eq: '=', gte: '≥', lte: '≤',
}

const pad = (n: number) => String(n).padStart(2, '0')
/** an ISO instant → the "YYYY-MM-DD" and "HH:MM" the browser's date / time inputs take (local time) */
function localParts(iso?: string | null): { date: string; time: string } {
  if (!iso) return { date: '', time: '' }
  const d = new Date(iso)
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` }
}
const toIso = (date: string, time: string) => (date && time ? new Date(`${date}T${time}`).toISOString() : null)

/** "Stage is Interested" — a condition as the chips show it. */
function describeCondition(c: FilterCondition, fields: FilterField[]): string {
  const field = fields.find((f) => f.key === c.field)
  const label = field?.label ?? c.field
  const op = OP_TEXT[c.op] ?? c.op
  const values = Array.isArray(c.value) ? c.value : c.value !== undefined && c.value !== '' ? [c.value] : []
  const text = values.map((v) => field?.options?.find((o) => o.value === v)?.label ?? v).join(c.op === 'between' ? ' – ' : ', ')
  return text ? `${label} ${op} ${text}` : `${label} ${op}`
}

function ConditionChips({ conditions, fields }: { conditions: FilterCondition[]; fields: FilterField[] }) {
  if (!conditions.length) return <span className="text-xs text-slate-400">Every lead</span>
  return (
    <div className="flex flex-wrap gap-1">
      {conditions.map((c, i) => (
        <span key={i} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
          {describeCondition(c, fields)}
        </span>
      ))}
    </div>
  )
}

function AutomationDrawer({ automation, onClose }: { automation?: AutomationRow; onClose: () => void }) {
  const { data: options } = useMessagingOptionsQuery()
  const { data: meta } = useFilterFieldsQuery()
  const [create, { isLoading: creating }] = useCreateAutomationMutation()
  const [update, { isLoading: updating }] = useUpdateAutomationMutation()
  const [preview, { data: audience, isLoading: counting }] = usePreviewAutomationAudienceMutation()

  const [name, setName] = useState(automation?.name ?? '')
  const [channel, setChannel] = useState<Channel>(automation?.channel ?? 'sms')
  const [template, setTemplate] = useState(automation?.template?._id ?? '')
  const [variables, setVariables] = useState<string[]>(automation?.variables ?? [])
  const [triggerType, setTriggerType] = useState<AutomationTriggerType>(automation?.triggerType ?? 'event')
  const [event, setEvent] = useState(automation?.event ?? '')
  const [delay, setDelay] = useState(splitDelay(automation?.delayMinutes ?? 0))
  const [recurrence, setRecurrence] = useState<AutomationRecurrence>(automation?.recurrence ?? 'daily')
  const [run, setRun] = useState(localParts(automation?.runAt))
  const [weekdays, setWeekdays] = useState<number[]>(automation?.weekdays ?? [])
  const [endDate, setEndDate] = useState(localParts(automation?.endAt).date)
  const [conditions, setConditions] = useState<FilterCondition[]>(automation?.conditions ?? [])
  const [active, setActive] = useState(automation?.isActive ?? true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [filterOpen, setFilterOpen] = useState(false)

  const { data: templates } = useListMessageTemplatesQuery({ channel, active: true })
  const chosen = templates?.data.find((t) => t._id === template)
  const templated = channel !== 'email'
  const fields = useMemo(() => meta?.data.fields ?? [], [meta])
  const clearError = (key: string) => setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== key)))

  // the live count: how many leads the conditions reach on this channel right now
  useEffect(() => {
    const handle = setTimeout(() => {
      preview({ channel, conditions }).catch(() => undefined)
    }, 300)
    return () => clearTimeout(handle)
  }, [channel, conditions, preview])

  const pickChannel = (next: Channel) => {
    setChannel(next)
    setTemplate('')
    setVariables([])
    clearError('template')
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

  const body = (): AutomationBody => ({
    name: name.trim(),
    channel,
    template,
    variables: templated ? variables.map((v) => v.trim()) : [],
    triggerType,
    conditions,
    isActive: active,
    ...(triggerType === 'event'
      ? { event, delayMinutes: Math.max(0, Math.round(Number(delay.amount) || 0)) * delay.unit, recurrence: null, runAt: null, weekdays: [], endAt: null }
      : {
          event: null,
          delayMinutes: 0,
          recurrence,
          runAt: toIso(run.date, run.time),
          weekdays: recurrence === 'weekly' ? weekdays : [],
          endAt: recurrence !== 'once' && endDate ? toIso(endDate, '23:59') : null,
        }),
  })

  const validate = () => {
    const local: Record<string, string> = {}
    if (!name.trim()) local.name = 'Give the automation a name'
    if (!template) local.template = `Choose a ${CHANNEL_LABEL[channel]} template`
    variables.forEach((v, i) => {
      if (!v.trim()) local[`variables.${i}`] = `Variable ${i + 1} is required`
    })
    if (triggerType === 'event' && !event) local.event = 'Choose the lead event that starts it'
    if (triggerType === 'schedule') {
      if (!run.date || !run.time) local.runAt = 'Pick the date and time'
      if (recurrence === 'weekly' && !weekdays.length) local.weekdays = 'Pick at least one day of the week'
    }
    setErrors(local)
    return !Object.keys(local).length
  }

  const onSave = async () => {
    if (!validate()) return
    try {
      if (automation) await update({ id: automation._id, body: body() }).unwrap()
      else await create(body()).unwrap()
      toast.success(automation ? 'Automation updated' : 'Automation created')
      onClose()
    } catch (err) {
      const parsed = parseApiError(err)
      setErrors(parsed.errors)
      toast.error(parsed.message)
    }
  }

  const triggerTypes = options?.data.triggerTypes ?? [
    { value: 'event', label: 'When something happens' },
    { value: 'schedule', label: 'On a schedule' },
  ]
  const recurrences = options?.data.recurrences ?? [
    { value: 'once', label: 'Once' },
    { value: 'daily', label: 'Every day' },
    { value: 'weekly', label: 'Every week' },
    { value: 'monthly', label: 'Every month' },
  ]
  const weekdayOptions = options?.data.weekdays ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, value) => ({ value, label }))
  const window = options?.data.bulkWindow ?? '09:00-21:00'

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        wide
        title={automation ? `Edit automation · ${automation.name}` : 'New automation'}
        description="One template on one channel, sent when a lead event happens or on a schedule, to the leads that match the conditions."
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={onSave} loading={creating || updating}>
              {automation ? 'Save changes' : 'Create automation'}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.5fr_1fr]">
            <FormField label="Name" required error={errors.name}>
              <Input value={name} onChange={(e) => { setName(e.target.value); clearError('name') }} maxLength={150} placeholder="Welcome SMS" />
            </FormField>
            <FormField label="Channel" required error={errors.channel}>
              <Select value={channel} onChange={(e) => pickChannel(e.target.value as Channel)} disabled={!!automation}>
                {(options?.data.channels ?? Object.entries(CHANNEL_LABEL).map(([value, label]) => ({ value, label }))).map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <section className="space-y-3 rounded-xl border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">When</p>
            <div className="flex flex-wrap gap-4 text-sm">
              {triggerTypes.map((t) => (
                <label key={t.value} className="flex items-center gap-1.5">
                  <input type="radio" checked={triggerType === t.value} onChange={() => setTriggerType(t.value as AutomationTriggerType)} />
                  {t.value === 'event' ? <Zap className="h-3.5 w-3.5 text-amber-500" /> : <CalendarClock className="h-3.5 w-3.5 text-sky-600" />}
                  {t.label}
                </label>
              ))}
            </div>
            {triggerType === 'event' ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.6fr_1fr]">
                <FormField label="Lead event" required error={errors.event}>
                  <Select value={event} onChange={(e) => { setEvent(e.target.value); clearError('event') }}>
                    <option value="">Choose…</option>
                    {options?.data.triggers.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Wait before sending" error={errors.delayMinutes} hint="0 = straight away. The conditions are checked again when the wait is over.">
                  <div className="flex gap-2">
                    <Input type="number" min={0} value={delay.amount} onChange={(e) => { setDelay((d) => ({ ...d, amount: Number(e.target.value) })); clearError('delayMinutes') }} />
                    <Select value={delay.unit} onChange={(e) => setDelay((d) => ({ ...d, unit: Number(e.target.value) }))}>
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
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <FormField label="Repeat" required error={errors.recurrence}>
                    <Select value={recurrence} onChange={(e) => setRecurrence(e.target.value as AutomationRecurrence)}>
                      {recurrences.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label={recurrence === 'once' ? 'Date' : 'Starts on'} required error={errors.runAt}>
                    <Input type="date" value={run.date} onChange={(e) => { setRun((r) => ({ ...r, date: e.target.value })); clearError('runAt') }} />
                  </FormField>
                  <FormField label="Time" required hint={`Sends between ${window.replace('-', ' and ')}`}>
                    <Input type="time" value={run.time} onChange={(e) => { setRun((r) => ({ ...r, time: e.target.value })); clearError('runAt') }} />
                  </FormField>
                </div>
                {recurrence === 'weekly' && (
                  <FormField label="On" required error={errors.weekdays}>
                    <div className="flex flex-wrap gap-1.5">
                      {weekdayOptions.map((d) => (
                        <Button key={d.value} type="button" size="sm" variant={weekdays.includes(d.value) ? 'secondary' : 'outline'} onClick={() => toggleWeekday(d.value)}>
                          {d.label}
                        </Button>
                      ))}
                    </div>
                  </FormField>
                )}
                {recurrence !== 'once' && (
                  <FormField label="Ends on" error={errors.endAt} hint="Optional — leave empty to keep running">
                    <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); clearError('endAt') }} className="sm:w-1/3" />
                  </FormField>
                )}
              </div>
            )}
          </section>

          <section className="space-y-3 rounded-xl border border-slate-200 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">What</p>
            <FormField
              label={`${CHANNEL_LABEL[channel]} template`}
              required
              error={errors.template}
              hint={channel === 'sms' ? 'Only DLT-approved templates are listed' : channel === 'whatsapp' ? 'Only templates approved in WhatsApp Manager are listed' : undefined}
            >
              <Select value={template} onChange={(e) => pickTemplate(e.target.value)}>
                <option value="">Choose…</option>
                {templates?.data.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name}
                    {t.dltTemplateId ? ` · DLT ${t.dltTemplateId}` : ''}
                  </option>
                ))}
              </Select>
            </FormField>
            <DltVariableFields variables={variables} errors={errors} onChange={setVariable} perRecipient />
            {chosen && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="mb-1 text-[11px] text-slate-500">
                  {channel === 'email' ? `Subject: ${chosen.subject ?? ''}` : 'Preview'} · {'{lead fields}'} are filled for each lead
                </p>
                <p className="line-clamp-4 whitespace-pre-wrap text-sm text-slate-800">{channel === 'email' ? chosen.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : chosen.body}</p>
              </div>
            )}
          </section>

          <section className="space-y-3 rounded-xl border border-slate-200 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Which leads</p>
              <Button type="button" size="sm" variant="outline" onClick={() => setFilterOpen(true)}>
                <Filter className="h-3.5 w-3.5" /> {conditions.length ? 'Edit conditions' : 'Add conditions'}
              </Button>
            </div>
            <ConditionChips conditions={conditions} fields={fields} />
            {errors.conditions && <p className="text-xs text-red-600">{errors.conditions}</p>}
            <p className="text-xs text-slate-500">
              {counting
                ? 'Counting…'
                : audience
                  ? `Reaches ${audience.data.final} lead${audience.data.final === 1 ? '' : 's'} right now (${audience.data.matching} match · ${audience.data.excluded.optedOut} opted out, ${audience.data.excluded.invalid} without a valid ${channel === 'email' ? 'email' : 'mobile'})`
                  : ''}
              {triggerType === 'event' ? ' · for an event, the conditions are checked on the lead the event happened to.' : ''}
            </p>
          </section>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <Switch checked={active} onChange={setActive} label="Active" /> Active
          </label>
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

/** Communication → Automation: create, edit, switch on / off and delete the rules that send SMS, email and WhatsApp on their own. */
export function AutomationsTab() {
  const user = useCurrentUser()
  const editable = can(user, 'automation', 'edit')
  const { data, isLoading } = useListAutomationsQuery(undefined, { pollingInterval: 30000 })
  const { data: meta } = useFilterFieldsQuery()
  const [update] = useUpdateAutomationMutation()
  const [remove, { isLoading: removing }] = useDeleteAutomationMutation()
  const [editing, setEditing] = useState<AutomationRow | 'new' | null>(null)
  const [deleting, setDeleting] = useState<AutomationRow | null>(null)
  const [switching, setSwitching] = useState<string | null>(null)
  const fields = meta?.data.fields ?? []

  const toggle = async (row: AutomationRow) => {
    setSwitching(row._id)
    try {
      const res = await update({ id: row._id, body: { isActive: !row.isActive } }).unwrap()
      toast.success(res.message)
    } catch (err) {
      toast.error(parseApiError(err).message)
    } finally {
      setSwitching(null)
    }
  }
  const onDelete = async () => {
    if (!deleting) return
    try {
      const res = await remove(deleting._id).unwrap()
      toast.success(res.message)
    } catch (err) {
      toast.error(parseApiError(err).message)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <>
      <StaffAlertsSection />
      <h2 className="mb-1 text-sm font-semibold text-slate-800">Lead automations</h2>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          An automation sends one template on one channel — when a lead event happens (straight away or after a wait) or on a schedule — to the
          leads matching its conditions. Automations never reach Junk leads, skip opted-out channels and never send the same automation to a lead
          twice within a day.
        </p>
        {editable && (
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="h-3.5 w-3.5" /> New automation
          </Button>
        )}
      </div>
      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !data?.data.length ? (
        <EmptyState title="No automations yet" description="Create one to send a welcome SMS on every new lead, a reminder email every Monday, or a WhatsApp nudge to leads who went quiet." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Automation</th>
                <th className="px-4 py-2">Channel</th>
                <th className="px-4 py-2">Trigger</th>
                <th className="px-4 py-2">Template</th>
                <th className="px-4 py-2">Runs</th>
                <th className="px-4 py-2">Status</th>
                {editable && <th className="px-4 py-2 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.data.map((row) => (
                <tr key={row._id} className="align-top hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <button type="button" className="text-left font-medium text-slate-800 hover:text-brand-700" onClick={() => editable && setEditing(row)}>
                      {row.name}
                    </button>
                    <p className="text-[11px] text-slate-500">
                      {row.updatedBy ?? row.createdBy ?? '—'} · {formatDateTime(row.updatedAt)}
                    </p>
                  </td>
                  <td className="px-4 py-2">
                    <Badge tone={CHANNEL_TONE[row.channel]}>{row.channelLabel}</Badge>
                  </td>
                  <td className="px-4 py-2">
                    <p className="flex items-center gap-1 text-slate-700">
                      {row.triggerType === 'event' ? <Zap className="h-3.5 w-3.5 shrink-0 text-amber-500" /> : <CalendarClock className="h-3.5 w-3.5 shrink-0 text-sky-600" />}
                      <span>{row.schedule}</span>
                    </p>
                    <div className="mt-1">
                      <ConditionChips conditions={row.conditions} fields={fields} />
                    </div>
                    {row.nextRunAt && <p className="mt-1 text-[11px] text-slate-500">Next run {formatDateTime(row.nextRunAt)}</p>}
                  </td>
                  <td className="px-4 py-2 text-slate-700">
                    {row.template ? (
                      <>
                        {row.template.name}
                        {!row.template.isActive && (
                          <Badge tone="amber" className="ml-1">
                            inactive
                          </Badge>
                        )}
                      </>
                    ) : (
                      <span className="text-red-600">No template</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-600">
                    {row.runCount ? (
                      <>
                        <p>
                          {row.runCount} run{row.runCount === 1 ? '' : 's'} · {row.sentCount} sent
                        </p>
                        {row.lastRun && (
                          <p className="text-[11px] text-slate-500">
                            Last {formatDateTime(row.lastRun.scheduledAt)}: {row.lastRun.sent} sent{row.lastRun.failed ? `, ${row.lastRun.failed} failed` : ''}
                          </p>
                        )}
                        {!row.lastRun && row.lastRunAt && <p className="text-[11px] text-slate-500">Last {formatDateTime(row.lastRunAt)}</p>}
                      </>
                    ) : (
                      <span className="text-slate-400">Not yet</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      {editable && <Switch checked={row.isActive} onChange={() => toggle(row)} loading={switching === row._id} label={`${row.isActive ? 'Deactivate' : 'Activate'} ${row.name}`} />}
                      <Badge tone={row.isActive ? 'green' : 'slate'} dot>
                        {row.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </td>
                  {editable && (
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(row)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-600" title="Delete" onClick={() => setDeleting(row)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <AutomationDrawer automation={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={onDelete}
        title="Delete automation"
        message={`Delete "${deleting?.name}" (${deleting?.channelLabel}) permanently? Messages waiting on its timer are cancelled; what it already sent stays in the history.`}
        confirmLabel="Delete"
        danger
        loading={removing}
      />
    </>
  )
}
