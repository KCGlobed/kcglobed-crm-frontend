import { useState } from 'react'
import Cropper, { type Area, type MediaSize } from 'react-easy-crop'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '../../lib/utils'
import { Button } from './Button'
import { Modal } from './Modal'

/** Aspect choices; `original` follows the image's own shape. */
const ASPECTS = [
  { key: 'original', label: 'Original' },
  { key: '1', label: 'Square' },
  { key: '0.75', label: 'Portrait 3:4' },
  { key: '1.3333', label: 'Landscape 4:3' },
  { key: '3', label: 'Wide 3:1' },
] as const
type AspectKey = (typeof ASPECTS)[number]['key']

/** The cropped part of an image as a new file (PNG stays PNG, everything else becomes JPEG). */
async function cropToFile(src: string, area: Area, fileName: string, contentType: string): Promise<File> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read the image'))
    img.src = src
  })
  const type = contentType === 'image/png' ? 'image/png' : 'image/jpeg'
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(area.width))
  canvas.height = Math.max(1, Math.round(area.height))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Cropping is not supported in this browser')
  if (type === 'image/jpeg') {
    ctx.fillStyle = '#ffffff' // JPEG has no transparency
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not crop the image'))), type, 0.92)
  )
  const name = `${fileName.replace(/\.[^.]+$/, '') || 'image'}${type === 'image/png' ? '.png' : '.jpg'}`
  return new File([blob], name, { type })
}

/**
 * Crop an image before it is saved: drag to move, slider or scroll to zoom, pick a shape. `src` is an object URL
 * (undefined while it loads). Save hands back the cropped file; with `onUseOriginal` the picked file can also be
 * saved as it is.
 */
export function ImageCropper({
  title,
  src,
  error,
  fileName,
  contentType,
  initialAspect = 'original',
  saving,
  onCancel,
  onSave,
  onUseOriginal,
}: {
  title: string
  src?: string
  error?: string
  fileName: string
  contentType: string
  initialAspect?: AspectKey
  saving?: boolean
  onCancel: () => void
  onSave: (file: File) => void
  onUseOriginal?: () => void
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [aspectKey, setAspectKey] = useState<AspectKey>(initialAspect)
  const [natural, setNatural] = useState(4 / 3)
  const [area, setArea] = useState<Area | null>(null)
  const [working, setWorking] = useState(false)
  const aspect = aspectKey === 'original' ? natural : Number(aspectKey)

  // a new shape starts centred again
  const chooseAspect = (key: AspectKey) => {
    setAspectKey(key)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
  }

  const save = async () => {
    if (!src || !area) return
    setWorking(true)
    try {
      onSave(await cropToFile(src, area, fileName, contentType))
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setWorking(false)
    }
  }

  return (
    <Modal
      open
      onClose={onCancel}
      title={title}
      description="Drag to move · scroll or use the slider to zoom"
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          {onUseOriginal && (
            <Button variant="outline" onClick={onUseOriginal} disabled={saving}>
              Upload as is
            </Button>
          )}
          <Button onClick={save} loading={saving || working} disabled={!src || !area}>
            Save cropped image
          </Button>
        </>
      }
    >
      <div className="relative h-[55vh] min-h-72 overflow-hidden rounded-lg bg-slate-900">
        {src ? (
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            minZoom={1}
            maxZoom={4}
            showGrid
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setArea(pixels)}
            onMediaLoaded={(m: MediaSize) => setNatural(m.naturalWidth / m.naturalHeight)}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-300">
            {error ? error : <Loader2 className="h-6 w-6 animate-spin" />}
          </div>
        )}
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {ASPECTS.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => chooseAspect(a.key)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                aspectKey === a.key
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-slate-300 text-slate-600 hover:border-brand-300 hover:bg-brand-50/60 hover:text-brand-700'
              )}
            >
              {a.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-500">
          Zoom
          <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-40 accent-brand-600" />
        </label>
      </div>
    </Modal>
  )
}
