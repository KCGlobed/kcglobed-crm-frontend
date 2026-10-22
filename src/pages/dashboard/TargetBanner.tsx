import { cn } from '../../lib/utils'
import type { Mood } from '../../lib/targetMood'
import type { Target } from '../../types/models'

/** One line under the welcome heading: the stage, the count, time left and the pace still needed. */
export function TargetLine({ target, mood }: { target: Target; mood: Mood }) {
  return (
    <p className="mt-2 text-xs text-brand-100 sm:text-sm" data-testid="banner-target">
      <span className="font-semibold text-white">Target: {target.stage.name}</span>
      {' · '}
      <span className="tabular-nums">
        {target.achieved} / {target.targetCount} ({target.percent}%)
      </span>
      {' · '}
      {mood.timeLeft}
      {mood.pace && ` · ${mood.pace}`}
    </p>
  )
}

/** The mood in the banner's right corner; the tooltip spells out how it was read. */
export function TargetSmiley({ target, mood }: { target: Target; mood: Mood }) {
  const title =
    target.status === 'completed'
      ? `${target.achieved} of ${target.targetCount} reached`
      : `${target.percent}% done, ${mood.expected}% expected by now`
  return (
    <div className="flex shrink-0 flex-col items-center text-center" title={title} data-testid="banner-mood">
      <span className="text-3xl leading-none sm:text-4xl" role="img" aria-label={mood.label}>
        {mood.emoji}
      </span>
      <span className="mt-1 whitespace-nowrap text-[11px] font-semibold text-gold-300">{mood.label}</span>
    </div>
  )
}

/** The progress bar along the banner's bottom edge; lighter shades than the list so it reads on purple. */
export function TargetBar({ target }: { target: Target }) {
  const width = Math.min(100, target.percent)
  return (
    <div
      className="absolute inset-x-0 bottom-0 h-1.5 bg-white/15"
      role="progressbar"
      aria-label={`Target progress ${target.percent}%`}
      aria-valuenow={width}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn('h-full transition-all', width >= 100 ? 'bg-emerald-400' : width >= 50 ? 'bg-brand-300' : 'bg-amber-400')}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}
