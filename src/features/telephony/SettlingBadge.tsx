import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

/**
 * In place of a call's status and talk time while they are on their way from the dialer's call record (the call
 * just ended: the CRM's own guess is never shown — it was often wrong for a few seconds).
 */
export function SettlingBadge({ className, label = 'Getting result…' }: { className?: string; label?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium text-slate-500', className)} role="status" data-testid="call-settling">
      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
      {label}
    </span>
  )
}
