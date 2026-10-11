import { useState } from 'react'
import { toast } from 'sonner'
import { useDispositionOptionsQuery, useUpdateLeadMutation } from '../../services/leadsApi'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { parseApiError } from '../../lib/utils'
import type { Lead } from '../../types/models'
import { StageFields } from './StageFields'
import { stageChanged, stagePayload, stageValueOf, validateStage, type StageValue } from './stageForm'

/**
 * Stage + sub-stage picker (Lead Stages sheet); shows the counsellor action for
 * the pick. System stages (Untouched, Re-enquired, Application Submitted) are
 * set by the CRM only. Open stages also need the next follow-up (Go-live GL-19).
 */
export function ChangeStageModal({ lead, open, onClose }: { lead: Lead; open: boolean; onClose: () => void }) {
  const { data } = useDispositionOptionsQuery()
  const [updateLead, { isLoading }] = useUpdateLeadMutation()
  const stages = (data?.data.stages ?? []).filter((s) => !s.locked)
  const [value, setValue] = useState<StageValue>(() => stageValueOf(lead))
  const [errors, setErrors] = useState<Record<string, string>>({})

  const onSubmit = async () => {
    const local = validateStage(value, stages)
    if (Object.keys(local).length) return setErrors(local)
    try {
      await updateLead({ id: lead._id, body: stagePayload(value, stages) }).unwrap()
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
      title="Change Stage"
      description={`Current: ${lead.stage?.name ?? '—'}${lead.lastDisposition && lead.lastDisposition !== lead.stage?.name ? ` · ${lead.lastDisposition}` : ''}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit} loading={isLoading} disabled={!stageChanged(value, lead)}>
            Save
          </Button>
        </>
      }
    >
      <StageFields
        value={value}
        onChange={(v) => {
          setValue(v)
          setErrors({})
        }}
        stages={stages}
        followUpTypes={data?.data.followUpTypes ?? []}
        errors={errors}
      />
    </Modal>
  )
}
