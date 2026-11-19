import type { Lead, Stage, SubStage } from '../types/models'

/** Stages a person may pick — system stages (e.g. Untouched) are set by the CRM only. */
export function selectableStages(stages: Stage[] | undefined): Stage[] {
  return (stages ?? []).filter((s) => s.isActive && !s.isSystem)
}

export function activeSubStages(stage: Stage | undefined | null): SubStage[] {
  return (stage?.subStages ?? []).filter((s) => s.isActive)
}

/**
 * First Touch filter (Leads + Analytics: ?first_stage / ?first_sub_stage) — the first stage / disposition a lead was
 * moved to. Untouched / Re-enquired are never a first touch (the backend skips them), so they are not offered.
 */
export const NOT_TOUCHED = '__none__'
const firstTouchStages = (stages: Stage[] | undefined) =>
  (stages ?? []).filter((s) => !['untouched', 're-enquired'].includes(s.name.trim().toLowerCase()))

export function firstTouchOptions(stages: Stage[] | undefined): { value: string; label: string }[] {
  return [{ value: NOT_TOUCHED, label: 'Not touched yet' }, ...firstTouchStages(stages).map((s) => ({ value: s._id, label: s.name }))]
}

/** Dispositions of the chosen first-touch stages — inactive ones too: a lead's first disposition may have been retired. */
export function firstTouchSubOptions(stages: Stage[] | undefined, stageIds: string[]): { value: string; label: string }[] {
  return firstTouchStages(stages)
    .filter((s) => stageIds.includes(s._id))
    .flatMap((s) => (s.subStages ?? []).map((sub) => ({ value: sub._id, label: stageIds.length > 1 ? `${s.name} · ${sub.name}` : sub.name })))
}

/** ?first_stage changed: keep only the chosen dispositions that belong to a still-chosen stage. */
export function keepFirstTouchSubs(stages: Stage[] | undefined, stageIds: string[], subIds: string[]): string[] {
  const allowed = new Set(firstTouchSubOptions(stages, stageIds).map((o) => o.value))
  return subIds.filter((id) => allowed.has(id))
}

/** The lead's current sub-stage, resolved from its populated stage. */
export function subStageOf(lead: Pick<Lead, 'stage' | 'subStage'>): SubStage | undefined {
  if (!lead.subStage) return undefined
  return lead.stage?.subStages?.find((s) => s._id === lead.subStage)
}
