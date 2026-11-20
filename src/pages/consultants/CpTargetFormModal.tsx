import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { useCpCreateTargetMutation, useCpTargetOptionsQuery, useCpUpdateTargetMutation } from '../../services/consultantsApi'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { ErrorState, LoadingState } from '../../components/ui/feedback'
import { FormField, Input, Select, Textarea } from '../../components/ui/fields'
import { parseApiError } from '../../lib/utils'
import type { CpTarget, CpTargetBody, CpTargetMeasure } from '../../types/consultants'
import { isoToLocalInput, localInputToIso } from './cpShared'

const DAY = 24 * 60 * 60 * 1000

const HINTS: Record<CpTargetMeasure, string> = {
  stage:
    'Counts the leads that reach this stage within the period while this person owns them. Moving on or closing keeps a lead counted; going back to an earlier stage takes it out.',
  sub_stage:
    'Counts the leads that reach this sub-stage within the period while this person owns them. Moving on or closing keeps a lead counted; going back to an earlier stage takes it out.',
  calls: 'Counts the calls this person logs (Log Call) within the period.',
}

/** The goal the server allows one active target per person for: "calls", "stage:<id>" or "sub_stage:<id>". */
function goalKey(measure: CpTargetMeasure, stage: string, subStage: string): string | null {
  if (measure === 'calls') return 'calls'
  if (measure === 'sub_stage') return subStage ? `sub_stage:${subStage}` : null
  return stage ? `stage:${stage}` : null
}

/**
 * Assign a Channel Partners target (a stage, a sub-stage or calls × a number within a period) to someone in the
 * partnership team, or edit an active one. A person runs one active target per goal: a goal already running for the
 * chosen person is flagged and cannot be saved.
 */
export function CpTargetFormModal({ target, onClose }: { target?: CpTarget; onClose: () => void }) {
  const { data: options, isLoading, isError, error, refetch } = useCpTargetOptionsQuery()
  const [createTarget, { isLoading: creating }] = useCpCreateTargetMutation()
  const [updateTarget, { isLoading: updating }] = useCpUpdateTargetMutation()

  // mounted fresh per open (keyed by the page), so the initial values derive once here
  const [assignee, setAssignee] = useState(target?.assignee._id ?? '')
  const [measure, setMeasure] = useState<CpTargetMeasure>(target?.measure ?? 'stage')
  const [stage, setStage] = useState(target?.measure === 'stage' ? (target.stage?._id ?? '') : '')
  const [subStage, setSubStage] = useState(target?.subStage?._id ?? '')
  const [count, setCount] = useState(target ? String(target.targetCount) : '')
  // a new target defaults to the next 30 days
  const [startAt, setStartAt] = useState(() => isoToLocalInput(target?.startAt ?? new Date().toISOString()))
  const [endAt, setEndAt] = useState(() => isoToLocalInput(target?.endAt ?? new Date(Date.now() + 30 * DAY).toISOString()))
  const [description, setDescription] = useState(target?.description ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const opts = options?.data
  const stages = opts?.stages ?? []
  const subStageStages = stages.filter((s) => s.subStages.length > 0)
  const assignees = opts?.assignees ?? []

  const key = goalKey(measure, stage, subStage)
  const ownKey = target ? goalKey(target.measure, target.stage?._id ?? '', target.subStage?._id ?? '') : null
  // the goals the chosen person already has running, less the target being edited
  const running = new Set(
    (opts?.busy[assignee] ?? []).filter((k) => !(target && assignee === target.assignee._id && k === ownKey))
  )
  const taken = !!key && running.has(key)
  const busyNote = (goal: string) => (running.has(goal) ? ' — already running' : '')

  // an edited target's person, stage or sub-stage may have left the options since (moved team, deactivated)
  const assigneeKnown = !assignee || assignees.some((u) => u._id === assignee)
  const stageKnown = !stage || stages.some((s) => s._id === stage)
  const subStageKnown = !subStage || stages.some((s) => s.subStages.some((x) => x._id === subStage))

  const goalName = () => {
    if (measure === 'calls') return 'Calls logged'
    if (measure === 'stage') return stages.find((s) => s._id === stage)?.name ?? 'this stage'
    for (const s of stages) {
      const sub = s.subStages.find((x) => x._id === subStage)
      if (sub) return `${sub.name} (${s.name})`
    }
    return 'this sub-stage'
  }
  const personName = assignees.find((u) => u._id === assignee)?.name ?? target?.assignee.name ?? 'This person'

  const onSubmit = async () => {
    const local: Record<string, string> = {}
    const n = Number(count)
    const startIso = localInputToIso(startAt)
    const endIso = localInputToIso(endAt)
    if (!assignee) local.assignee = 'Choose who the target is for'
    if (measure === 'stage' && !stage) local.stage = 'Choose a stage'
    if (measure === 'sub_stage' && !subStage) local.subStage = 'Choose a sub-stage'
    if (!count.trim() || !Number.isInteger(n) || n < 1) local.targetCount = 'Enter a whole number of at least 1'
    else if (n > 100000) local.targetCount = 'Enter at most 100000'
    if (!startIso) local.startAt = 'Choose the start'
    if (!endIso) local.endAt = 'Choose the end'
    else if (startIso && new Date(endAt) <= new Date(startAt)) local.endAt = 'End must be after the start'
    else if (new Date(endAt).getTime() <= Date.now()) local.endAt = 'End must be in the future'
    if (Object.keys(local).length || !startIso || !endIso) return setErrors(local)
    setErrors({})

    const body: CpTargetBody = {
      assignee,
      measure,
      stage: measure === 'stage' ? stage : null,
      subStage: measure === 'sub_stage' ? subStage : null,
      targetCount: n,
      description: description.trim(),
      startAt: startIso,
      endAt: endIso,
    }
    try {
      if (target) {
        // an edit sends what changed: an unchanged goal (its stage may be inactive by now) and times stay as saved
        const patch: Partial<CpTargetBody> = { ...body }
        if (key === ownKey) {
          delete patch.measure
          delete patch.stage
          delete patch.subStage
        }
        if (startAt === isoToLocalInput(target.startAt)) delete patch.startAt
        if (endAt === isoToLocalInput(target.endAt)) delete patch.endAt
        await updateTarget({ id: target._id, body: patch }).unwrap()
      } else {
        await createTarget(body).unwrap()
      }
      toast.success(target ? 'Target updated' : 'Target assigned')
      onClose()
    } catch (err) {
      const { message, errors: fe } = parseApiError(err)
      setErrors(fe)
      toast.error(message)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={target ? 'Edit target' : 'Assign target'}
      description="A goal for one person within a period. It is counted live and settled when the period ends: completed at 100%, otherwise expired."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit} loading={creating || updating} disabled={taken || !opts} data-testid="cp-target-save">
            {target ? 'Save' : 'Assign'}
          </Button>
        </>
      }
    >
      {isLoading ? (
        <LoadingState />
      ) : isError || !opts ? (
        <ErrorState message={parseApiError(error).message} onRetry={refetch} error={error} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="cp-target-form">
          <FormField
            label="Executive"
            required
            error={errors.assignee}
            className="sm:col-span-2"
            hint={assignees.length ? 'Someone in the partnership team you can assign to.' : 'Nobody in the partnership team can be assigned yet.'}
          >
            <Select
              value={assignee}
              aria-invalid={!!errors.assignee}
              data-testid="cp-target-assignee"
              onChange={(e) => setAssignee(e.target.value)}
            >
              <option value="">Select person…</option>
              {assignees.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name}
                </option>
              ))}
              {!assigneeKnown && <option value={assignee}>{target?.assignee.name ?? 'Current person'}</option>}
            </Select>
          </FormField>
          <FormField label="What it counts" required error={errors.measure} hint={HINTS[measure]} className="sm:col-span-2">
            <Select
              value={measure}
              aria-invalid={!!errors.measure}
              data-testid="cp-target-measure"
              onChange={(e) => setMeasure(e.target.value as CpTargetMeasure)}
            >
              {opts.measures.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                  {m.value === 'calls' ? busyNote('calls') : ''}
                </option>
              ))}
            </Select>
          </FormField>
          {measure === 'stage' && (
            <FormField label="Stage" required error={errors.stage}>
              <Select value={stage} aria-invalid={!!errors.stage} data-testid="cp-target-stage" onChange={(e) => setStage(e.target.value)}>
                <option value="">Select stage…</option>
                {stages.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                    {busyNote(`stage:${s._id}`)}
                  </option>
                ))}
                {!stageKnown && <option value={stage}>{target?.stage?.name ?? 'Current stage'} (inactive)</option>}
              </Select>
            </FormField>
          )}
          {measure === 'sub_stage' && (
            <FormField label="Sub-stage" required error={errors.subStage}>
              <Select
                value={subStage}
                aria-invalid={!!errors.subStage}
                data-testid="cp-target-substage"
                onChange={(e) => setSubStage(e.target.value)}
              >
                <option value="">Select sub-stage…</option>
                {subStageStages.map((s) => (
                  <optgroup key={s._id} label={s.name}>
                    {s.subStages.map((x) => (
                      <option key={x._id} value={x._id}>
                        {x.name}
                        {busyNote(`sub_stage:${x._id}`)}
                      </option>
                    ))}
                  </optgroup>
                ))}
                {!subStageKnown && <option value={subStage}>{target?.goalLabel ?? 'Current sub-stage'} (inactive)</option>}
              </Select>
            </FormField>
          )}
          <FormField label="Target number" required error={errors.targetCount}>
            <Input
              type="number"
              min={1}
              max={100000}
              step={1}
              inputMode="numeric"
              value={count}
              aria-invalid={!!errors.targetCount}
              data-testid="cp-target-count"
              onChange={(e) => setCount(e.target.value)}
            />
          </FormField>
          {taken && (
            <p
              role="alert"
              data-testid="cp-target-busy"
              className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 sm:col-span-2"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {personName} already has a running target for {goalName()}. Cancel it or let it complete before assigning another.
              </span>
            </p>
          )}
          <FormField label="Start" required error={errors.startAt} hint="Can be in the past">
            <Input
              type="datetime-local"
              value={startAt}
              aria-invalid={!!errors.startAt}
              data-testid="cp-target-start"
              onChange={(e) => setStartAt(e.target.value)}
            />
          </FormField>
          <FormField label="End" required error={errors.endAt} hint="Must be in the future">
            <Input
              type="datetime-local"
              value={endAt}
              aria-invalid={!!errors.endAt}
              data-testid="cp-target-end"
              onChange={(e) => setEndAt(e.target.value)}
            />
          </FormField>
          <FormField label="Description" error={errors.description} hint="Optional, max 1000 characters" className="sm:col-span-2">
            <Textarea rows={3} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
          </FormField>
        </div>
      )}
    </Modal>
  )
}
