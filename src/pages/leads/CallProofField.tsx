import { useEffect, useRef } from 'react'
import { FileAudio, ImagePlus, Loader2, Trash2, X } from 'lucide-react'
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
  screenshot: { exts: ['.png', '.jpg', '.jpeg', '.webp'], maxMb: 5, max: 10, label: 'Call Screenshots' },
  recording: { exts: ['.mp3', '.m4a', '.wav', '.ogg', '.aac', '.amr', '.webm'], maxMb: 50, max: 1, label: 'Call Recording' },
} as const

/**
 * The proofs of a logged call: the screenshots of the call time (at least one; several when the call spans more
 * than one screen) and the call recording (optional). A file is uploaded as soon as it is picked (or pasted, for
 * a screenshot), then shown — thumbnails or a player — with Remove. The drawer sends the ids with the call.
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
  // the current list for the async upload loop and the unmount cleanup (a prop read after an await is stale)
  const latest = useRef(value)
  useEffect(() => {
    latest.current = value
  }, [value])

  useEffect(() => {
    onBusy?.(isLoading)
  }, [isLoading, onBusy])
  // the local preview URLs are released when the drawer closes
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

  // the files are copied out of the input before it is reset (clearing the input empties its live FileList);
  // one request per file, appended in order
  const pick = async (files: File[]) => {
    if (input.current) input.current.value = '' // picking the same file again still fires
    const good = files.filter(accepted)
    if (!good.length) return
    const room = rule.max - (rule.max > 1 ? latest.current.length : 0)
    if (good.length > room) {
      toast.error(rule.max > 1 ? `At most ${rule.max} screenshots per call` : 'One recording per call')
      return
    }
    const added: ProofValue[] = []
    for (const file of good) {
      const body = new FormData()
      body.append('kind', kind)
      body.append('file', file)
      try {
        const res = await upload(body).unwrap()
        added.push({ id: res.data._id, fileName: res.data.fileName, url: URL.createObjectURL(file) })
      } catch (err) {
        const parsed = parseApiError(err)
        toast.error(`${file.name}: ${parsed.errors.file ?? parsed.message}`)
        break
      }
    }
    if (!added.length) return
    onChange(rule.max > 1 ? [...latest.current, ...added] : added)
  }

  const remove = (id: string) => onChange(latest.current.filter((v) => v.id !== id))

  // a screenshot pasted into the drawer
  useEffect(() => {
    if (pasted && kind === 'screenshot') void pick([pasted])
    // pick is recreated each render; react to the pasted file only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pasted])

  const Icon = kind === 'screenshot' ? ImagePlus : FileAudio
  const hint =
    kind === 'screenshot'
      ? `The call screen showing its duration — add every screen of a long call (up to ${rule.max}) · PNG, JPG, WEBP up to ${rule.maxMb} MB each · you can also paste`
      : `Optional · MP3, M4A, WAV, OGG, AAC, AMR, WEBM up to ${rule.maxMb} MB`
  const canAdd = value.length < rule.max
  const picker = (
    <input ref={input} type="file" className="hidden" accept={rule.exts.join(',')} multiple={rule.max > 1} onChange={(e) => void pick(Array.from(e.target.files ?? []))} />
  )
  const addButton = (label: string) => (
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
      {isLoading ? 'Uploading…' : label}
    </button>
  )

  if (kind === 'screenshot') {
    return (
      <FormField label={`${rule.label}${value.length ? ` (${value.length})` : ''}`} required={required} error={error} hint={value.length ? undefined : hint}>
        {picker}
        <div className="space-y-2">
          {value.length > 0 && (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4" data-testid="call-screenshots">
              {value.map((v, i) => (
                <li key={v.id} className="group relative">
                  <a href={v.url} target="_blank" rel="noreferrer" title={`${v.fileName} — open full size`}>
                    <img src={v.url} alt={`Call screenshot ${i + 1}`} className="h-20 w-full rounded-md border border-slate-200 object-cover" />
                  </a>
                  <span className="absolute bottom-1 left-1 rounded bg-slate-900/70 px-1 text-[10px] font-medium text-white">{i + 1}</span>
                  <button
                    type="button"
                    aria-label={`Remove screenshot ${i + 1}`}
                    title="Remove"
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-white p-0.5 text-red-600 shadow ring-1 ring-slate-200 hover:bg-red-50"
                    onClick={() => remove(v.id)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {canAdd && addButton(value.length ? 'Add another screenshot' : 'Upload the call screenshot')}
          {!canAdd && <p className="text-[11px] text-slate-400">{rule.max} screenshots — the most a call can carry</p>}
        </div>
      </FormField>
    )
  }

  const current = value[0]
  return (
    <FormField label={rule.label} required={required} error={error} hint={current ? undefined : hint}>
      {picker}
      {current ? (
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-slate-700">{current.fileName}</p>
            <audio controls src={current.url} className="mt-1 h-8 w-full" />
            <div className="mt-1 flex gap-3 text-[11px]">
              <button type="button" className="font-medium text-brand-600 hover:underline" onClick={() => input.current?.click()} disabled={isLoading}>
                Change
              </button>
              <button type="button" className="inline-flex items-center gap-1 font-medium text-red-600 hover:underline" onClick={() => onChange([])}>
                <Trash2 className="h-3 w-3" /> Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        addButton('Upload the call recording')
      )}
    </FormField>
  )
}
