import { Lightbulb } from 'lucide-react'
import { FormField, Input, Select } from '../../components/ui/fields'
import type { DispositionStage } from '../../types/models'
import { taskTypeLabel, toLocalInput } from '../tasks/taskMeta'
import type { StageValue } from './stageForm'

/**
 * Stage + sub-stage picker (Lead Stages sheet) with the counsellor action for
 * the pick and the next follow-up an open stage needs. Shared by the Change
 * Stage modal and the Edit Lead form; the stages come from Masters.
 */
export function StageFields({
  value,
  onChange,
  stages,
  followUpTypes,
  errors,
  required = true,
}: {
  value: StageValue
  onChange: (value: StageValue) => void
  stages: DispositionStage[]
  followUpTypes: { value: string; label: string }[]
  errors: Record<string, string>
  /** false in the Edit Lead form, where an empty pick keeps the current stage */
  required?: boolean
}) {
  const stage = stages.find((s) => s._id === value.stageId)
  const subStages = stage?.subStages ?? []
  const subStage = subStages.find((s) => s._id === value.subStageId)
  return (
    <div className="space-y-3">
      <FormField label="Lead Stage" required={required} error={errors.stage}>
        <Select
          value={value.stageId}
          aria-invalid={!!errors.stage}
          onChange={(e) => onChange({ ...value, stageId: e.target.value, subStageId: '' })}
        >
          <option value="">{!stages.length ? 'Loading stages…' : required ? 'Select Stage…' : 'Keep Current Stage'}</option>
          {stages.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name}
            </option>
          ))}
        </Select>
      </FormField>
      {subStages.length > 0 && (
        <FormField label="Lead Sub-stage" required error={errors.subStage}>
          <Select value={value.subStageId} aria-invalid={!!errors.subStage} onChange={(e) => onChange({ ...value, subStageId: e.target.value })}>
            <option value="">Select Sub-stage…</option>
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
            <b>Counsellor Action:</b> {subStage.counsellorAction}
          </p>
        </div>
      )}
      {stage?.requiresFollowUp && (
        <div className="grid gap-2 rounded-lg border border-brand-100 bg-brand-50/40 p-3 sm:grid-cols-[1.3fr_1fr]">
          <FormField label="Next Follow-up" required error={errors.followUpAt}>
            <Input
              type="datetime-local"
              min={toLocalInput(new Date())}
              value={value.followUpAt}
              onChange={(e) => onChange({ ...value, followUpAt: e.target.value })}
              aria-invalid={!!errors.followUpAt}
            />
          </FormField>
          <FormField label="Type" error={errors.followUpType}>
            <Select value={value.followUpType} onChange={(e) => onChange({ ...value, followUpType: e.target.value })}>
              {followUpTypes.map((t) => (
                <option key={t.value} value={t.value}>
                  {taskTypeLabel(t.value, t.label)}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
      )}
    </div>
  )
}
