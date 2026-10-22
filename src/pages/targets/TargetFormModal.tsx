import { useState } from 'react'
import { toast } from 'sonner'
import { useCreateTargetMutation, useTargetOptionsQuery, useUpdateTargetMutation } from '../../services/targetsApi'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { FormField, Input, Select, Textarea } from '../../components/ui/fields'
import { parseApiError } from '../../lib/utils'
import type { Target } from '../../types/models'
import { toLocalInput } from '../tasks/taskMeta'
import { ownerLabel, useAssignableOwners } from '../leads/leadSelection'

/**
 * Assign a target (stage × number within a date-time range) to someone in the caller's hierarchy, or edit
 * an active one. People who already run an active target are listed but cannot be picked.
 */
export function TargetFormModal({ target, onClose }: { target?: Target; onClose: () => void }) {
  const { data: options } = useTargetOptionsQuery()
  const assignable = useAssignableOwners()
  const [createTarget, { isLoading: creating }] = useCreateTargetMutation()
  const [updateTarget, { isLoading: updating }] = useUpdateTargetMutation()

  const [stage, setStage] = useState(target?.stage._id ?? '')
  const [count, setCount] = useState(target ? String(target.targetCount) : '')
  const [description, setDescription] = useState(target?.description ?? '')
  // a new target defaults to the next 30 days
  const [startAt, setStartAt] = useState(() => toLocalInput(target ? new Date(target.startAt) : new Date()))
  const [endAt, setEndAt] = useState(() =>
    toLocalInput(target ? new Date(target.endAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
  )
  const [assignee, setAssignee] = useState(target?.assignee._id ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const busy = options?.data.busyAssignees ?? {}

  const onSubmit = async () => {
    const local: Record<string, string> = {}
    if (!stage) local.stage = 'Choose a stage'
    if (!count || Number(count) < 1 || !Number.isInteger(Number(count))) local.targetCount = 'Enter a whole number of at least 1'
    if (!startAt) local.startAt = 'Choose the start'
    if (!endAt) local.endAt = 'Choose the end'
    else if (startAt && new Date(endAt) <= new Date(startAt)) local.endAt = 'End must be after the start'
    else if (new Date(endAt).getTime() <= Date.now()) local.endAt = 'End must be in the future'
    if (!assignee) local.assignee = 'Choose who the target is for'
    if (Object.keys(local).length) return setErrors(local)

    const body = {
      stage,
      targetCount: Number(count),
      description,
      startAt: new Date(startAt).toISOString(),
      endAt: new Date(endAt).toISOString(),
      assignee,
    }
    try {
      if (target) await updateTarget({ id: target._id, body }).unwrap()
      else await createTarget(body).unwrap()
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
      description="Progress counts the leads that reach the chosen stage within the dates while owned by this person. It completes automatically at 100%."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit} loading={creating || updating}>
            {target ? 'Save' : 'Assign'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Target (stage)" required error={errors.stage}>
          <Select value={stage} aria-invalid={!!errors.stage} onChange={(e) => setStage(e.target.value)}>
            <option value="">Select stage…</option>
            {options?.data.stages.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Target number" required error={errors.targetCount}>
          <Input type="number" min={1} step={1} value={count} aria-invalid={!!errors.targetCount} onChange={(e) => setCount(e.target.value)} />
        </FormField>
        <FormField label="Start" required error={errors.startAt}>
          <Input type="datetime-local" value={startAt} aria-invalid={!!errors.startAt} onChange={(e) => setStartAt(e.target.value)} />
        </FormField>
        <FormField label="End" required error={errors.endAt}>
          <Input type="datetime-local" value={endAt} aria-invalid={!!errors.endAt} onChange={(e) => setEndAt(e.target.value)} />
        </FormField>
        <FormField label="Assign to" required error={errors.assignee} className="sm:col-span-2"
          hint={assignable.length ? 'People in your team. Anyone already running an active target is unavailable.' : 'Nobody in your team can own leads yet.'}
        >
          <Select value={assignee} aria-invalid={!!errors.assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Select person…</option>
            {assignable.map((u) => {
              const taken = !!busy[u._id] && busy[u._id] !== target?._id
              return (
                <option key={u._id} value={u._id} disabled={taken}>
                  {ownerLabel(u)}
                  {taken ? ' — has an active target' : ''}
                </option>
              )
            })}
          </Select>
        </FormField>
        <FormField label="Description" error={errors.description} hint="Optional, max 1000 characters" className="sm:col-span-2">
          <Textarea rows={3} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormField>
      </div>
    </Modal>
  )
}
