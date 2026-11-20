import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { Download, Plus, Upload, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { useCpAssignMutation, useCpLeadsQuery, useCpMetaQuery, useCpStageCountsQuery, cpExportPath } from '../../services/consultantsApi'
import { useCurrentUser } from '../../app/hooks'
import { can } from '../../constants/permissions'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { FilterBar, PageHeader, SearchInput } from '../../components/ui/misc'
import { Button } from '../../components/ui/Button'
import { DateRangeFilter } from '../../components/ui/DateRangeFilter'
import { Checkbox, Select } from '../../components/ui/fields'
import { authorizedDownload } from '../../lib/download'
import { cn, formatDate, formatDateTime, parseApiError, timeAgo } from '../../lib/utils'
import type { CpLead, CpLeadListParams } from '../../types/consultants'
import { CpStageBadge } from './CpStageBadge'
import { CP_LEADS_PATH, cpLeadPath } from './cpShared'
import CpLeadFormDrawer from './CpLeadFormDrawer'
import { CpTargetBanner } from './CpTargetBanner'

/** URL params that are paging / sorting, not filters */
const LIST_KEYS = ['page', 'page_size', 'sort_by', 'sort_order']
/** `target`: the leads behind a Target Manager number (its name rides along as `target_label`, for the chip only) */
const FILTER_KEYS = ['search', 'stage', 'subStage', 'source', 'owner', 'followUp', 'createdFrom', 'createdTo', 'target'] as const
const SORT_KEYS: NonNullable<CpLeadListParams['sort_by']>[] = ['createdAt', 'nextFollowUpAt', 'lastActivityAt', 'name', 'leadNo']
const FOLLOW_UPS = [
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Due today' },
  { value: 'none', label: 'No follow-up' },
] as const
/** the bulk Assign choice that clears the owner */
const UNASSIGNED = '__unassigned__'

const isOverdue = (l: CpLead) => l.status === 'open' && !!l.nextFollowUpAt && dayjs(l.nextFollowUpAt).isBefore(dayjs())

/** Channel Partners › Leads: the consultant leads, apart from the student Leads list. */
export default function CpLeadsPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const user = useCurrentUser()
  const canCreate = can(user, 'consultants.leads', 'create')
  const canImport = can(user, 'consultants.leads', 'import')
  const canExport = can(user, 'consultants.leads', 'export')
  const canReassign = can(user, 'consultants.leads', 'reassign')
  const [addOpen, setAddOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [assignTo, setAssignTo] = useState('')
  const [assign, { isLoading: assigning }] = useCpAssignMutation()

  // filters straight from the URL, so a link, refresh or Back keeps them
  const filters = useMemo(() => {
    const f: Record<string, string> = {}
    FILTER_KEYS.forEach((key) => {
      const value = params.get(key)
      if (value) f[key] = value
    })
    return f
  }, [params])
  const sortParam = params.get('sort_by') as CpLeadListParams['sort_by']
  const query: CpLeadListParams = useMemo(
    () => ({
      ...filters,
      followUp: filters.followUp as CpLeadListParams['followUp'],
      page: Number(params.get('page')) || 1,
      page_size: Number(params.get('page_size')) || 25,
      sort_by: sortParam && SORT_KEYS.includes(sortParam) ? sortParam : 'createdAt',
      sort_order: params.get('sort_order') === 'asc' ? 'asc' : 'desc',
    }),
    [filters, params, sortParam]
  )
  // the chip counts: every filter but the stage (and its sub-stage), so each chip shows what clicking it would list
  const countQuery: CpLeadListParams = useMemo(() => {
    const rest = Object.fromEntries(Object.entries(filters).filter(([key]) => key !== 'stage' && key !== 'subStage'))
    return { ...rest, followUp: rest.followUp as CpLeadListParams['followUp'] }
  }, [filters])

  const { data, currentData, isLoading, isFetching, isError, error, refetch } = useCpLeadsQuery(query, { refetchOnFocus: true })
  const { data: counts } = useCpStageCountsQuery(countQuery, { refetchOnFocus: true })
  const { data: meta } = useCpMetaQuery()
  const stages = meta?.data.stages ?? []
  const owners = meta?.data.owners ?? []
  const sources = meta?.data.sources ?? []
  const showOwnerFilter = owners.length > 1 || canReassign
  const stageId = params.get('stage') ?? ''
  const chosenStage = stages.find((s) => s._id === stageId)
  const targetId = params.get('target')
  const targetLabel = params.get('target_label')

  const pageIds = data?.data.map((l) => l._id) ?? []
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id))
  const hasFilters = Object.keys(filters).length > 0

  const clearSelection = () => {
    setSelected([])
    setAssignTo('')
  }
  /** a filter change: back to page 1, selection dropped */
  const replaceParams = (next: URLSearchParams) => {
    next.delete('page')
    setParams(next, { replace: true })
    clearSelection()
  }
  const setParam = (key: string, value?: string | number) => {
    const next = new URLSearchParams(params)
    if (value === undefined || value === '') next.delete(key)
    else next.set(key, String(value))
    if (key === 'page' || key === 'page_size') setParams(next, { replace: true })
    else replaceParams(next)
  }
  const setStage = (id: string) => {
    const next = new URLSearchParams(params)
    if (id) next.set('stage', id)
    else next.delete('stage')
    next.delete('subStage') // a sub-stage belongs to the stage it was picked under
    replaceParams(next)
  }
  const setCreated = (from: string, to: string) => {
    const next = new URLSearchParams(params)
    if (from) next.set('createdFrom', from)
    else next.delete('createdFrom')
    if (to) next.set('createdTo', to)
    else next.delete('createdTo')
    replaceParams(next)
  }
  const clearTarget = () => {
    const next = new URLSearchParams(params)
    next.delete('target')
    next.delete('target_label')
    replaceParams(next)
  }
  const clearAll = () => {
    const next = new URLSearchParams()
    LIST_KEYS.filter((k) => k !== 'page').forEach((k) => {
      const v = params.get(k)
      if (v) next.set(k, v)
    })
    replaceParams(next)
  }
  const onSort = (key: string) => {
    const next = new URLSearchParams(params)
    if (query.sort_by === key) next.set('sort_order', query.sort_order === 'asc' ? 'desc' : 'asc')
    else {
      next.set('sort_by', key)
      // names read A→Z, the next follow-up soonest first; dates newest first
      next.set('sort_order', key === 'name' || key === 'nextFollowUpAt' ? 'asc' : 'desc')
    }
    setParams(next, { replace: true })
  }

  const onExport = async () => {
    setExporting(true)
    try {
      await authorizedDownload(cpExportPath(filters), 'channel-partner-leads.xlsx')
    } catch (err) {
      toast.error(parseApiError(err).message)
    } finally {
      setExporting(false)
    }
  }

  const onAssign = async () => {
    if (!assignTo || !selected.length) return
    const owner = assignTo === UNASSIGNED ? null : assignTo
    try {
      const res = await assign({ ids: selected, owner }).unwrap()
      const { updated, skipped } = res.data
      const who = owner ? (owners.find((o) => o._id === owner)?.name ?? 'the new owner') : 'Unassigned'
      toast.success(
        `${updated} lead${updated === 1 ? '' : 's'} ${owner ? `assigned to ${who}` : 'moved to Unassigned'}` +
          (skipped ? ` · ${skipped} already ${owner ? `with ${who}` : 'unassigned'}` : '')
      )
      clearSelection()
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  const selectColumn: Column<CpLead> = {
    key: '__select',
    header: '',
    className: 'w-8',
    headerNode: (
      <Checkbox
        aria-label="Select page"
        checked={allPageSelected}
        onChange={(e) =>
          setSelected((s) => (e.target.checked ? [...new Set([...s, ...pageIds])] : s.filter((id) => !pageIds.includes(id))))
        }
      />
    ),
    render: (l) => (
      <span onClick={(e) => e.stopPropagation()}>
        <Checkbox
          aria-label={`Select ${l.leadNo}`}
          checked={selected.includes(l._id)}
          onChange={(e) => setSelected((s) => (e.target.checked ? [...s, l._id] : s.filter((id) => id !== l._id)))}
        />
      </span>
    ),
  }
  const columns: Column<CpLead>[] = [
    ...(canReassign ? [selectColumn] : []),
    {
      key: 'leadNo',
      header: 'Lead No',
      sortable: true,
      render: (l) => (
        <Link
          to={cpLeadPath(l._id)}
          onClick={(e) => e.stopPropagation()}
          className="text-xs font-semibold text-brand-700 hover:underline"
        >
          {l.leadNo}
        </Link>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (l) => (
        <div className="min-w-0 max-w-60">
          <p className="truncate text-sm font-medium text-slate-800" title={l.name}>
            {l.name}
          </p>
          {l.firmName && (
            <p className="truncate text-[11px] text-slate-500" title={l.firmName}>
              {l.firmName}
            </p>
          )}
        </div>
      ),
    },
    { key: 'mobile', header: 'Mobile', render: (l) => <span className="text-xs text-slate-700">{l.mobile}</span> },
    { key: 'city', header: 'City', render: (l) => <span className="text-xs text-slate-600">{l.city || '—'}</span> },
    {
      key: 'source',
      header: 'Source',
      render: (l) =>
        l.source ? (
          <span className="block max-w-40 truncate text-xs text-slate-600" title={l.source.name}>
            {l.source.name}
          </span>
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
    {
      key: 'stage',
      header: 'Stage',
      render: (l) => (
        <div className="flex flex-col items-start gap-0.5">
          <CpStageBadge stage={l.stage} />
          {l.subStage && <span className="max-w-48 truncate text-[11px] text-slate-500" title={l.subStage.name}>{l.subStage.name}</span>}
        </div>
      ),
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (l) =>
        l.owner ? <span className="text-xs text-slate-700">{l.owner.name}</span> : <span className="text-xs italic text-slate-400">Unassigned</span>,
    },
    {
      key: 'nextFollowUpAt',
      header: 'Next Follow-up',
      sortable: true,
      render: (l) => {
        if (!l.nextFollowUpAt) return <span className="text-xs text-slate-400">—</span>
        const overdue = isOverdue(l)
        return (
          <span className={cn('text-xs', overdue ? 'font-semibold text-red-600' : 'text-slate-700')} title={overdue ? 'Overdue' : undefined}>
            {formatDateTime(l.nextFollowUpAt)}
          </span>
        )
      },
    },
    {
      key: 'attempts',
      header: 'Attempts',
      align: 'center',
      render: (l) => (
        <span
          className={cn('text-xs', l.attempts ? 'font-medium text-amber-700' : 'text-slate-400')}
          title={meta ? `Calls in a row that did not connect · dropped at ${meta.data.settings.maxAttempts}` : undefined}
        >
          {l.attempts}
        </span>
      ),
    },
    {
      key: 'lastActivityAt',
      header: 'Last Activity',
      sortable: true,
      render: (l) => (
        <span className="text-xs text-slate-600" title={formatDateTime(l.lastActivityAt)}>
          {timeAgo(l.lastActivityAt)}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      sortable: true,
      render: (l) => (
        <span className="text-xs text-slate-600" title={formatDateTime(l.createdAt)}>
          {formatDate(l.createdAt)}
        </span>
      ),
    },
  ]

  const chip = (key: string, label: string, count: number | undefined, active: boolean, color?: string | null) => (
    <button
      key={key}
      type="button"
      data-testid="cp-stage-chip"
      data-stage={key}
      aria-pressed={active}
      onClick={() => setStage(key === 'all' || active ? '' : key)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
          : 'border-slate-300 bg-white text-slate-600 hover:border-brand-300 hover:bg-brand-50/60 hover:text-brand-700'
      )}
    >
      {color && <span aria-hidden className="h-2 w-2 rounded-full ring-1 ring-black/10" style={{ backgroundColor: color }} />}
      {label}
      {count !== undefined && (
        <span className={cn('rounded-full px-1.5 text-[10px] font-semibold', active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600')}>
          {count.toLocaleString()}
        </span>
      )}
    </button>
  )

  return (
    <>
      <CpTargetBanner />
      <PageHeader
        title="Partner Leads"
        description="Channel Partners · consultant leads"
        actions={
          <>
            {canExport && (
              <Button variant="outline" size="sm" onClick={onExport} loading={exporting} data-testid="cp-export">
                {!exporting && <Download className="h-3.5 w-3.5" />} Export
              </Button>
            )}
            {canImport && (
              <Button variant="outline" size="sm" onClick={() => navigate(`${CP_LEADS_PATH}/import`)} data-testid="cp-bulk-upload">
                <Upload className="h-3.5 w-3.5" /> Bulk Upload
              </Button>
            )}
            {canCreate && (
              <Button size="sm" onClick={() => setAddOpen(true)} data-testid="cp-add-lead">
                <Plus className="h-3.5 w-3.5" /> Add Lead
              </Button>
            )}
          </>
        }
      />

      {/* stage chips: counts under every other filter */}
      <div className="-mx-4 mb-3 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&>*]:shrink-0">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Stages</span>
        {chip('all', 'All', counts?.data.total, !stageId)}
        {stages.map((s) => chip(s._id, s.name, counts ? (counts.data.byStage[s._id] ?? 0) : undefined, stageId === s._id, s.color))}
      </div>

      <FilterBar
        end={
          hasFilters ? (
            <Button variant="ghost" size="sm" onClick={clearAll}>
              <X className="h-3.5 w-3.5" /> Clear All
            </Button>
          ) : undefined
        }
      >
        <SearchInput
          className="w-full sm:w-72"
          value={params.get('search') ?? ''}
          onSearch={(v) => setParam('search', v.trim() || undefined)}
          placeholder="Search name, firm, mobile, email, ID…"
        />
        {chosenStage && chosenStage.subStages.length > 0 && (
          <Select
            aria-label="Sub-stage"
            className="!h-8 !w-auto !py-0 text-xs"
            value={params.get('subStage') ?? ''}
            onChange={(e) => setParam('subStage', e.target.value || undefined)}
          >
            <option value="">All sub-stages</option>
            {chosenStage.subStages.map((sub) => (
              <option key={sub._id} value={sub._id}>
                {sub.name}
              </option>
            ))}
          </Select>
        )}
        {showOwnerFilter && (
          <Select
            aria-label="Owner"
            className="!h-8 !w-auto !py-0 text-xs"
            value={params.get('owner') ?? ''}
            onChange={(e) => setParam('owner', e.target.value || undefined)}
          >
            <option value="">All owners</option>
            <option value="me">Me</option>
            <option value="unassigned">Unassigned</option>
            {owners.map((o) => (
              <option key={o._id} value={o._id}>
                {o.name}
              </option>
            ))}
          </Select>
        )}
        <Select
          aria-label="Source"
          className="!h-8 !w-auto !py-0 text-xs"
          value={params.get('source') ?? ''}
          onChange={(e) => setParam('source', e.target.value || undefined)}
        >
          <option value="">All sources</option>
          {sources.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Follow-up"
          className="!h-8 !w-auto !py-0 text-xs"
          value={params.get('followUp') ?? ''}
          onChange={(e) => setParam('followUp', e.target.value || undefined)}
        >
          <option value="">Any follow-up</option>
          {FOLLOW_UPS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
        <DateRangeFilter from={params.get('createdFrom') ?? ''} to={params.get('createdTo') ?? ''} onChange={setCreated} />
      </FilterBar>

      {targetId && (
        <div className="-mt-2 mb-3 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Filtered By</span>
          <span
            data-testid="cp-target-filter-chip"
            className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 py-0.5 pl-2.5 pr-1 font-medium text-brand-700"
          >
            Leads behind a target{targetLabel ? `: ${targetLabel}` : ''}
            <button
              type="button"
              aria-label="Remove target filter"
              title="Remove"
              onClick={clearTarget}
              className="rounded-full p-0.5 text-brand-500 hover:bg-brand-100 hover:text-brand-800"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        </div>
      )}

      {canReassign && selected.length > 0 && (
        <div className="sticky top-0 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm shadow-sm">
          <b className="text-brand-800">{selected.length} selected</b>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Select
              aria-label="Assign to"
              data-testid="cp-assign-owner"
              className="!h-8 !w-auto !py-0 bg-white text-xs"
              value={assignTo}
              onChange={(e) => setAssignTo(e.target.value)}
            >
              <option value="">Assign to…</option>
              <option value={UNASSIGNED}>Unassigned</option>
              {owners.map((o) => (
                <option key={o._id} value={o._id}>
                  {o.name}
                </option>
              ))}
            </Select>
            <Button size="sm" onClick={onAssign} loading={assigning} disabled={!assignTo} data-testid="cp-assign">
              {!assigning && <UserPlus className="h-3.5 w-3.5" />} Assign
            </Button>
            <Button size="sm" variant="ghost" onClick={clearSelection}>
              Clear
            </Button>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={data?.data}
        rowKey={(l) => l._id}
        // skeletons only while these filters have no rows yet: a background refresh keeps the table
        loading={isLoading || (isFetching && !currentData)}
        error={isError}
        errorMessage={isError ? parseApiError(error).message : undefined}
        errorDetail={error}
        onRetry={refetch}
        emptyTitle={hasFilters ? 'No Leads Found' : 'No Channel Partners leads yet'}
        emptyDescription={
          hasFilters
            ? 'No Channel Partners leads match these filters.'
            : 'Consultant leads added here or by bulk upload will appear in this list.'
        }
        emptyAction={
          hasFilters ? (
            <Button variant="outline" size="sm" onClick={clearAll}>
              Clear Filters
            </Button>
          ) : canCreate ? (
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Lead
            </Button>
          ) : undefined
        }
        sortBy={query.sort_by}
        sortOrder={query.sort_order}
        onSort={onSort}
        pagination={data?.pagination}
        pageSizes={[25, 50, 100]}
        onPageChange={(page) => setParam('page', page)}
        onPageSizeChange={(size) => {
          const next = new URLSearchParams(params)
          next.set('page_size', String(size))
          next.delete('page')
          setParams(next, { replace: true })
        }}
        onRowClick={(l) => navigate(cpLeadPath(l._id))}
        rowClassName={(l) => (isOverdue(l) ? 'bg-red-50/40 [&>td:first-child]:shadow-[inset_3px_0_0_var(--danger)]' : undefined)}
      />

      <CpLeadFormDrawer open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  )
}
