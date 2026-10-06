import type { Task, TaskType } from '../../types/models'

export const TASK_TYPES: { value: TaskType; label: string }[] = [
  // Go-live GL-36
  { value: 'call_back', label: 'Call back' },
  { value: 'follow_up_call', label: 'Follow-up call' },
  { value: 'counselling_session', label: 'Counselling session' },
  { value: 'expert_one_on_one', label: 'Expert one-on-one' },
  { value: 'document_collection', label: 'Document collection' },
  { value: 'other', label: 'Other' },
]

export const REMINDER_OPTIONS = [5, 15, 30, 60] as const

/** 'YYYY-MM-DDTHH:mm' in local time, for <input type="datetime-local"> */
export function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function statusTone(task: Task): 'red' | 'blue' | 'green' | 'slate' {
  if (task.status === 'done') return 'green'
  if (task.status === 'cancelled') return 'slate'
  return task.isOverdue ? 'red' : 'blue'
}

export function statusLabel(task: Task): string {
  if (task.status === 'open') return task.isOverdue ? 'Overdue' : 'Open'
  return task.status === 'done' ? 'Done' : 'Cancelled'
}
