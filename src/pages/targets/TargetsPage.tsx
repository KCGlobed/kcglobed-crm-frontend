import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Pencil, Plus, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import dayjs from 'dayjs'
import { useCurrentUser } from '../../app/hooks'
import { can } from '../../constants/permissions'
import { useListParams } from '../../hooks/useListParams'
import { cn, parseApiError } from '../../lib/utils'
import type { BadgeTone } from '../../lib/status'
import { useCancelTargetMutation, useListTargetsQuery } from '../../services/targetsApi'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { ConfirmDialog } from '../../components/ui/feedback'
import { FilterBar, PageHeader, SearchInput, Tabs } from '../../components/ui/misc'
import type { Target, TargetStatus } from '../../types/models'
import { TargetFormModal } from './TargetFormModal'

type Tab = TargetStatus | 'all'
const TABS: { key: Tab; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'expired', label: 'Expired' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'all', label: 'All' },
]
const STATUS: Record<TargetStatus, { label: string; tone: BadgeTone }> = {
  active: { label: 'Active', tone: 'blue' },
  completed: { label: 'Completed', tone: 'green' },
  expired: { label: 'Expired', tone: 'amber' },
  cancelled: { label: 'Cancelled', tone: 'slate' },
}
const when = (iso: string) => dayjs(iso).format('DD MMM YYYY, h:mm A')

function Progress({ target }: { target: Target }) {
  const summary = `${target.achieved} / ${target.targetCount}`
  // closed targets show their final figure; only a running target gets the bar
  if (target.status !== 'active') {
    return (
      <span className="whitespace-nowrap text-xs tabular-nums text-slate-600">
        {summary} · {target.percent}%
      </span>
    )
  }
  const width = Math.min(100, target.percent)
  return (
    <div className="min-w-[160px]">
      <div className="mb-1 flex justify-between text-xs tabular-nums">
        <span className="text-slate-600">{summary}</span>
        <span className="font-semibold text-slate-800">{target.percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={width} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={cn('h-full rounded-full transition-all', width >= 100 ? 'bg-emerald-500' : width >= 50 ? 'bg-brand-600' : 'bg-amber-500')}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}

/**
 * Target Manager: every target the caller may see (their hierarchy; their own for a counsellor), the active
 * ones with a live progress bar. Assign / edit / cancel follow the Targets permissions.
 */
export default function TargetsPage() {
  const user = useCurrentUser()
  const canCreate = can(user, 'targets', 'create')
  const canEdit = can(user, 'targets', 'edit')
  const canOpenLeads = can(user, 'leads', 'view')
  const navigate = useNavigate()
  // a row opens the lead list narrowed to the leads that target counted
  const openLeads = (t: Target) =>
    navigate(`/app/leads?${new URLSearchParams({ target: t._id, target_label: `${t.assignee.name} · ${t.stage.name}` }).toString()}`)
  const { query, setParam } = useListParams({ sort_by: 'createdAt', sort_order: 'desc' }, ['status', 'search'])
  const [, setSearchParams] = useSearchParams()
  const tab: Tab = TABS.find((t) => t.key === query.status)?.key ?? 'active'
  const list = useListTargetsQuery(
    { page: query.page, page_size: query.page_size, status: tab, search: query.search },
    { refetchOnMountOrArgChange: true }
  )
  const [cancelTarget, { isLoading: cancelling }] = useCancelTargetMutation()
  const [editing, setEditing] = useState<Target | 'new' | null>(null)
  const [toCancel, setToCancel] = useState<Target | null>(null)

  const onCancel = async () => {
    if (!toCancel) return
    try {
      await cancelTarget(toCancel._id).unwrap()
      toast.success('Target cancelled')
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
    setToCancel(null)
  }

  const columns: Column<Target>[] = [
    { key: 'assignee', header: 'Assigned To', render: (t) => <span className="font-medium text-slate-800">{t.assignee.name}</span> },
    { key: 'stage', header: 'Target', render: (t) => <span className="text-sm">{t.stage.name}</span> },
    { key: 'progress', header: 'Progress', render: (t) => <Progress target={t} /> },
    {
      key: 'range',
      header: 'Duration',
      render: (t) => (
        <span className="whitespace-nowrap text-xs text-slate-600">
          {when(t.startAt)}
          <br />
          {when(t.endAt)}
        </span>
      ),
    },
    { key: 'status', header: 'Status', render: (t) => <Badge tone={STATUS[t.status].tone}>{STATUS[t.status].label}</Badge> },
    { key: 'assignedBy', header: 'Assigned By', render: (t) => <span className="text-xs text-slate-600">{t.assignedBy?.name ?? '—'}</span> },
    ...(canEdit
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right' as const,
            render: (t: Target) =>
              t.status === 'active' ? (
                <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" title="Edit target" onClick={() => setEditing(t)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-red-600" title="Cancel target" onClick={() => setToCancel(t)}>
                    <XCircle className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : null,
          },
        ]
      : []),
  ]

  return (
    <>
      <PageHeader
        title="Target Manager"
        description="Targets for leads to reach a stage within a date range. Progress counts the leads the assignee owned when they reached the stage; a target completes automatically at 100%. Click a target to see its leads."
        actions={
          canCreate ? (
            <Button size="sm" onClick={() => setEditing('new')}>
              <Plus className="h-3.5 w-3.5" /> Assign Target
            </Button>
          ) : undefined
        }
      />
      <div className="mb-3">
        <Tabs
          tabs={TABS}
          active={tab}
          onChange={(key) => setSearchParams(key === 'active' ? new URLSearchParams() : new URLSearchParams({ status: key }), { replace: true })}
        />
      </div>
      <FilterBar>
        <SearchInput className="w-full sm:w-64" value={query.search ?? ''} onSearch={(v) => setParam('search', v)} placeholder="Person or stage…" />
      </FilterBar>
      <DataTable
        columns={columns}
        rows={list.data?.data}
        rowKey={(t) => t._id}
        onRowClick={canOpenLeads ? openLeads : undefined}
        loading={list.isLoading || list.isFetching}
        error={list.isError}
        errorMessage={list.isError ? parseApiError(list.error).message : undefined}
        onRetry={list.refetch}
        emptyTitle="No targets"
        emptyDescription={tab === 'active' ? 'No active targets right now.' : 'No targets match this view.'}
        pagination={list.data?.pagination}
        onPageChange={(p) => setParam('page', p)}
        onPageSizeChange={(s) => setParam('page_size', s)}
      />
      {editing && <TargetFormModal target={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!toCancel}
        onClose={() => setToCancel(null)}
        onConfirm={onCancel}
        title="Cancel Target"
        message={`Cancel ${toCancel?.assignee.name}'s target (${toCancel?.stage.name}: ${toCancel?.targetCount})? Its progress is kept as final and a new target can then be assigned.`}
        confirmLabel="Cancel target"
        danger
        loading={cancelling}
      />
    </>
  )
}
