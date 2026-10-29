import { cn } from '../../lib/utils'

/** The pill-style view switch inside a tab (Automation: Lead automations | Team alerts). */
export function SegmentedTabs({ tabs, active, onChange }: { tabs: { key: string; label: string; count?: number }[]; active: string; onChange: (key: string) => void }) {
  return (
    <div role="tablist" className="inline-flex rounded-lg bg-slate-100 p-1">
      {tabs.map((v) => (
        <button
          key={v.key}
          type="button"
          role="tab"
          aria-selected={active === v.key}
          onClick={() => onChange(v.key)}
          className={cn('rounded-md px-3 py-1.5 text-sm font-medium transition-colors', active === v.key ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-800')}
        >
          {v.label}
          {v.count !== undefined && <span className="ml-1.5 text-xs text-slate-400">{v.count}</span>}
        </button>
      ))}
    </div>
  )
}

/** All N | On N | Off N — the status filter of a list of rules. */
export function StatusFilterButtons({ value, onChange, total, on }: { value: 'all' | 'on' | 'off'; onChange: (v: 'all' | 'on' | 'off') => void; total: number; on: number }) {
  const options = [
    ['all', `All ${total}`],
    ['on', `On ${on}`],
    ['off', `Off ${total - on}`],
  ] as const
  return (
    <div className="flex overflow-hidden rounded-md border border-slate-300 text-xs font-medium">
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={value === key ? 'bg-brand-600 px-2.5 py-1.5 text-white' : 'bg-white px-2.5 py-1.5 text-slate-600 hover:bg-slate-100'}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
