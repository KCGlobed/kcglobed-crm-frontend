import { useRef } from 'react'
import { Paperclip, X } from 'lucide-react'
import { toast } from 'sonner'
import { useUploadMessageAttachmentMutation } from '../../services/messagingApi'
import { Button } from '../ui/Button'
import { cn, parseApiError } from '../../lib/utils'
import type { MessageAsset } from '../../types/models'

/** All attachments of one email together (the server applies the same limit). */
const ATTACHMENTS_MAX_BYTES = 15 * 1024 * 1024

const fileSize = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)

/**
 * The files attached to an email, as a mail client shows them under the subject line: a chip per file with
 * its size and a remove cross, and an "Attach file" button that uploads into the CRM (PDF, Word, Excel,
 * PowerPoint or images, 8 MB each, 15 MB together).
 */
export function AttachmentList({
  attachments,
  onChange,
  readOnly = false,
  className,
}: {
  attachments: MessageAsset[]
  onChange?: (next: MessageAsset[]) => void
  readOnly?: boolean
  className?: string
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [upload, { isLoading }] = useUploadMessageAttachmentMutation()
  const total = attachments.reduce((sum, a) => sum + a.size, 0)

  const add = async (files: FileList | null) => {
    if (!files?.length || !onChange) return
    const next = [...attachments]
    for (const file of Array.from(files)) {
      try {
        const form = new FormData()
        form.append('file', file)
        const res = await upload(form).unwrap()
        if (!next.some((a) => a._id === res.data._id)) next.push(res.data)
      } catch (err) {
        toast.error(`${file.name}: ${parseApiError(err).message}`)
      }
    }
    onChange(next)
    if (fileRef.current) fileRef.current.value = ''
  }

  if (readOnly && attachments.length === 0) return null
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5 text-xs', className)}>
      {!readOnly && (
        <>
          <Button size="sm" variant="ghost" loading={isLoading} onClick={() => fileRef.current?.click()} title="PDF, Word, Excel, PowerPoint or image · 8 MB each">
            <Paperclip className="h-3.5 w-3.5" /> Attach file
          </Button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".pdf,.docx,.xlsx,.pptx,image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
            onChange={(e) => add(e.target.files)}
          />
        </>
      )}
      {attachments.map((a) => (
        <span key={a._id} className="inline-flex max-w-xs items-center gap-1 rounded-md border border-slate-200 bg-slate-50 py-0.5 pl-2 pr-1 text-slate-700">
          <Paperclip className="h-3 w-3 shrink-0 text-slate-400" />
          <a href={a.url} target="_blank" rel="noreferrer" className="truncate hover:underline" title={a.name}>
            {a.name}
          </a>
          <span className="shrink-0 text-slate-400">{fileSize(a.size)}</span>
          {!readOnly && onChange && (
            <button
              type="button"
              aria-label={`Remove ${a.name}`}
              title="Remove from this email"
              className="ml-0.5 rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-red-600"
              onClick={() => onChange(attachments.filter((x) => x._id !== a._id))}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </span>
      ))}
      {attachments.length > 0 && (
        <span className={cn('text-slate-400', total > ATTACHMENTS_MAX_BYTES && 'font-medium text-red-600')}>
          {fileSize(total)} total{total > ATTACHMENTS_MAX_BYTES ? ' · over the 15 MB limit' : ''}
        </span>
      )}
    </div>
  )
}
