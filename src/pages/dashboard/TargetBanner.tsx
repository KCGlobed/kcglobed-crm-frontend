import { useEffect, useState } from 'react'
import { cn } from '../../lib/utils'
import type { Mood } from '../../lib/targetMood'
import type { Target } from '../../types/models'

const MIN_VISIBLE = 2 // % of the bar drawn even at 0%

/** One line under the welcome heading: the stage, the count and the time left. */
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
    </p>
  )
}

/**
 * The mood in the banner's right corner: the emoji follows the mood, the caption always reads "Goal Post" and
 * the tooltip names the mood. Positioned absolutely by the banner so a larger smiley never makes it taller.
 */
export function TargetSmiley({ target, mood, className }: { target: Target; mood: Mood; className?: string }) {
  const title =
    target.status === 'completed'
      ? `${mood.label} ${target.achieved} of ${target.targetCount} reached`
      : `${mood.label}: ${target.percent}% done, ${mood.expected}% expected by now`
  return (
    <div className={cn('flex flex-col items-center text-center', className)} title={title} data-testid="banner-mood">
      <span
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-full bg-white/15 shadow-lg ring-2 ring-gold-300/70 sm:h-14 sm:w-14',
          target.status === 'completed' && 'animate-target-pop'
        )}
      >
        <span className="text-3xl leading-none drop-shadow-[0_2px_3px_rgba(0,0,0,0.35)] sm:text-4xl" role="img" aria-label={mood.label}>
          {mood.emoji}
        </span>
      </span>
      <span className="mt-1 whitespace-nowrap text-xs font-bold tracking-wide text-gold-300">Goal Post</span>
    </div>
  )
}

/**
 * The progress bar along the banner's bottom edge; lighter shades than the list so it reads on purple.
 * It grows from empty when the dashboard opens, a sheen runs over a live target, and a completed one glows.
 */
export function TargetBar({ target }: { target: Target }) {
  const width = Math.min(100, target.percent)
  const done = width >= 100
  // a just-started target still shows a sliver at the start, never an empty bar
  const shown = Math.max(MIN_VISIBLE, width)
  const [grown, setGrown] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setGrown(true))
    return () => cancelAnimationFrame(frame)
  }, [])
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
        className={cn(
          'relative h-full transition-[width] duration-[1100ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
          done ? 'animate-target-glow bg-emerald-400' : cn('overflow-hidden', width >= 50 ? 'bg-brand-300' : 'bg-amber-400')
        )}
        style={{ width: `${grown ? shown : 0}%` }}
      >
        {!done && (
          <span aria-hidden className="animate-target-shimmer absolute inset-0 bg-linear-to-r from-transparent via-white/70 to-transparent" />
        )}
      </div>
    </div>
  )
}
