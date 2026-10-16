import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { useAddLeadNoteMutation, useAssignLeadMutation, useFilterFieldsQuery } from '../../services/leadsApi'
import {
  useListMessageTemplatesQuery,
  usePreviewLeadMessageMutation,
  useSendLeadMessageMutation,
} from '../../services/messagingApi'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { FormField, Input, Select, Textarea } from '../../components/ui/fields'
import { parseApiError } from '../../lib/utils'
import { sanitizeHtml } from '../../lib/sanitize'
import { DLT_VAR_MAX, LEAD_FIELD_LABELS, fillTemplateVariables, leadFieldOf, resolveDltVariables } from '../../lib/smsTemplate'
import type { Lead, MessagePreview } from '../../types/models'
import { DltVariableFields } from './DltVariableFields'
import { ownerLabel, useAssignableOwners } from './leadSelection'

/** GL-13 single assign / reassign: new owner (anyone who can own leads) + reason. */
export function AssignLeadModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const assignable = useAssignableOwners()
  const { data: meta } = useFilterFieldsQuery()
  const [owner, setOwner] = useState('')
  const [reason, setReason] = useState('')
  const [assign, { isLoading }] = useAssignLeadMutation()
  const reasons = meta?.data.assignReasons ?? ['New allocation', 'Workload', 'Leave', 'Language', 'Performance', 'Other']

  const onSave = async () => {
    try {
      await assign({ id: lead._id, owner, reason }).unwrap()
      toast.success('Lead assigned')
      onClose()
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={lead.owner ? 'Reassign lead' : 'Assign lead'}
      description={lead.owner ? `Now with ${lead.owner.name}. Open follow-ups move to the new counsellor.` : 'From the Unassigned pool'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} loading={isLoading} disabled={!owner || !reason}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <FormField
          label="Assign to"
          required
          hint={assignable.length ? undefined : 'Nobody can be assigned yet — users need View on the Leads module.'}
        >
          <Select value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">Choose…</option>
            {assignable
              .filter((u) => u._id !== lead.owner?._id)
              .map((u) => (
                <option key={u._id} value={u._id}>
                  {ownerLabel(u)}
                </option>
              ))}
          </Select>
        </FormField>
        <FormField label="Reason" required>
          <Select value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">Choose…</option>
            {reasons.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </FormField>
      </div>
    </Modal>
  )
}

/**
 * GL-22 per-lead send: template → preview with real values → (email: edit) → send.
 * SMS and WhatsApp templates carry variables ({#var#} markers / {{n}} parameters): each value is typed
 * here or picked from the lead's fields (name, lead ID, counsellor …), the preview fills them live,
 * and a review step shows the final text and number before the gateway is called.
 */
export function SendMessageModal({ lead, channel, onClose }: { lead: Lead; channel: 'sms' | 'email' | 'whatsapp'; onClose: () => void }) {
  const { data: templates } = useListMessageTemplatesQuery({ channel, active: true })
  const [preview, { isLoading: previewing }] = usePreviewLeadMessageMutation()
  const [send, { isLoading: sending }] = useSendLeadMessageMutation()
  const [template, setTemplate] = useState('')
  const [shown, setShown] = useState<MessagePreview | null>(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [variables, setVariables] = useState<string[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [reviewing, setReviewing] = useState(false)
  // Schedule: the message waits on the server (Activity Log → Scheduled) and goes out at this time
  const [schedule, setSchedule] = useState(false)
  const [when, setWhen] = useState('')
  const scheduleReady = !schedule || !!when
  const whenText = when ? new Date(when).toLocaleString() : ''
  const label = channel === 'sms' ? 'SMS' : channel === 'whatsapp' ? 'WhatsApp' : 'Email'
  const templated = channel !== 'email' // SMS and WhatsApp: the approved text is fixed, values fill its markers
  const smsText = shown ? fillTemplateVariables(shown.body, resolveDltVariables(variables, shown.leadValues), channel) : ''

  const choose = async (id: string) => {
    setTemplate(id)
    setShown(null)
    setVariables([])
    setErrors({})
    setReviewing(false)
    if (!id) return
    try {
      const res = await preview({ id: lead._id, template: id }).unwrap()
      setShown(res.data)
      setSubject(res.data.subject ?? '')
      setBody(res.data.body)
      setVariables(Array.from({ length: res.data.variableCount ?? 0 }, () => ''))
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  const setVariable = (i: number, value: string) => {
    setVariables((vs) => vs.map((v, j) => (j === i ? value : v)))
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => k !== `variables.${i}`)))
  }

  /** SMS: check the typed values, then show the final text for confirmation. */
  const review = () => {
    const local: Record<string, string> = {}
    const resolved = resolveDltVariables(variables, shown?.leadValues)
    variables.forEach((v, i) => {
      const field = leadFieldOf(v)
      if (field && !resolved[i]) local[`variables.${i}`] = `This lead has no ${LEAD_FIELD_LABELS[field] ?? field}`
      else if (!v.trim()) local[`variables.${i}`] = `Variable ${i + 1} is required`
      else if (!field && v.trim().length > DLT_VAR_MAX) local[`variables.${i}`] = `At most ${DLT_VAR_MAX} characters (DLT rule)`
    })
    if (Object.keys(local).length) return setErrors(local)
    setReviewing(true)
  }

  const onSend = async () => {
    if (sending) return // a second click while the request is in flight must not send twice
    try {
      const res = await send({
        id: lead._id,
        body: {
          template,
          channel,
          ...(channel === 'email' ? { subject, body } : { variables: variables.map((v) => v.trim()) }),
          ...(schedule && when ? { scheduledAt: new Date(when).toISOString() } : {}),
        },
      }).unwrap()
      if (res.data.status === 'failed') {
        toast.error(res.data.error ?? `${label} failed`)
        if (templated) return setReviewing(false) // keep the typed values so the send can be corrected
      } else toast.success(res.data.status === 'scheduled' ? `${label} scheduled for ${whenText}` : `${label} ${res.data.status}`)
      onClose()
    } catch (err) {
      const { message, errors: fe } = parseApiError(err)
      setErrors(fe)
      if (Object.keys(fe).length) setReviewing(false)
      toast.error(message)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Send ${label}`}
      description={`To ${channel === 'email' ? lead.email ?? 'no email' : lead.mobile ?? 'no mobile'}`}
      footer={
        templated && reviewing ? (
          <>
            <Button variant="outline" onClick={() => setReviewing(false)} disabled={sending}>
              Back
            </Button>
            <Button onClick={onSend} loading={sending} disabled={!shown || !shown.to || !scheduleReady}>
              {schedule ? 'Confirm & Schedule' : `Confirm & Send ${label}`}
            </Button>
          </>
        ) : templated ? (
          <>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={review} disabled={!shown || !shown.to || previewing || !scheduleReady}>
              Review
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={onSend} loading={sending} disabled={!shown || !shown.to || !scheduleReady}>
              {schedule ? `Schedule ${label}` : `Send ${label}`}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-3">
        <FormField
          label="Template"
          required
          hint={
            channel === 'sms'
              ? 'Only DLT-approved SMS templates can be sent'
              : channel === 'whatsapp'
                ? 'Only templates approved in WhatsApp Manager can be sent'
                : undefined
          }
        >
          <Select value={template} disabled={reviewing} onChange={(e) => choose(e.target.value)}>
            <option value="">Choose…</option>
            {templates?.data.map((t) => (
              <option key={t._id} value={t._id}>
                {t.name}
              </option>
            ))}
          </Select>
        </FormField>
        {previewing && <p className="text-xs text-slate-500">Preparing preview…</p>}
        {shown?.warning && (
          <p className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5" /> {shown.warning}
          </p>
        )}
        {shown && templated && !reviewing && (
          <DltVariableFields variables={variables} errors={errors} onChange={setVariable} />
        )}
        {shown && templated && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="mb-1 text-[11px] text-slate-500">
              {reviewing ? 'Final message' : 'Preview'} · To {lead.mobile ?? 'no mobile'} ·{' '}
              {channel === 'whatsapp'
                ? `Template ${shown.template.waTemplateName ?? '?'} · ${shown.template.waLanguage ?? 'en'}`
                : `DLT ${shown.template.dltTemplateId} · Sender ${shown.template.senderId}`}{' '}
              · {smsText.length} chars
            </p>
            <p className="whitespace-pre-wrap text-sm text-slate-800">{smsText}</p>
          </div>
        )}
        {shown && channel === 'sms' && shown.template.dltType === 'explicit' && (
          <p className="text-xs text-slate-500">
            Explicit (promotional) DLT template: operators deliver it between 10 am and 9 pm only, and not to DND numbers without consent.
          </p>
        )}
        {templated && reviewing && (
          <p className="text-xs text-slate-500">
            {schedule
              ? `Check the number and the text. Confirm & Schedule keeps it until ${whenText}; cancel it any time from Activity Log → Scheduled.`
              : `Check the number and the text. Confirm & Send hands it to ${channel === 'whatsapp' ? 'WhatsApp' : 'the SMS gateway'} right away.`}
          </p>
        )}
        {shown && channel === 'email' && (
          <>
            <FormField label="Subject">
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
            </FormField>
            <FormField label="Message (You Can Edit Before Sending)">
              <div
                className="min-h-40 rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-100"
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => setBody(sanitizeHtml(e.currentTarget.innerHTML))}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(shown.body) }}
              />
            </FormField>
          </>
        )}
        {shown && !(templated && reviewing) && (
          <>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-1.5">
                <input type="radio" checked={!schedule} onChange={() => setSchedule(false)} /> Send Now
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" checked={schedule} onChange={() => setSchedule(true)} /> Schedule
              </label>
            </div>
            {schedule && (
              <FormField
                label="Date & Time"
                required
                hint={
                  channel === 'sms' && shown.template.dltType === 'explicit'
                    ? 'Explicit DLT templates are delivered between 10 am and 9 pm only'
                    : 'Goes out from the server at this time; cancel it any time from Activity Log → Scheduled'
                }
              >
                <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
              </FormField>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

/** Header "Add Note" (GL-35): up to 2,000 characters. */
export function AddNoteModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const [body, setBody] = useState('')
  const [add, { isLoading }] = useAddLeadNoteMutation()
  return (
    <Modal
      open
      onClose={onClose}
      title="Add Note"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={isLoading}
            disabled={!body.trim()}
            onClick={async () => {
              try {
                await add({ id: lead._id, body: body.trim() }).unwrap()
                toast.success('Note added')
                onClose()
              } catch (err) {
                toast.error(parseApiError(err).message)
              }
            }}
          >
            Save Note
          </Button>
        </>
      }
    >
      <Textarea rows={5} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What happened on this lead?" />
      <p className="mt-1 text-right text-[11px] text-slate-400">{body.length} / 2,000</p>
    </Modal>
  )
}
