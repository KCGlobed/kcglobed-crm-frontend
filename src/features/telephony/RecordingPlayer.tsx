import { useState } from 'react'
import { Download, ExternalLink, Loader2, Play } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { authorizedDownload, useAuthorizedObjectUrl } from '../../lib/download'
import { cn, parseApiError } from '../../lib/utils'

/**
 * Plays a call recording: a "Play recording" button that fetches the protected file
 * (GET /calls/:id/proofs/:proofId) only when pressed, then an <audio> player. While the dialer's
 * download is still pending, admin-like users get the provider's own link instead.
 */
export function RecordingPlayer({
  callId,
  proofId,
  fileName,
  fallbackUrl,
  compact,
  className,
}: {
  callId: string
  proofId?: string | null
  fileName?: string
  /** the provider's recording link (admin-like users only), used when the file is not downloaded yet */
  fallbackUrl?: string | null
  compact?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const path = proofId ? `/calls/${callId}/proofs/${proofId}` : null
  const file = useAuthorizedObjectUrl(open ? path : null)

  if (!proofId) {
    if (!fallbackUrl) return null
    return (
      <a
        href={fallbackUrl}
        target="_blank"
        rel="noreferrer"
        className={cn('inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline', className)}
        onClick={(e) => e.stopPropagation()}
        data-testid="recording-provider-link"
      >
        <ExternalLink className="h-3 w-3" /> Open recording at the provider
      </a>
    )
  }
  if (!open) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className={cn('h-7 px-2 text-brand-700', className)}
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        data-testid="play-recording"
      >
        <Play className="h-3.5 w-3.5" /> Play recording
      </Button>
    )
  }
  return (
    <div className={cn('flex items-center gap-2', className)} onClick={(e) => e.stopPropagation()}>
      {file.loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
      ) : file.error ? (
        <span className="text-xs text-red-600">{file.error}</span>
      ) : (
        <audio controls autoPlay src={file.url} className={cn('h-8', compact ? 'w-56' : 'w-full max-w-sm')} />
      )}
      {!compact && path && (
        <Button
          variant="ghost"
          size="icon"
          title="Download recording"
          aria-label="Download recording"
          onClick={() => authorizedDownload(`${path}?download=1`, fileName ?? 'recording.mp3').catch((e) => toast.error(parseApiError(e).message))}
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}
