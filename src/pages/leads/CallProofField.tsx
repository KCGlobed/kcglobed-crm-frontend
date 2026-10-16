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

/** Same limits as the server (apps/leads/call_proofs.py). */
const PROOF_RULES = {
  screenshot: { exts: ['.png', '.jpg', '.jpeg', '.webp'], maxMb: 5, label: 'Call Screenshot' },
  recording: { exts: ['.mp3', '.m4a', '.wav', '.ogg', '.aac', '.amr', '.webm'], maxMb: 14, label: 'Call Recording' },
} as const

/**
 * One proof of a logged call: the screenshot of the call time (required) or the call recording (optional).
 * A file is uploaded as soon as it is picked (or pasted, for the screenshot), then shown — a thumbnail or a
 * player — with Change and Remove. The drawer sends its id with the call.
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
  value: ProofValue | null
  onChange: (value: ProofValue | null) => void
  onBusy?: (busy: boolean) => void
  error?: string
  /** an image pasted anywhere in the drawer (screenshot only) */
  pasted?: File | null
}) {
  const rule = PROOF_RULES[kind]
  const input = useRef<HTMLInputElement>(null)
  const [upload, { isLoading }] = useUploadCallProofMutation()

  useEffect(() => {
    onBusy?.(isLoading)
  }, [isLoading, onBusy])
  // the local preview URL is released when the file changes or the drawer closes
  useEffect(() => () => {
    if (value?.url) URL.revokeObjectURL(value.url)
  }, [value?.url])

  const pick = async (file?: File | null) => {
    if (input.current) input.current.value = '' // picking the same file again still fires
    if (!file) return
    const ext = `.${file.name.split('.').pop()?.toLowerCase()}`
    if (!(rule.exts as readonly string[]).includes(ext)) {
      toast.error(`${rule.label}: ${rule.exts.filter((e) => e !== '.jpeg').map((e) => e.slice(1).toUpperCase()).join(', ')} only`)
      return
    }
    if (file.size > rule.maxMb * 1024 * 1024) {
      toast.error(`${rule.label} can be at most ${rule.maxMb} MB`)
      return
    }
    const body = new FormData()
    body.append('kind', kind)
    body.append('file', file)
    try {
      const res = await upload(body).unwrap()
      onChange({ id: res.data._id, fileName: res.data.fileName, url: URL.createObjectURL(file) })
    } catch (err) {
      const parsed = parseApiError(err)
      toast.error(parsed.errors.file ?? parsed.message)
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
      ? `The call screen showing its duration · PNG, JPG, WEBP up to ${rule.maxMb} MB · you can also paste it`
      : `Optional · MP3, M4A, WAV, OGG, AAC, AMR, WEBM up to ${rule.maxMb} MB`

  return (
    <FormField label={rule.label} required={required} error={error} hint={value ? undefined : hint}>
      <input ref={input} type="file" className="hidden" accept={rule.exts.join(',')} onChange={(e) => pick(e.target.files?.[0])} />
      {value ? (
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2">
          {kind === 'screenshot' ? (
            <a href={value.url} target="_blank" rel="noreferrer" title="Open full size">
              <img src={value.url} alt="Call screenshot" className="h-16 w-24 rounded-md border border-slate-100 object-cover" />
            </a>
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-slate-700">{value.fileName}</p>
            {kind === 'recording' && <audio controls src={value.url} className="mt-1 h-8 w-full" />}
            <div className="mt-1 flex gap-3 text-[11px]">
              <button type="button" className="font-medium text-brand-600 hover:underline" onClick={() => input.current?.click()} disabled={isLoading}>
                Change
              </button>
              <button type="button" className="inline-flex items-center gap-1 font-medium text-red-600 hover:underline" onClick={() => onChange(null)}>
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
