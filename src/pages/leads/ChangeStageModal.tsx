import { useState } from 'react'
import { Lightbulb } from 'lucide-react'
import { toast } from 'sonner'
import { useDispositionOptionsQuery, useUpdateLeadMutation } from '../../services/leadsApi'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { FormField, Input, Select } from '../../components/ui/fields'
import { parseApiError } from '../../lib/utils'
import type { Lead } from '../../types/models'
import { toLocalInput } from '../tasks/taskMeta'

/**
 * Stage + sub-stage picker (Lead Stages sheet); shows the counsellor action for
 * the pick. System stages (Untouched, Re-enquired, Application Submitted) are
 * set by the CRM only. Open stages also need the next follow-up (Go-live GL-19).
 */
export function ChangeStageModal({ lead, open, onClose }: { lead: Lead; open: boolean; onClose: () => void }) {
  const { data } = useDispositionOptionsQuery()
  const [updateLead, { isLoading }] = useUpdateLeadMutation()
  const stages = (data?.data.stages ?? []).filter((s) => !s.locked)
  const [stageId, setStageId] = useState(lead.stage?.isSystem ? '' : (lead.stage?._id ?? ''))
  const [subStageId, setSubStageId] = useState(lead.subStage ?? '')
  const [followUpAt, setFollowUpAt] = useState(() => toLocalInput(new Date(Date.now() + 24 * 3600_000)))
  const [followUpType, setFollowUpType] = useState('follow_up_call')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const stage = stages.find((s) => s._id === stageId)
  const subStages = stage?.subStages ?? []
  const subStage = subStages.find((s) => s._id === subStageId)
  const unchanged = stageId === lead.stage?._id && (subStageId || null) === (lead.subStage ?? null)

  const onSubmit = async () => {
    const local: Record<string, string> = {}
    if (!stage) local.stage = 'Select a stage'
    else if (subStages.length && !subStage) local.subStage = 'Select a sub-stage'
    if (stage?.requiresFollowUp && !followUpAt) local.followUpAt = 'A next follow-up date-time is required for this stage'
    if (Object.keys(local).length) return setErrors(local)
    try {
      await updateLead({
        id: lead._id,
        body: {
          stage: stageId,
          subStage: subStage?._id ?? null,
          ...(stage?.requiresFollowUp ? { followUpAt: new Date(followUpAt).toISOString(), followUpType } : {}),
        },
      }).unwrap()
      toast.success('Stage updated')
      onClose()
    } catch (err) {
      const { message, errors: fe } = parseApiError(err)
      setErrors(fe)
      toast.error(message)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change stage"
      description={`Current: ${lead.stage?.name ?? '—'}${lead.lastDisposition && lead.lastDisposition !== lead.stage?.name ? ` · ${lead.lastDisposition}` : ''}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit} loading={isLoading} disabled={unchanged}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <FormField label="Lead stage" required error={errors.stage}>
          <Select
            value={stageId}
            aria-invalid={!!errors.stage}
            onChange={(e) => {
              setStageId(e.target.value)
              setSubStageId('')
              setErrors({})
            }}
          >
            <option value="">Select stage…</option>
            {stages.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </Select>
        </FormField>
        {subStages.length > 0 && (
          <FormField label="Lead sub-stage" required error={errors.subStage}>
            <Select
              value={subStageId}
              aria-invalid={!!errors.subStage}
              onChange={(e) => {
                setSubStageId(e.target.value)
                setErrors({})
              }}
            >
              <option value="">Select sub-stage…</option>
              {subStages.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </FormField>
        )}
        {subStage?.counsellorAction && (
          <div className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
            <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>
              <b>Counsellor action:</b> {subStage.counsellorAction}
            </p>
          </div>
        )}
        {stage?.requiresFollowUp && (
          <div className="grid gap-2 rounded-lg border border-brand-100 bg-brand-50/40 p-3 sm:grid-cols-[1.3fr_1fr]">
            <FormField label="Next follow-up" required error={errors.followUpAt}>
              <Input
                type="datetime-local"
                min={toLocalInput(new Date())}
                value={followUpAt}
                onChange={(e) => setFollowUpAt(e.target.value)}
                aria-invalid={!!errors.followUpAt}
              />
            </FormField>
            <FormField label="Type">
              <Select value={followUpType} onChange={(e) => setFollowUpType(e.target.value)}>
                {data?.data.followUpTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
        )}
      </div>
    </Modal>
  )
}
