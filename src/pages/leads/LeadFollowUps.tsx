import { Flag } from 'lucide-react'
import { useLeadTasksQuery } from '../../services/tasksApi'
import { Badge } from '../../components/ui/Badge'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/feedback'
import { cn, formatDateTime, parseApiError, timeAgo } from '../../lib/utils'
import { FollowUpActions } from '../tasks/FollowUpActions'
import { statusLabel, statusTone } from '../tasks/taskMeta'

/** The lead's follow-ups: open ones (soonest first), then closed ones. */
export function LeadFollowUps({ leadId }: { leadId: string }) {
  const { data, isLoading, isError, error, refetch } = useLeadTasksQuery(leadId)

  if (isLoading) return <Skeleton className="h-40 w-full" />
  if (isError) return <ErrorState message={parseApiError(error).message} onRetry={refetch} />
  const tasks = data?.data ?? []
  if (!tasks.length) {
    return <EmptyState title="No follow-ups yet" description="Use “Add follow-up” to schedule the next action on this lead." />
  }

  return (
    <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
      {tasks.map((t) => (
        <li key={t._id} className={cn('flex flex-wrap items-start gap-3 px-4 py-3', t.status !== 'open' && 'opacity-70')}>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-800">
              {t.priority === 'high' && <Flag className="h-3.5 w-3.5 text-red-500" aria-label="High priority" />}
              {t.typeLabel}
              <Badge tone={statusTone(t)}>{statusLabel(t)}</Badge>
            </p>
            <p className={cn('mt-0.5 text-xs', t.isOverdue ? 'text-red-600' : 'text-slate-500')}>
              {t.status === 'open'
                ? `Due ${formatDateTime(t.dueAt)} (${timeAgo(t.dueAt)}) · ${t.assignee.name} · reminder ${t.reminderMinutes} min before`
                : `${statusLabel(t)} ${formatDateTime(t.completedAt)}${t.completedBy ? ` by ${t.completedBy.name}` : ''}`}
            </p>
            {t.notes && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{t.notes}</p>}
            {t.outcome && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">Outcome: {t.outcome}</p>}
          </div>
          <FollowUpActions task={t} />
        </li>
      ))}
    </ul>
  )
}
