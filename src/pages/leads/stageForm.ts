import type { DispositionStage, Lead } from '../../types/models'
import { toLocalInput } from '../tasks/taskMeta'

/** What the stage picker holds: the pick plus the follow-up an open stage needs (GL-19). */
export interface StageValue {
  stageId: string
  subStageId: string
  followUpAt: string
  followUpType: string
}

type StageOf = Pick<Lead, 'stage' | 'subStage'>

/** The picker's starting point for `lead`: its stage, unless the CRM set it (system stages cannot be re-chosen). */
export function stageValueOf(lead: StageOf): StageValue {
  return {
    stageId: lead.stage?.isSystem ? '' : (lead.stage?._id ?? ''),
    subStageId: lead.subStage ?? '',
    followUpAt: toLocalInput(new Date(Date.now() + 24 * 3600_000)),
    followUpType: 'follow_up_call',
  }
}

/** True when the pick moves the lead. An empty pick keeps the lead where it is. */
export function stageChanged(value: StageValue, lead: StageOf): boolean {
  if (!value.stageId) return false
  return value.stageId !== lead.stage?._id || (value.subStageId || null) !== (lead.subStage ?? null)
}

/** The rules the backend enforces, checked first so the form can point at the field. */
export function validateStage(value: StageValue, stages: DispositionStage[]): Record<string, string> {
  const errors: Record<string, string> = {}
  const stage = stages.find((s) => s._id === value.stageId)
  if (!stage) errors.stage = 'Select a stage'
  else if (stage.subStages.length && !stage.subStages.some((s) => s._id === value.subStageId)) errors.subStage = 'Select a sub-stage'
  if (stage?.requiresFollowUp && !value.followUpAt) errors.followUpAt = 'A next follow-up date-time is required for this stage'
  return errors
}

/** The stage part of a PUT /leads/:id body (the update API runs it through the disposition rules). */
export function stagePayload(value: StageValue, stages: DispositionStage[]): Record<string, unknown> {
  const stage = stages.find((s) => s._id === value.stageId)
  return {
    stage: value.stageId,
    subStage: value.subStageId || null,
    ...(stage?.requiresFollowUp ? { followUpAt: new Date(value.followUpAt).toISOString(), followUpType: value.followUpType } : {}),
  }
}

/** API field errors that belong to the stage picker rather than the lead form. */
export const STAGE_ERROR_KEYS: readonly string[] = ['stage', 'subStage', 'followUpAt', 'followUpType']
