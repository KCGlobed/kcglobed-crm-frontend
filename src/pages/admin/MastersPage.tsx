import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Ban, Pencil, Plus, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import {
  useCreateMasterMutation,
  useDeleteMasterMutation,
  useListMasterQuery,
  useMasterBootstrapQuery,
  useUpdateMasterMutation,
  type MasterType,
} from '../../services/mastersApi'
import { useCurrentUser } from '../../app/hooks'
import { can } from '../../constants/permissions'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { FilterBar, PageHeader, SearchInput, Tabs } from '../../components/ui/misc'
import { RowActions } from '../../components/ui/RowActions'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { ConfirmDialog } from '../../components/ui/feedback'
import { Checkbox, FormField, Input, Select } from '../../components/ui/fields'
import { cn, formatDate, parseApiError } from '../../lib/utils'
import { SubStagesEditor, type SubStageDraft } from './SubStagesEditor'

type Row = Record<string, unknown> & { _id: string }

interface FieldDef {
  key: string
  label: string
  type: 'text' | 'number' | 'select' | 'boolean' | 'date' | 'color' | 'list' | 'program' | 'subStages'
  required?: boolean
  options?: { value: string; label: string }[]
  /** create-only fields cannot change once saved (e.g. custom field key) */
  createOnly?: boolean
  /** not typed in: computed from another field's value on create and shown as a hint under that field */
  derived?: { from: string; compute: (source: string) => string }
}

/** "Sister Name" → "sisterName": the camelCase key the backend requires (`^[a-z][a-zA-Z0-9_]*$`). */
const camelKey = (label: string) => {
  const words = label.toLowerCase().replace(/['’]/g, '').match(/[a-z0-9]+/g) ?? []
  const key = words.map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w)).join('')
  return (/^[a-z]/.test(key) ? key : key && `field${key[0].toUpperCase()}${key.slice(1)}`).slice(0, 50)
}

interface MasterConfig {
  type: MasterType
  label: string
  description: string
  fields: FieldDef[]
  columns: Column<Row>[]
  sortBy: string
  /** cohorts close rather than deactivate */
  deactivateLabel?: string
  /** HIDDEN: no tab is shown, but the config stays so it can be switched back on */
  hidden?: boolean
  /** sources: one row per channel with its sources inside, instead of a row per source */
  view?: 'channels'
}

/**
 * Source channels — "Lead Stage Mapping / Source Logic" §6. Keys are what the
 * backend stores (`apps/masters/models.py` CHANNELS); `telephony` and `chatbot`
 * need adding there. A source still on a dropped key (e.g. `partner`) keeps it.
 */
const CHANNEL_OPTIONS = [
  { value: 'direct', label: 'Direct' },
  { value: 'organic', label: 'Organic' },
  { value: 'paid', label: 'Paid Ads' },
  { value: 'referral', label: 'Referral' },
  { value: 'event', label: 'Events' },
  { value: 'telephony', label: 'Telephony' },
  { value: 'chatbot', label: 'Chatbot' },
  { value: 'other', label: 'Others' },
]
const channelLabel = (key: unknown) => CHANNEL_OPTIONS.find((c) => c.value === key)?.label ?? String(key ?? '—')

const activeBadge: Column<Row> = {
  key: 'isActive',
  header: 'Status',
  render: (r) => <Badge tone={r.isActive === false ? 'slate' : 'green'}>{r.isActive === false ? 'Inactive' : 'Active'}</Badge>,
}

const colorDot = (r: Row) =>
  r.color ? <span className="inline-block h-3 w-3 rounded-full" style={{ background: String(r.color) }} /> : '—'

const CONFIGS: MasterConfig[] = [
  {
    type: 'stages',
    label: 'Lead stages',
    description: 'Lead stages and sub-stages with the counsellor action for each. System stages are set by the CRM only.',
    sortBy: 'order',
    // `type` (open/converted/lost) is no longer edited here: the backend ignores it on
    // create/edit and makes every new stage "open". It still arrives in GET responses.
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'order', label: 'Order', type: 'number' },
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'isActive', label: 'Active', type: 'boolean' },
      { key: 'subStages', label: 'Sub-stages', type: 'subStages' },
    ],
    columns: [
      { key: 'order', header: '#', sortable: true },
      {
        key: 'name',
        header: 'Name',
        sortable: true,
        render: (r) => (
          <span className="inline-flex items-center gap-1.5">
            <Badge color={r.color as string}>{String(r.name)}</Badge>
            {!!r.isSystem && <Badge>System</Badge>}
          </span>
        ),
      },
      {
        key: 'subStages',
        header: 'Sub-stages',
        render: (r) => {
          const subs = (r.subStages as { isActive: boolean }[] | undefined) ?? []
          return <span className="text-xs tabular-nums">{subs.filter((s) => s.isActive).length}</span>
        },
      },
      activeBadge,
    ],
  },
  {
    type: 'sources',
    label: 'Sources',
    description: 'Lead sources grouped by channel (Source Logic §6). Click a source to edit it; add new ones under their channel.',
    sortBy: 'sortOrder',
    view: 'channels',
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'channel', label: 'Channel', type: 'select', options: CHANNEL_OPTIONS },
      { key: 'description', label: 'Description', type: 'text' },
      { key: 'sortOrder', label: 'Sort order', type: 'number' },
      { key: 'isActive', label: 'Active', type: 'boolean' },
    ],
    columns: [
      { key: 'name', header: 'Name', sortable: true },
      { key: 'channel', header: 'Channel', render: (r) => <Badge tone="blue">{channelLabel(r.channel)}</Badge> },
      activeBadge,
    ],
  },
  {
    type: 'programs',
    label: 'Programs',
    description: 'All programs and tracks — every module refers to this list.',
    sortBy: 'name',
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'code', label: 'Code', type: 'text', required: true },
      { key: 'track', label: 'Track', type: 'text' },
      { key: 'durationMonths', label: 'Duration (months)', type: 'number' },
      { key: 'description', label: 'Description', type: 'text' },
      { key: 'isActive', label: 'Active', type: 'boolean' },
    ],
    columns: [
      { key: 'name', header: 'Name', sortable: true },
      { key: 'code', header: 'Code' },
      { key: 'durationMonths', header: 'Duration', render: (r) => (r.durationMonths ? `${r.durationMonths} months` : '—') },
      activeBadge,
    ],
  },
  {
    type: 'cohorts',
    label: 'Cohorts',
    description: 'Intakes with dates and capacity, mapped to a program.',
    sortBy: 'startDate',
    deactivateLabel: 'Close',
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'program', label: 'Program', type: 'program', required: true },
      { key: 'startDate', label: 'Start date', type: 'date' },
      { key: 'endDate', label: 'End date', type: 'date' },
      { key: 'capacity', label: 'Capacity', type: 'number' },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: ['planned', 'open', 'closed', 'completed'].map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) })),
      },
    ],
    columns: [
      { key: 'name', header: 'Name', sortable: true },
      { key: 'program', header: 'Program', render: (r) => String((r.program as { name?: string })?.name ?? '—') },
      { key: 'startDate', header: 'Starts', sortable: true, render: (r) => formatDate(r.startDate as string) },
      { key: 'capacity', header: 'Capacity', render: (r) => String(r.capacity ?? '—') },
      { key: 'status', header: 'Status', render: (r) => <Badge tone={r.status === 'open' ? 'green' : 'slate'}>{String(r.status)}</Badge> },
    ],
  },
  {
    type: 'dispositions',
    label: 'Dispositions',
    // HIDDEN for now: call logging uses stage sub-stages, nothing reads this list. Remove to show the tab again.
    hidden: true,
    description: 'Call outcomes counsellors record after each call.',
    sortBy: 'sortOrder',
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'category', label: 'Category', type: 'text' },
      { key: 'requiresFollowUp', label: 'Requires follow-up', type: 'boolean' },
      { key: 'sortOrder', label: 'Sort order', type: 'number' },
      { key: 'isActive', label: 'Active', type: 'boolean' },
    ],
    columns: [
      { key: 'name', header: 'Name', sortable: true },
      { key: 'requiresFollowUp', header: 'Follow-up', render: (r) => (r.requiresFollowUp ? 'Required' : '—') },
      activeBadge,
    ],
  },
  {
    type: 'tags',
    label: 'Tags',
    // HIDDEN for now: no screen assigns tags to leads yet. Remove to show the tab again.
    hidden: true,
    description: 'Configurable tags for segmentation and priority.',
    sortBy: 'sortOrder',
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'sortOrder', label: 'Sort order', type: 'number' },
      { key: 'isActive', label: 'Active', type: 'boolean' },
    ],
    columns: [
      { key: 'color', header: '', render: colorDot },
      { key: 'name', header: 'Name', sortable: true },
      activeBadge,
    ],
  },
  {
    type: 'custom-fields',
    label: 'Custom fields',
    description: 'GCC-specific lead fields without code changes. They appear on the lead form automatically.',
    sortBy: 'sortOrder',
    fields: [
      { key: 'label', label: 'Label', type: 'text', required: true },
      { key: 'key', label: 'Key', type: 'text', required: true, createOnly: true, derived: { from: 'label', compute: camelKey } },
      {
        key: 'type',
        label: 'Type',
        type: 'select',
        required: true,
        options: ['text', 'number', 'date', 'select', 'boolean'].map((t) => ({ value: t, label: t })),
      },
      { key: 'options', label: 'Options (comma-separated, for select)', type: 'list' },
      { key: 'required', label: 'Required', type: 'boolean' },
      { key: 'sortOrder', label: 'Sort order', type: 'number' },
      { key: 'isActive', label: 'Active', type: 'boolean' },
    ],
    columns: [
      { key: 'label', header: 'Label', sortable: true },
      { key: 'key', header: 'Key' },
      { key: 'type', header: 'Type' },
      { key: 'required', header: 'Required', render: (r) => (r.required ? 'Yes' : '—') },
      activeBadge,
    ],
  },
]
const VISIBLE_CONFIGS = CONFIGS.filter((c) => !c.hidden)

function MasterModal({
  config,
  open,
  onClose,
  row,
  initial,
}: {
  config: MasterConfig
  open: boolean
  onClose: () => void
  row?: Row
  /** preset values for a new item (e.g. the channel a source is added under) */
  initial?: Record<string, unknown>
}) {
  // Mounted fresh per open (keyed by the parent), so initial values derive once here.
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    if (!row) return { isActive: true, ...initial }
    const v: Record<string, unknown> = {}
    for (const f of config.fields) {
      let value = row[f.key]
      if (f.type === 'program' && value && typeof value === 'object') value = (value as { _id: string })._id
      if (f.type === 'date' && value) value = String(value).slice(0, 10)
      if (f.type === 'list' && Array.isArray(value)) value = value.join(', ')
      if (f.type === 'subStages') value = ((value as SubStageDraft[] | undefined) ?? []).map((s) => ({ ...s }))
      v[f.key] = value
    }
    return v
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { data: masters } = useMasterBootstrapQuery()
  const [create, { isLoading: creating }] = useCreateMasterMutation()
  const [update, { isLoading: updating }] = useUpdateMasterMutation()

  const onSubmit = async () => {
    const body: Record<string, unknown> = {}
    const localErrors: Record<string, string> = {}
    for (const f of config.fields) {
      if (row && f.createOnly) continue
      const raw = f.derived ? f.derived.compute(String(values[f.derived.from] ?? '')) : values[f.key]
      if (f.type === 'subStages') {
        body[f.key] = ((raw as SubStageDraft[] | undefined) ?? []).map((s) => ({
          ...(s._id ? { _id: s._id } : {}),
          name: s.name.trim(),
          counsellorAction: s.counsellorAction?.trim() || undefined,
          isActive: s.isActive,
        }))
        continue
      }
      if (f.required && (raw === undefined || raw === '')) {
        localErrors[f.key] = `${f.label} is required`
        continue
      }
      if (raw === undefined || raw === '') continue
      if (f.type === 'number') body[f.key] = Number(raw)
      else if (f.type === 'list')
        body[f.key] = String(raw)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      else body[f.key] = raw
    }
    if (Object.keys(localErrors).length) return setErrors(localErrors)
    try {
      if (row) await update({ type: config.type, id: row._id, body }).unwrap()
      else await create({ type: config.type, body }).unwrap()
      toast.success(`${config.label.replace(/s$/, '')} saved`)
      onClose()
    } catch (err) {
      const { message, errors: fe } = parseApiError(err)
      setErrors(fe)
      toast.error(message)
    }
  }

  const set = (k: string, v: unknown) => setValues((s) => ({ ...s, [k]: v }))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${row ? 'Edit' : 'Add'} ${config.label.toLowerCase().replace(/s$/, '')}`}
      size={config.fields.some((f) => f.type === 'subStages') ? 'lg' : 'md'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit} loading={creating || updating}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        {config.fields.map((f) => {
          if (f.derived) return null
          const disabled = !!row && f.createOnly
          const value = values[f.key]
          // a derived field (e.g. the custom field key) shows its result under the field it comes from
          const derivedChild = config.fields.find((d) => d.derived?.from === f.key)
          const hint = derivedChild
            ? row
              ? `${derivedChild.label}: ${row[derivedChild.key]} (cannot change)`
              : value
                ? `${derivedChild.label}: ${derivedChild.derived!.compute(String(value))}`
                : `The ${derivedChild.label.toLowerCase()} is generated from the ${f.label.toLowerCase()}`
            : undefined
          if (f.type === 'subStages') {
            return (
              <FormField key={f.key} label={f.label} className="col-span-2" error={errors[f.key]}>
                <SubStagesEditor
                  value={(value as SubStageDraft[] | undefined) ?? []}
                  onChange={(next) => set(f.key, next)}
                  errors={errors}
                />
              </FormField>
            )
          }
          if (f.type === 'boolean') {
            return (
              <label key={f.key} className="flex items-end gap-2 pb-2 text-xs text-slate-600">
                <Checkbox checked={!!value} onChange={(e) => set(f.key, e.target.checked)} /> {f.label}
              </label>
            )
          }
          return (
            <FormField key={f.key} label={f.label} required={f.required} error={errors[f.key] ?? (derivedChild && errors[derivedChild.key])} hint={hint}>
              {f.type === 'select' ? (
                <Select value={(value as string) ?? ''} onChange={(e) => set(f.key, e.target.value)}>
                  <option value="">Select…</option>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                  {/* a saved value no longer in the list (e.g. a channel that was dropped) stays selectable so it is kept on save */}
                  {!!value && !f.options?.some((o) => o.value === value) && <option value={String(value)}>{String(value)} (current)</option>}
                </Select>
              ) : f.type === 'program' ? (
                <Select value={(value as string) ?? ''} onChange={(e) => set(f.key, e.target.value)}>
                  <option value="">Select program…</option>
                  {masters?.data.programs.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : f.type === 'color' ? 'color' : 'text'}
                  disabled={disabled}
                  value={(value as string) ?? (f.type === 'color' ? '#3d1f73' : '')}
                  onChange={(e) => set(f.key, e.target.value)}
                  aria-invalid={!!errors[f.key]}
                />
              )}
            </FormField>
          )
        })}
      </div>
    </Modal>
  )
}

function MasterTable({ config }: { config: MasterConfig }) {
  const me = useCurrentUser()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [sort, setSort] = useState<{ by: string; order: 'asc' | 'desc' }>({ by: config.sortBy, order: 'asc' })
  const [modal, setModal] = useState<{ open: boolean; row?: Row }>({ open: false })
  const [confirm, setConfirm] = useState<Row | null>(null)
  const [remove, { isLoading: removing }] = useDeleteMasterMutation()
  const [update] = useUpdateMasterMutation()

  const { data, isLoading, isFetching, isError, error, refetch } = useListMasterQuery({
    type: config.type,
    page,
    page_size: pageSize,
    search: search || undefined,
    sort_by: sort.by,
    sort_order: sort.order,
  })

  const onDelete = async () => {
    if (!confirm) return
    try {
      await remove({ type: config.type, id: confirm._id }).unwrap()
      toast.success('Updated')
      setConfirm(null)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  // the reverse of deactivate — the same PUT the edit form sends, with just the flag
  const onReactivate = async (row: Row) => {
    try {
      await update({ type: config.type, id: row._id, body: { isActive: true } }).unwrap()
      toast.success('Reactivated')
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  const columns: Column<Row>[] = [
    ...config.columns,
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      align: 'right',
      render: (r) => (
        <RowActions
          actions={[
            { label: 'Edit', icon: Pencil, hidden: !can(me, 'masters', 'edit'), onClick: () => setModal({ open: true, row: r }) },
            {
              label: config.deactivateLabel ?? 'Deactivate',
              icon: Ban,
              danger: true,
              hidden: !can(me, 'masters', 'delete') || r.isActive === false || r.status === 'closed',
              onClick: () => setConfirm(r),
            },
            {
              label: 'Reactivate',
              icon: RotateCcw,
              // cohorts close instead of deactivating, so they have no isActive flag
              hidden: !can(me, 'masters', 'edit') || r.isActive !== false,
              onClick: () => onReactivate(r),
            },
          ]}
        />
      ),
    },
  ]

  return (
    <>
      <p className="mb-3 text-xs text-slate-500">{config.description}</p>
      <FilterBar
        end={
          can(me, 'masters', 'create') && (
            <Button size="sm" onClick={() => setModal({ open: true })}>
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
          )
        }
      >
        <div className="contents">
          <SearchInput
            className="w-full sm:w-64"
            value={search}
            onSearch={(v) => {
              setSearch(v)
              setPage(1)
            }}
          />
        </div>
      </FilterBar>
      <DataTable
        columns={columns}
        rows={data?.data as Row[] | undefined}
        rowKey={(r) => r._id}
        loading={isLoading || isFetching}
        error={isError}
        errorMessage={isError ? parseApiError(error).message : undefined}
        onRetry={refetch}
        emptyTitle={`No ${config.label.toLowerCase()} yet`}
        sortBy={sort.by}
        sortOrder={sort.order}
        onSort={(key) =>
          setSort((s) => (s.by === key ? { by: key, order: s.order === 'asc' ? 'desc' : 'asc' } : { by: key, order: 'asc' }))
        }
        pagination={data?.pagination}
        onPageChange={setPage}
        onPageSizeChange={(s) => {
          setPageSize(s)
          setPage(1)
        }}
      />
      {modal.open && (
        <MasterModal
          key={modal.row?._id ?? 'new'}
          config={config}
          open
          row={modal.row}
          onClose={() => setModal({ open: false })}
        />
      )}
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={onDelete}
        title={`${config.deactivateLabel ?? 'Deactivate'} item`}
        message="Inactive master values stay on existing records but disappear from dropdowns."
        confirmLabel={config.deactivateLabel ?? 'Deactivate'}
        danger
        loading={removing}
      />
    </>
  )
}

type ChannelRow = Row & { label: string; sources: Row[] }

/**
 * Sources shown per channel: the eight channels of the Source Logic table, each
 * with the sources mapped to it. A source on a channel that is no longer in the
 * list (e.g. an old `partner`) gets its own row so nothing disappears.
 */
function ChannelTable({ config }: { config: MasterConfig }) {
  const me = useCurrentUser()
  const [modal, setModal] = useState<{ open: boolean; row?: Row; channel?: string }>({ open: false })
  // the backend caps a page at 100 rows — more sources than that is a sign the list needs cleaning, not paging
  const { data, isLoading, isFetching, isError, error, refetch } = useListMasterQuery({ type: config.type, page: 1, page_size: 100, sort_by: 'name', sort_order: 'asc' })

  const sources = (data?.data ?? []) as Row[]
  const channels = [...CHANNEL_OPTIONS.map((c) => c.value), ...new Set(sources.map((s) => String(s.channel ?? 'other')))]
  const rows: ChannelRow[] = [...new Set(channels)].map((key) => ({
    _id: key,
    label: channelLabel(key),
    sources: sources.filter((s) => String(s.channel ?? 'other') === key),
  }))

  const columns: Column<ChannelRow>[] = [
    {
      key: 'label',
      header: 'Channel',
      className: 'w-40',
      render: (r) => (
        <span className="inline-flex items-center gap-1.5">
          <Badge tone="blue">{r.label}</Badge>
          {!CHANNEL_OPTIONS.some((c) => c.value === r._id) && <Badge>Legacy</Badge>}
        </span>
      ),
    },
    {
      key: 'sources',
      header: 'Sources',
      render: (r) =>
        r.sources.length ? (
          <div className="flex flex-wrap gap-1.5">
            {r.sources.map((s) => (
              <button
                key={s._id}
                type="button"
                disabled={!can(me, 'masters', 'edit')}
                title={s.isActive === false ? 'Inactive — click to edit' : 'Click to edit'}
                onClick={() => setModal({ open: true, row: s })}
                className={cn(
                  'rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset transition-colors disabled:pointer-events-none',
                  s.isActive === false
                    ? 'bg-slate-50 text-slate-400 line-through ring-slate-200 hover:bg-slate-100'
                    : 'bg-white text-slate-700 ring-slate-200 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700'
                )}
              >
                {String(s.name)}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-xs text-slate-400">No sources yet</span>
        ),
    },
    {
      key: 'active',
      header: 'Active',
      className: 'w-20',
      align: 'right',
      render: (r) => <span className="text-xs tabular-nums text-slate-600">{r.sources.filter((s) => s.isActive !== false).length}</span>,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-24',
      align: 'right',
      render: (r) =>
        can(me, 'masters', 'create') && (
          <Button variant="ghost" size="sm" onClick={() => setModal({ open: true, channel: r._id })}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        ),
    },
  ]

  return (
    <>
      <p className="mb-3 text-xs text-slate-500">{config.description}</p>
      <DataTable
        columns={columns}
        rows={isLoading ? undefined : rows}
        rowKey={(r) => r._id}
        loading={isLoading || isFetching}
        error={isError}
        errorMessage={isError ? parseApiError(error).message : undefined}
        onRetry={refetch}
      />
      {modal.open && (
        <MasterModal
          key={modal.row?._id ?? `new-${modal.channel}`}
          config={config}
          open
          row={modal.row}
          initial={modal.channel ? { channel: modal.channel } : undefined}
          onClose={() => setModal({ open: false })}
        />
      )}
    </>
  )
}

export default function MastersPage() {
  const [params, setParams] = useSearchParams()
  const active = (params.get('tab') as MasterType) ?? 'stages'
  const config = VISIBLE_CONFIGS.find((c) => c.type === active) ?? VISIBLE_CONFIGS[0]

  return (
    <>
      <PageHeader title="Masters" description="Configurable lists reused by every module — no hard-coded values" />
      <Tabs
        tabs={VISIBLE_CONFIGS.map((c) => ({ key: c.type, label: c.label }))}
        active={config.type}
        onChange={(key) => setParams({ tab: key }, { replace: true })}
      />
      <div className="mt-4">
        {config.view === 'channels' ? <ChannelTable key={config.type} config={config} /> : <MasterTable key={config.type} config={config} />}
      </div>
    </>
  )
}
