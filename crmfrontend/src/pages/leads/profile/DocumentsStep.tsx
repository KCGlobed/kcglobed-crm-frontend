import { useState } from 'react'
import { Check, Download, FileUp } from 'lucide-react'
import { toast } from 'sonner'
import { useLeadDocumentsQuery, useUploadLeadDocumentMutation } from '../../../services/leadsApi'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { ErrorState, Skeleton } from '../../../components/ui/feedback'
import { formatDateTime, parseApiError } from '../../../lib/utils'
import { authorizedDownload } from '../../../lib/download'
import type { DocumentSlot } from '../../../types/models'
import { Section } from './ProfileFields'

function Slot({ leadId, slot, readOnly }: { leadId: string; slot: DocumentSlot; readOnly: boolean }) {
  const [upload, { isLoading }] = useUploadLeadDocumentMutation()
  const [showHistory, setShowHistory] = useState(false)

  const pick = async (file?: File) => {
    if (!file) return
    const ext = `.${file.name.split('.').pop()?.toLowerCase()}`
    if (!slot.accept.includes(ext)) return toast.error(`${slot.label}: ${slot.accept.join(', ')} only`)
    if (file.size > slot.maxMb * 1024 * 1024) return toast.error(`${slot.label} can be at most ${slot.maxMb} MB`)
    const fd = new FormData()
    fd.append('type', slot.type)
    fd.append('file', file)
    try {
      await upload({ id: leadId, body: fd }).unwrap()
      toast.success(`${slot.label} ${slot.current ? 'replaced' : 'uploaded'}`)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  const download = (id: string, name: string) =>
    authorizedDownload(`/leads/${leadId}/documents/${id}/download`, name).catch((e) => toast.error(parseApiError(e).message))

  return (
    <li className="rounded-lg border border-slate-200 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-slate-700">
            {slot.label}
            {slot.mandatory ? <Badge tone="red">Required</Badge> : <Badge>Optional</Badge>}
            {slot.current && <Check className="h-4 w-4 text-emerald-600" />}
          </p>
          <p className="text-[11px] text-slate-400">
            {slot.accept.map((a) => a.slice(1).toUpperCase()).filter((a) => a !== 'JPEG').join(' / ')} · max {slot.maxMb} MB
          </p>
        </div>
        <div className="flex items-center gap-2">
          {slot.current && (
            <Button variant="ghost" size="sm" onClick={() => download(slot.current!._id, slot.current!.fileName)}>
              <Download className="h-3.5 w-3.5" /> {slot.current.fileName}
            </Button>
          )}
          {!readOnly && (
            <label className={`inline-flex cursor-pointer items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 ${isLoading ? 'opacity-50' : ''}`}>
              <FileUp className="h-3.5 w-3.5" /> {slot.current ? 'Replace' : 'Upload'}
              <input type="file" className="hidden" accept={slot.accept.join(',')} disabled={isLoading} onChange={(e) => pick(e.target.files?.[0])} />
            </label>
          )}
        </div>
      </div>
      {slot.history.length > 0 && (
        <button className="mt-1 text-[11px] text-slate-500 underline" onClick={() => setShowHistory((s) => !s)}>
          {showHistory ? 'Hide' : 'Show'} {slot.history.length} earlier version{slot.history.length > 1 ? 's' : ''}
        </button>
      )}
      {showHistory && (
        <ul className="mt-1 space-y-0.5">
          {slot.history.map((h) => (
            <li key={h._id} className="text-[11px] text-slate-500">
              <button className="underline" onClick={() => download(h._id, h.fileName)}>
                {h.fileName}
              </button>{' '}
              · {formatDateTime(h.uploadedAt)} {h.uploadedBy ? `· ${h.uploadedBy}` : ''}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

/** Student profile documents #34–#41 (replacing keeps the old file in history). */
export function DocumentsStep({ leadId, readOnly, onBack, onNext }: { leadId: string; readOnly: boolean; onBack: () => void; onNext: () => void }) {
  const { data, isLoading, isError, error, refetch } = useLeadDocumentsQuery(leadId)
  if (isLoading) return <Skeleton className="h-64 w-full" />
  if (isError || !data) return <ErrorState message={parseApiError(error).message} onRetry={refetch} />
  return (
    <div className="space-y-4">
      <Section title="Documents">
        <ul className="grid gap-2 lg:grid-cols-2">
          {data.data.documents.map((slot) => (
            <Slot key={slot.type} leadId={leadId} slot={slot} readOnly={readOnly} />
          ))}
        </ul>
      </Section>
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>Continue to declaration</Button>
      </div>
    </div>
  )
}
