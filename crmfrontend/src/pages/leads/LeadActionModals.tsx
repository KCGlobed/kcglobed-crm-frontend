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
import type { Lead, MessagePreview } from '../../types/models'
import { useCounsellors } from './leadSelection'

/** GL-13 single assign / reassign: counsellor + reason. */
export function AssignLeadModal({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const counsellors = useCounsellors()
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
        <FormField label="Admission Counsellor" required>
          <Select value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">Choose…</option>
            {counsellors
              .filter((u) => u._id !== lead.owner?._id)
              .map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name}
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

/** GL-22 per-lead send: template → preview with real values → (email: edit) → send. */
export function SendMessageModal({ lead, channel, onClose }: { lead: Lead; channel: 'sms' | 'email'; onClose: () => void }) {
  const { data: templates } = useListMessageTemplatesQuery({ channel, active: true })
  const [preview, { isLoading: previewing }] = usePreviewLeadMessageMutation()
  const [send, { isLoading: sending }] = useSendLeadMessageMutation()
  const [template, setTemplate] = useState('')
  const [shown, setShown] = useState<MessagePreview | null>(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const label = channel === 'sms' ? 'SMS' : 'Email'

  const choose = async (id: string) => {
    setTemplate(id)
    setShown(null)
    if (!id) return
    try {
      const res = await preview({ id: lead._id, template: id }).unwrap()
      setShown(res.data)
      setSubject(res.data.subject ?? '')
      setBody(res.data.body)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  const onSend = async () => {
    try {
      const res = await send({
        id: lead._id,
        body: { template, channel, ...(channel === 'email' ? { subject, body } : {}) },
      }).unwrap()
      if (res.data.status === 'failed') toast.error(res.data.error ?? `${label} failed`)
      else toast.success(`${label} ${res.data.status}`)
      onClose()
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`Send ${label}`}
      description={`To ${channel === 'sms' ? lead.mobile ?? 'no mobile' : lead.email ?? 'no email'}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSend} loading={sending} disabled={!shown || !shown.to}>
            Send {label}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <FormField label="Template" required hint={channel === 'sms' ? 'Only DLT-approved SMS templates can be sent' : undefined}>
          <Select value={template} onChange={(e) => choose(e.target.value)}>
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
        {shown && channel === 'sms' && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="mb-1 text-[11px] text-slate-500">
              Preview · DLT {shown.template.dltTemplateId} · Sender {shown.template.senderId} · {shown.body.length} chars
            </p>
            <p className="whitespace-pre-wrap text-sm text-slate-800">{shown.body}</p>
          </div>
        )}
        {shown && channel === 'email' && (
          <>
            <FormField label="Subject">
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
            </FormField>
            <FormField label="Message (you can edit before sending)">
              <div
                className="min-h-40 rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-100"
                contentEditable
                suppressContentEditableWarning
                onBlur={(e) => setBody(e.currentTarget.innerHTML)}
                dangerouslySetInnerHTML={{ __html: shown.body }}
              />
            </FormField>
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
      title="Add note"
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
            Save note
          </Button>
        </>
      }
    >
      <Textarea rows={5} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What happened on this lead?" />
      <p className="mt-1 text-right text-[11px] text-slate-400">{body.length} / 2,000</p>
    </Modal>
  )
}
