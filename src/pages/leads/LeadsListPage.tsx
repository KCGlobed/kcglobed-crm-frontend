import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Bookmark, Download, Filter, Info, Mail, MessageSquareText, Plus, Trash2, Upload, UserPlus, X } from 'lucide-react'
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
import { Checkbox, Input, Select } from '../../components/ui/fields'
import { Modal } from '../../components/ui/Modal'
import { cn, parseApiError } from '../../lib/utils'
import { useColumnPrefs } from '../../hooks/useColumnPrefs'
import type { Lead } from '../../types/models'
import { QuickAddDrawer } from './QuickAddDrawer'
import { BulkUploadModal } from './BulkUploadModal'
import { ExportLeadsModal } from './ExportLeadsModal'
import { LeadFilterPanel } from './LeadFilterPanel'
import { BulkAssignModal } from './BulkAssignModal'
import { parseConditions, type LeadSelection } from './leadSelection'
import { BulkSendModal } from './BulkSendModal'
import { DEFAULT_VISIBLE_COLUMNS, LEAD_COLUMNS, LEAD_COLUMN_KEYS, LOCKED_COLUMNS } from './leadColumns'

const LIST_KEYS = ['page', 'page_size', 'sort_by', 'sort_order']

export default function LeadsListPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const user = useCurrentUser()
  const admin = isAdminLike(user)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [savedOpen, setSavedOpen] = useState(false)
  const [filterName, setFilterName] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [allMatching, setAllMatching] = useState(false)
  const [bulkAction, setBulkAction] = useState<'assign' | 'sms' | 'email' | null>(null)

  const columnPrefs = useColumnPrefs(`crm.leads.columns.v2.${user?._id ?? 'anon'}`, {
    allKeys: LEAD_COLUMN_KEYS,
    defaultVisible: DEFAULT_VISIBLE_COLUMNS,
    locked: LOCKED_COLUMNS,
  })

  const query: LeadListParams = useMemo(() => {
    const q: LeadListParams = {
      page: Number(params.get('page')) || 1,
      page_size: Number(params.get('page_size')) || 25,
      sort_by: params.get('sort_by') ?? 'createdAt',
      sort_order: (params.get('sort_order') as 'asc' | 'desc') ?? 'desc',
    }
    params.forEach((value, key) => {
      if (!LIST_KEYS.includes(key) && value) q[key] = value
    })
    return q
  }, [params])

  const { data, isLoading, isFetching, isError, error, refetch } = useListLeadsQuery(query)
  const { data: meta } = useFilterFieldsQuery()
  const { data: masters } = useMasterBootstrapQuery()
  const currentStage = masters?.data.stages.find((s) => s._id === params.get('stage'))
  const { data: saved } = useSavedFiltersQuery()
  const [saveFilter, { isLoading: savingFilter }] = useSaveFilterMutation()
  const [deleteSaved] = useDeleteSavedFilterMutation()

  const filters = Object.fromEntries([...params.entries()].filter(([k, v]) => v && !LIST_KEYS.includes(k)))
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
  const columns = [
    ...(admin ? [selectColumn] : []),
    ...columnPrefs.visibleKeys.map((key) => LEAD_COLUMNS.find((c) => c.key === key)!).filter(Boolean),
  ]
  const smart = params.get('smart')

  return (
    <>
      <PageHeader
        title="Leads"
        description={data ? `${total} leads ${admin ? 'in the CRM' : 'assigned to you'}` : undefined}
        actions={
          <>
            {can(user, 'leads', 'export') && (
              <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
            )}
            {can(user, 'leads', 'import') && (
              <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)}>
                <Upload className="h-3.5 w-3.5" /> Bulk upload
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
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Quick filters</span>
        {meta?.data.smartFilters.map((f) => (
          <button
            key={f.key}
            onClick={() => setParam('smart', smart === f.key ? undefined : f.key)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              smart === f.key
                ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-800'
            )}
            title={f.label}
          >
            {f.key.replace(/_/g, ' ').replace('3d', '3+ days').replace(/^\w/, (c) => c.toUpperCase())}
          </button>
        ))}
      </div>

      <FilterBar
        end={
          <>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearAll}>
                <X className="h-3.5 w-3.5" /> Clear all
              </Button>
            )}
            <ColumnChooser
              columns={LEAD_COLUMNS.map((c) => ({ key: c.key, label: c.header }))}
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
          <option value="">All stages</option>
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
            <option value="">All sub-stages</option>
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
            <Bookmark className="h-3.5 w-3.5" /> My saved filters
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
                    + Save current filters
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </FilterBar>

      {data?.notice && (
        <div role="status" className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <Info className="h-4 w-4 shrink-0" /> {data.notice}
        </div>
      )}

      {admin && (selected.length > 0 || allMatching) && (
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
            {can(user, 'communications', 'edit') && (
              <>
                <Button size="sm" variant="outline" onClick={() => setBulkAction('sms')}>
                  <MessageSquareText className="h-3.5 w-3.5" /> Bulk SMS
                </Button>
                <Button size="sm" variant="outline" onClick={() => setBulkAction('email')}>
                  <Mail className="h-3.5 w-3.5" /> Bulk Email
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
        loading={isLoading || isFetching}
        error={isError}
        errorMessage={isError ? parseApiError(error).message : undefined}
        onRetry={refetch}
        emptyTitle={hasFilters ? 'No leads found' : 'No leads yet'}
        emptyDescription={hasFilters ? 'There are no leads matching your current search or filters.' : 'Leads from Meta, Quick Add and bulk upload will appear here.'}
        emptyAction={
          hasFilters ? (
            <Button variant="outline" size="sm" onClick={clearAll}>
              Clear filters
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
      {bulkOpen && <BulkUploadModal open onClose={() => setBulkOpen(false)} />}
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
          fields={meta.data.fields}
          value={conditions}
          onApply={(c) => setParam('filters', c.length ? JSON.stringify(c) : undefined)}
        />
      )}
      {bulkAction === 'assign' && <BulkAssignModal selection={selection} onClose={() => setBulkAction(null)} onDone={() => { setBulkAction(null); clearSelection() }} />}
      {(bulkAction === 'sms' || bulkAction === 'email') && (
        <BulkSendModal channel={bulkAction} selection={selection} onClose={() => setBulkAction(null)} />
      )}
      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title="Save filter"
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
