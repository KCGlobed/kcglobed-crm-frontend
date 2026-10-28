import { useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight, Download, FileAudio, Image as ImageIcon, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { authorizedDownload, useAuthorizedObjectUrl } from '../../lib/download'
import { formatHms } from '../../lib/durations'
import { formatDateTime, parseApiError } from '../../lib/utils'
import { useReplaceCallProofsMutation } from '../../services/leadsApi'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { CallProofField, type ProofValue } from './CallProofField'
import { callScreenshots, proofPath, type ProofCall } from './callProofFiles'
import type { CallLog, CallProofFile } from '../../types/models'

/**
 * A call's proofs: the screenshot large (one at a time, with a pager for a call of several screens) beside the
 * duration that was entered, and the recording's player, so the two can be compared. The dialog keeps one size
 * whatever the screenshot; `actions` adds buttons under the downloads (the lead page's Re-upload).
 */
export function CallProofPreview({
  call,
  title,
  description,
  actions,
  onClose,
}: {
  call: ProofCall
  title: string
  description?: string
  actions?: ReactNode
  onClose: () => void
}) {
  const shots = callScreenshots(call)
  const [index, setIndex] = useState(0)
  const shown = shots[index] ?? null
  const shot = useAuthorizedObjectUrl(shown ? proofPath(call._id, shown) : null)
  const rec = useAuthorizedObjectUrl(call.recording ? proofPath(call._id, call.recording) : null)
  const download = (proof: CallProofFile) =>
    authorizedDownload(`${proofPath(call._id, proof)}?download=1`, proof.fileName).catch((e) => toast.error(parseApiError(e).message))

  return (
    <Modal open onClose={onClose} title={title} description={description} size="xl">
      <div className="grid gap-5 md:grid-cols-[1fr_15rem]">
        <div className="min-w-0 space-y-2">
          <div className="flex h-[55vh] min-h-72 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            {!shown ? (
              <p className="flex items-center gap-2 text-sm text-slate-400">
                <ImageIcon className="h-4 w-4" /> No screenshot
              </p>
            ) : shot.loading ? (
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            ) : shot.error ? (
              <p className="text-sm text-red-600">{shot.error}</p>
            ) : (
              <a href={shot.url} target="_blank" rel="noreferrer" title="Open full size" className="flex h-full w-full items-center justify-center">
                <img src={shot.url} alt={`Call screenshot ${index + 1}`} className="max-h-full max-w-full object-contain" />
              </a>
            )}
          </div>
          {shots.length > 1 && (
            <div className="flex items-center justify-center gap-3 text-xs text-slate-600" data-testid="screenshot-pager">
              <Button variant="ghost" size="sm" aria-label="Previous screenshot" disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-0 truncate tabular-nums">
                Screenshot {index + 1} of {shots.length}
                {shown ? <span className="text-slate-400"> · {shown.fileName}</span> : null}
              </span>
              <Button variant="ghost" size="sm" aria-label="Next screenshot" disabled={index >= shots.length - 1} onClick={() => setIndex((i) => Math.min(shots.length - 1, i + 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-brand-100 bg-brand-50/50 p-4 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{call.source === 'dialer' ? 'Talk time (dialer)' : 'Entered duration'}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{call.durationSeconds != null ? formatHms(call.durationSeconds) : '—'}</p>
            <p className="mt-1 text-[11px] text-slate-500">{call.source === 'dialer' ? 'Reported by the dialer' : 'Compare it with the call time in the screenshot'}</p>
          </div>
          <dl className="space-y-1 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-400">Disposition</dt>
              <dd className="text-right font-medium text-slate-700">{call.subStage ?? call.stage ?? '—'}</dd>
            </div>
          </dl>
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <FileAudio className="h-3.5 w-3.5" /> Recording
            </p>
            {!call.recording ? (
              <p className="text-xs text-slate-400">No recording uploaded</p>
            ) : rec.loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            ) : rec.error ? (
              <p className="text-xs text-red-600">{rec.error}</p>
            ) : (
              <audio controls src={rec.url} className="w-full" />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {shown && (
              <Button variant="outline" size="sm" onClick={() => download(shown)}>
                <Download className="h-3.5 w-3.5" /> {shots.length > 1 ? `Screenshot ${index + 1}` : 'Screenshot'}
              </Button>
            )}
            {call.recording && (
              <Button variant="outline" size="sm" onClick={() => download(call.recording!)}>
                <Download className="h-3.5 w-3.5" /> Recording
              </Button>
            )}
            {actions}
          </div>
        </div>
      </div>
    </Modal>
  )
}

/**
 * Re-upload the files of a call logged with Log Call: new screenshots replace all of the call's screenshots, a new
 * recording replaces its recording; whatever is left empty here stays as it is. The files upload as they are picked
 * (or pasted), as in the Log Call drawer, and replace the old ones on Save.
 */
export function ReuploadCallProofs({ call, leadId, onClose }: { call: CallLog; leadId: string; onClose: () => void }) {
  const [replace, { isLoading }] = useReplaceCallProofsMutation()
  const [screenshots, setScreenshots] = useState<ProofValue[]>([])
  const [recording, setRecording] = useState<ProofValue[]>([])
  const [shotBusy, setShotBusy] = useState(false)
  const [recBusy, setRecBusy] = useState(false)
  const [pasted, setPasted] = useState<File | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const current = callScreenshots(call)
  const now = [
    current.length ? `${current.length} screenshot${current.length > 1 ? 's' : ''}` : 'no screenshot',
    call.recording ? `the recording ${call.recording.fileName}` : 'no recording',
  ].join(' and ')

  const onSave = async () => {
    setErrors({})
    try {
      await replace({
        callId: call._id,
        leadId,
        screenshotIds: screenshots.length ? screenshots.map((s) => s.id) : undefined,
        recordingId: recording[0]?.id,
      }).unwrap()
      toast.success('Call files updated')
      onClose()
    } catch (err) {
      const parsed = parseApiError(err)
      setErrors(parsed.errors)
      toast.error(parsed.message)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Re-upload call files"
      description={`${call.subStage ?? call.stage ?? 'Call'} · ${formatDateTime(call.createdAt)}${call.durationSeconds != null ? ` · ${formatHms(call.durationSeconds)}` : ''}`}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSave} loading={isLoading} disabled={(!screenshots.length && !recording.length) || shotBusy || recBusy} data-testid="save-call-files">
            Save
          </Button>
        </>
      }
    >
      <div
        onPaste={(e) => {
          // a screenshot pasted anywhere in the dialog is added to the new screenshots
          const image = Array.from(e.clipboardData.files).find((f) => f.type.startsWith('image/'))
          if (image) {
            e.preventDefault()
            setPasted(new File([image], image.name || 'call-screenshot.png', { type: image.type }))
          }
        }}
        className="space-y-3"
      >
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          This call has {now}. New screenshots replace all of its screenshots, and a new recording replaces its recording. Leave one empty to keep it.
        </p>
        <CallProofField kind="screenshot" value={screenshots} onChange={setScreenshots} onBusy={setShotBusy} pasted={pasted} error={errors.screenshotId} />
        <CallProofField kind="recording" value={recording} onChange={setRecording} onBusy={setRecBusy} error={errors.recordingId} />
      </div>
    </Modal>
  )
}
