import { useState } from 'react'
import {
  ArrowRightLeft,
  CalendarClock,
  CircleDot,
  Download,
  FileText,
  Mail,
  Repeat,
  FileEdit,
  FilePlus2,
  IdCard,
  MessageSquare,
  Phone,
  Sparkles,
  Upload,
  UserPlus,
} from 'lucide-react'
import { useLeadTimelineQuery } from '../../services/leadsApi'
import { ErrorState, Skeleton, EmptyState } from '../../components/ui/feedback'
import { Button } from '../../components/ui/Button'
import { cn, formatDateTime, parseApiError } from '../../lib/utils'

const TYPE_ICONS: Record<string, { icon: typeof Sparkles; className: string }> = {
  created: { icon: FilePlus2, className: 'bg-emerald-50 text-emerald-600' },
  note: { icon: MessageSquare, className: 'bg-sky-50 text-sky-600' },
  call: { icon: Phone, className: 'bg-pink-50 text-pink-600' },
  task: { icon: CalendarClock, className: 'bg-orange-50 text-orange-600' },
  stage_change: { icon: ArrowRightLeft, className: 'bg-amber-50 text-amber-600' },
  status_change: { icon: CircleDot, className: 'bg-rose-50 text-rose-600' },
  assignment: { icon: UserPlus, className: 'bg-brand-50 text-brand-600' },
  profile: { icon: IdCard, className: 'bg-teal-50 text-teal-600' },
  edit: { icon: FileEdit, className: 'bg-slate-100 text-slate-500' },
  import: { icon: Upload, className: 'bg-slate-100 text-slate-500' },
  re_enquiry: { icon: Repeat, className: 'bg-sky-50 text-sky-600' },
  communication: { icon: Mail, className: 'bg-indigo-50 text-indigo-600' },
  document: { icon: FileText, className: 'bg-teal-50 text-teal-600' },
  export: { icon: Download, className: 'bg-slate-100 text-slate-500' },
  system: { icon: Sparkles, className: 'bg-slate-100 text-slate-500' },
}

/** Filter chips → activity types (the API takes ?type=a,b). */
const FILTERS: { key: string; label: string; types?: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'calls', label: 'Calls', types: 'call' },
  { key: 'notes', label: 'Notes', types: 'note' },
  { key: 'messages', label: 'SMS / Email', types: 'communication' },
  { key: 'reenquiry', label: 'Re-enquiry', types: 're_enquiry' },
  { key: 'documents', label: 'Documents', types: 'document' },
  { key: 'followups', label: 'Follow-ups', types: 'task' },
  { key: 'stages', label: 'Stage & status', types: 'stage_change,status_change' },
  { key: 'assignment', label: 'Assignment', types: 'assignment' },
  { key: 'edits', label: 'Edits & profile', types: 'edit,profile' },
  { key: 'system', label: 'Created & system', types: 'created,import,system,export' },
]


function TimelinePage({ leadId, page, types, isLast, onMore }: {
  leadId: string
  page: number
  types?: string
  isLast: boolean
  onMore: () => void
}) {
  const { data, isLoading, isError, error, refetch, isFetching } = useLeadTimelineQuery({ id: leadId, page, type: types })

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    )
  }
  if (isError) return <ErrorState message={parseApiError(error).message} onRetry={refetch} />
  if (page === 1 && !data?.data.length) {
    return <EmptyState title="No activity yet" description="Notes, follow-ups, stage changes and edits will appear here." />
  }

  return (
    <>
      <ol className="relative space-y-4 border-l border-slate-200 pl-6">
        {data?.data.map((activity) => {
          const meta = TYPE_ICONS[activity.type] ?? TYPE_ICONS.system
          const Icon = meta.icon
          return (
            <li key={activity._id} className="relative">
              <span className={`absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full ${meta.className}`}>
                <Icon className="h-3 w-3" />
              </span>
              <p className="text-sm font-medium text-slate-700">{activity.title}</p>
              {activity.description && (
                <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-500">{activity.description}</p>
              )}
              <p className="mt-0.5 text-[11px] text-slate-400">
                {activity.actor?.name ?? activity.actorName ?? 'System'} · {formatDateTime(activity.createdAt)}
              </p>
            </li>
          )
        })}
      </ol>
      {isLast && data?.pagination.next_page && (
        <div className="mt-4 text-center">
          <Button variant="outline" size="sm" loading={isFetching} onClick={onMore}>
            Load older activity
          </Button>
        </div>
      )}
    </>
  )
}

/** Complete lead history: every activity, newest first, filterable by type (Deep Dive §9.3). */
export function LeadTimeline({ leadId }: { leadId: string }) {
  const [filter, setFilter] = useState('all')
  const [pages, setPages] = useState(1)
  const types = FILTERS.find((f) => f.key === filter)?.types

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Filter activity">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            aria-pressed={filter === f.key}
            onClick={() => {
              setFilter(f.key)
              setPages(1)
            }}
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs transition-colors',
              filter === f.key
                ? 'border-brand-500 bg-brand-50 font-medium text-brand-700'
                : 'border-slate-200 text-slate-600 hover:border-slate-300'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="space-y-4">
        {Array.from({ length: pages }, (_, i) => (
          <TimelinePage
            key={`${filter}-${i}`}
            leadId={leadId}
            page={i + 1}
            types={types}
            isLast={i === pages - 1}
            onMore={() => setPages((p) => p + 1)}
          />
        ))}
      </div>
    </div>
  )
}
