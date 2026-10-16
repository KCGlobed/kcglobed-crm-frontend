import { useRef, useState } from 'react'
import { Check, Crop, Download, Eye, FileText, FileUp, ImageIcon, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useDeleteLeadDocumentMutation, useLeadDocumentsQuery, useUploadLeadDocumentMutation } from '../../../services/leadsApi'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { ConfirmDialog, ErrorState, Skeleton } from '../../../components/ui/feedback'
import { ImageCropper } from '../../../components/ui/ImageCropper'
import { formatDateTime, parseApiError } from '../../../lib/utils'
import { authorizedDownload, useAuthorizedObjectUrl } from '../../../lib/download'
import type { DocumentSlot, LeadDocumentFile } from '../../../types/models'
import { DocumentPreview } from './DocumentPreview'
import { documentPath, isCroppableFile, isImageDocument } from './documentFiles'
import { Section } from './ProfileFields'

/** What the cropper is working on: a file just picked, or the slot's current image. */
type Cropping = { kind: 'file'; file: File; src: string } | { kind: 'current'; doc: LeadDocumentFile } | null

const initialAspect = (type: string) => (type === 'photo' ? '0.75' : type === 'signature' ? '3' : 'original') as '0.75' | '3' | 'original'

/** The cropper on the slot's current image, loaded from the server. */
function CropCurrent({ leadId, doc, ...rest }: { leadId: string; doc: LeadDocumentFile } & Omit<Parameters<typeof ImageCropper>[0], 'src' | 'error' | 'fileName' | 'contentType' | 'title'>) {
  const image = useAuthorizedObjectUrl(`${documentPath(leadId, doc._id)}?inline=1`)
  return <ImageCropper title={`Crop ${doc.typeLabel}`} src={image.url} error={image.error} fileName={doc.fileName} contentType={doc.contentType} {...rest} />
}

function Slot({ leadId, slot, readOnly }: { leadId: string; slot: DocumentSlot; readOnly: boolean }) {
  const [upload, { isLoading }] = useUploadLeadDocumentMutation()
  const [remove, { isLoading: deleting }] = useDeleteLeadDocumentMutation()
  const [showHistory, setShowHistory] = useState(false)
  const [preview, setPreview] = useState<LeadDocumentFile | null>(null)
  const [cropping, setCropping] = useState<Cropping>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const current = slot.current

  const send = async (file: File, verb: string): Promise<boolean> => {
    if (file.size > slot.maxMb * 1024 * 1024) {
      toast.error(`${slot.label} can be at most ${slot.maxMb} MB`)
      return false
    }
    const fd = new FormData()
    fd.append('type', slot.type)
    fd.append('file', file)
    try {
      await upload({ id: leadId, body: fd }).unwrap()
      toast.success(`${slot.label} ${verb}`)
      return true
    } catch (err) {
      const parsed = parseApiError(err)
      toast.error(parsed.errors.file ?? parsed.message)
      return false
    }
  }

  const closeCropper = () => {
    if (cropping?.kind === 'file') URL.revokeObjectURL(cropping.src)
    setCropping(null)
  }

  const pick = (file?: File | null) => {
    if (input.current) input.current.value = '' // picking the same file again still fires
    if (!file) return
    const ext = `.${file.name.split('.').pop()?.toLowerCase()}`
    if (!slot.accept.includes(ext)) {
      toast.error(`${slot.label}: ${slot.accept.map((a) => a.slice(1).toUpperCase()).filter((a) => a !== 'JPEG').join(', ')} only`)
      return
    }
    // an image goes through the cropper first (with "Upload as is"); other files upload straight away
    if (isCroppableFile(file)) setCropping({ kind: 'file', file, src: URL.createObjectURL(file) })
    else void send(file, current ? 'replaced' : 'uploaded')
  }

  const saveCropped = async (file: File) => {
    if (await send(file, cropping?.kind === 'current' ? 'cropped' : current ? 'replaced' : 'uploaded')) closeCropper()
  }

  const download = (doc: LeadDocumentFile) =>
    authorizedDownload(documentPath(leadId, doc._id), doc.fileName).catch((e) => toast.error(parseApiError(e).message))

  const deleteCurrent = async () => {
    if (!current) return
    try {
      await remove({ id: leadId, documentId: current._id }).unwrap()
      toast.success(`${slot.label} deleted · kept in its history`)
      setConfirmDelete(false)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  return (
    <li className="rounded-lg border border-slate-200 p-3">
      <input ref={input} type="file" className="hidden" accept={slot.accept.join(',')} onChange={(e) => pick(e.target.files?.[0])} />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-slate-700">
            {slot.label}
            {slot.mandatory ? <Badge tone="red">Required</Badge> : <Badge>Optional</Badge>}
            {current && <Check className="h-4 w-4 text-emerald-600" />}
          </p>
          <p className="text-[11px] text-slate-400">
            {slot.accept.map((a) => a.slice(1).toUpperCase()).filter((a) => a !== 'JPEG').join(' / ')} · max {slot.maxMb} MB
          </p>
        </div>
        {!current && !readOnly && (
          <Button variant="outline" size="sm" loading={isLoading} onClick={() => input.current?.click()}>
            <FileUp className="h-3.5 w-3.5" /> Upload
          </Button>
        )}
      </div>

      {current && (
        <div className="mt-2 rounded-md bg-slate-50 p-2">
          <button type="button" onClick={() => setPreview(current)} className="flex w-full min-w-0 items-center gap-2 text-left" title="Preview">
            {isImageDocument(current) ? <ImageIcon className="h-4 w-4 shrink-0 text-slate-400" /> : <FileText className="h-4 w-4 shrink-0 text-slate-400" />}
            <span className="min-w-0">
              <span className="block truncate text-xs font-medium text-brand-700 hover:underline">{current.fileName}</span>
              <span className="block text-[11px] text-slate-400">
                {formatDateTime(current.uploadedAt)}
                {current.uploadedBy ? ` · ${current.uploadedBy}` : ''}
              </span>
            </span>
          </button>
          <div className="mt-2 flex flex-wrap gap-1">
            <Button variant="ghost" size="sm" onClick={() => setPreview(current)}>
              <Eye className="h-3.5 w-3.5" /> Preview
            </Button>
            <Button variant="ghost" size="sm" onClick={() => download(current)}>
              <Download className="h-3.5 w-3.5" /> Download
            </Button>
            {!readOnly && (
              <>
                {isImageDocument(current) && (
                  <Button variant="ghost" size="sm" onClick={() => setCropping({ kind: 'current', doc: current })}>
                    <Crop className="h-3.5 w-3.5" /> Crop
                  </Button>
                )}
                <Button variant="ghost" size="sm" loading={isLoading} onClick={() => input.current?.click()}>
                  <RefreshCw className="h-3.5 w-3.5" /> Re-upload
                </Button>
                <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {slot.history.length > 0 && (
        <button type="button" className="mt-2 text-[11px] text-slate-500 underline" onClick={() => setShowHistory((s) => !s)}>
          {showHistory ? 'Hide' : 'Show'} {slot.history.length} earlier version{slot.history.length > 1 ? 's' : ''}
        </button>
      )}
      {showHistory && (
        <ul className="mt-1 space-y-1">
          {slot.history.map((h) => (
            <li key={h._id} className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
              <span className="min-w-0">
                <button type="button" className="truncate font-medium text-slate-600 underline" onClick={() => setPreview(h)}>
                  {h.fileName}
                </button>{' '}
                · {formatDateTime(h.uploadedAt)} {h.uploadedBy ? `· ${h.uploadedBy}` : ''}
                {h.deletedAt && (
                  <span className="ml-1 text-red-600">
                    · deleted {formatDateTime(h.deletedAt)}
                    {h.deletedBy ? ` by ${h.deletedBy}` : ''}
                  </span>
                )}
              </span>
              <button type="button" className="shrink-0 text-slate-400 hover:text-slate-700" title="Download" onClick={() => download(h)}>
                <Download className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {preview && <DocumentPreview leadId={leadId} doc={preview} onClose={() => setPreview(null)} />}
      {cropping?.kind === 'file' && (
        <ImageCropper
          title={`${current ? 'Re-upload' : 'Upload'} ${slot.label}`}
          src={cropping.src}
          fileName={cropping.file.name}
          contentType={cropping.file.type}
          initialAspect={initialAspect(slot.type)}
          saving={isLoading}
          onCancel={closeCropper}
          onSave={saveCropped}
          onUseOriginal={async () => {
            if (await send(cropping.file, current ? 'replaced' : 'uploaded')) closeCropper()
          }}
        />
      )}
      {cropping?.kind === 'current' && (
        <CropCurrent
          leadId={leadId}
          doc={cropping.doc}
          initialAspect={initialAspect(slot.type)}
          saving={isLoading}
          onCancel={closeCropper}
          onSave={saveCropped}
        />
      )}
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={deleteCurrent}
        title={`Delete ${slot.label}?`}
        message="The file is removed from the profile and kept in this document's history, marked as deleted."
        confirmLabel="Delete"
        danger
        loading={deleting}
      />
    </li>
  )
}

/**
 * Student profile documents #34–#41. Every document can be previewed; while editing an unlocked profile it can
 * also be cropped (images), re-uploaded or deleted. Replacing or deleting keeps the old file in its history.
 */
export function DocumentsStep({ leadId, readOnly }: { leadId: string; readOnly: boolean }) {
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
    </div>
  )
}
