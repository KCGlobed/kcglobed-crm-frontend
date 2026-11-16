import { useEffect, useRef } from 'react'
import { FileAudio, ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useUploadCallProofMutation } from '../../services/leadsApi'
import { FormField } from '../../components/ui/fields'
import { cn, parseApiError } from '../../lib/utils'

/** An uploaded proof: its id goes with the call; the local URL shows it in the drawer. */
export interface ProofValue {
  id: string
  fileName: string
  url: string
}

/** Same limits as the server (apps/leads/call_proofs.py); one file of each kind per call. */
const PROOF_RULES = {
  screenshot: { exts: ['.png', '.jpg', '.jpeg', '.webp'], maxMb: 5, label: 'Call Screenshot' },
  recording: { exts: ['.mp3', '.m4a', '.wav', '.ogg', '.aac', '.amr', '.webm'], maxMb: 50, label: 'Call Recording' },
} as const

/**
 * The proofs of a logged call: the screenshot of the call time (required) and the call recording (optional), one
 * of each. A file is uploaded as soon as it is picked (or pasted, for the screenshot), then shown — the image or a
 * player — with Change and Remove; picking again replaces it. The drawer sends the ids with the call.
 */
export function CallProofField({
  kind,
  required,
  value,
  onChange,
  onBusy,
  error,
  pasted,
}: {
  kind: 'screenshot' | 'recording'
  required?: boolean
  /** the current upload, if any (a list of at most one, as the drawer sends it) */
  value: ProofValue[]
  onChange: (value: ProofValue[]) => void
  onBusy?: (busy: boolean) => void
  error?: string
  /** an image pasted anywhere in the drawer (screenshot only) */
  pasted?: File | null
}) {
  const rule = PROOF_RULES[kind]
  const input = useRef<HTMLInputElement>(null)
  const [upload, { isLoading }] = useUploadCallProofMutation()
  // the current value for the async upload and the unmount cleanup (a prop read after an await is stale)
  const latest = useRef(value)
  useEffect(() => {
    latest.current = value
  }, [value])

  useEffect(() => {
    onBusy?.(isLoading)
  }, [isLoading, onBusy])
  // the local preview URL is released when the drawer closes
  useEffect(
    () => () => {
      for (const v of latest.current) URL.revokeObjectURL(v.url)
    },
    []
  )

  const accepted = (file: File) => {
    const ext = `.${file.name.split('.').pop()?.toLowerCase()}`
    if (!(rule.exts as readonly string[]).includes(ext)) {
      toast.error(`${file.name}: ${rule.exts.filter((e) => e !== '.jpeg').map((e) => e.slice(1).toUpperCase()).join(', ')} only`)
      return false
    }
    if (file.size > rule.maxMb * 1024 * 1024) {
      toast.error(`${file.name}: at most ${rule.maxMb} MB`)
      return false
    }
    return true
  }

  // the previous upload's preview is released once it is replaced or removed
  const replaceWith = (next: ProofValue[]) => {
    for (const v of latest.current) URL.revokeObjectURL(v.url)
    onChange(next)
  }

  // the file is copied out of the input before it is reset (clearing the input empties its live FileList); the new
  // upload takes the place of the current one
  const pick = async (file: File | undefined) => {
    if (input.current) input.current.value = '' // picking the same file again still fires
    if (!file || !accepted(file)) return
    const body = new FormData()
    body.append('kind', kind)
    body.append('file', file)
    try {
      const res = await upload(body).unwrap()
      replaceWith([{ id: res.data._id, fileName: res.data.fileName, url: URL.createObjectURL(file) }])
    } catch (err) {
      const parsed = parseApiError(err)
      toast.error(`${file.name}: ${parsed.errors.file ?? parsed.message}`)
    }
  }

  // a screenshot pasted into the drawer
  useEffect(() => {
    if (pasted && kind === 'screenshot') void pick(pasted)
    // pick is recreated each render; react to the pasted file only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pasted])

  const Icon = kind === 'screenshot' ? ImagePlus : FileAudio
  const hint =
    kind === 'screenshot'
      ? `The call screen showing its duration · PNG, JPG, WEBP up to ${rule.maxMb} MB · you can also paste`
      : `Optional · MP3, M4A, WAV, OGG, AAC, AMR, WEBM up to ${rule.maxMb} MB`
  const current = value[0]
  return (
    <FormField label={rule.label} required={required} error={error} hint={current ? undefined : hint}>
      <input ref={input} type="file" className="hidden" accept={rule.exts.join(',')} onChange={(e) => void pick(e.target.files?.[0])} />
      {current ? (
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2" data-testid={`call-${kind}`}>
          {kind === 'screenshot' && (
            <a href={current.url} target="_blank" rel="noreferrer" title="Open full size" className="shrink-0">
              <img src={current.url} alt="Call screenshot" className="h-20 w-28 rounded-md border border-slate-200 object-cover" />
            </a>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-slate-700">{current.fileName}</p>
            {kind === 'recording' && <audio controls src={current.url} className="mt-1 h-8 w-full" />}
            <div className="mt-1 flex gap-3 text-[11px]">
              <button type="button" className="font-medium text-brand-600 hover:underline disabled:opacity-60" onClick={() => input.current?.click()} disabled={isLoading}>
                {isLoading ? 'Uploading…' : 'Change'}
              </button>
              <button type="button" className="inline-flex items-center gap-1 font-medium text-red-600 hover:underline" onClick={() => replaceWith([])}>
                <Trash2 className="h-3 w-3" /> Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={isLoading}
          className={cn(
            'flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-3 text-xs font-medium transition-colors disabled:opacity-60',
            error ? 'border-red-300 text-red-600' : 'border-slate-300 text-slate-600 hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700'
          )}
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
          {isLoading ? 'Uploading…' : kind === 'screenshot' ? 'Upload the call screenshot' : 'Upload the call recording'}
        </button>
      )}
    </FormField>
  )
}
