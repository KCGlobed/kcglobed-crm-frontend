import type { ReactNode } from 'react'
import { Badge } from '../../components/ui/Badge'
import { textOn } from '../../lib/stageColors'
import { cn } from '../../lib/utils'
import type { CpStageRef } from '../../types/consultants'

/**
 * A Channel Partners stage in its own Lead Stages colour. The student palette (lib/stageColors) is keyed by the
 * student stage names, some of which these share (Interested, Not Connected), so it is not used here.
 */
export function CpStageBadge({
  stage,
  children,
  className,
  title,
}: {
  stage: Pick<CpStageRef, 'name' | 'color'> | null | undefined
  children?: ReactNode
  className?: string
  title?: string
}) {
  if (!stage?.color) return <Badge className={className} title={title}>{children ?? stage?.name ?? '—'}</Badge>
  return (
    <span
      title={title}
      style={{ backgroundColor: stage.color, color: textOn(stage.color), boxShadow: 'inset 0 0 0 1px rgba(15, 23, 42, 0.14)' }}
      className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-semibold leading-4', className)}
    >
      {children ?? stage.name}
    </span>
  )
}
