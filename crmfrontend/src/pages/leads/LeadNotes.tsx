import { useState } from 'react'
import { Lock, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { useAddLeadNoteMutation, useEditLeadNoteMutation, useLeadNotesQuery } from '../../services/leadsApi'
import { Button } from '../../components/ui/Button'
import { Textarea } from '../../components/ui/fields'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/feedback'
import { formatDateTime, initials, parseApiError } from '../../lib/utils'
import type { Note } from '../../types/models'

const MAX = 2000

function NoteCard({ note, leadId }: { note: Note; leadId: string }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(note.body)
  const [edit, { isLoading }] = useEditLeadNoteMutation()

  const onSave = async () => {
    try {
      await edit({ id: leadId, noteId: note._id, body: text.trim() }).unwrap()
      toast.success('Note updated')
      setEditing(false)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700">
          {initials(note.createdBy?.name)}
        </span>
        <span className="text-xs font-medium text-slate-700">{note.createdBy?.name ?? 'System'}</span>
        {note.category && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{note.category}</span>}
        {note.edited && <span className="text-[10px] text-slate-400">edited</span>}
        <span className="ml-auto text-[11px] text-slate-400">{formatDateTime(note.createdAt)}</span>
        {note.editable && !editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} title="You can edit for 15 minutes after adding">
            <Pencil className="h-3 w-3" />
          </Button>
        )}
        {!note.editable && <Lock className="h-3 w-3 text-slate-300" aria-label="Locked" />}
      </div>
      {editing ? (
        <div className="space-y-2">
          <Textarea rows={3} maxLength={MAX} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={onSave} loading={isLoading} disabled={!text.trim()}>
              Save
            </Button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-sm text-slate-600">{note.body}</p>
      )}
    </div>
  )
}

/** GL-35 notes: up to 2,000 characters; the author can edit for 15 minutes; never deleted. */
export function LeadNotes({ leadId }: { leadId: string }) {
  const [body, setBody] = useState('')
  const { data, isLoading, isError, error, refetch } = useLeadNotesQuery(leadId)
  const [addNote, { isLoading: saving }] = useAddLeadNoteMutation()

  const onSubmit = async () => {
    if (!body.trim()) return
    try {
      await addNote({ id: leadId, body: body.trim() }).unwrap()
      setBody('')
      toast.success('Note added')
    } catch (err) {
      // Note text stays in the box so the user can retry (SOW §6).
      toast.error(parseApiError(err).message)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-1">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Add note</h3>
        <div className="space-y-2">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="What happened on this lead?" rows={5} maxLength={MAX} />
          <p className="text-right text-[11px] text-slate-400">
            {body.length} / {MAX.toLocaleString()}
          </p>
          <Button onClick={onSubmit} loading={saving} disabled={!body.trim()} className="w-full">
            Save note
          </Button>
          <p className="text-[11px] text-slate-400">Notes can be edited for 15 minutes, then they lock. Notes are never deleted.</p>
        </div>
      </div>

      <div className="lg:col-span-2">
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        )}
        {isError && <ErrorState message={parseApiError(error).message} onRetry={refetch} />}
        {!isLoading && !isError && !data?.data.length && (
          <EmptyState title="No notes yet" description="Counselling notes keep the next person in the loop." />
        )}
        <div className="space-y-3">
          {data?.data.map((note) => (
            <NoteCard key={note._id} note={note} leadId={leadId} />
          ))}
        </div>
      </div>
    </div>
  )
}
