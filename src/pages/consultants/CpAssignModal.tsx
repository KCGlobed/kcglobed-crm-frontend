import { useState } from 'react'
import { toast } from 'sonner'
import { useCpAssignMutation, useCpMetaQuery } from '../../services/consultantsApi'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { FormField, Select } from '../../components/ui/fields'
import { parseApiError } from '../../lib/utils'
import type { CpLeadDetail } from '../../types/consultants'

const UNASSIGNED = '__unassigned'
const REASONS = ['New allocation', 'Workload', 'Leave', 'Language', 'Performance', 'Other']

/** One lead's assign / reassign (as on a student lead): the new owner from the partnership team + a reason. */
export default function CpAssignModal({ lead, onClose }: { lead: CpLeadDetail; onClose: () => void }) {
  const { data: meta } = useCpMetaQuery()
  const [owner, setOwner] = useState('')
  const [reason, setReason] = useState('')
  const [assign, { isLoading }] = useCpAssignMutation()
  const owners = (meta?.data.owners ?? []).filter((o) => o._id !== lead.owner?._id)

  const onSave = async () => {
    const to = owner === UNASSIGNED ? null : owner
    try {
      await assign({ ids: [lead._id], owner: to, reason }).unwrap()
      toast.success(to ? `Assigned to ${owners.find((o) => o._id === to)?.name ?? 'the new owner'}` : 'Moved to Unassigned')
      onClose()
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={lead.owner ? 'Reassign lead' : 'Assign lead'}
      description={lead.owner ? `Now with ${lead.owner.name}. Open follow-ups move to the new owner.` : 'From the Unassigned leads'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} loading={isLoading} disabled={!owner || !reason} data-testid="cp-assign-save">
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-3" data-testid="cp-assign-modal">
        <FormField
          label="Assign to"
          required
          hint={owners.length ? undefined : 'Nobody else can be assigned — users need View on Channel Partners › Leads.'}
        >
          <Select value={owner} onChange={(e) => setOwner(e.target.value)} data-testid="cp-assign-to">
            <option value="">Choose…</option>
            {lead.owner && <option value={UNASSIGNED}>Unassigned</option>}
            {owners.map((o) => (
              <option key={o._id} value={o._id}>
                {o.name}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Reason" required>
          <Select value={reason} onChange={(e) => setReason(e.target.value)} data-testid="cp-assign-reason">
            <option value="">Choose…</option>
            {REASONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        </FormField>
      </div>
    </Modal>
  )
}
