import { useState } from 'react'
import { Download, Loader2, Play } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { authorizedDownload, useAuthorizedObjectUrl } from '../../lib/download'
import { cn, parseApiError } from '../../lib/utils'
import { useFetchCallRecordingMutation } from '../../services/telephonyApi'

/**
 * Plays a call recording in the CRM: a "Play recording" button that fetches the protected file
 * (GET /calls/:id/proofs/:proofId) only when pressed, then an <audio> player. A recording the dialer has that the
 * CRM has not copied yet (`pending`; the scheduler copies it a minute or two after the call) is copied when the
 * button is pressed and plays here just the same — never a link out to the provider.
 */
export function RecordingPlayer({
  callId,
  proofId,
  fileName,
  pending,
  compact,
  className,
}: {
  callId: string
  proofId?: string | null
  fileName?: string
  /** the dialer has a recording the CRM has not copied yet */
  pending?: boolean
  compact?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [fetched, setFetched] = useState<{ id: string; fileName: string } | null>(null)
  const [fetchRecording, { isLoading: copying }] = useFetchCallRecordingMutation()
  const id = proofId ?? fetched?.id ?? null
  const path = id ? `/calls/${callId}/proofs/${id}` : null
  const file = useAuthorizedObjectUrl(open ? path : null)

  if (!id && !pending) return null
  if (!open) {
    const play = async () => {
      if (!id) {
        try {
          const res = await fetchRecording(callId).unwrap()
          setFetched({ id: res.data._id, fileName: res.data.fileName })
        } catch (err) {
          toast.error(parseApiError(err).message)
          return
        }
      }
      setOpen(true)
    }
    return (
      <Button
        variant="ghost"
        size="sm"
        className={cn('h-7 px-2 text-brand-700', className)}
        loading={copying}
        onClick={(e) => {
          e.stopPropagation()
          void play()
        }}
        data-testid="play-recording"
      >
        {!copying && <Play className="h-3.5 w-3.5" />} Play recording
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
          onClick={() => authorizedDownload(`${path}?download=1`, fileName ?? fetched?.fileName ?? 'recording.mp3').catch((e) => toast.error(parseApiError(e).message))}
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}
