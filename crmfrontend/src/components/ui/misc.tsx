import { useEffect, useState, type ReactNode } from 'react'
import { Search } from 'lucide-react'
import { Input } from './fields'
import { cn } from '../../lib/utils'

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
        {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Debounced search box — fires onSearch 400ms after typing stops (SOW §5). */
export function SearchInput({
  value,
  onSearch,
  placeholder = 'Search…',
  className,
}: {
  value: string
  onSearch: (value: string) => void
  placeholder?: string
  className?: string
}) {
  const [text, setText] = useState(value)
  const [syncedValue, setSyncedValue] = useState(value)

  // Adopt external changes (e.g. "clear filters", back navigation) during render.
  if (value !== syncedValue) {
    setSyncedValue(value)
    setText(value)
  }

  useEffect(() => {
    const handle = setTimeout(() => {
      if (text !== value) onSearch(text)
    }, 400)
    return () => clearTimeout(handle)
  }, [text]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="pl-8"
      />
    </div>
  )
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: string; label: string; count?: number }[]
  active: string
  onChange: (key: string) => void
}) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            'whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            active === tab.key
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
