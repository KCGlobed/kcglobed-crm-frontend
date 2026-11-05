import { useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from '../../components/ui/Button'

/**
 * Quick Filters → Owner: pick one or several owners (checkboxes with a name search). The options are the
 * backend's owner field, already scoped to the viewer (everyone for admins, their team for a team manager).
 */
export function OwnerMultiSelect({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[]
  value: string[]
  onChange: (ids: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const term = search.trim().toLowerCase()
  const shown = term ? options.filter((o) => o.label.toLowerCase().includes(term)) : options
  const text =
    value.length === 0
      ? 'All Owners'
      : value.length === 1
        ? (options.find((o) => o.value === value[0])?.label ?? '1 Owner')
        : `${value.length} Owners`
  const toggle = (id: string, on: boolean) => onChange(on ? [...value, id] : value.filter((v) => v !== id))

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Owner"
        aria-expanded={open}
        title={value.length > 1 ? value.map((id) => options.find((o) => o.value === id)?.label ?? id).join(', ') : undefined}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex h-7 max-w-48 cursor-pointer items-center gap-1 rounded-lg border bg-white px-2.5 text-xs transition-colors',
          value.length ? 'border-brand-400 font-medium text-brand-700' : 'border-slate-300 text-slate-700 hover:border-slate-400'
        )}
      >
        <span className="truncate">{text}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1.5 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
            <div className="relative mb-1.5">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search owner…"
                aria-label="Search owner"
                className="h-8 w-full rounded-lg border border-slate-200 pl-7 pr-2 text-xs focus:border-brand-400 focus:outline-none"
              />
            </div>
            <div className="max-h-64 space-y-0.5 overflow-y-auto">
              {shown.length === 0 && <p className="px-2 py-1.5 text-xs text-slate-400">No owner matches</p>}
              {shown.map((o) => (
                <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50">
                  <input type="checkbox" checked={value.includes(o.value)} onChange={(e) => toggle(o.value, e.target.checked)} />
                  <span className="truncate">{o.label}</span>
                </label>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
              <span className="text-[11px] text-slate-500">{value.length ? `${value.length} selected` : 'All owners'}</span>
              <div className="flex gap-1.5">
                {value.length > 0 && (
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
