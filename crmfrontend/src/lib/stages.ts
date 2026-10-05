import type { Lead, Stage, SubStage } from '../types/models'

/** Stages a person may pick — system stages (e.g. Untouched) are set by the CRM only. */
export function selectableStages(stages: Stage[] | undefined): Stage[] {
  return (stages ?? []).filter((s) => s.isActive && !s.isSystem)
}

export function activeSubStages(stage: Stage | undefined | null): SubStage[] {
  return (stage?.subStages ?? []).filter((s) => s.isActive)
}

/** The lead's current sub-stage, resolved from its populated stage. */
export function subStageOf(lead: Pick<Lead, 'stage' | 'subStage'>): SubStage | undefined {
  if (!lead.subStage) return undefined
  return lead.stage?.subStages?.find((s) => s._id === lead.subStage)
}
