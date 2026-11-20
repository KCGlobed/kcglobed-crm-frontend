import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Info, Pencil, Plus, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useCpCancelTargetMutation, useCpTargetOptionsQuery, useCpTargetsQuery } from '../../services/consultantsApi'
import { useCurrentUser } from '../../app/hooks'
import { can } from '../../constants/permissions'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { FilterBar, PageHeader, SearchInput } from '../../components/ui/misc'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/feedback'
import { Select } from '../../components/ui/fields'
import { cn, formatDateTime, parseApiError } from '../../lib/utils'
import { targetMood } from '../../lib/targetMood'
import type { BadgeTone } from '../../lib/status'
import type { CpTarget, CpTargetMeasure, CpTargetStatus } from '../../types/consultants'
import { CP_LEADS_PATH } from './cpShared'
import { CpTabs } from './CpTabs'
import { CpTargetFormModal } from './CpTargetFormModal'

type Tab = CpTargetStatus | 'all'
const TABS: { key: Tab; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'expired', label: 'Expired' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'all', label: 'All' },
]
const STATUS: Record<CpTargetStatus, { label: string; tone: BadgeTone }> = {
  active: { label: 'Active', tone: 'blue' },
  completed: { label: 'Completed', tone: 'green' },
  expired: { label: 'Expired', tone: 'amber' },
  cancelled: { label: 'Cancelled', tone: 'slate' },
}
const EMPTY: Record<Tab, { title: string; description: string }> = {
  active: { title: 'No active targets', description: 'Targets running now show here with their live progress.' },
  completed: { title: 'No completed targets', description: 'Targets that reached their number by the end of the period show here.' },
  expired: { title: 'No expired targets', description: 'Targets that ended short of their number show here.' },
  cancelled: { title: 'No cancelled targets', description: 'Targets cancelled before their period ended show here.' },
  all: { title: 'No targets yet', description: 'Targets assigned to the partnership team show here.' },
}

/** Partner Leads narrowed to the leads behind a stage / sub-stage target's number; the label names it in the filter chip. */
const leadsPath = (t: CpTarget) =>
  `${CP_LEADS_PATH}?${new URLSearchParams({ target: t._id, target_label: `${t.assignee.name} · ${t.goalLabel}` })}`

function Progress({ target, linkLeads }: { target: CpTarget; linkLeads: boolean }) {
  const achieved =
    linkLeads && target.measure !== 'calls' ? (
      <Link
        to={leadsPath(target)}
        data-testid="cp-target-achieved-link"
        title="See the leads behind this number"
        className="font-semibold text-brand-700 hover:underline"
      >
        {target.achieved}
      </Link>
    ) : (
      target.achieved
    )
  // closed targets show their final figure; only a running target gets the bar
  if (target.status !== 'active') {
    return (
      <span className="whitespace-nowrap text-xs tabular-nums text-slate-600">
        {achieved} / {target.targetCount} · {target.percent}%
      </span>
    )
  }
  const width = Math.min(100, target.percent)
  const mood = targetMood(target)
  return (
    <div className="min-w-[160px]">
      <div className="mb-1 flex justify-between text-xs tabular-nums">
        <span className="text-slate-600">
          {achieved} / {target.targetCount}
        </span>
        <span className="font-semibold text-slate-800">{target.percent}%</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        title={`${mood.label}: ${mood.expected}% expected by now`}
        aria-valuenow={width}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn('h-full rounded-full transition-all', width >= 100 ? 'bg-emerald-500' : width >= 50 ? 'bg-brand-600' : 'bg-amber-500')}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}

/**
 * Channel Partners › Target Manager: targets for the partnership team (leads reaching a stage or sub-stage, or calls
 * logged, within a period), apart from the student Targets. Every target the caller may see (their team; their own
 * for an executive), the active ones counted live. Assign / edit / cancel follow the Target Manager permissions.
 */
export default function CpTargetsPage() {
  const me = useCurrentUser()
  const canCreate = can(me, 'consultants.targets', 'create')
  const canEdit = can(me, 'consultants.targets', 'edit')
  const canOpenLeads = can(me, 'consultants.leads', 'view')
  const [params, setParams] = useSearchParams()
  const requested = params.get('status')
  const tab: Tab = TABS.find((t) => t.key === requested)?.key ?? 'active'
  const search = params.get('search') ?? ''
  const assignee = params.get('assignee') ?? ''
  const measure = (params.get('measure') ?? '') as CpTargetMeasure | ''
  const page = Number(params.get('page')) || 1
  const pageSize = Number(params.get('page_size')) || 25

  const set = (key: string, value: string | number | undefined) => {
    const next = new URLSearchParams(params)
    if (value === undefined || value === '') next.delete(key)
    else next.set(key, String(value))
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }

  const { data: options } = useCpTargetOptionsQuery()
  const assignees = options?.data.assignees ?? []
  const { data, currentData, isLoading, isFetching, isError, error, refetch } = useCpTargetsQuery(
    {
      status: tab,
      assignee: assignee || undefined,
      measure: measure || undefined,
      search: search || undefined,
      page,
      page_size: pageSize,
    },
    // counted on every fetch: a visit re-reads, so the numbers are live
    { refetchOnMountOrArgChange: true }
  )
  const [cancelTarget, { isLoading: cancelling }] = useCpCancelTargetMutation()
  const [editing, setEditing] = useState<CpTarget | 'new' | null>(null)
  const [toCancel, setToCancel] = useState<CpTarget | null>(null)

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

  const columns: Column<CpTarget>[] = [
    {
      key: 'assignee',
      header: 'Executive',
      render: (t) => (
        // DataTable rows take no attributes: the row's test id sits on its first cell
        <span data-testid="cp-target-row" data-target-id={t._id} data-status={t.status} className="font-medium text-slate-800">
          {t.assignee.name}
        </span>
      ),
    },
    {
      key: 'goal',
      header: 'Goal',
      render: (t) => (
        <div className="min-w-0 max-w-72" title={t.description ?? undefined}>
          <p className="truncate text-sm text-slate-800">{t.goalLabel}</p>
          {t.measureLabel !== t.goalLabel && <p className="truncate text-[11px] text-slate-500">{t.measureLabel}</p>}
        </div>
      ),
    },
    { key: 'progress', header: 'Progress', render: (t) => <Progress target={t} linkLeads={canOpenLeads} /> },
    {
      key: 'period',
      header: 'Period',
      render: (t) => (
        <span className="whitespace-nowrap text-xs text-slate-600">
          {formatDateTime(t.startAt)}
          <br />
          {formatDateTime(t.endAt)}
          {t.status === 'active' && <span className="block text-[11px] text-slate-400">{targetMood(t).timeLeft}</span>}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (t) =>
        // reached while the period runs is not final: a stage / sub-stage lead going back takes it below
        t.status === 'active' && t.achieved >= t.targetCount ? (
          <span title="Settled when the period ends">
            <Badge tone="green">Reached</Badge>
          </span>
        ) : (
          <Badge tone={STATUS[t.status].tone} title={t.closedAt ? `Closed ${formatDateTime(t.closedAt)}` : undefined}>
            {STATUS[t.status].label}
          </Badge>
        ),
    },
    { key: 'assignedBy', header: 'Assigned by', render: (t) => <span className="text-xs text-slate-600">{t.assignedBy?.name ?? '—'}</span> },
    ...(canEdit
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right' as const,
            render: (t: CpTarget) =>
              t.status === 'active' ? (
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="sm" title="Edit target" aria-label="Edit target" data-testid="cp-target-edit" onClick={() => setEditing(t)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600"
                    title="Cancel target"
                    aria-label="Cancel target"
                    data-testid="cp-target-cancel"
                    onClick={() => setToCancel(t)}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : null,
          },
        ]
      : []),
  ]

  const filtered = !!search || !!assignee || !!measure
  const empty = filtered ? { title: 'No targets match', description: 'Try another search or filter, or reset them.' } : EMPTY[tab]

  return (
    <>
      <PageHeader
        title="Target Manager"
        description="Goals for the partnership team within a period, counted live and settled when the period ends: completed at 100%, otherwise expired."
        breadcrumbs={[{ label: 'Channel Partners', to: CP_LEADS_PATH }, { label: 'Target Manager' }]}
        actions={
          canCreate ? (
            <Button size="sm" data-testid="cp-target-add" onClick={() => setEditing('new')}>
              <Plus className="h-3.5 w-3.5" /> Assign target
            </Button>
          ) : undefined
        }
      />
      <p className="mb-4 flex items-start gap-1.5 text-xs leading-5 text-slate-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
        <span>
          A lead counts when it reaches the stage or sub-stage within the period while the executive owns it, and stays counted when it
          moves on or closes (Not Interested / Dropped); going back to an earlier stage takes it out. Calls count the Log Call entries the
          executive records in the period.{canOpenLeads && ' Click a lead count to see those leads.'}
        </span>
      </p>
      <FilterBar
        end={
          filtered ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const next = new URLSearchParams(params)
                for (const key of ['search', 'assignee', 'measure', 'page']) next.delete(key)
                setParams(next, { replace: true })
              }}
            >
              Reset
            </Button>
          ) : undefined
        }
      >
        <SearchInput
          className="w-full sm:w-64"
          value={search}
          placeholder="Executive, stage or sub-stage…"
          onSearch={(v) => set('search', v.trim())}
        />
        {assignees.length > 1 && (
          <Select
            className="!w-auto"
            aria-label="Executive"
            data-testid="cp-target-filter-assignee"
            value={assignee}
            onChange={(e) => set('assignee', e.target.value)}
          >
            <option value="">All executives</option>
            {assignees.map((u) => (
              <option key={u._id} value={u._id}>
                {u.name}
              </option>
            ))}
          </Select>
        )}
        <Select
          className="!w-auto"
          aria-label="What it counts"
          data-testid="cp-target-filter-measure"
          value={measure}
          onChange={(e) => set('measure', e.target.value)}
        >
          <option value="">All goals</option>
          {options?.data.measures.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </Select>
      </FilterBar>
      <CpTabs testIdPrefix="cp-target-status" tabs={TABS} active={tab} onChange={(key) => set('status', key === 'active' ? undefined : key)} />
      <div className="mt-4">
        <DataTable
          columns={columns}
          rows={data?.data}
          rowKey={(t) => t._id}
          // skeletons only while this view has no rows yet: a refresh after a save keeps the table
          loading={isLoading || (isFetching && !currentData)}
          error={isError}
          errorMessage={isError ? parseApiError(error).message : undefined}
          errorDetail={error}
          onRetry={refetch}
          emptyTitle={empty.title}
          emptyDescription={empty.description}
          pagination={data?.pagination}
          onPageChange={(p) => set('page', p)}
          onPageSizeChange={(s) => set('page_size', s)}
        />
      </div>
      {editing && (
        <CpTargetFormModal
          key={editing === 'new' ? 'new' : editing._id}
          target={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
      <ConfirmDialog
        open={!!toCancel}
        onClose={() => setToCancel(null)}
        onConfirm={onCancel}
        title="Cancel Target"
        message={`Cancel ${toCancel?.assignee.name}'s target (${toCancel?.goalLabel}: ${toCancel?.targetCount})? Its progress is kept as final and a new target for this goal can then be assigned.`}
        confirmLabel="Cancel target"
        danger
        loading={cancelling}
      />
    </>
  )
}
