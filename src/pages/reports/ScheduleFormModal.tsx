import { useState } from 'react'
import { toast } from 'sonner'
import { cn, parseApiError } from '../../lib/utils'
import {
  useCreateReportScheduleMutation,
  useReportCatalogQuery,
  useUpdateReportScheduleMutation,
  type ReportScheduleBody,
} from '../../services/reportsApi'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { FormField, Input, Select, Switch, Textarea } from '../../components/ui/fields'
import type { ReportFrequency, ReportPeriodKey, ReportSchedule } from '../../types/models'
import { WEEKDAYS, scheduleWhen } from './reportFormat'

const FREQUENCIES: { value: ReportFrequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]
const MON_TO_SAT = [0, 1, 2, 3, 4, 5]

const splitEmails = (text: string) =>
  text
    .split(/[\s,;]+/)
    .map((e) => e.trim())
    .filter(Boolean)

/** A server error key ("recipients.0", "weekdays") → the field it belongs to. */
function fieldErrors(errors: Record<string, string>) {
  const out: Record<string, string> = {}
  for (const [key, message] of Object.entries(errors)) {
    const field = key.split('.')[0]
    if (!out[field]) out[field] = message
  }
  return out
}

/**
 * Create or edit a scheduled report email: which report, the period it covers (relative to the day it goes
 * out), when it goes out (IST) and who gets it. `reportKey` preselects the report (from the report screen).
 */
export function ScheduleFormModal({ schedule, reportKey, onClose }: { schedule?: ReportSchedule; reportKey?: string; onClose: () => void }) {
  const { data: catalog } = useReportCatalogQuery()
  const reports = catalog?.data ?? []
  const [createSchedule, { isLoading: creating }] = useCreateReportScheduleMutation()
  const [updateSchedule, { isLoading: updating }] = useUpdateReportScheduleMutation()

  const initialReport = reports.find((r) => r.key === (schedule?.reportKey ?? reportKey))
  const [report, setReport] = useState(schedule?.reportKey ?? reportKey ?? '')
  const [name, setName] = useState(schedule?.name ?? initialReport?.name ?? '')
  const [period, setPeriod] = useState<ReportPeriodKey | ''>(schedule?.period ?? initialReport?.periods[0]?.value ?? '')
  const [frequency, setFrequency] = useState<ReportFrequency>(schedule?.frequency ?? 'daily')
  const [sendTime, setSendTime] = useState(schedule?.sendTime ?? '20:00')
  const [weekdays, setWeekdays] = useState<number[]>(schedule?.weekdays ?? MON_TO_SAT)
  const [monthDay, setMonthDay] = useState(String(schedule?.monthDay ?? 1))
  const [recipients, setRecipients] = useState((schedule?.recipients ?? []).join(', '))
  const [cc, setCc] = useState((schedule?.cc ?? []).join(', '))
  const [isActive, setIsActive] = useState(schedule?.isActive ?? true)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const selected = reports.find((r) => r.key === report)

  const changeReport = (key: string) => {
    const next = reports.find((r) => r.key === key)
    const previous = reports.find((r) => r.key === report)
    setReport(key)
    // keep a name the user typed; replace one that was just the previous report's name
    if (next && (!name || name === previous?.name)) setName(next.name)
    if (next && !next.periods.some((p) => p.value === period)) setPeriod(next.periods[0]?.value ?? '')
  }

  const changeFrequency = (value: ReportFrequency) => {
    setFrequency(value)
    if (value === 'weekly') setWeekdays([weekdays[0] ?? 0])
    if (value === 'daily' && weekdays.length < 2) setWeekdays(MON_TO_SAT)
  }

  const toggleDay = (day: number) => {
    if (frequency === 'weekly') return setWeekdays([day])
    setWeekdays(weekdays.includes(day) ? weekdays.filter((d) => d !== day) : [...weekdays, day].sort((a, b) => a - b))
  }

  const onSubmit = async () => {
    const local: Record<string, string> = {}
    if (!name.trim()) local.name = 'Name the schedule'
    if (!report) local.reportKey = 'Choose a report'
    if (!period) local.period = 'Choose the period'
    if (!sendTime) local.sendTime = 'Choose the time'
    if (frequency !== 'monthly' && !weekdays.length) local.weekdays = 'Pick at least one day'
    if (frequency === 'monthly' && !(Number(monthDay) >= 1 && Number(monthDay) <= 28)) local.monthDay = 'Choose a day from 1 to 28'
    if (!splitEmails(recipients).length) local.recipients = 'Add at least one recipient'
    if (Object.keys(local).length) return setErrors(local)

    const body: ReportScheduleBody = {
      name: name.trim(),
      reportKey: report,
      period: period as ReportPeriodKey,
      frequency,
      sendTime,
      weekdays: frequency === 'monthly' ? [] : weekdays,
      monthDay: frequency === 'monthly' ? Number(monthDay) : null,
      recipients: splitEmails(recipients),
      cc: splitEmails(cc),
      isActive,
    }
    try {
      if (schedule) await updateSchedule({ id: schedule._id, body }).unwrap()
      else await createSchedule(body).unwrap()
      toast.success(schedule ? 'Schedule saved' : 'Schedule created')
      onClose()
    } catch (err) {
      const { message, errors: fe } = parseApiError(err)
      setErrors(fieldErrors(fe))
      toast.error(message)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={schedule ? 'Edit scheduled report' : 'Schedule a report email'}
      description="The report goes out by email with the Excel file attached, at the chosen time (IST). Every send is kept in the history; a failed send is retried 3 times, 15 minutes apart."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit} loading={creating || updating}>
            {schedule ? 'Save' : 'Create schedule'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Report" required error={errors.reportKey}>
          <Select value={report} aria-invalid={!!errors.reportKey} onChange={(e) => changeReport(e.target.value)} disabled={!!schedule}>
            <option value="">Select report…</option>
            {reports.map((r) => (
              <option key={r.key} value={r.key}>
                {r.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Period" required error={errors.period} hint="Counted from the day it is sent">
          <Select value={period} aria-invalid={!!errors.period} onChange={(e) => setPeriod(e.target.value as ReportPeriodKey)}>
            <option value="">Select period…</option>
            {selected?.periods.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Name" required error={errors.name} className="sm:col-span-2" hint="The email subject: name — period">
          <Input value={name} maxLength={150} aria-invalid={!!errors.name} onChange={(e) => setName(e.target.value)} />
        </FormField>

        <FormField label="Repeats" required error={errors.frequency}>
          <Select value={frequency} onChange={(e) => changeFrequency(e.target.value as ReportFrequency)}>
            {FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Time (IST)" required error={errors.sendTime}>
          <Input type="time" value={sendTime} aria-invalid={!!errors.sendTime} onChange={(e) => setSendTime(e.target.value)} />
        </FormField>

        {frequency === 'monthly' ? (
          <FormField label="Day of the month" required error={errors.monthDay} hint="1 to 28, so every month has it">
            <Input type="number" min={1} max={28} value={monthDay} aria-invalid={!!errors.monthDay} onChange={(e) => setMonthDay(e.target.value)} />
          </FormField>
        ) : (
          <FormField label={frequency === 'weekly' ? 'Day' : 'Days'} required error={errors.weekdays} className="sm:col-span-2">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Days of the week">
              {WEEKDAYS.map((label, day) => {
                const on = weekdays.includes(day)
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleDay(day)}
                    className={cn(
                      'h-8 w-12 rounded-lg border text-xs font-medium transition-colors',
                      on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-600 hover:border-brand-300'
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </FormField>
        )}

        <FormField
          label="To"
          required
          error={errors.recipients}
          className="sm:col-span-2"
          hint="Email addresses separated by commas — @kcglobed.com and @gccschool.com only"
        >
          <Textarea rows={2} value={recipients} aria-invalid={!!errors.recipients} onChange={(e) => setRecipients(e.target.value)} />
        </FormField>
        <FormField label="CC" error={errors.cc} className="sm:col-span-2">
          <Textarea rows={1} value={cc} aria-invalid={!!errors.cc} onChange={(e) => setCc(e.target.value)} />
        </FormField>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 sm:col-span-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-700">{isActive ? 'Active' : 'Paused'}</p>
            <p className="text-[11px] text-slate-500">
              {isActive && sendTime && (frequency === 'monthly' || weekdays.length)
                ? scheduleWhen({ frequency, weekdays, monthDay: Number(monthDay), sendTime })
                : 'Nothing is sent while paused'}
            </p>
          </div>
          <Switch checked={isActive} onChange={setIsActive} label="Active" />
        </div>
      </div>
    </Modal>
  )
}
