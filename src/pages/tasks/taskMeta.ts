import type { Task, TaskType } from '../../types/models'

export const TASK_TYPES: { value: TaskType; label: string }[] = [
  // Go-live GL-36
  { value: 'call_back', label: 'Call Back' },
  { value: 'follow_up_call', label: 'Follow-up Call' },
  { value: 'counselling_session', label: 'Counselling Session' },
  { value: 'expert_one_on_one', label: 'Expert One-on-One' },
  { value: 'document_collection', label: 'Document Collection' },
  { value: 'parents_discussion', label: 'Parents Discussion' },
  { value: 'in_person_meeting', label: 'In-Person Meeting' },
  { value: 'other', label: 'Other' },
]

/** Display name of a follow-up type; API-provided lists carry the backend's label as the fallback. */
export const taskTypeLabel = (value: string, fallback?: string) => TASK_TYPES.find((t) => t.value === value)?.label ?? fallback ?? value

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
