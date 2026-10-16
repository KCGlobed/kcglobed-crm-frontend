import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import {
  Baseline,
  Bold,
  Braces,
  Code,
  Eraser,
  Eye,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  MousePointerClick,
  Redo2,
  Strikethrough,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignStart,
  Trash2,
  Underline,
  Undo2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useDeleteMessageAssetMutation, useListMessageAssetsQuery, useUploadMessageAssetMutation } from '../../services/messagingApi'
import { Button } from '../ui/Button'
import { sanitizeHtml } from '../../lib/sanitize'
import { cn, parseApiError } from '../../lib/utils'
import { buttonHtml, dividerHtml, imageHtml, isHtmlDocument, wrapInEmailLayout } from '../../lib/emailPreview'

type Mode = 'visual' | 'code'
type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const HANDLE_CLASS: Record<Handle, string> = {
  nw: '-left-1.5 -top-1.5 cursor-nwse-resize',
  n: '-top-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize',
  ne: '-right-1.5 -top-1.5 cursor-nesw-resize',
  e: '-right-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize',
  se: '-bottom-1.5 -right-1.5 cursor-nwse-resize',
  s: '-bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize',
  sw: '-bottom-1.5 -left-1.5 cursor-nesw-resize',
  w: '-left-1.5 top-1/2 -translate-y-1/2 cursor-ew-resize',
}

/** Fonts every mail client has (the first is Outlook's own default, with Arial behind it). */
const FONTS: [string, string][] = [
  ['Aptos, Arial, sans-serif', 'Aptos'],
  ['Arial, Helvetica, sans-serif', 'Arial'],
  ['Georgia, serif', 'Georgia'],
  ['Tahoma, sans-serif', 'Tahoma'],
  ['"Times New Roman", serif', 'Times New Roman'],
  ['"Trebuchet MS", sans-serif', 'Trebuchet MS'],
  ['Verdana, sans-serif', 'Verdana'],
  ['"Courier New", monospace', 'Courier New'],
]
const SIZES = [10, 11, 12, 13, 14, 15, 16, 18, 20, 24, 28, 32, 36]
const ASSET_ID_RE = /\/api\/v1\/public\/assets\/([0-9a-f]{24})\b/

function ToolButton({ icon, label, onClick, active, disabled }: { icon: ReactNode; label: string; onClick: () => void; active?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} // keep the editor's selection
      onClick={onClick}
      className={cn(
        'rounded-md p-1.5 text-slate-700 transition-colors hover:bg-slate-200/70 hover:text-slate-900 disabled:opacity-40',
        active && 'bg-brand-50 text-brand-700'
      )}
    >
      {icon}
    </button>
  )
}

const Sep = () => <span className="mx-1 h-5 w-px bg-slate-200" />

/**
 * The email editor (GL-21), laid out like a mail client's compose window: font and size, bold / italic /
 * underline / strike, highlight and text colour, lists, alignment, links, images, a call-to-action
 * button, placeholders, a divider — and an HTML mode for an emailer pasted from a design tool. Images
 * upload into the CRM's library; click one to resize, align, remove it or delete it from the library.
 * A whole HTML page (doctype / <html>) is edited as code only — the visual editor would drop its <head>.
 */
export function EmailEditor({
  value,
  onChange,
  placeholders = [],
  height = '24rem',
  frameless = false,
  className,
}: {
  value: string
  onChange: (html: string) => void
  /** lead fields a {placeholder} can name (from /messaging/options) */
  placeholders?: string[]
  height?: string
  /** no outer border / rounding: the editor sits inside a compose window */
  frameless?: boolean
  className?: string
}) {
  const document_ = isHtmlDocument(value)
  const [chosenMode, setMode] = useState<Mode>(document_ ? 'code' : 'visual')
  const mode: Mode = document_ ? 'code' : chosenMode // a whole page is always code
  const editorRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const colorRef = useRef<HTMLInputElement>(null)
  const highlightRef = useRef<HTMLInputElement>(null)
  const lastEmitted = useRef<string | null>(null)
  const [imageMenu, setImageMenu] = useState(false)
  const [placeholderMenu, setPlaceholderMenu] = useState(false)
  const selectedImgRef = useRef<HTMLImageElement | null>(null) // the DOM node being edited: mutated in place, so never state
  const [selectedSrc, setSelectedSrc] = useState<string | null>(null) // re-renders the image toolbar
  const wrapRef = useRef<HTMLDivElement>(null) // scrolls the visual editor; the resize frame is positioned inside it
  const [frame, setFrame] = useState<{ top: number; left: number; width: number; height: number } | null>(null)
  const [dragSize, setDragSize] = useState<string | null>(null) // "320 × 180" while a corner is dragged
  const [confirmLibraryDelete, setConfirmLibraryDelete] = useState<string | null>(null)
  const [upload, { isLoading: uploading }] = useUploadMessageAssetMutation()
  const [deleteAsset, { isLoading: deleting }] = useDeleteMessageAssetMutation()
  const { data: assets } = useListMessageAssetsQuery(undefined, { skip: !imageMenu })

  // the visual editor shows `value` whenever it changed elsewhere (mode switch, template loaded) — not on
  // its own keystrokes, which would move the caret
  useEffect(() => {
    if (mode !== 'visual' || !editorRef.current) return
    if (value !== lastEmitted.current) {
      editorRef.current.innerHTML = sanitizeHtml(value)
      lastEmitted.current = value
    }
  }, [mode, value])

  /** The frame with the corner handles sits exactly over the selected image (in the scroll wrapper's coordinates). */
  const measure = () => {
    const img = selectedImgRef.current
    const wrap = wrapRef.current
    if (!img || !wrap || !img.isConnected) return setFrame(null)
    const a = img.getBoundingClientRect()
    const b = wrap.getBoundingClientRect()
    setFrame({ top: a.top - b.top + wrap.scrollTop, left: a.left - b.left + wrap.scrollLeft, width: a.width, height: a.height })
  }
  const selectImage = (img: HTMLImageElement | null) => {
    selectedImgRef.current = img
    setSelectedSrc(img ? (img.getAttribute('src') ?? '') : null)
    if (img) requestAnimationFrame(measure)
    else setFrame(null)
  }
  const emit = () => {
    const html = editorRef.current?.innerHTML ?? ''
    lastEmitted.current = html
    onChange(html)
    if (selectedImgRef.current) requestAnimationFrame(measure) // text above the image moves it
  }
  /** Legacy <font> tags from execCommand become spans with inline styles — what mail clients render best. */
  const normaliseFonts = () => {
    editorRef.current?.querySelectorAll('font').forEach((font) => {
      const span = document.createElement('span')
      if (font.getAttribute('face')) span.style.fontFamily = font.getAttribute('face') as string
      if (font.getAttribute('color')) span.style.color = font.getAttribute('color') as string
      span.innerHTML = font.innerHTML
      font.replaceWith(span)
    })
  }
  const exec = (command: string, arg?: string) => {
    editorRef.current?.focus()
    document.execCommand('styleWithCSS', false, 'true')
    document.execCommand(command, false, arg)
    normaliseFonts()
    emit()
  }
  const setFontSize = (px: number) => {
    editorRef.current?.focus()
    document.execCommand('styleWithCSS', false, 'true')
    document.execCommand('fontSize', false, '7') // a marker size, replaced by the pixel size right away
    editorRef.current?.querySelectorAll<HTMLElement>('span[style*="xxx-large"], font[size="7"]').forEach((el) => {
      if (el.tagName === 'FONT') {
        const span = document.createElement('span')
        span.innerHTML = el.innerHTML
        el.replaceWith(span)
        el = span
      }
      el.style.fontSize = `${px}px`
    })
    emit()
  }
  const insertAtCursor = (snippet: string) => {
    const ta = textareaRef.current
    if (!ta) return onChange(value + snippet)
    const start = ta.selectionStart ?? value.length
    const end = ta.selectionEnd ?? start
    onChange(value.slice(0, start) + snippet + value.slice(end))
    requestAnimationFrame(() => {
      ta.focus()
      ta.selectionStart = ta.selectionEnd = start + snippet.length
    })
  }
  const insertHtml = (html: string) => (mode === 'visual' ? exec('insertHTML', html) : insertAtCursor(html))
  const insertPlaceholder = (p: string) => {
    setPlaceholderMenu(false)
    if (mode === 'visual') exec('insertText', `{${p}}`)
    else insertAtCursor(`{${p}}`)
  }

  const addLink = () => {
    const url = window.prompt('Link address (https://…)')
    if (!url) return
    if (mode === 'visual') exec('createLink', url)
    else insertAtCursor(`<a href="${url}">link text</a>`)
  }
  const addButton = () => {
    const text = window.prompt('Button text', 'Apply now')
    if (!text) return
    const url = window.prompt('Button link (https://…)')
    if (!url) return
    insertHtml(buttonHtml(text, url))
  }
  const addImageByUrl = () => {
    setImageMenu(false)
    const url = window.prompt('Image address (https://…)')
    if (url) insertHtml(imageHtml(url))
  }
  const uploadImage = async (file: File | undefined) => {
    setImageMenu(false)
    if (!file) return
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await upload(form).unwrap()
      insertHtml(imageHtml(res.data.url, file.name.replace(/\.[^.]+$/, '')))
      toast.success('Image uploaded')
    } catch (err) {
      toast.error(parseApiError(err).message)
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }
  const removeFromLibrary = async (id: string, img?: HTMLImageElement | null) => {
    try {
      await deleteAsset(id).unwrap()
      if (img) {
        img.remove()
        selectImage(null)
        emit()
      }
      toast.success('Image deleted from the library')
    } catch (err) {
      toast.error(parseApiError(err).message)
    } finally {
      setConfirmLibraryDelete(null)
    }
  }

  // ---- the selected image's tools
  const imgAssetId = selectedSrc ? ASSET_ID_RE.exec(selectedSrc)?.[1] : undefined
  const sizeImage = (width: string) => {
    const img = selectedImgRef.current
    if (!img) return
    img.style.width = width
    img.style.height = 'auto'
    img.style.maxWidth = '100%'
    emit()
  }
  const alignImage = (where: 'left' | 'center' | 'right') => {
    const img = selectedImgRef.current
    if (!img) return
    img.style.display = 'block'
    img.style.marginLeft = where === 'left' ? '0' : 'auto'
    img.style.marginRight = where === 'right' ? '0' : 'auto'
    emit()
  }
  const removeImage = () => {
    const img = selectedImgRef.current
    if (!img) return
    img.remove()
    selectImage(null)
    emit()
  }
  const setWidthPx = (px: number) => {
    const img = selectedImgRef.current
    if (!img || !Number.isFinite(px)) return
    img.style.width = `${Math.max(24, Math.round(px))}px`
    img.style.height = 'auto'
    img.style.maxWidth = '100%'
    emit()
  }
  const fitProportions = () => {
    const img = selectedImgRef.current
    if (!img) return
    img.style.height = 'auto'
    emit()
  }
  const originalSize = () => {
    const img = selectedImgRef.current
    if (!img) return
    img.style.width = ''
    img.style.height = 'auto'
    img.style.maxWidth = '100%'
    emit()
  }
  /**
   * Mail-client style resizing: a corner keeps the picture's proportions; a side handle stretches it — width
   * from the left / right edge, height from the top / bottom edge.
   */
  const startDrag = (handle: Handle) => (e: ReactMouseEvent) => {
    const img = selectedImgRef.current
    if (!img) return
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const start = img.getBoundingClientRect()
    const ratio = img.naturalWidth && img.naturalHeight ? img.naturalHeight / img.naturalWidth : start.height / Math.max(1, start.width)
    const maxWidth = Math.max(48, (wrapRef.current?.clientWidth ?? 800) - 40)
    const dx = handle.includes('e') ? 1 : handle.includes('w') ? -1 : 0
    const dy = handle.includes('s') ? 1 : handle.includes('n') ? -1 : 0
    const corner = dx !== 0 && dy !== 0
    const onMove = (ev: globalThis.MouseEvent) => {
      img.style.maxWidth = '100%'
      let width = Math.round(start.width)
      let height = Math.round(start.height)
      if (corner) {
        width = Math.round(Math.min(maxWidth, Math.max(24, start.width + dx * (ev.clientX - startX))))
        height = Math.round(width * ratio)
        img.style.width = `${width}px`
        img.style.height = 'auto'
      } else if (dx !== 0) {
        width = Math.round(Math.min(maxWidth, Math.max(24, start.width + dx * (ev.clientX - startX))))
        img.style.width = `${width}px`
        img.style.height = `${height}px`
      } else {
        height = Math.round(Math.max(16, start.height + dy * (ev.clientY - startY)))
        img.style.width = `${width}px`
        img.style.height = `${height}px`
      }
      setDragSize(`${width} × ${height}`)
      measure()
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      setDragSize(null)
      emit()
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const visual = mode === 'visual'
  const icon = 'h-4 w-4'
  const select = 'h-7 rounded-md border border-slate-200 bg-white px-1.5 text-xs text-slate-700 focus:border-brand-400 focus:outline-none'

  return (
    <div className={cn('flex flex-col bg-white', !frameless && 'rounded-lg border border-slate-300', className)} style={{ height }}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50/80 px-2 py-1.5">
        {visual && (
          <>
            <ToolButton icon={<Undo2 className={icon} />} label="Undo" onClick={() => exec('undo')} />
            <ToolButton icon={<Redo2 className={icon} />} label="Redo" onClick={() => exec('redo')} />
            <Sep />
            <select className={cn(select, 'w-32')} defaultValue="" aria-label="Font" onMouseDown={(e) => e.stopPropagation()} onChange={(e) => e.target.value && exec('fontName', e.target.value)}>
              <option value="" disabled>
                Font
              </option>
              {FONTS.map(([family, label]) => (
                <option key={label} value={family} style={{ fontFamily: family }}>
                  {label}
                </option>
              ))}
            </select>
            <select className={cn(select, 'w-16')} defaultValue="" aria-label="Font size" onChange={(e) => e.target.value && setFontSize(Number(e.target.value))}>
              <option value="" disabled>
                Size
              </option>
              {SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <Sep />
            <ToolButton icon={<Bold className={icon} />} label="Bold (Ctrl+B)" onClick={() => exec('bold')} />
            <ToolButton icon={<Italic className={icon} />} label="Italic (Ctrl+I)" onClick={() => exec('italic')} />
            <ToolButton icon={<Underline className={icon} />} label="Underline (Ctrl+U)" onClick={() => exec('underline')} />
            <ToolButton icon={<Strikethrough className={icon} />} label="Strikethrough" onClick={() => exec('strikeThrough')} />
            <ToolButton icon={<Highlighter className={icon} />} label="Highlight colour" onClick={() => highlightRef.current?.click()} />
            <input ref={highlightRef} type="color" defaultValue="#fff59d" className="sr-only" aria-label="Highlight colour" onChange={(e) => exec('hiliteColor', e.target.value)} />
            <ToolButton icon={<Baseline className={icon} />} label="Font colour" onClick={() => colorRef.current?.click()} />
            <input ref={colorRef} type="color" defaultValue="#c00000" className="sr-only" aria-label="Font colour" onChange={(e) => exec('foreColor', e.target.value)} />
            <ToolButton icon={<Eraser className={icon} />} label="Clear formatting" onClick={() => exec('removeFormat')} />
            <Sep />
            <ToolButton icon={<List className={icon} />} label="Bullets" onClick={() => exec('insertUnorderedList')} />
            <ToolButton icon={<ListOrdered className={icon} />} label="Numbering" onClick={() => exec('insertOrderedList')} />
            <ToolButton icon={<TextAlignStart className={icon} />} label="Align left" onClick={() => exec('justifyLeft')} />
            <ToolButton icon={<TextAlignCenter className={icon} />} label="Align centre" onClick={() => exec('justifyCenter')} />
            <ToolButton icon={<TextAlignEnd className={icon} />} label="Align right" onClick={() => exec('justifyRight')} />
            <Sep />
          </>
        )}
        <ToolButton icon={<Link2 className={icon} />} label="Link" onClick={addLink} />
        <div className="relative">
          <ToolButton icon={<ImagePlus className={icon} />} label="Image" onClick={() => setImageMenu((o) => !o)} active={imageMenu} />
          {imageMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setImageMenu(false)} />
              <div className="absolute left-0 top-full z-50 mt-1 w-80 rounded-lg border border-slate-200 bg-white p-2 text-xs shadow-xl">
                <Button size="sm" variant="outline" className="w-full justify-center" loading={uploading} onClick={() => fileRef.current?.click()}>
                  Upload from computer
                </Button>
                <button type="button" className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-slate-600 hover:bg-slate-100" onClick={addImageByUrl}>
                  Insert by address (https://…)
                </button>
                {assets?.data.length ? (
                  <>
                    <p className="mt-2 px-1 text-[10px] font-semibold uppercase text-slate-400">Image library · click to insert</p>
                    <div className="mt-1 grid max-h-44 grid-cols-4 gap-1.5 overflow-y-auto p-0.5">
                      {assets.data.map((a) => (
                        <div key={a._id} className="group relative aspect-square overflow-hidden rounded border border-slate-200 hover:border-brand-400">
                          {confirmLibraryDelete === a._id ? (
                            <div className="flex h-full flex-col items-center justify-center gap-1 bg-red-50 p-1 text-center text-[10px] text-red-700">
                              Delete?
                              <div className="flex gap-1">
                                <button type="button" className="rounded bg-red-600 px-1.5 py-0.5 text-white" disabled={deleting} onClick={() => removeFromLibrary(a._id)}>
                                  Yes
                                </button>
                                <button type="button" className="rounded bg-white px-1.5 py-0.5 text-slate-600 ring-1 ring-slate-300" onClick={() => setConfirmLibraryDelete(null)}>
                                  No
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                title={a.name}
                                className="h-full w-full"
                                onClick={() => {
                                  setImageMenu(false)
                                  insertHtml(imageHtml(a.url, a.name.replace(/\.[^.]+$/, '')))
                                }}
                              >
                                <img src={a.url} alt={a.name} className="h-full w-full object-cover" />
                              </button>
                              <button
                                type="button"
                                title="Delete from the library"
                                aria-label={`Delete ${a.name} from the library`}
                                className="absolute right-0.5 top-0.5 rounded-full bg-white/90 p-0.5 text-slate-500 opacity-0 shadow ring-1 ring-slate-200 group-hover:opacity-100 hover:text-red-600"
                                onClick={() => setConfirmLibraryDelete(a._id)}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}
                <p className="mt-2 px-1 text-[10px] text-slate-400">PNG, JPEG, GIF or WebP · up to 5 MB · hosted by the CRM, so every mail client can load them</p>
              </div>
            </>
          )}
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={(e) => uploadImage(e.target.files?.[0])} />
        </div>
        <ToolButton icon={<MousePointerClick className={icon} />} label="Button (call to action)" onClick={addButton} />
        <ToolButton icon={<Minus className={icon} />} label="Divider" onClick={() => insertHtml(dividerHtml)} />
        <div className="relative">
          <ToolButton icon={<Braces className={icon} />} label="Insert placeholder (lead field)" onClick={() => setPlaceholderMenu((o) => !o)} active={placeholderMenu} />
          {placeholderMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setPlaceholderMenu(false)} />
              <div className="absolute left-0 top-full z-50 mt-1 max-h-64 w-56 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 text-xs shadow-xl">
                {placeholders.length === 0 && <p className="px-2 py-1 text-slate-400">No placeholders</p>}
                {placeholders.map((p) => (
                  <button key={p} type="button" className="block w-full rounded-md px-2 py-1 text-left font-mono text-slate-700 hover:bg-brand-50" onClick={() => insertPlaceholder(p)}>
                    {`{${p}}`}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1">
          {!visual && !document_ && (
            <button
              type="button"
              className="rounded-md px-2 py-1 text-[11px] font-medium text-brand-600 hover:bg-brand-50"
              title="Put the content inside the standard 600 px centred layout"
              onClick={() => onChange(wrapInEmailLayout(value))}
            >
              Wrap in email layout
            </button>
          )}
          <div className="flex overflow-hidden rounded-md border border-slate-300 text-[11px] font-medium">
            <button
              type="button"
              disabled={document_}
              title={document_ ? 'A whole HTML page is edited as code' : 'Visual editor'}
              onClick={() => setMode('visual')}
              className={cn('px-2 py-1', visual ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100', 'disabled:opacity-50')}
            >
              <Eye className="mr-1 inline h-3 w-3" />
              Visual
            </button>
            <button
              type="button"
              title="HTML code (paste an emailer here)"
              onClick={() => setMode('code')}
              className={cn('px-2 py-1', !visual ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100')}
            >
              <Code className="mr-1 inline h-3 w-3" />
              HTML
            </button>
          </div>
        </div>
      </div>
      {visual && selectedSrc !== null && frame && (
        <div className="flex flex-wrap items-center gap-1 border-b border-brand-100 bg-brand-50/60 px-2 py-1 text-[11px] text-slate-700">
          <span className="mr-1 font-semibold text-brand-700">Image</span>
          <span className="text-slate-500">Size</span>
          {(
            [
              ['25%', 'S'],
              ['50%', 'M'],
              ['75%', 'L'],
              ['100%', 'Full'],
            ] as const
          ).map(([w, label]) => (
            <button key={w} type="button" className="rounded px-1.5 py-0.5 hover:bg-white" onClick={() => sizeImage(w)}>
              {label}
            </button>
          ))}
          <label className="ml-1 inline-flex items-center gap-1 text-slate-500">
            Width
            <input
              key={dragSize ? 'drag' : `${selectedSrc}-${Math.round(frame.width)}`}
              type="number"
              min={24}
              defaultValue={Math.round(frame.width)}
              aria-label="Image width in pixels"
              className="h-6 w-16 rounded border border-slate-300 bg-white px-1 text-[11px] text-slate-800"
              onKeyDown={(e) => e.key === 'Enter' && setWidthPx(Number((e.target as HTMLInputElement).value))}
              onBlur={(e) => Number(e.target.value) !== Math.round(frame.width) && setWidthPx(Number(e.target.value))}
            />
            px
          </label>
          <button type="button" className="rounded px-1.5 py-0.5 hover:bg-white" title="Height follows the width again" onClick={fitProportions}>
            Fit
          </button>
          <button type="button" className="rounded px-1.5 py-0.5 hover:bg-white" title="Back to the picture's own size" onClick={originalSize}>
            Original
          </button>
          <Sep />
          <ToolButton icon={<TextAlignStart className="h-3.5 w-3.5" />} label="Image left" onClick={() => alignImage('left')} />
          <ToolButton icon={<TextAlignCenter className="h-3.5 w-3.5" />} label="Image centred" onClick={() => alignImage('center')} />
          <ToolButton icon={<TextAlignEnd className="h-3.5 w-3.5" />} label="Image right" onClick={() => alignImage('right')} />
          <Sep />
          <button type="button" className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-red-600 hover:bg-white" onClick={removeImage}>
            <X className="h-3 w-3" /> Remove from email
          </button>
          {imgAssetId &&
            (confirmLibraryDelete === imgAssetId ? (
              <span className="inline-flex items-center gap-1">
                Delete from the library too?
                <button type="button" className="rounded bg-red-600 px-1.5 py-0.5 text-white" disabled={deleting} onClick={() => removeFromLibrary(imgAssetId, selectedImgRef.current)}>
                  Yes
                </button>
                <button type="button" className="rounded bg-white px-1.5 py-0.5 ring-1 ring-slate-300" onClick={() => setConfirmLibraryDelete(null)}>
                  No
                </button>
              </span>
            ) : (
              <button type="button" className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-red-600 hover:bg-white" onClick={() => setConfirmLibraryDelete(imgAssetId)}>
                <Trash2 className="h-3 w-3" /> Delete from library
              </button>
            ))}
          <button type="button" className="ml-auto rounded px-1.5 py-0.5 text-slate-500 hover:bg-white" onClick={() => selectImage(null)}>
            Done
          </button>
        </div>
      )}
      {visual ? (
        <div ref={wrapRef} className="relative min-h-0 flex-1 overflow-y-auto" onScroll={() => selectedImgRef.current && measure()}>
          <div
            ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Email body"
          onInput={emit}
          onBlur={emit}
          onClick={(e) => {
            const target = e.target as HTMLElement
            selectImage(target.tagName === 'IMG' ? (target as HTMLImageElement) : null)
          }}
          className="min-h-full px-5 py-4 text-[15px] leading-relaxed text-slate-800 [font-family:Aptos,Arial,Helvetica,sans-serif] focus:outline-none [&_a]:text-brand-600 [&_a]:underline [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:text-xl [&_h2]:font-semibold [&_img]:cursor-pointer [&_img:hover]:outline [&_img:hover]:outline-2 [&_img:hover]:outline-brand-300 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-6"
          />
          {frame && selectedSrc !== null && (
            <div className="pointer-events-none absolute z-10" style={{ top: frame.top, left: frame.left, width: frame.width, height: frame.height, outline: '2px solid #4f46e5' }}>
              {HANDLES.map((h) => (
                <span
                  key={h}
                  role="presentation"
                  title={h.length === 2 ? 'Drag to resize (keeps proportions)' : 'Drag to stretch'}
                  onMouseDown={startDrag(h)}
                  className={cn('pointer-events-auto absolute h-3 w-3 rounded-sm border border-white bg-brand-600 shadow', HANDLE_CLASS[h])}
                />
              ))}
              {dragSize && <span className="absolute -bottom-6 left-0 whitespace-nowrap rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-white">{dragSize} px</span>}
            </div>
          )}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={value}
          spellCheck={false}
          aria-label="Email HTML"
          placeholder="Paste the emailer's HTML here, or write it. Placeholders like {first_name} are filled from the lead."
          onChange={(e) => onChange(e.target.value)}
          className="min-h-0 flex-1 resize-none p-3 font-mono text-xs leading-5 text-slate-800 focus:outline-none"
        />
      )}
    </div>
  )
}
