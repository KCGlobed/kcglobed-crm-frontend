import { useRef, useState } from 'react'
import { Check, Crop, Download, Eye, FileText, FileUp, ImageIcon, Plus, RefreshCw, Trash2 } from 'lucide-react'
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

/** How one upload went: a new file, a file the slot already holds, or refused. */
type Sent = 'added' | 'unchanged' | 'failed'

const initialAspect = (type: string) => (type === 'photo' ? '0.75' : type === 'signature' ? '3' : 'original') as '0.75' | '3' | 'original'

const formats = (slot: DocumentSlot, sep: string) =>
  slot.accept.map((a) => a.slice(1).toUpperCase()).filter((a) => a !== 'JPEG').join(sep)

/** The cropper on the slot's current image, loaded from the server. */
function CropCurrent({ leadId, doc, ...rest }: { leadId: string; doc: LeadDocumentFile } & Omit<Parameters<typeof ImageCropper>[0], 'src' | 'error' | 'fileName' | 'contentType' | 'title'>) {
  const image = useAuthorizedObjectUrl(`${documentPath(leadId, doc._id)}?inline=1`)
  return <ImageCropper title={`Crop ${doc.typeLabel}`} src={image.url} error={image.error} fileName={doc.fileName} contentType={doc.contentType} {...rest} />
}

/** One uploaded file: its name (opens the preview), when and by whom. */
function FileLine({ doc, onPreview }: { doc: LeadDocumentFile; onPreview: () => void }) {
  return (
    <button type="button" onClick={onPreview} className="flex w-full min-w-0 items-center gap-2 text-left" title="Preview">
      {isImageDocument(doc) ? <ImageIcon className="h-4 w-4 shrink-0 text-slate-400" /> : <FileText className="h-4 w-4 shrink-0 text-slate-400" />}
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium text-brand-700 hover:underline">{doc.fileName}</span>
        <span className="block text-[11px] text-slate-400">
          {formatDateTime(doc.uploadedAt)}
          {/* a website upload is recorded under the first Super Admin; the student sent it */}
          {doc.source === 'website' ? ' · by the student on the website' : doc.uploadedBy ? ` · ${doc.uploadedBy}` : ''}
        </span>
      </span>
    </button>
  )
}

function Slot({ leadId, slot, readOnly }: { leadId: string; slot: DocumentSlot; readOnly: boolean }) {
  const [upload, { isLoading }] = useUploadLeadDocumentMutation()
  const [remove, { isLoading: deleting }] = useDeleteLeadDocumentMutation()
  const [showHistory, setShowHistory] = useState(false)
  const [preview, setPreview] = useState<LeadDocumentFile | null>(null)
  const [cropping, setCropping] = useState<Cropping>(null)
  const [confirmDelete, setConfirmDelete] = useState<LeadDocumentFile | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const current = slot.current
  const maxFiles = slot.maxFiles ?? 1
  const multi = maxFiles > 1
  const files = slot.files ?? (current ? [current] : [])
  const room = maxFiles - files.length

  const accepted = (file: File): boolean => {
    const ext = `.${file.name.split('.').pop()?.toLowerCase()}`
    if (!slot.accept.includes(ext)) {
      toast.error(`${file.name}: ${slot.label} takes ${formats(slot, ', ')} only`)
      return false
    }
    if (file.size > slot.maxMb * 1024 * 1024) {
      toast.error(`${file.name}: ${slot.label} can be at most ${slot.maxMb} MB`)
      return false
    }
    return true
  }

  /** One file to the server; `quiet` leaves the success message to the caller (several files at once). */
  const send = async (file: File, verb: string, quiet = false): Promise<Sent> => {
    const fd = new FormData()
    fd.append('type', slot.type)
    fd.append('file', file)
    try {
      const res = await upload({ id: leadId, body: fd }).unwrap()
      if (res.data?.unchanged) {
        if (!quiet) toast.info(`${slot.label}: this file is already uploaded`)
        return 'unchanged'
      }
      if (!quiet) toast.success(`${slot.label} ${verb}`)
      return 'added'
    } catch (err) {
      const parsed = parseApiError(err)
      toast.error(`${quiet ? `${file.name}: ` : ''}${parsed.errors.file ?? parsed.message}`)
      return 'failed'
    }
  }

  const closeCropper = () => {
    if (cropping?.kind === 'file') URL.revokeObjectURL(cropping.src)
    setCropping(null)
  }

  /** A single-file slot: an image goes through the cropper first (with "Upload as is"); other files upload straight away. */
  const pickOne = (file?: File | null) => {
    if (!file || !accepted(file)) return
    if (isCroppableFile(file)) setCropping({ kind: 'file', file, src: URL.createObjectURL(file) })
    else void send(file, current ? 'replaced' : 'uploaded')
  }

  /** A multi-file slot: every picked file that fits, one request after another, up to the slot's limit. */
  const pickMany = async (picked: File[]) => {
    const valid = picked.filter(accepted)
    if (!valid.length) return
    if (valid.length > room) {
      toast.warning(`${slot.label} holds ${maxFiles} files: only ${room} more can be added, the first ${room} are uploaded`)
    }
    const batch = valid.slice(0, room)
    let added = 0
    let same = 0
    setProgress({ done: 0, total: batch.length })
    for (const [i, file] of batch.entries()) {
      const sent = await send(file, 'added', true)
      added += sent === 'added' ? 1 : 0
      same += sent === 'unchanged' ? 1 : 0
      setProgress({ done: i + 1, total: batch.length })
    }
    setProgress(null)
    if (added) toast.success(`${slot.label}: ${added} file${added > 1 ? 's' : ''} added`)
    if (same) toast.info(`${slot.label}: ${same} file${same > 1 ? 's were' : ' was'} already uploaded`)
  }

  const onPicked = (list: FileList | null) => {
    const picked = Array.from(list ?? [])
    if (input.current) input.current.value = '' // picking the same file again still fires
    if (multi) void pickMany(picked)
    else pickOne(picked[0])
  }

  const saveCropped = async (file: File) => {
    if ((await send(file, cropping?.kind === 'current' ? 'cropped' : current ? 'replaced' : 'uploaded')) !== 'failed') closeCropper()
  }

  const download = (doc: LeadDocumentFile) =>
    authorizedDownload(documentPath(leadId, doc._id), doc.fileName).catch((e) => toast.error(parseApiError(e).message))

  const deleteFile = async () => {
    if (!confirmDelete) return
    try {
      await remove({ id: leadId, documentId: confirmDelete._id }).unwrap()
      toast.success(`${multi ? confirmDelete.fileName : slot.label} deleted · kept in its history`)
      setConfirmDelete(null)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  const deleteButton = (doc: LeadDocumentFile) => (
    <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setConfirmDelete(doc)}>
      <Trash2 className="h-3.5 w-3.5" /> Delete
    </Button>
  )

  return (
    <li className="rounded-lg border border-slate-200 p-3">
      <input ref={input} type="file" className="hidden" multiple={multi} accept={slot.accept.join(',')} onChange={(e) => onPicked(e.target.files)} />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-700">
            {slot.label}
            {slot.mandatory ? <Badge tone="red">Required</Badge> : <Badge>Optional</Badge>}
            <Badge tone={files.length ? 'green' : 'slate'}>
              {files.length > 0 && <Check className="h-3 w-3" />}
              {files.length ? `${files.length} file${files.length > 1 ? 's' : ''}` : 'No file'}
            </Badge>
          </p>
          <p className="text-[11px] text-slate-400">
            {formats(slot, ' / ')} · max {slot.maxMb} MB
            {multi ? ` · ${files.length} of up to ${maxFiles} files` : ''}
          </p>
        </div>
        {!readOnly && (multi ? room > 0 : !current) && (
          <Button variant="outline" size="sm" loading={isLoading || !!progress} onClick={() => input.current?.click()}>
            {multi ? <Plus className="h-3.5 w-3.5" /> : <FileUp className="h-3.5 w-3.5" />}
            {progress ? `Uploading ${Math.min(progress.done + 1, progress.total)} of ${progress.total}` : multi ? 'Add files' : 'Upload'}
          </Button>
        )}
      </div>

      {multi && files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((doc) => (
            <li key={doc._id} className="rounded-md bg-slate-50 p-2">
              <FileLine doc={doc} onPreview={() => setPreview(doc)} />
              <div className="mt-1 flex flex-wrap gap-1">
                <Button variant="ghost" size="sm" onClick={() => setPreview(doc)}>
                  <Eye className="h-3.5 w-3.5" /> Preview
                </Button>
                <Button variant="ghost" size="sm" onClick={() => download(doc)}>
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
                {!readOnly && deleteButton(doc)}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!multi && current && (
        <div className="mt-2 rounded-md bg-slate-50 p-2">
          <FileLine doc={current} onPreview={() => setPreview(current)} />
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
                {deleteButton(current)}
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
            if ((await send(cropping.file, current ? 'replaced' : 'uploaded')) !== 'failed') closeCropper()
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
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={deleteFile}
        title={`Delete ${multi && confirmDelete ? confirmDelete.fileName : slot.label}?`}
        message="The file is removed from the profile and kept in this document's history, marked as deleted."
        confirmLabel="Delete"
        danger
        loading={deleting}
      />
    </li>
  )
}

/**
 * Student profile documents #34–#41. Every document can be previewed; with Leads › Edit on an unlocked profile it
 * can also be cropped (images), re-uploaded or deleted — straight away, without the profile's Edit. Aadhaar, the
 * marksheets and Other Documents hold several files, added together; the other types hold one, which a new upload
 * replaces. Replacing or deleting keeps the old file in its history. Deletions show on the student's website profile.
 */
export function DocumentsStep({ leadId, readOnly, locked = false }: { leadId: string; readOnly: boolean; locked?: boolean }) {
  const { data, isLoading, isError, error, refetch } = useLeadDocumentsQuery(leadId)
  if (isLoading) return <Skeleton className="h-64 w-full" />
  if (isError || !data) return <ErrorState message={parseApiError(error).message} onRetry={refetch} />
  const slots = data.data.documents
  const total = slots.reduce((n, s) => n + (s.files ?? (s.current ? [s.current] : [])).length, 0)
  const filled = slots.filter((s) => (s.files ?? (s.current ? [s.current] : [])).length > 0).length
  return (
    <div className="space-y-4">
      {locked && (
        <p className="rounded-md bg-pink-50 px-3 py-2 text-xs text-pink-700">
          The profile is locked after the declaration: unlock it to add or delete documents.
        </p>
      )}
      <Section title={`Documents · ${total} file${total === 1 ? '' : 's'} in ${filled} of ${slots.length}`}>
        <ul className="grid gap-2 lg:grid-cols-2">
          {data.data.documents.map((slot) => (
            <Slot key={slot.type} leadId={leadId} slot={slot} readOnly={readOnly} />
          ))}
        </ul>
      </Section>
    </div>
  )
}
