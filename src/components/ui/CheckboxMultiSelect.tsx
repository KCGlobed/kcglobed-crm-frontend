import { useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from './Button'

export interface CheckboxOption {
  value: string
  label: string
  /** options with a group are listed under that heading, in the order given */
  group?: string
}

/**
 * The Leads filter-bar multiselect (Stage, Sub-stage), built like Quick Filters → Owner: one button that opens a
 * panel with a search box, a checkbox list and Clear / Done. The button reads `allLabel`, the one name, or "N <plural>".
 */
export function CheckboxMultiSelect({
  options,
  value,
  onChange,
  allLabel,
  plural,
  ariaLabel,
  searchPlaceholder = 'Search…',
}: {
  options: CheckboxOption[]
  value: string[]
  onChange: (ids: string[]) => void
  allLabel: string
  plural: string
  ariaLabel: string
  searchPlaceholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const term = search.trim().toLowerCase()
  const shown = term ? options.filter((o) => o.label.toLowerCase().includes(term) || o.group?.toLowerCase().includes(term)) : options
  const chosen = value.filter((id) => options.some((o) => o.value === id))
  const nameOf = (id: string) => options.find((o) => o.value === id)?.label ?? id
  const text = chosen.length === 0 ? allLabel : chosen.length === 1 ? nameOf(chosen[0]) : `${chosen.length} ${plural}`
  const toggle = (id: string, on: boolean) => onChange(on ? [...value, id] : value.filter((v) => v !== id))

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        title={chosen.length > 1 ? chosen.map(nameOf).join(', ') : undefined}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex h-9 max-w-60 cursor-pointer items-center gap-1.5 rounded-lg border bg-white px-3 text-sm shadow-sm transition-colors',
          chosen.length ? 'border-brand-400 font-medium text-brand-700' : 'border-slate-300 text-slate-800 hover:border-slate-400'
        )}
      >
        <span className="truncate">{text}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1.5 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
            <div className="relative mb-1.5">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={`Search ${ariaLabel}`}
                className="h-8 w-full rounded-lg border border-slate-200 pl-7 pr-2 text-xs focus:border-brand-400 focus:outline-none"
              />
            </div>
            <div className="max-h-64 space-y-0.5 overflow-y-auto">
              {shown.length === 0 && <p className="px-2 py-1.5 text-xs text-slate-400">No match</p>}
              {shown.map((o, i) => (
                <div key={o.value}>
                  {o.group && o.group !== shown[i - 1]?.group && (
                    <p className="px-2 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{o.group}</p>
                  )}
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50">
                    <input type="checkbox" checked={value.includes(o.value)} onChange={(e) => toggle(o.value, e.target.checked)} />
                    <span className="truncate">{o.label}</span>
                  </label>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
              <span className="text-[11px] text-slate-500">{chosen.length ? `${chosen.length} selected` : allLabel}</span>
              <div className="flex gap-1.5">
                {chosen.length > 0 && (
                  <Button variant="ghost" size="sm" className="text-red-600" onClick={() => onChange([])}>
                    Clear
                  </Button>
                )}
                <Button size="sm" onClick={() => setOpen(false)}>
                  Done
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
