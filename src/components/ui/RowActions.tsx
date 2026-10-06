import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { MoreVertical, type LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface RowAction {
  label: string
  icon?: LucideIcon
  onClick: () => void
  danger?: boolean
  /** omit actions the user may not perform */
  hidden?: boolean
}

/**
 * "⋮" menu for a table row. Positioned with `fixed` so the table's scroll
 * container never clips it; clicks don't bubble to the row's own click.
 */
export function RowActions({ actions, label = 'Row actions' }: { actions: RowAction[]; label?: string }) {
  const visible = actions.filter((a) => !a.hidden)
  const [pos, setPos] = useState<{ top: number; right: number; up: boolean } | null>(null)
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!pos) return
    const close = () => setPos(null)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [pos])

  if (!visible.length) return null

  const toggle = (e: MouseEvent) => {
    e.stopPropagation()
    if (pos) return setPos(null)
    const r = button.current!.getBoundingClientRect()
    const up = window.innerHeight - r.bottom < visible.length * 36 + 24
    setPos({ top: up ? r.top - 4 : r.bottom + 4, right: window.innerWidth - r.right, up })
  }

  return (
    <div onClick={(e) => e.stopPropagation()} className="inline-flex">
      <button
        ref={button}
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={!!pos}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {pos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPos(null)} />
          <div
            role="menu"
            style={{ top: pos.top, right: pos.right, transform: pos.up ? 'translateY(-100%)' : undefined }}
            className="fixed z-50 min-w-44 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-left shadow-[var(--shadow-md)]"
          >
            {visible.map((a) => (
              <button
                key={a.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setPos(null)
                  a.onClick()
                }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-xs font-medium',
                  a.danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50'
                )}
              >
                {a.icon && <a.icon className="h-3.5 w-3.5" />}
                {a.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
