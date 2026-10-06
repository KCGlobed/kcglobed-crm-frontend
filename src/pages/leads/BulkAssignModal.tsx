import { useState } from 'react'
import { toast } from 'sonner'
import { useBulkAssignMutation, useFilterFieldsQuery } from '../../services/leadsApi'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Checkbox, FormField, Select } from '../../components/ui/fields'
import { parseApiError } from '../../lib/utils'
import type { BulkAssignResult } from '../../types/models'
import { selectionBody, useCounsellors, type LeadSelection } from './leadSelection'


/**
 * GL-13 bulk assign: one counsellor, or "split equally among" a chosen set →
 * reason → confirm screen with the count per counsellor.
 */
export function BulkAssignModal({ selection, onClose, onDone }: { selection: LeadSelection; onClose: () => void; onDone: () => void }) {
  const counsellors = useCounsellors()
  const { data: meta } = useFilterFieldsQuery()
  const [mode, setMode] = useState<'one' | 'split'>('one')
  const [owner, setOwner] = useState('')
  const [owners, setOwners] = useState<string[]>([])
  const [reason, setReason] = useState('')
  const [preview, setPreview] = useState<BulkAssignResult | null>(null)
  const [assign, { isLoading }] = useBulkAssignMutation()
  const chosen = mode === 'one' ? (owner ? [owner] : []) : owners
  const reasons = meta?.data.assignReasons ?? ['New allocation', 'Workload', 'Leave', 'Language', 'Performance', 'Other']

  const run = async (dryRun: boolean) => {
    try {
      const res = await assign({ ...selectionBody(selection), owners: chosen, reason, preview: dryRun }).unwrap()
      if (dryRun) setPreview(res.data)
      else {
        toast.success(res.message)
        onDone()
      }
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={preview ? 'Confirm assignment' : `Assign ${selection.count} lead${selection.count === 1 ? '' : 's'}`}
      description="Open follow-ups move with the leads; the old owners lose access and both sides are notified."
      footer={
        preview ? (
          <>
            <Button variant="outline" onClick={() => setPreview(null)}>
              Back
            </Button>
            <Button onClick={() => run(false)} loading={isLoading}>
              Confirm — assign {preview.total}
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => run(true)} loading={isLoading} disabled={!chosen.length || !reason || (mode === 'split' && chosen.length < 2)}>
              Review
            </Button>
          </>
        )
      }
    >
      {preview ? (
        <div className="space-y-2">
          <p className="text-sm text-slate-600">
            <b>{preview.total}</b> leads · reason <b>{reason}</b>
          </p>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {preview.perCounsellor.map((p) => (
              <li key={p._id} className="flex justify-between px-3 py-2 text-sm">
                <span className="text-slate-700">{p.name}</span>
                <b className="text-slate-800">{p.count}</b>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2">
            {(['one', 'split'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 rounded-lg border px-3 py-2 text-left text-xs ${mode === m ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600'}`}
              >
                <b className="block text-sm">{m === 'one' ? 'One counsellor' : 'Split equally'}</b>
                {m === 'one' ? 'All selected leads to one person' : 'A → B → C … counts differ by at most one'}
              </button>
            ))}
          </div>
          {mode === 'one' ? (
            <FormField label="Counsellor" required>
              <Select value={owner} onChange={(e) => setOwner(e.target.value)}>
                <option value="">Choose…</option>
                {counsellors.map((u) => (
                  <option key={u._id} value={u._id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </FormField>
          ) : (
            <FormField label="Split equally among" required hint="Pick two or more Admission Counsellors">
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {counsellors.map((u) => (
                  <label key={u._id} className="flex items-center gap-2 text-sm text-slate-700">
                    <Checkbox
                      checked={owners.includes(u._id)}
                      onChange={(e) => setOwners((o) => (e.target.checked ? [...o, u._id] : o.filter((x) => x !== u._id)))}
                    />
                    {u.name}
                  </label>
                ))}
              </div>
            </FormField>
          )}
          <FormField label="Reason" required>
            <Select value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">Choose a reason…</option>
              {reasons.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </Select>
          </FormField>
        </div>
      )}
    </Modal>
  )
}
