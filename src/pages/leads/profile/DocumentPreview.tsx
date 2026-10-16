import { Download, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { authorizedDownload, useAuthorizedObjectUrl } from '../../../lib/download'
import { formatDateTime, parseApiError } from '../../../lib/utils'
import { Button } from '../../../components/ui/Button'
import { Modal } from '../../../components/ui/Modal'
import type { LeadDocumentFile } from '../../../types/models'
import { documentPath, isImageDocument } from './documentFiles'

/**
 * A document shown in a large window: an image fitted to it, a PDF in the browser's own viewer, anything else
 * (a Word resume) offered as a download. Available to everyone who can see the lead, locked profile or not.
 */
export function DocumentPreview({ leadId, doc, onClose }: { leadId: string; doc: LeadDocumentFile; onClose: () => void }) {
  const previewable = isImageDocument(doc) || doc.contentType === 'application/pdf'
  const file = useAuthorizedObjectUrl(previewable ? `${documentPath(leadId, doc._id)}?inline=1` : null)
  const download = () =>
    authorizedDownload(documentPath(leadId, doc._id), doc.fileName).catch((e) => toast.error(parseApiError(e).message))

  return (
    <Modal
      open
      onClose={onClose}
      title={`${doc.typeLabel} · ${doc.fileName}`}
      description={`Uploaded ${formatDateTime(doc.uploadedAt)}${doc.uploadedBy ? ` by ${doc.uploadedBy}` : ''}${
        doc.deletedAt ? ` · deleted ${formatDateTime(doc.deletedAt)}${doc.deletedBy ? ` by ${doc.deletedBy}` : ''}` : ''
      }`}
      size="xl"
      footer={
        <Button variant="outline" onClick={download}>
          <Download className="h-3.5 w-3.5" /> Download
        </Button>
      }
    >
      <div className="flex min-h-[60vh] items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        {!previewable ? (
          <div className="flex flex-col items-center gap-2 text-center text-sm text-slate-500">
            <FileText className="h-8 w-8 text-slate-400" />
            This file type can't be shown here. Download it to open it.
          </div>
        ) : file.loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        ) : file.error ? (
          <p className="text-sm text-red-600">{file.error}</p>
        ) : isImageDocument(doc) ? (
          <img src={file.url} alt={doc.fileName} className="max-h-[70vh] w-auto object-contain" />
        ) : (
          <iframe src={file.url} title={doc.fileName} className="h-[70vh] w-full" />
        )}
      </div>
    </Modal>
  )
}
