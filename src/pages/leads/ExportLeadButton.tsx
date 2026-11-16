import { useState } from 'react'
import { FileDown } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { authorizedDownload } from '../../lib/download'
import { parseApiError } from '../../lib/utils'

/** Every detail of this lead merged into one PDF: overview, profile, discussion, follow-ups, calls, notes, messages, timeline, history. */
export const leadExportPath = (leadId: string) => `/leads/${leadId}/export-pdf`

/**
 * Lead header, next to Send WhatsApp: downloads the lead's dossier PDF. Needs lead view only — the sections the
 * user may not see on screen (messages, follow-ups, history) are left out of the file by the server as well.
 */
export function ExportLeadButton({ leadId }: { leadId: string }) {
  const [busy, setBusy] = useState(false)

  const onClick = async () => {
    setBusy(true)
    try {
      await authorizedDownload(leadExportPath(leadId), 'lead-details.pdf')
      toast.success('Lead PDF downloaded')
    } catch (err) {
      toast.error(parseApiError(err).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={onClick} loading={busy} title="Download every detail of this lead as one PDF" data-testid="export-lead">
      <FileDown className="h-3.5 w-3.5" /> Export Details
    </Button>
  )
}
