import type { MetricStatus, ReasonCount } from '../../../types/models'
import { REASON_STATUS_LABELS, STATUS_COLUMNS, naReason } from './deliveryStatus'

/** One count: N/A (grey, with why) when the channel cannot report it, else the number — 0 included. */
export function MetricCell({ value, channel, status, className = '' }: { value: number | null | undefined; channel: string; status: MetricStatus; className?: string }) {
  if (value === null || value === undefined)
    return (
      <span className={`cursor-help text-slate-400 ${className}`} title={naReason(channel, status)}>
        N/A
      </span>
    )
  const color = STATUS_COLUMNS.find((s) => s.key === status)?.color ?? 'text-slate-700'
  return <span className={`${value ? color : 'text-slate-400'} ${className}`}>{value}</span>
}

/** "Why it did not go through": the reasons grouped under their status, each clickable to list those leads. */
export function ReasonBreakdown({ reasons, active, onPick }: { reasons: ReasonCount[]; active?: string; onPick?: (code: string | undefined) => void }) {
  if (!reasons.length) return null
  const groups = (Object.keys(REASON_STATUS_LABELS) as ReasonCount['status'][])
    .map((status) => ({ status, items: reasons.filter((r) => r.status === status) }))
    .filter((g) => g.items.length)
  return (
    <div className="rounded-lg border border-slate-200">
      <p className="border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">Why it did not go through</p>
      <div className="divide-y divide-slate-100">
        {groups.map((g) => (
          <div key={g.status} className="px-3 py-2">
            <p className="mb-1 text-[11px] font-medium uppercase text-slate-500">{REASON_STATUS_LABELS[g.status]}</p>
            <ul className="space-y-0.5">
              {g.items.map((r) => {
                const on = active === r.code
                return (
                  <li key={`${r.status}-${r.code}`}>
                    <button
                      type="button"
                      disabled={!onPick}
                      onClick={() => onPick?.(on ? undefined : r.code)}
                      className={`flex w-full items-center justify-between rounded px-1.5 py-0.5 text-left text-xs ${
                        on ? 'bg-blue-50 text-blue-800' : 'text-slate-700 enabled:hover:bg-slate-50'
                      }`}
                      title={onPick ? (on ? 'Show everyone again' : 'Show only these leads') : undefined}
                    >
                      <span>{r.label}</span>
                      <span className="ml-3 font-semibold">{r.count}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
