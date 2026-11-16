import { useState } from 'react'
import { FileDown } from 'lucide-react'
import { toast } from 'sonner'
import { useLeadDocumentsQuery } from '../../../services/leadsApi'
import { Button } from '../../../components/ui/Button'
import { authorizedDownload } from '../../../lib/download'
import { parseApiError } from '../../../lib/utils'
import { documentsExportPath } from './documentFiles'

/**
 * Student Profile header, next to Call: every uploaded document (Aadhaar, PAN, marksheets, photo, signature,
 * resume) downloads as ONE PDF — images become pages, PDFs are appended, Word resumes are only listed on its
 * cover page. Needs lead view only, so it also works on a locked profile.
 */
export function ExportDocumentsButton({ leadId }: { leadId: string }) {
  const { data } = useLeadDocumentsQuery(leadId)
  const [busy, setBusy] = useState(false)
  // disabled once the slots are known and all are empty; the button never waits on that request
  const none = !!data && data.data.documents.every((slot) => !slot.current)

  const onClick = async () => {
    setBusy(true)
    try {
      await authorizedDownload(documentsExportPath(leadId), 'documents.pdf')
      toast.success('Documents PDF downloaded')
    } catch (err) {
      toast.error(parseApiError(err).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      loading={busy}
      disabled={none}
      title={none ? 'No documents uploaded yet' : 'Download all documents as one PDF'}
      data-testid="export-documents"
    >
      <FileDown className="h-3.5 w-3.5" /> Export PDF
    </Button>
  )
}
