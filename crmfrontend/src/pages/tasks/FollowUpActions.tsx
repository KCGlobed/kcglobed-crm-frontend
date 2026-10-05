import { useState, type MouseEvent } from 'react'
import { Check, CalendarClock, RotateCcw, X } from 'lucide-react'
import { toast } from 'sonner'
import { useUpdateTaskMutation } from '../../services/tasksApi'
import { useCurrentUser } from '../../app/hooks'
import { can } from '../../constants/permissions'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { FormField, Textarea } from '../../components/ui/fields'
import { parseApiError } from '../../lib/utils'
import type { Task } from '../../types/models'
import { FollowUpFormModal } from './FollowUpFormModal'

type Closing = 'done' | 'cancelled'

/** Done / Reschedule / Cancel for an open follow-up; Reopen for a closed one. */
export function FollowUpActions({ task }: { task: Task }) {
  const me = useCurrentUser()
  const [updateTask, { isLoading }] = useUpdateTaskMutation()
  const [closing, setClosing] = useState<Closing | null>(null)
  const [editing, setEditing] = useState(false)
  const [outcome, setOutcome] = useState('')

  if (!can(me, 'tasks', 'edit')) return null

  const save = async (body: Record<string, unknown>, message: string) => {
    try {
      await updateTask({ id: task._id, leadId: task.lead._id, body }).unwrap()
      toast.success(message)
      setClosing(null)
      setOutcome('')
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  // rows are clickable (they open the lead); action clicks must not bubble up
  const stop = (e: MouseEvent) => e.stopPropagation()

  if (task.status !== 'open') {
    return (
      <Button
        variant="ghost"
        size="sm"
        loading={isLoading}
        onClick={(e) => {
          stop(e)
          save({ status: 'open' }, 'Follow-up reopened')
        }}
      >
        <RotateCcw className="h-3.5 w-3.5" /> Reopen
      </Button>
    )
  }

  return (
    <div className="flex justify-end gap-1" onClick={stop}>
      <Button variant="ghost" size="sm" className="text-emerald-700" onClick={() => setClosing('done')}>
        <Check className="h-3.5 w-3.5" /> Done
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
        <CalendarClock className="h-3.5 w-3.5" /> Reschedule
      </Button>
      <Button variant="ghost" size="sm" className="text-red-600" aria-label="Cancel follow-up" onClick={() => setClosing('cancelled')}>
        <X className="h-3.5 w-3.5" />
      </Button>

      {closing && (
        <Modal
          open
          size="sm"
          onClose={() => setClosing(null)}
          title={closing === 'done' ? 'Complete follow-up' : 'Cancel follow-up'}
          description={`${task.typeLabel} · ${task.lead.firstName} ${task.lead.lastName ?? ''}`}
          footer={
            <>
              <Button variant="outline" onClick={() => setClosing(null)}>
                Back
              </Button>
              <Button
                variant={closing === 'done' ? 'primary' : 'danger'}
                loading={isLoading}
                onClick={() =>
                  save({ status: closing, outcome }, closing === 'done' ? 'Follow-up completed' : 'Follow-up cancelled')
                }
              >
                {closing === 'done' ? 'Mark done' : 'Cancel follow-up'}
              </Button>
            </>
          }
        >
          <FormField label={closing === 'done' ? 'Outcome' : 'Reason'} hint="Optional — saved on the lead's timeline">
            <Textarea rows={3} maxLength={500} value={outcome} onChange={(e) => setOutcome(e.target.value)} />
          </FormField>
        </Modal>
      )}
      {editing && <FollowUpFormModal leadId={task.lead._id} task={task} onClose={() => setEditing(false)} />}
    </div>
  )
}
