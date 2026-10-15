import { useState } from 'react'
import { toast } from 'sonner'
import { useCreateCampaignMutation, useListMessageTemplatesQuery } from '../../services/messagingApi'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { FormField, Input, Select } from '../../components/ui/fields'
import { parseApiError } from '../../lib/utils'
import { sanitizeHtml } from '../../lib/sanitize'
import { DLT_VAR_MAX, leadFieldOf } from '../../lib/smsTemplate'
import type { CampaignPreview } from '../../types/models'
import { DltVariableFields } from './DltVariableFields'
import { selectionBody, type LeadSelection } from './leadSelection'

/**
 * GL-23 bulk SMS / email: template → (SMS: each DLT {#var#} value is typed once for every recipient, or
 * a lead field such as the first name that is filled per recipient) → sample preview → send now or
 * schedule (9 am – 9 pm only) → confirm screen with selected, excluded and final counts.
 */
export function BulkSendModal({
  channel,
  selection,
  onClose,
}: {
  channel: 'sms' | 'email'
  selection: LeadSelection
  onClose: () => void
}) {
  const { data: templates } = useListMessageTemplatesQuery({ channel, active: true })
  const [template, setTemplate] = useState('')
  const [variables, setVariables] = useState<string[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [schedule, setSchedule] = useState(false)
  const [when, setWhen] = useState('')
  const [preview, setPreview] = useState<CampaignPreview | null>(null)
  const [create, { isLoading }] = useCreateCampaignMutation()
  const label = channel === 'sms' ? 'SMS' : 'Email'

  /** Picking an SMS template opens one input per {#var#} marker; the values are the same for every recipient. */
  const choose = (id: string) => {
    setTemplate(id)
    setErrors({})
    const count = channel === 'sms' ? (templates?.data.find((t) => t._id === id)?.variableCount ?? 0) : 0
    setVariables(Array.from({ length: count }, () => ''))
  }
  const setVariable = (i: number, value: string) => {
    setVariables((vs) => vs.map((v, j) => (j === i ? value : v)))
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== `variables.${i}`)))
  }

  const body = (dryRun: boolean) => ({
    channel,
    template,
    preview: dryRun,
    audience: selectionBody(selection),
    ...(channel === 'sms' ? { variables: variables.map((v) => v.trim()) } : {}),
    ...(schedule && when ? { scheduledAt: new Date(when).toISOString() } : {}),
  })

  const fail = (err: unknown) => {
    const { message, errors: fe } = parseApiError(err)
    setErrors(fe)
    if (Object.keys(fe).length) setPreview(null) // back to the form, where the field errors show
    toast.error(message)
  }

  const review = async () => {
    const local: Record<string, string> = {}
    variables.forEach((v, i) => {
      if (leadFieldOf(v)) return // filled per recipient on the server
      if (!v.trim()) local[`variables.${i}`] = `Variable ${i + 1} is required`
      else if (v.trim().length > DLT_VAR_MAX) local[`variables.${i}`] = `At most ${DLT_VAR_MAX} characters (DLT rule)`
    })
    if (Object.keys(local).length) return setErrors(local)
    try {
      setPreview((await create(body(true)).unwrap()).data)
    } catch (err) {
      fail(err)
    }
  }
  const send = async () => {
    try {
      const res = await create(body(false)).unwrap()
      toast.success(`${res.message} — the campaign report is under SMS & Email → Campaigns`)
      onClose()
    } catch (err) {
      fail(err)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Bulk ${label} · ${selection.count} selected`}
      description="Opted-out, invalid and duplicate recipients are excluded automatically."
      footer={
        preview ? (
          <>
            <Button variant="outline" onClick={() => setPreview(null)}>
              Back
            </Button>
            <Button onClick={send} loading={isLoading} disabled={!preview.final}>
              {schedule ? 'Schedule' : 'Send Now'} to {preview.final}
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={review} loading={isLoading} disabled={!template || (schedule && !when)}>
              Preview
            </Button>
          </>
        )
      }
    >
      {preview ? (
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              ['Selected', preview.selected],
              ['Opted out', preview.excluded.optedOut],
              [`No valid ${channel === 'sms' ? 'mobile' : 'email'}`, preview.excluded.invalid],
              ['Duplicate', preview.excluded.duplicate],
              ['Final', preview.final],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-slate-200 p-2 text-center">
                <p className="text-lg font-semibold text-slate-800">{v}</p>
                <p className="text-[11px] text-slate-500">{k}</p>
              </div>
            ))}
          </div>
          {preview.sample && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="mb-1 text-[11px] font-semibold uppercase text-slate-500">Sample · to {preview.sample.to}</p>
              {preview.sample.subject && <p className="mb-1 text-sm font-medium text-slate-800">{preview.sample.subject}</p>}
              {channel === 'email' ? (
                <div className="prose prose-sm text-sm text-slate-700" dangerouslySetInnerHTML={{ __html: sanitizeHtml(preview.sample.body) }} />
              ) : (
                <p className="whitespace-pre-wrap text-sm text-slate-700">{preview.sample.body}</p>
              )}
            </div>
          )}
          <p className="text-xs text-slate-500">
            {schedule ? `Scheduled for ${new Date(when).toLocaleString()}` : 'Sends now in the background, in batches.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <FormField label={`${label} template`} required hint={channel === 'sms' ? 'Only DLT-approved templates are listed' : undefined}>
            <Select value={template} onChange={(e) => choose(e.target.value)}>
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
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={!schedule} onChange={() => setSchedule(false)} /> Send Now
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={schedule} onChange={() => setSchedule(true)} /> Schedule
            </label>
          </div>
          {schedule && (
            <FormField label="Date & Time" hint="Bulk sends run between 9 am and 9 pm only">
              <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            </FormField>
          )}
        </div>
      )}
    </Modal>
  )
}
