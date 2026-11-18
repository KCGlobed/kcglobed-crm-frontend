import { useState } from 'react'
import { ArrowDown, ArrowUp, Ban, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useCpCreateStageMutation, useCpDeleteStageMutation, useCpUpdateStageMutation } from '../../services/consultantsApi'
import { Drawer } from '../../components/ui/Drawer'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/feedback'
import { Checkbox, FieldGroup, FormField, Input, Select, Switch } from '../../components/ui/fields'
import { cn, parseApiError } from '../../lib/utils'
import type { CpSettings, CpStage, CpStageType } from '../../types/consultants'
import { CpStageBadge } from './CpStageBadge'
import { CP_STAGE_TYPES } from './cpShared'

const DEFAULT_COLOR = '#2563eb'

interface SubDraft {
  /** React key: the saved id, or a client one for a new row */
  key: string
  _id?: string
  name: string
  isActive: boolean
  requiresRemark: boolean
  /** a document type key, '' for none */
  requiredDocument: string
  needsApproval: boolean
  movesToStudent: boolean
  /** why it cannot be removed (on leads, or in a rule): it is deactivated instead */
  locked: string | null
}

let draftSeq = 0
const draftKey = () => `new-${(draftSeq += 1)}`

/** Why a saved sub-stage cannot be removed, mirroring the server's check (leads, history, the attempts and entry rules). */
function lockReason(subId: string, used: boolean | undefined, stages: CpStage[], settings: CpSettings): string | null {
  if (used) return 'Used on leads'
  if (settings.dropSubStage === subId) return 'Used by the call-attempts rule'
  const opens = stages.find((s) => s.entrySubStage === subId)
  return opens ? `Opens the "${opens.name}" stage` : null
}

/**
 * Add / edit a Channel Partners stage with its sub-stages (Lead Stages). Changes apply to Channel Partners only.
 * `readOnly` shows the same form disabled (View on consultants.stages without Edit).
 */
export function CpStageFormDrawer({
  stage,
  stages,
  settings,
  documentTypes,
  readOnly,
  onClose,
}: {
  stage?: CpStage
  /** every stage (active and inactive), in order */
  stages: CpStage[]
  settings: CpSettings
  documentTypes: Record<string, string>
  readOnly?: boolean
  onClose: () => void
}) {
  const [createStage, { isLoading: creating }] = useCpCreateStageMutation()
  const [updateStage, { isLoading: updating }] = useCpUpdateStageMutation()
  const [deleteStage, { isLoading: deleting }] = useCpDeleteStageMutation()

  // mounted fresh per open (keyed by the parent), so the initial values derive once here
  const [name, setName] = useState(stage?.name ?? '')
  const [type, setType] = useState<CpStageType>(stage?.type ?? 'open')
  const [color, setColor] = useState<string | null>(stage ? stage.color : DEFAULT_COLOR)
  const [isActive, setIsActive] = useState(stage?.isActive ?? true)
  const [countsAsAttempt, setCountsAsAttempt] = useState(stage?.countsAsAttempt ?? false)
  const [entrySubStage, setEntrySubStage] = useState(stage?.entrySubStage ?? '')
  const [subs, setSubs] = useState<SubDraft[]>(() =>
    (stage?.subStages ?? []).map((s) => ({
      key: s._id,
      _id: s._id,
      name: s.name,
      isActive: s.isActive,
      requiresRemark: s.requiresRemark,
      requiredDocument: s.requiredDocument ?? '',
      needsApproval: s.needsApproval,
      movesToStudent: s.movesToStudent,
      locked: lockReason(s._id, s.used, stages, settings),
    }))
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirmDelete, setConfirmDelete] = useState(false)

  const otherStages = stages.filter((s) => s._id !== stage?._id && s.subStages.length > 0)
  const entryKnown = !entrySubStage || otherStages.some((s) => s.subStages.some((x) => x._id === entrySubStage))
  const documentOptions = Object.entries(documentTypes)

  const updateSub = (i: number, patch: Partial<SubDraft>) => setSubs((list) => list.map((s, idx) => (idx === i ? { ...s, ...patch } : s)))
  const moveSub = (i: number, by: -1 | 1) =>
    setSubs((list) => {
      const next = [...list]
      const [item] = next.splice(i, 1)
      next.splice(i + by, 0, item)
      return next
    })
  const addSub = () => {
    const key = draftKey()
    setSubs((list) => [
      ...list,
      {
        key,
        name: '',
        isActive: true,
        requiresRemark: false,
        requiredDocument: '',
        needsApproval: false,
        movesToStudent: false,
        locked: null,
      },
    ])
  }

  const onSave = async () => {
    const local: Record<string, string> = {}
    if (!name.trim()) local.name = 'Stage name is required'
    const seen = new Map<string, number>()
    subs.forEach((s, i) => {
      const key = s.name.trim().toLowerCase()
      if (!key) local[`subStages.${i}.name`] = 'Name the sub-stage'
      else if (seen.has(key)) local[`subStages.${i}.name`] = 'Two sub-stages have the same name'
      else seen.set(key, i)
    })
    if (Object.keys(local).length) {
      setErrors(local)
      return
    }
    setErrors({})
    const body = {
      name: name.trim(),
      type,
      color,
      isActive,
      countsAsAttempt,
      entrySubStage: entrySubStage || null,
      subStages: subs.map((s) => ({
        ...(s._id ? { _id: s._id } : {}),
        name: s.name.trim(),
        isActive: s.isActive,
        requiresRemark: s.requiresRemark,
        requiredDocument: s.requiredDocument || null,
        needsApproval: s.needsApproval,
        movesToStudent: s.movesToStudent,
      })),
    }
    try {
      if (stage) await updateStage({ id: stage._id, body }).unwrap()
      else await createStage(body).unwrap()
      toast.success(stage ? 'Stage saved' : 'Stage added')
      onClose()
    } catch (err) {
      const { message, errors: fe } = parseApiError(err)
      setErrors(fe)
      toast.error(message)
    }
  }

  const onDelete = async () => {
    if (!stage) return
    try {
      await deleteStage(stage._id).unwrap()
      toast.success('Stage deleted')
      setConfirmDelete(false)
      onClose()
    } catch (err) {
      toast.error(parseApiError(err).message)
      setConfirmDelete(false)
    }
  }

  const title = readOnly ? stage?.name ?? 'Stage' : stage ? 'Edit stage' : 'Add stage'

  return (
    <>
      <Drawer
        open
        wide
        onClose={onClose}
        title={title}
        description="Channel Partners only: student stages are managed in Masters and never change here."
        footer={
          readOnly ? (
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          ) : (
            <>
              {stage &&
                (stage.used === false ? (
                  <Button variant="outline" className="mr-auto text-red-600" data-testid="cp-stage-delete" onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete stage
                  </Button>
                ) : (
                  <span className="mr-auto self-center text-[11px] text-slate-500" data-testid="cp-stage-used">
                    Used on leads — deactivate instead
                  </span>
                ))}
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={onSave} loading={creating || updating} data-testid="cp-stage-save">
                {stage ? 'Save' : 'Add stage'}
              </Button>
            </>
          )
        }
      >
        <fieldset disabled={readOnly} className="min-w-0 space-y-6">
          <FieldGroup title="Stage">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Name" required error={errors.name} hint={stage ? 'A rename shows on past records too' : undefined}>
                <Input
                  value={name}
                  maxLength={100}
                  placeholder="e.g. Interested"
                  aria-invalid={!!errors.name}
                  data-testid="cp-stage-name"
                  onChange={(e) => setName(e.target.value)}
                />
              </FormField>
              <FormField label="Colour" error={errors.color}>
                <div className="flex h-9 items-center gap-2">
                  <input
                    type="color"
                    aria-label="Stage colour"
                    data-testid="cp-stage-color"
                    value={color ?? DEFAULT_COLOR}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-9 w-11 shrink-0 cursor-pointer rounded-lg border border-slate-300 bg-white p-1 disabled:cursor-not-allowed"
                  />
                  <CpStageBadge stage={{ name: name.trim() || 'Preview', color }} className="max-w-40 truncate" />
                  {color ? (
                    <span className="font-mono text-[11px] text-slate-500">{color}</span>
                  ) : (
                    <span className="text-[11px] text-slate-400">No colour</span>
                  )}
                  {color && !readOnly && (
                    <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setColor(null)}>
                      Clear
                    </Button>
                  )}
                </div>
              </FormField>
            </div>
            <FormField label="Type" required error={errors.type}>
              <div role="radiogroup" aria-label="Type" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {CP_STAGE_TYPES.map((t) => (
                  <label
                    key={t.value}
                    className={cn(
                      'flex cursor-pointer gap-2 rounded-lg border p-2.5 text-xs transition-colors',
                      type === t.value ? 'border-brand-500 bg-brand-50/60 ring-1 ring-brand-200' : 'border-slate-200 hover:border-slate-300',
                      readOnly && 'cursor-default'
                    )}
                  >
                    <input
                      type="radio"
                      name="cp-stage-type"
                      value={t.value}
                      checked={type === t.value}
                      onChange={() => setType(t.value)}
                      data-testid={`cp-stage-type-${t.value}`}
                      className="mt-0.5 accent-brand-600"
                    />
                    <span>
                      <span className="block font-semibold text-slate-800">{t.label}</span>
                      <span className="text-[11px] leading-4 text-slate-500">{t.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </FormField>
            <div className="flex items-start gap-2.5">
              <Switch checked={isActive} onChange={setIsActive} label="Active" className="mt-0.5" />
              <div className="text-xs">
                <p className="font-medium text-slate-700">{isActive ? 'Active' : 'Inactive'}</p>
                <p className="text-[11px] leading-4 text-slate-500">
                  {isActive
                    ? 'The team can move leads to this stage.'
                    : 'Cannot be picked any more; leads already in it keep it.'}
                  {!isActive && !!stage?.leadCount && ` ${stage.leadCount} lead${stage.leadCount === 1 ? ' is' : 's are'} in it now.`}
                </p>
              </div>
            </div>
          </FieldGroup>
  
          <FieldGroup title="Rules">
            <label className="flex items-start gap-2 text-xs text-slate-700">
              <Checkbox
                className="mt-0.5"
                checked={countsAsAttempt}
                data-testid="cp-stage-attempt"
                onChange={(e) => setCountsAsAttempt(e.target.checked)}
              />
              <span>
                <span className="font-medium">Counts as a call attempt (not connected)</span>
                <span className="block text-[11px] leading-4 text-slate-500">
                  Calls logged in this stage add up; after the limit in Call attempts the lead is moved on. A connected call starts the count again.
                </span>
              </span>
            </label>
            <FormField
              label="Opens only after sub-stage"
              error={errors.entrySubStage}
              hint="Leads can move to this stage only once this sub-stage was recorded (e.g. Documentation after Countersigned by GCC School)."
            >
              <Select
                value={entrySubStage}
                aria-invalid={!!errors.entrySubStage}
                data-testid="cp-stage-entry"
                onChange={(e) => setEntrySubStage(e.target.value)}
              >
                <option value="">None — opens any time</option>
                {otherStages.map((s) => (
                  <optgroup key={s._id} label={s.isActive ? s.name : `${s.name} (inactive)`}>
                    {s.subStages.map((x) => (
                      <option key={x._id} value={x._id}>
                        {x.name}
                        {x.isActive ? '' : ' (inactive)'}
                      </option>
                    ))}
                  </optgroup>
                ))}
                {!entryKnown && <option value={entrySubStage}>Current sub-stage</option>}
              </Select>
            </FormField>
          </FieldGroup>
  
          <FieldGroup
            title="Sub-stages"
            description="In the order the team sees them. A sub-stage used on a lead or in a rule can be deactivated but not removed."
          >
            {errors.subStages && (
              <p role="alert" className="text-[11px] font-medium text-red-600">
                {errors.subStages}
              </p>
            )}
            {subs.length === 0 && <p className="text-xs text-slate-400">No sub-stages. Leads in this stage need none.</p>}
            <div className="space-y-2">
              {subs.map((s, i) => {
                const nameError = errors[`subStages.${i}.name`]
                return (
                  <div
                    key={s.key}
                    data-testid="cp-substage-row"
                    className={cn('rounded-lg border border-slate-200 p-2.5', !s.isActive && 'bg-slate-50')}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 shrink-0 text-right text-[11px] tabular-nums text-slate-400">{i + 1}</span>
                      <Input
                        value={s.name}
                        maxLength={150}
                        placeholder="Sub-stage name"
                        aria-label={`Sub-stage ${i + 1} name`}
                        aria-invalid={!!nameError}
                        data-testid="cp-substage-name"
                        className={cn(!s.isActive && 'text-slate-500')}
                        onChange={(e) => updateSub(i, { name: e.target.value })}
                      />
                      <span className="flex shrink-0 items-center gap-1.5 text-[11px] text-slate-600">
                        <Switch checked={s.isActive} label={`Sub-stage ${i + 1} active`} onChange={(v) => updateSub(i, { isActive: v })} />
                        <span className="hidden w-11 sm:inline">{s.isActive ? 'Active' : 'Inactive'}</span>
                      </span>
                      {!readOnly && (
                        <>
                          <Button variant="ghost" size="icon" aria-label="Move up" title="Move up" disabled={i === 0} onClick={() => moveSub(i, -1)}>
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Move down"
                            title="Move down"
                            disabled={i === subs.length - 1}
                            onClick={() => moveSub(i, 1)}
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                          {s.locked ? (
                            s.isActive ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-amber-700"
                                title={`${s.locked}: it can be deactivated, not removed`}
                                data-testid="cp-substage-deactivate"
                                onClick={() => updateSub(i, { isActive: false })}
                              >
                                <Ban className="h-3.5 w-3.5" /> Deactivate
                              </Button>
                            ) : (
                              <span className="w-8 shrink-0" />
                            )
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-600"
                              aria-label="Remove sub-stage"
                              title="Remove sub-stage"
                              data-testid="cp-substage-remove"
                              onClick={() => setSubs((list) => list.filter((_, idx) => idx !== i))}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                    {nameError && <p className="ml-7 mt-1 text-[11px] font-medium text-red-600">{nameError}</p>}
                    <div className="ml-7 mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-600">
                      <label className="flex items-center gap-1.5">
                        <Checkbox checked={s.requiresRemark} onChange={(e) => updateSub(i, { requiresRemark: e.target.checked })} /> Remark required
                      </label>
                      <label className="flex items-center gap-1.5">
                        <Checkbox checked={s.needsApproval} onChange={(e) => updateSub(i, { needsApproval: e.target.checked })} />
                        Needs manager approval
                      </label>
                      <label className="flex items-center gap-1.5">
                        <Checkbox checked={s.movesToStudent} onChange={(e) => updateSub(i, { movesToStudent: e.target.checked })} />
                        Moves to student Leads
                      </label>
                      <label className="flex items-center gap-1.5">
                        Document required
                        <Select
                          className="!h-7 !w-auto !py-0 text-[11px]"
                          value={s.requiredDocument}
                          onChange={(e) => updateSub(i, { requiredDocument: e.target.value })}
                        >
                          <option value="">None</option>
                          {documentOptions.map(([key, label]) => (
                            <option key={key} value={key}>
                              {label}
                            </option>
                          ))}
                          {s.requiredDocument && !(s.requiredDocument in documentTypes) && (
                            <option value={s.requiredDocument}>{s.requiredDocument}</option>
                          )}
                        </Select>
                      </label>
                    </div>
                    {s.locked && <p className="ml-7 mt-1.5 text-[11px] text-slate-400">{s.locked} — deactivate it instead of removing it.</p>}
                  </div>
                )
              })}
            </div>
            {!readOnly && (
              <Button variant="outline" size="sm" data-testid="cp-substage-add" onClick={addSub}>
                <Plus className="h-3.5 w-3.5" /> Add sub-stage
              </Button>
            )}
          </FieldGroup>
        </fieldset>
      </Drawer>
      {stage && (
        <ConfirmDialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={onDelete}
          title="Delete stage"
          message={`Delete "${stage.name}" and its sub-stages? It is on no lead, so nothing else changes. This cannot be undone.`}
          confirmLabel="Delete"
          danger
          loading={deleting}
        />
      )}
    </>
  )
}
