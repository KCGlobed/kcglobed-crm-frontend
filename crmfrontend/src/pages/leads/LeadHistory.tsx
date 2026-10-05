import { useState } from 'react'
import { useLeadHistoryQuery } from '../../services/leadsApi'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '../../components/ui/feedback'
import { formatDateTime, parseApiError } from '../../lib/utils'

const SECTION_TONE = { lead: 'blue', profile: 'violet', discussion: 'amber', system: 'slate' } as const
const SECTION_LABEL: Record<string, string> = { lead: 'Lead', profile: 'Student profile', discussion: 'Counsellor discussion', system: 'System' }

/** GL-27 History tab (Super Admin / Admin): every field change with old → new, who and when. */
export function LeadHistory({ leadId }: { leadId: string }) {
  const [page, setPage] = useState(1)
  const { data, isLoading, isError, error, refetch } = useLeadHistoryQuery({ id: leadId, page })

  if (isLoading) return <Skeleton className="h-48 w-full" />
  if (isError) return <ErrorState message={parseApiError(error).message} onRetry={refetch} />
  if (!data?.data.length) return <EmptyState title="No field changes yet" />

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">When (IST)</th>
            <th className="px-4 py-2">Section</th>
            <th className="px-4 py-2">Field</th>
            <th className="px-4 py-2">Old value</th>
            <th className="px-4 py-2">New value</th>
            <th className="px-4 py-2">Changed by</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.data.map((h) => (
            <tr key={h._id} className="align-top">
              <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-500">{formatDateTime(h.createdAt)}</td>
              <td className="px-4 py-2">
                <Badge tone={SECTION_TONE[h.section as keyof typeof SECTION_TONE] ?? 'slate'}>{SECTION_LABEL[h.section] ?? h.section}</Badge>
              </td>
              <td className="px-4 py-2 text-xs font-medium text-slate-700">{h.label}</td>
              <td className="max-w-56 break-words px-4 py-2 text-xs text-slate-500 line-through decoration-slate-300">{h.oldValue ?? '—'}</td>
              <td className="max-w-56 break-words px-4 py-2 text-xs text-slate-800">{h.newValue ?? '—'}</td>
              <td className="px-4 py-2 text-xs text-slate-600">{h.changedBy.name}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.pagination.total_pages > 1 && (
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          Page {page} of {data.pagination.total_pages}
          <Button variant="outline" size="sm" disabled={page >= data.pagination.total_pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
