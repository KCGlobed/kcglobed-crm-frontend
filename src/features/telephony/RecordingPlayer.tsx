import { useEffect, useState } from 'react'
import { Download, Loader2, Play } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { authorizedDownload, useAuthorizedObjectUrl } from '../../lib/download'
import { cn, parseApiError } from '../../lib/utils'
import { useFetchCallRecordingMutation } from '../../services/telephonyApi'
import { SettlingBadge } from './SettlingBadge'

const FETCH_TRIES = 6
const FETCH_EVERY_MS = 15_000

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
  const [gaveUp, setGaveUp] = useState(false)
  const [fetchRecording] = useFetchCallRecordingMutation()
  const id = proofId ?? fetched?.id ?? null
  const path = id ? `/calls/${callId}/proofs/${id}` : null
  const file = useAuthorizedObjectUrl(open ? path : null)

  // a recording the CRM has not copied yet: fetched in the background (nothing waits for it), a few times while the
  // dialer is still preparing it; "Fetching the recording…" until then
  const fetchNow = !id && !!pending
  useEffect(() => {
    if (!fetchNow) return
    let stopped = false
    let timer: number | undefined
    let tries = 0
    const attempt = () => {
      fetchRecording(callId)
        .unwrap()
        .then((res) => !stopped && setFetched({ id: res.data._id, fileName: res.data.fileName }))
        .catch(() => {
          if (stopped) return
          if (++tries < FETCH_TRIES) timer = window.setTimeout(attempt, FETCH_EVERY_MS)
          else setGaveUp(true)
        })
    }
    attempt()
    return () => {
      stopped = true
      window.clearTimeout(timer)
    }
  }, [fetchNow, callId, fetchRecording])

  if (!id && !pending) return null
  if (!id) {
    return gaveUp ? (
      <span className={cn('text-[11px] text-slate-400', className)}>Recording not available yet</span>
    ) : (
      <SettlingBadge label="Fetching the recording…" className={className} />
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
          onClick={() => authorizedDownload(`${path}?download=1`, fileName ?? fetched?.fileName ?? 'recording.mp3').catch((e) => toast.error(parseApiError(e).message))}
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}
