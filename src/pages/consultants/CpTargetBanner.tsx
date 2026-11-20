import { Link } from 'react-router-dom'
import { Target } from 'lucide-react'
import { useCpMyTargetsQuery } from '../../services/consultantsApi'
import { useCurrentUser } from '../../app/hooks'
import { cn, formatDateTime } from '../../lib/utils'
import { targetMood } from '../../lib/targetMood'
import type { CpTarget } from '../../types/consultants'
import { CP_LEADS_PATH } from './cpShared'

/** One running target: the goal, the count (a stage / sub-stage count opens its leads), a bar and the time left. */
function CpTargetLine({ target }: { target: CpTarget }) {
  const mood = targetMood(target)
  const width = Math.min(100, target.percent)
  const leads = `${CP_LEADS_PATH}?${new URLSearchParams({ target: target._id, target_label: target.goalLabel })}`
  return (
    <li className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2" data-testid="cp-target-banner-item">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="truncate font-semibold text-slate-800" title={target.goalLabel}>
          {target.goalLabel}
        </span>
        <span className="shrink-0 tabular-nums text-slate-600">
          {target.measure === 'calls' ? (
            target.achieved
          ) : (
            <Link to={leads} className="font-semibold text-brand-700 hover:underline" title="See these leads">
              {target.achieved}
            </Link>
          )}{' '}
          / {target.targetCount} <b className="font-semibold text-slate-800">({target.percent}%)</b>
        </span>
      </div>
      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-label={`${target.goalLabel} progress ${target.percent}%`}
        aria-valuenow={width}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn('h-full rounded-full transition-all', width >= 100 ? 'bg-emerald-500' : width >= 50 ? 'bg-brand-600' : 'bg-amber-500')}
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="mt-1 flex justify-between gap-2 text-[11px] text-slate-500">
        <span title={`${target.percent}% done, ${mood.expected}% expected by now`}>
          <span role="img" aria-label={mood.label}>
            {mood.emoji}
          </span>{' '}
          {mood.label}
        </span>
        <span className="shrink-0" title={`Ends ${formatDateTime(target.endAt)}`}>
          {mood.timeLeft}
        </span>
      </p>
    </li>
  )
}

/**
 * The signed-in executive's running Channel Partners targets, on top of Partner Leads (the student banner's twin).
 * Renders nothing without one.
 */
export function CpTargetBanner() {
  const user = useCurrentUser()
  // re-read every 2 minutes as leads move on; marked as background in consultantsApi, so it never keeps a session alive
  const { data } = useCpMyTargetsQuery(undefined, { skip: !user || user.isSuperAdmin, pollingInterval: 120_000 })
  const targets = data?.data ?? []
  if (!targets.length) return null
  return (
    <section
      aria-label="My targets"
      data-testid="cp-target-banner"
      className="mb-4 rounded-xl border border-brand-100 bg-linear-to-r from-brand-50 to-white px-4 py-3 shadow-sm"
    >
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
        <Target className="h-3.5 w-3.5" /> My targets
      </p>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {targets.map((t) => (
          <CpTargetLine key={t._id} target={t} />
        ))}
      </ul>
    </section>
  )
}
