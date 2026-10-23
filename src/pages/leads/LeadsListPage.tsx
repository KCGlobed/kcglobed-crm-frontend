import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Bookmark, Download, Filter, Info, Mail, MessageCircle, MessageSquareText, PhoneCall, Plus, Trash2, Upload, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  useDeleteSavedFilterMutation,
  useFilterFieldsQuery,
  useListLeadsQuery,
  useSaveFilterMutation,
  useSavedFiltersQuery,
  type LeadListParams,
} from '../../services/leadsApi'
import { useCurrentUser } from '../../app/hooks'
import { useMasterBootstrapQuery } from '../../services/mastersApi'
import { activeSubStages } from '../../lib/stages'
import { can } from '../../constants/permissions'
import { isAdminLike } from '../../lib/roles'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { ColumnChooser } from '../../components/ui/ColumnChooser'
import { FilterBar, PageHeader, SearchInput } from '../../components/ui/misc'
import { Button } from '../../components/ui/Button'
import { DateRangeFilter } from '../../components/ui/DateRangeFilter'
import { Checkbox, Input, Select } from '../../components/ui/fields'
import { Modal } from '../../components/ui/Modal'
import { cn, parseApiError } from '../../lib/utils'
import { useColumnPrefs } from '../../hooks/useColumnPrefs'
import type { FilterField, Lead } from '../../types/models'
import { QuickAddDrawer } from './QuickAddDrawer'
import { ExportLeadsModal } from './ExportLeadsModal'
import { LeadFilterPanel } from './LeadFilterPanel'
import { BulkAssignModal } from './BulkAssignModal'
import { parseConditions, type LeadSelection } from './leadSelection'
import { BulkSendModal } from './BulkSendModal'
import { DEFAULT_VISIBLE_COLUMNS, LOCKED_COLUMNS } from './leadColumns'
import { useLeadColumns } from './useLeadColumns'
import { LeadRowActions } from './LeadRowActions'
import { startQueue } from '../../features/telephony/callQueue'
import { useTelephonyEnabled } from '../../features/telephony/useLiveCalls'

/** URL params that are not lead filters: paging, sorting, the dashboard's `from` marker and the name a
 * Target Manager link carries for its chip */
const LIST_KEYS = ['page', 'page_size', 'sort_by', 'sort_order', 'from', 'target_label']
// HIDDEN for now: filter fields the backend offers but the panel leaves out.
// - tag: no screen assigns tags to leads yet
const HIDDEN_FILTER_FIELDS = ['tag']
// HIDDEN for now: every Meta (Facebook Lead Ads) filter field — campaign, ad set, ad, form,
// Meta lead ID — whatever key, label or group the backend sends it under. Delete this
// function's uses to bring them back.
const isMetaFilterField = (f: FilterField) => /meta/i.test(f.key) || /\bmeta\b/i.test(f.label) || /\bmeta\b/i.test(f.group)
const isHiddenFilterField = (f: FilterField) => HIDDEN_FILTER_FIELDS.includes(f.key) || isMetaFilterField(f)
/** Quick-filter pill names (the backend's smart filter keys), in Title Case. */
const SMART_LABELS: Record<string, string> = {
  new_today: 'New Today',
  untouched: 'Untouched',
  not_connected: 'Not Connected',
  followups_all: 'All Follow-ups',
  followups_today: 'Follow-ups Today',
  overdue: 'Overdue',
  interested: 'Interested',
  not_interested: 'Not Interested',
  no_activity_3d: 'No Activity 3+ Days',
  re_enquired: 'Re-enquired',
  unassigned: 'Unassigned',
  owner_inactive: 'Inactive Counsellors',
}
const smartLabel = (key: string) => SMART_LABELS[key] ?? key.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

/**
 * Filters that arrive by link (e.g. a dashboard drill-down) and have no control
 * of their own in the bar: shown as removable chips so it is clear why the list
 * is narrowed. Names come from the filter-field options already loaded.
 */
function linkedFilterChips(params: URLSearchParams, fields: FilterField[] | undefined): { key: string; text: string }[] {
  const label = (key: string, value: string) => fields?.find((f) => f.key === key)?.options?.find((o) => o.value === value)?.label
  const chips: { key: string; text: string }[] = []
  const source = params.get('source')
  if (source) chips.push({ key: 'source', text: `Source: ${label('source', source) ?? 'selected source'}` })
  const owner = params.get('owner')
  if (owner) chips.push({ key: 'owner', text: `Counsellor: ${label('owner', owner) ?? 'selected counsellor'}` })
  const status = params.get('status')
  if (status) chips.push({ key: 'status', text: `Status: ${label('status', status) ?? status}` })
  if (params.get('assigned') === 'true') chips.push({ key: 'assigned', text: 'Assigned to a Counsellor' })
  if (params.get('unassigned') === 'true') chips.push({ key: 'unassigned', text: 'Unassigned' })
  if (params.get('target')) chips.push({ key: 'target', text: `Target: ${params.get('target_label') || 'selected target'}` })
  return chips
}

export default function LeadsListPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const user = useCurrentUser()
  const admin = isAdminLike(user)
  // bulk select for everyone who has a bulk action: assign needs leads.reassign, bulk SMS / email / WhatsApp needs the
  // same send permission as a single send (a counsellor only ever sees and selects their own leads)
  const canSendBulk = can(user, 'communications', 'create')
  const canBulk = can(user, 'leads', 'reassign') || canSendBulk
  // click-to-dial: a Call action per row and "Start calling" through the list (the dialer must be set up)
  const { enabled: dialerEnabled } = useTelephonyEnabled()
  const canCall = dialerEnabled && can(user, 'leads', 'edit')
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [savedOpen, setSavedOpen] = useState(false)
  const [filterName, setFilterName] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [allMatching, setAllMatching] = useState(false)
  const [bulkAction, setBulkAction] = useState<'assign' | 'sms' | 'email' | 'whatsapp' | null>(null)

  // the static lead columns plus one per active custom field (Masters → Custom fields)
  const { columns: leadColumns, keys: leadColumnKeys } = useLeadColumns()
  const columnPrefs = useColumnPrefs(`crm.leads.columns.v2.${user?._id ?? 'anon'}`, {
    allKeys: leadColumnKeys,
    defaultVisible: DEFAULT_VISIBLE_COLUMNS,
    locked: LOCKED_COLUMNS,
  })

  const query: LeadListParams = useMemo(() => {
    const q: LeadListParams = {
      page: Number(params.get('page')) || 1,
      page_size: Number(params.get('page_size')) || 25,
      // enquiredAt = last enquiry (re-enquiry bumps it) falling back to created —
      // so a duplicate enquiry floats its lead back to the top of the list
      sort_by: params.get('sort_by') ?? 'enquiredAt',
      sort_order: (params.get('sort_order') as 'asc' | 'desc') ?? 'desc',
    }
    params.forEach((value, key) => {
      if (!LIST_KEYS.includes(key) && value) q[key] = value
    })
    return q
  }, [params])

  // refreshed every 30 s (and on returning to the tab): the filters live in the URL, so each refresh re-runs the same
  // query, and selection / open panels are local state that a refresh doesn't touch
  const { data, currentData, isLoading, isFetching, isError, error, refetch } = useListLeadsQuery(query, {
    pollingInterval: 30_000,
    skipPollingIfUnfocused: true,
    refetchOnFocus: true,
  })
  const { data: meta } = useFilterFieldsQuery()
  const { data: masters } = useMasterBootstrapQuery()
  const currentStage = masters?.data.stages.find((s) => s._id === params.get('stage'))
  const { data: saved } = useSavedFiltersQuery()
  const [saveFilter, { isLoading: savingFilter }] = useSaveFilterMutation()
  const [deleteSaved] = useDeleteSavedFilterMutation()

  const filters: Record<string, string> = {}
  params.forEach((v, k) => {
    if (v && !LIST_KEYS.includes(k)) filters[k] = v
  })
  const conditions = parseConditions(params.get('filters'))
  const total = data?.pagination.total_results ?? 0
  const pageIds = data?.data.map((l) => l._id) ?? []
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id))

  const clearSelection = () => {
    setSelected([])
    setAllMatching(false)
  }

  const replaceParams = (next: URLSearchParams) => {
    next.set('page', '1')
    setParams(next, { replace: true })
    clearSelection()
  }
  const setParam = (key: string, value?: string | number) => {
    const next = new URLSearchParams(params)
    if (value === undefined || value === '' || value === null) next.delete(key)
    else next.set(key, String(value))
    if (key === 'page' || key === 'page_size') setParams(next, { replace: true })
    else replaceParams(next)
  }

  const createdFrom = params.get('created_from') ?? ''
  const createdTo = params.get('created_to') ?? ''
  // both dates in one URL update, so a preset never loses half the range
  const setDateRange = (from: string, to: string) => {
    const next = new URLSearchParams(params)
    if (from) next.set('created_from', from)
    else next.delete('created_from')
    if (to) next.set('created_to', to)
    else next.delete('created_to')
    replaceParams(next)
  }

  const onSort = (key: string) => {
    const next = new URLSearchParams(params)
    if (query.sort_by === key) next.set('sort_order', query.sort_order === 'asc' ? 'desc' : 'asc')
    else {
      next.set('sort_by', key)
      next.set('sort_order', 'desc')
    }
    setParams(next, { replace: true })
  }

  const applySaved = (p: Record<string, string>) => {
    const next = new URLSearchParams(p)
    replaceParams(next)
  }

  const hasFilters = Object.keys(filters).length > 0
  const clearAll = () => replaceParams(new URLSearchParams())

  const selection: LeadSelection = {
    allMatching,
    ids: selected,
    filters,
    count: allMatching ? total : selected.length,
  }

  const selectColumn: Column<Lead> = {
    key: '__select',
    header: '',
    className: 'w-8',
    headerNode: (
      <Checkbox
        aria-label="Select page"
        checked={allPageSelected}
        onChange={(e) => {
          setAllMatching(false)
          setSelected((s) => (e.target.checked ? [...new Set([...s, ...pageIds])] : s.filter((id) => !pageIds.includes(id))))
        }}
      />
    ),
    render: (l) => (
      <span onClick={(e) => e.stopPropagation()}>
        <Checkbox
          aria-label={`Select ${l.leadNo}`}
          checked={allMatching || selected.includes(l._id)}
          onChange={(e) => {
            setAllMatching(false)
            setSelected((s) => (e.target.checked ? [...s, l._id] : s.filter((id) => id !== l._id)))
          }}
        />
      </span>
    ),
  }
  const actionsColumn: Column<Lead> = {
    key: '__actions',
    header: '',
    align: 'right',
    className: 'w-10',
    render: (l) => <LeadRowActions lead={l} />,
  }
  const columns = [
    ...(canBulk ? [selectColumn] : []),
    ...columnPrefs.visibleKeys.map((key) => leadColumns.find((c) => c.key === key)!).filter(Boolean),
    ...(canCall ? [actionsColumn] : []),
  ]
  // "Start calling": the selected leads, else this page, one after the other (each opens with ?dial=1)
  const callableIds = (selected.length ? (data?.data.filter((l) => selected.includes(l._id)) ?? []) : (data?.data ?? [])).map((l) => l._id)
  const startCalling = () => {
    const first = startQueue(callableIds, smart ? smartLabel(smart) : params.get('search') ? 'search' : undefined)
    if (!first) return toast.error('No leads to call')
    navigate(`/app/leads/${first}?dial=1`)
  }
  const smart = params.get('smart')
  const chips = linkedFilterChips(params, meta?.data.fields)
  // "Not Connected" pill: the backend lists it as a smart filter from this release on. Against an
  // older backend (e.g. production before deploy) it falls back to the plain stage filter instead.
  const notConnectedStage = masters?.data.stages.find((s) => s.name.trim().toLowerCase() === 'not connected')
  const backendHasNotConnected = meta?.data.smartFilters.some((f) => f.key === 'not_connected') ?? false
  const notConnectedActive = !smart && !!notConnectedStage && params.get('stage') === notConnectedStage._id
  const toggleNotConnected = () => {
    if (!notConnectedStage) return
    const next = new URLSearchParams(params)
    next.delete('smart')
    next.delete('sub_stage')
    if (notConnectedActive) next.delete('stage')
    else next.set('stage', notConnectedStage._id)
    replaceParams(next)
  }
  const clearQuick = () => {
    const next = new URLSearchParams(params)
    next.delete('smart')
    if (notConnectedActive) {
      next.delete('stage')
      next.delete('sub_stage')
    }
    replaceParams(next)
  }
  const pill = (key: string, label: string, active: boolean, onClick: () => void, title: string) => (
    <button
      key={key}
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
          : 'border-slate-300 bg-white text-slate-600 hover:border-brand-300 hover:bg-brand-50/60 hover:text-brand-700'
      )}
      title={title}
    >
      {label}
    </button>
  )

  return (
    <>
      <PageHeader
        title="Leads"
        description={data ? `${total} leads ${admin ? 'in the CRM' : 'assigned to you'} · auto-refreshes every 30 s` : undefined}
        actions={
          <>
            {canCall && callableIds.length > 0 && (
              <Button variant="outline" size="sm" onClick={startCalling} title="Call these leads one after the other, from this page" data-testid="start-calling">
                <PhoneCall className="h-3.5 w-3.5" /> Start calling{selected.length ? ` (${selected.length})` : ''}
              </Button>
            )}
            {can(user, 'leads', 'export') && (
              <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
            )}
            {can(user, 'leads', 'import') && (
              <Button variant="outline" size="sm" onClick={() => navigate('/app/leads/import')}>
                <Upload className="h-3.5 w-3.5" /> Bulk Upload
              </Button>
            )}
            {can(user, 'leads', 'create') && (
              <Button size="sm" onClick={() => setQuickAddOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Quick Add
              </Button>
            )}
          </>
        }
      />

      {/* GL-34 smart filters */}
      <div className="-mx-4 mb-3 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&>*]:shrink-0">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Quick Filters</span>
        {pill('all', 'Show All', !smart && !notConnectedActive, clearQuick, 'All leads, no quick filter')}
        {meta?.data.smartFilters.flatMap((f) => [
          pill(f.key, smartLabel(f.key), smart === f.key, () => setParam('smart', smart === f.key ? undefined : f.key), f.label),
          // fallback pill sits where the backend's own not_connected filter would, right after Untouched
          ...(f.key === 'untouched' && !backendHasNotConnected && notConnectedStage
            ? [pill('not_connected', 'Not Connected', notConnectedActive, toggleNotConnected, 'Stage = Not Connected')]
            : []),
        ])}
      </div>

      <FilterBar
        end={
          <>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearAll}>
                <X className="h-3.5 w-3.5" /> Clear All
              </Button>
            )}
            <ColumnChooser
              columns={leadColumns.map((c) => ({ key: c.key, label: c.header }))}
              order={columnPrefs.order}
              isVisible={columnPrefs.isVisible}
              locked={LOCKED_COLUMNS}
              onToggle={columnPrefs.toggle}
              onMove={columnPrefs.move}
              onReset={columnPrefs.reset}
            />
          </>
        }
      >
        <SearchInput
          className="w-full sm:w-72"
          value={params.get('search') ?? ''}
          onSearch={(v) => setParam('search', v || undefined)}
          placeholder="Search name, mobile, email, ID…"
        />
        {/* Lead Stages sheet: stage, then its sub-stages */}
        <Select
          aria-label="Stage"
          className="!w-auto max-w-48"
          value={params.get('stage') ?? ''}
          onChange={(e) => {
            const next = new URLSearchParams(params)
            next.delete('sub_stage') // a sub-stage only makes sense under its own stage
            if (e.target.value) next.set('stage', e.target.value)
            else next.delete('stage')
            replaceParams(next)
          }}
        >
          <option value="">All Stages</option>
          {masters?.data.stages.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name}
            </option>
          ))}
        </Select>
        {activeSubStages(currentStage).length > 0 && (
          <Select
            aria-label="Sub-stage"
            className="!w-auto max-w-60"
            value={params.get('sub_stage') ?? ''}
            onChange={(e) => setParam('sub_stage', e.target.value)}
          >
            <option value="">All Sub-stages</option>
            {activeSubStages(currentStage).map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </Select>
        )}
        <Button variant={conditions.length ? 'secondary' : 'outline'} size="sm" onClick={() => setFilterOpen(true)}>
          <Filter className="h-3.5 w-3.5" /> Filters{conditions.length ? ` (${conditions.length})` : ''}
        </Button>
        <div className="relative">
          <Button variant="outline" size="sm" onClick={() => setSavedOpen((o) => !o)}>
            <Bookmark className="h-3.5 w-3.5" /> My Saved Filters
          </Button>
          {savedOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setSavedOpen(false)} />
              <div className="absolute left-0 z-40 mt-1.5 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-[var(--shadow-md)]">
                {!saved?.data.length && <p className="px-3 py-2 text-xs text-slate-500">No saved filters yet</p>}
                {saved?.data.map((f) => (
                  <div key={f._id} className="flex items-center justify-between px-3 py-1.5 hover:bg-slate-50">
                    <button
                      type="button"
                      className="truncate text-left text-sm text-slate-700"
                      onClick={() => {
                        applySaved(f.params)
                        setSavedOpen(false)
                      }}
                    >
                      {f.name}
                    </button>
                    <button type="button" className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => deleteSaved(f._id)} aria-label={`Delete saved filter ${f.name}`} title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {Object.keys(filters).length > 0 && (
                  <button
                    type="button"
                    className="mt-1 block w-full border-t border-slate-100 px-3 py-2 text-left text-xs font-medium text-brand-600 hover:bg-slate-50"
                    onClick={() => {
                      setSavedOpen(false)
                      setSaveOpen(true)
                    }}
                  >
                    + Save Current Filters
                  </button>
                )}
              </div>
            </>
          )}
        </div>
        {/* created-date range dropdown — filters on the lead's Created On date (backend created_from/created_to) */}
        <DateRangeFilter from={createdFrom} to={createdTo} onChange={setDateRange} />
      </FilterBar>

      {chips.length > 0 && (
        <div className="-mt-2 mb-3 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Filtered By</span>
          {chips.map((c) => (
            <span key={c.key} className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 py-0.5 pl-2.5 pr-1 font-medium text-brand-700">
              {c.text}
              <button
                type="button"
                aria-label={`Remove filter ${c.text}`}
                title="Remove"
                onClick={() => {
                  const next = new URLSearchParams(params)
                  next.delete(c.key)
                  if (c.key === 'target') next.delete('target_label')
                  replaceParams(next)
                }}
                className="rounded-full p-0.5 text-brand-500 hover:bg-brand-100 hover:text-brand-800"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {data?.notice && (
        <div role="status" className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <Info className="h-4 w-4 shrink-0" /> {data.notice}
        </div>
      )}

      {canBulk && (selected.length > 0 || allMatching) && (
        <div className="sticky top-0 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm shadow-sm">
          <b className="text-brand-800">{selection.count} selected</b>
          {!allMatching && allPageSelected && total > pageIds.length && (
            <button type="button" className="text-xs font-medium text-brand-700 underline" onClick={() => setAllMatching(true)}>
              Select all {total} matching this filter
            </button>
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            {can(user, 'leads', 'reassign') && (
              <Button size="sm" onClick={() => setBulkAction('assign')}>
                <UserPlus className="h-3.5 w-3.5" /> Assign
              </Button>
            )}
            {canSendBulk && (
              <>
                <Button size="sm" variant="outline" onClick={() => setBulkAction('sms')}>
                  <MessageSquareText className="h-3.5 w-3.5" /> Bulk SMS
                </Button>
                <Button size="sm" variant="outline" onClick={() => setBulkAction('email')}>
                  <Mail className="h-3.5 w-3.5" /> Bulk Email
                </Button>
                <Button size="sm" variant="outline" onClick={() => setBulkAction('whatsapp')}>
                  <MessageCircle className="h-3.5 w-3.5" /> Bulk WhatsApp
                </Button>
              </>
            )}
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
        // skeletons only while the rows for these filters aren't loaded yet: a background refresh keeps the table
        loading={isLoading || (isFetching && !currentData)}
        error={isError}
        errorMessage={isError ? parseApiError(error).message : undefined}
        onRetry={refetch}
        emptyTitle={hasFilters ? 'No Leads Found' : 'No Leads Yet'}
        emptyDescription={hasFilters ? 'There are no leads matching your current search or filters.' : 'Leads from Meta, Quick Add and bulk upload will appear here.'}
        emptyAction={
          hasFilters ? (
            <Button variant="outline" size="sm" onClick={clearAll}>
              Clear Filters
            </Button>
          ) : undefined
        }
        errorDetail={error}
        sortBy={query.sort_by}
        sortOrder={query.sort_order}
        onSort={onSort}
        pagination={data?.pagination}
        pageSizes={[25, 50, 100]}
        onPageChange={(page) => setParam('page', page)}
        onPageSizeChange={(size) => setParam('page_size', size)}
        onRowClick={(l) => navigate(`/app/leads/${l._id}`)}
        rowClassName={(l) => (l.isOverdue ? 'bg-red-50/40 [&>td:first-child]:shadow-[inset_3px_0_0_var(--danger)]' : undefined)}
      />

      {quickAddOpen && <QuickAddDrawer open onClose={() => setQuickAddOpen(false)} />}
      {exportOpen && (
        <ExportLeadsModal
          open
          onClose={() => setExportOpen(false)}
          filters={params}
          visibleColumnKeys={columnPrefs.visibleKeys}
          total={total}
        />
      )}
      {filterOpen && meta && (
        <LeadFilterPanel
          open
          onClose={() => setFilterOpen(false)}
          fields={meta.data.fields.filter((f) => !isHiddenFilterField(f))}
          value={conditions}
          onApply={(c) => setParam('filters', c.length ? JSON.stringify(c) : undefined)}
        />
      )}
      {bulkAction === 'assign' && <BulkAssignModal selection={selection} onClose={() => setBulkAction(null)} onDone={() => { setBulkAction(null); clearSelection() }} />}
      {(bulkAction === 'sms' || bulkAction === 'email' || bulkAction === 'whatsapp') && (
        <BulkSendModal channel={bulkAction} selection={selection} onClose={() => setBulkAction(null)} />
      )}
      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title="Save Filter"
        size="sm"
        footer={
          <Button
            loading={savingFilter}
            disabled={!filterName.trim()}
            onClick={async () => {
              try {
                await saveFilter({ name: filterName.trim(), params: filters }).unwrap()
                toast.success('Filter saved')
                setSaveOpen(false)
                setFilterName('')
              } catch (err) {
                toast.error(parseApiError(err).message)
              }
            }}
          >
            Save
          </Button>
        }
      >
        <Input value={filterName} onChange={(e) => setFilterName(e.target.value)} placeholder="e.g. Pune leads, not contacted" maxLength={80} />
      </Modal>
    </>
  )
}
