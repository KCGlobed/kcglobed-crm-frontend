import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useDeleteSavedTextMutation, useListSavedTextsQuery, useSaveSavedTextMutation } from '../../../services/messagingApi'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Checkbox, FormField, Input } from '../../../components/ui/fields'
import { Modal } from '../../../components/ui/Modal'
import { EmptyState, Skeleton } from '../../../components/ui/feedback'
import { DLT_VAR_MAX } from '../../../lib/smsTemplate'
import { formatDateTime, parseApiError } from '../../../lib/utils'
import type { SavedText } from '../../../types/models'

const isWebAddress = (text: string) => /^https?:\/\/\S+$/i.test(text)

function TextModal({ entry, onClose }: { entry?: SavedText; onClose: () => void }) {
  const [save, { isLoading }] = useSaveSavedTextMutation()
  const [name, setName] = useState(entry?.name ?? '')
  const [text, setText] = useState(entry?.text ?? '')
  const [active, setActive] = useState(entry?.isActive ?? true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const tooLong = text.trim().length > DLT_VAR_MAX

  const onSave = async () => {
    try {
      await save({ id: entry?._id, body: { name, text, isActive: active } }).unwrap()
      toast.success(entry ? 'Text updated' : 'Text added')
      onClose()
    } catch (err) {
      const parsed = parseApiError(err)
      setErrors(parsed.errors)
      toast.error(parsed.message)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={entry ? `Edit text · ${entry.name}` : 'New text'}
      description="Picked as a variable's source when sending an SMS or WhatsApp; goes out as the variable's value."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} loading={isLoading} disabled={!name.trim() || !text.trim() || tooLong}>
            {entry ? 'Save' : 'Add text'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <FormField label="Name" required error={errors.name} hint="Shown in the Saved text dropdown when sending">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Apply page" />
        </FormField>
        <FormField
          label="Text"
          required
          error={errors.text ?? (tooLong ? `At most ${DLT_VAR_MAX} characters (DLT rule for a variable) — for a web address use a short link` : undefined)}
          hint={`A short link, a date, a venue… one line · ${text.trim().length}/${DLT_VAR_MAX} characters`}
        >
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="https://gcc.sc/apply" />
        </FormField>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <Checkbox checked={active} onChange={(e) => setActive(e.target.checked)} /> Active (offered when sending)
        </label>
      </div>
    </Modal>
  )
}

/** Communication → Texts: the saved values a template variable can be filled with. */
export function TextsTab() {
  const { data, isLoading } = useListSavedTextsQuery()
  const [remove, { isLoading: removing }] = useDeleteSavedTextMutation()
  const [editing, setEditing] = useState<SavedText | 'new' | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)

  const onDelete = async (id: string) => {
    try {
      await remove(id).unwrap()
      toast.success('Text deleted')
    } catch (err) {
      toast.error(parseApiError(err).message)
    } finally {
      setConfirming(null)
    }
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          When sending, a variable's source can be "Saved text"; the chosen text goes out as the variable's value (max {DLT_VAR_MAX} characters, DLT rule).
        </p>
        <Button size="sm" onClick={() => setEditing('new')}>
          <Plus className="h-3.5 w-3.5" /> New text
        </Button>
      </div>
      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !data?.data.length ? (
        <EmptyState title="No saved texts yet" description="Add the values you send in SMS and WhatsApp variables — apply link, exam date, venue, payment link." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Text</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Updated</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.data.map((s) => (
                <tr key={s._id} className="hover:bg-slate-50">
                  <td className="cursor-pointer px-4 py-2 font-medium text-slate-800" onClick={() => setEditing(s)}>
                    {s.name}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-600">
                    {isWebAddress(s.text) ? (
                      <a href={s.text} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
                        {s.text}
                      </a>
                    ) : (
                      s.text
                    )}{' '}
                    <span className="text-slate-400">· {s.text.length}/{DLT_VAR_MAX}</span>
                  </td>
                  <td className="px-4 py-2">
                    <Badge tone={s.isActive ? 'green' : 'slate'}>{s.isActive ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">{formatDateTime(s.updatedAt)}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(s)}>
                        Edit
                      </Button>
                      {confirming === s._id ? (
                        <>
                          <Button size="sm" variant="ghost" className="text-red-600" loading={removing} onClick={() => onDelete(s._id)}>
                            Confirm delete
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setConfirming(null)}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="ghost" className="text-red-600" title="Delete" onClick={() => setConfirming(s._id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <TextModal entry={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  )
}
