import { cn } from '../../lib/utils'

/**
 * The underlined tab strip of components/ui/misc Tabs, with a data-testid on every tab (`<testIdPrefix>-<key>`) for
 * the Channel Partners screens.
 */
export function CpTabs({
  tabs,
  active,
  onChange,
  testIdPrefix,
}: {
  tabs: { key: string; label: string; count?: number }[]
  active: string
  onChange: (key: string) => void
  testIdPrefix: string
}) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          data-testid={`${testIdPrefix}-${tab.key}`}
          onClick={() => onChange(tab.key)}
          className={cn(
            '-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
            active === tab.key
              ? 'border-gold-400 text-brand-700'
              : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={cn(
                'ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                active === tab.key ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-600'
              )}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
