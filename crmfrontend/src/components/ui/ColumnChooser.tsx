import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Columns3, Lock, RotateCcw } from 'lucide-react'
import { Button } from './Button'
import { Checkbox } from './fields'
import { cn } from '../../lib/utils'

interface ColumnChooserProps {
  columns: { key: string; label: string }[]
  /** keys in their current order */
  order: string[]
  isVisible: (key: string) => boolean
  locked?: string[]
  onToggle: (key: string) => void
  onMove: (key: string, by: -1 | 1) => void
  onReset: () => void
}

/** "Columns" menu: tick to show/hide a table column, arrows to reorder. */
export function ColumnChooser({ columns, order, isVisible, locked = [], onToggle, onMove, onReset }: ColumnChooserProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const labels = new Map(columns.map((c) => [c.key, c.label]))
  const shown = order.filter(isVisible).length

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <Button variant="outline" size="sm" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((o) => !o)}>
        <Columns3 className="h-3.5 w-3.5" /> Columns
        <span className="rounded bg-slate-100 px-1 text-[10px] tabular-nums text-slate-600">
          {shown}/{order.length}
        </span>
      </Button>
      {open && (
        <div className="absolute right-0 z-30 mt-1 w-72 rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <p className="text-xs font-semibold text-slate-700">Show columns</p>
            <button onClick={onReset} className="inline-flex items-center gap-1 text-[11px] text-brand-700 hover:underline">
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          </div>
          <ul className="max-h-80 overflow-y-auto py-1">
            {order.map((key, i) => {
              const isLocked = locked.includes(key)
              return (
                <li key={key} className="flex items-center gap-2 px-3 py-1 hover:bg-slate-50">
                  <label className={cn('flex flex-1 items-center gap-2 text-xs text-slate-700', isLocked ? 'cursor-default' : 'cursor-pointer')}>
                    <Checkbox checked={isVisible(key)} disabled={isLocked} onChange={() => onToggle(key)} />
                    {labels.get(key) ?? key}
                    {isLocked && <Lock className="h-3 w-3 text-slate-300" aria-label="Always shown" />}
                  </label>
                  <button
                    aria-label={`Move ${labels.get(key)} up`}
                    disabled={i === 0}
                    onClick={() => onMove(key, -1)}
                    className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    aria-label={`Move ${labels.get(key)} down`}
                    disabled={i === order.length - 1}
                    onClick={() => onMove(key, 1)}
                    className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
