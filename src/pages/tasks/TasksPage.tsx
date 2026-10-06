import { useNavigate, useSearchParams } from 'react-router-dom'
import { Flag } from 'lucide-react'
import { useListTasksQuery, useTaskSummaryQuery } from '../../services/tasksApi'
import { useCurrentUser } from '../../app/hooks'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { FilterBar, PageHeader, Tabs } from '../../components/ui/misc'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Select } from '../../components/ui/fields'
import { formatDateTime, parseApiError, timeAgo } from '../../lib/utils'
import type { Task, TaskView } from '../../types/models'
import { FollowUpActions } from './FollowUpActions'
import { TASK_TYPES, statusLabel, statusTone } from './taskMeta'

const VIEWS: { key: TaskView; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
]

/**
 * Follow-up work queue (Deep Dive §10.2–10.3): today, overdue, upcoming and
 * completed. Counsellors see their own; team leaders can switch to the team view
 * (their data scope), which doubles as the overdue queue.
 */
export default function TasksPage() {
  const me = useCurrentUser()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const canSeeTeam = !!me && (me.isSuperAdmin || me.dataScope !== 'own')
  const view = (params.get('view') as TaskView) || 'today'
  const who = canSeeTeam && params.get('who') === 'team' ? undefined : 'me'
  const page = Number(params.get('page')) || 1
  const pageSize = Number(params.get('page_size')) || 25
  const type = params.get('type') ?? ''

  const set = (key: string, value: string | number | undefined) => {
    const next = new URLSearchParams(params)
    if (value === undefined || value === '') next.delete(key)
    else next.set(key, String(value))
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }

  const { data, isLoading, isFetching, isError, error, refetch } = useListTasksQuery(
    { view, assignee: who, type, page, page_size: pageSize },
    { pollingInterval: 60_000 }
  )
  const { data: summary } = useTaskSummaryQuery({ assignee: who }, { pollingInterval: 60_000 })
  const counts = summary?.data.counts

  const columns: Column<Task>[] = [
    {
      key: 'lead',
      header: 'Lead',
      render: (t) => (
        <div>
          <p className="font-medium text-slate-800">{[t.lead.firstName, t.lead.lastName].filter(Boolean).join(' ')}</p>
          <p className="text-[11px] text-slate-400">{t.lead.leadNo}</p>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Follow-up',
      render: (t) => (
        <div className="max-w-64">
          <p className="flex items-center gap-1 text-xs font-medium text-slate-700">
            {t.priority === 'high' && <Flag className="h-3 w-3 text-red-500" aria-label="High priority" />}
            {t.typeLabel}
          </p>
          {(t.outcome || t.notes) && <p className="truncate text-[11px] text-slate-500">{t.outcome || t.notes}</p>}
        </div>
      ),
    },
    {
      key: 'dueAt',
      header: view === 'completed' ? 'Closed' : 'Due',
      render: (t) => {
        const when = view === 'completed' ? t.completedAt : t.dueAt
        return (
          <div className="text-xs">
            <p className={t.isOverdue ? 'font-medium text-red-600' : 'text-slate-700'}>{timeAgo(when)}</p>
            <p className="text-[11px] text-slate-400">{formatDateTime(when)}</p>
          </div>
        )
      },
    },
    ...(who === 'me' ? [] : [{ key: 'assignee', header: 'Assignee', render: (t: Task) => <span className="text-xs">{t.assignee.name}</span> }]),
    { key: 'status', header: 'Status', render: (t) => <Badge tone={statusTone(t)}>{statusLabel(t)}</Badge> },
    { key: 'actions', header: '', className: 'text-right', render: (t) => <FollowUpActions task={t} /> },
  ]

  return (
    <>
      <PageHeader
        title="Follow-ups"
        description="Call-backs and next actions on your leads. Reminders arrive 15 minutes before they are due; Admin is alerted when one is overdue for 2 hours."
      />
      <FilterBar
        end={
          type ? (
            <Button variant="ghost" size="sm" onClick={() => set('type', undefined)}>
              Reset
            </Button>
          ) : undefined
        }
      >
        {canSeeTeam && (
          <Select className="!w-auto" value={who ? 'me' : 'team'} onChange={(e) => set('who', e.target.value === 'team' ? 'team' : undefined)}>
            <option value="me">My follow-ups</option>
            <option value="team">My team&apos;s follow-ups</option>
          </Select>
        )}
        <Select className="!w-auto" value={type} onChange={(e) => set('type', e.target.value)}>
          <option value="">All types</option>
          {TASK_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </FilterBar>
      <Tabs tabs={VIEWS.map((v) => ({ ...v, count: counts?.[v.key] }))} active={view} onChange={(key) => set('view', key)} />
      <div className="mt-4">
        <DataTable
          columns={columns}
          rows={data?.data}
          rowKey={(t) => t._id}
          loading={isLoading || isFetching}
          error={isError}
          errorMessage={isError ? parseApiError(error).message : undefined}
          onRetry={refetch}
          emptyTitle={view === 'overdue' ? 'Nothing overdue' : 'No follow-ups here'}
          emptyDescription={view === 'overdue' ? 'Every open follow-up is still on time.' : "Schedule follow-ups from a lead's page or while logging a call."}
          pagination={data?.pagination}
          onPageChange={(p) => set('page', p)}
          onPageSizeChange={(s) => set('page_size', s)}
          onRowClick={(t) => navigate(`/app/leads/${t.lead._id}`)}
        />
      </div>
    </>
  )
}
