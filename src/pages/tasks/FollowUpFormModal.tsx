import { useState } from 'react'
import { toast } from 'sonner'
import { useCreateTaskMutation, useUpdateTaskMutation } from '../../services/tasksApi'
import { useUserOptionsQuery } from '../../services/adminApi'
import { useCurrentUser } from '../../app/hooks'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { FormField, Input, Select, Textarea } from '../../components/ui/fields'
import { parseApiError } from '../../lib/utils'
import type { Task, TaskType } from '../../types/models'
import { REMINDER_OPTIONS, TASK_TYPES, toLocalInput } from './taskMeta'

interface Props {
  leadId: string
  /** the lead's owner, the default assignee */
  ownerId?: string
  /** edit / reschedule an existing follow-up */
  task?: Task
  onClose: () => void
}

/** Schedule a follow-up on a lead, or reschedule/edit one (Deep Dive §10.2). */
export function FollowUpFormModal({ leadId, ownerId, task, onClose }: Props) {
  const me = useCurrentUser()
  const canAssignOthers = !!me && (me.isSuperAdmin || me.dataScope !== 'own')
  const { data: users } = useUserOptionsQuery(undefined, { skip: !canAssignOthers })
  const [createTask, { isLoading: creating }] = useCreateTaskMutation()
  const [updateTask, { isLoading: updating }] = useUpdateTaskMutation()

  const [type, setType] = useState<TaskType | ''>(task?.type ?? '')
  // a new follow-up defaults to an hour from now
  const [due, setDue] = useState(() => toLocalInput(task ? new Date(task.dueAt) : new Date(Date.now() + 60 * 60 * 1000)))
  const [minDue] = useState(() => toLocalInput(new Date()))
  const [priority, setPriority] = useState(task?.priority ?? 'normal')
  const [reminder, setReminder] = useState<number>(task?.reminderMinutes ?? 15)
  const [assignee, setAssignee] = useState(task?.assignee._id ?? ownerId ?? me?._id ?? '')
  const [notes, setNotes] = useState(task?.notes ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const onSubmit = async () => {
    const local: Record<string, string> = {}
    if (!type) local.type = 'Select a follow-up type'
    if (!due) local.dueAt = 'Due date-time is required'
    else if (new Date(due).getTime() < Date.now() - 60_000) local.dueAt = 'Due date-time cannot be in the past'
    if (Object.keys(local).length) return setErrors(local)

    const body = {
      type,
      dueAt: new Date(due).toISOString(),
      priority,
      reminderMinutes: reminder,
      notes,
      ...(canAssignOthers && assignee ? { assignee } : {}),
    }
    try {
      if (task) await updateTask({ id: task._id, leadId, body }).unwrap()
      else await createTask({ leadId, body }).unwrap()
      toast.success(task ? 'Follow-up updated' : 'Follow-up scheduled')
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
      title={task ? 'Edit follow-up' : 'Schedule follow-up'}
      description="The assignee gets a reminder before it is due and an alert if it goes overdue."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit} loading={creating || updating}>
            {task ? 'Save' : 'Schedule'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Type" required error={errors.type} className="sm:col-span-2">
          <Select value={type} aria-invalid={!!errors.type} onChange={(e) => setType(e.target.value as TaskType)}>
            <option value="">Select type…</option>
            {TASK_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Due" required error={errors.dueAt}>
          <Input type="datetime-local" value={due} min={minDue} aria-invalid={!!errors.dueAt} onChange={(e) => setDue(e.target.value)} />
        </FormField>
        <FormField label="Reminder" error={errors.reminderMinutes}>
          <Select value={reminder} onChange={(e) => setReminder(Number(e.target.value))}>
            {REMINDER_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m} min before
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Priority">
          <Select value={priority} onChange={(e) => setPriority(e.target.value as 'high' | 'normal')}>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </Select>
        </FormField>
        {canAssignOthers ? (
          <FormField label="Assignee" error={errors.assignee}>
            <Select value={assignee} aria-invalid={!!errors.assignee} onChange={(e) => setAssignee(e.target.value)}>
              {users?.data.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </FormField>
        ) : (
          <FormField label="Assignee" hint="You can schedule follow-ups for yourself">
            <Input value={me?.name ?? ''} disabled readOnly />
          </FormField>
        )}
        <FormField label="Notes" error={errors.notes} hint="Optional, max 500 characters" className="sm:col-span-2">
          <Textarea rows={3} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
      </div>
    </Modal>
  )
}
