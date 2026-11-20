import { Fragment, useState, type DragEvent, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowDown, ArrowUp, ChevronDown, ChevronRight, Eye, GripVertical, Info, Pencil, Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
  useCpReorderStagesMutation,
  useCpSaveSourceMutation,
  useCpSourcesQuery,
  useCpStageLogQuery,
  useCpStagesQuery,
  useCpUpdateSettingsMutation,
} from '../../services/consultantsApi'
import { useCurrentUser } from '../../app/hooks'
import { can } from '../../constants/permissions'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Card, PageHeader } from '../../components/ui/misc'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/feedback'
import { FormField, Input, Select, Switch } from '../../components/ui/fields'
import { cn, formatDateTime, parseApiError, timeAgo } from '../../lib/utils'
import type { CpSource, CpStage, CpStageList, CpStageLogEntry, CpStageType } from '../../types/consultants'
import type { BadgeTone } from '../../lib/status'
import { CpStageBadge } from './CpStageBadge'
import { CP_LEADS_PATH, CP_STAGE_TYPES } from './cpShared'
import { CpStageFormDrawer } from './CpStageFormDrawer'
import { CpTabs } from './CpTabs'

type TabKey = 'stages' | 'attempts' | 'sources' | 'log'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'stages', label: 'Stages' },
  { key: 'attempts', label: 'Call attempts' },
  { key: 'sources', label: 'Sources' },
  { key: 'log', label: 'Change log' },
]

const TYPE_TONE: Record<CpStageType, BadgeTone> = { open: 'blue', won: 'green', closed: 'slate' }
const typeLabel = (type: CpStageType) => CP_STAGE_TYPES.find((t) => t.value === type)?.label ?? type

/** sub-stage id → "Sub-stage (Stage)", for the rules and the change log */
function subStageNames(stages: CpStage[] | undefined): Map<string, { name: string; stage: string }> {
  const map = new Map<string, { name: string; stage: string }>()
  for (const s of stages ?? []) for (const x of s.subStages) map.set(x._id, { name: x.name, stage: s.name })
  return map
}

function useStageList() {
  const query = useCpStagesQuery()
  return { ...query, list: query.data?.data }
}

function LoadError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <Card bodyClassName="p-0">
      <ErrorState message={parseApiError(error).message} onRetry={onRetry} error={error} />
    </Card>
  )
}

// ------------------------------------------------------------------ Stages

const ROW_GRID = 'md:grid md:grid-cols-[1.25rem_1.5rem_minmax(0,1.3fr)_4.5rem_minmax(0,1.7fr)_6rem_4.5rem_auto] md:gap-3'

function StagesTab({ canEdit }: { canEdit: boolean }) {
  const { list, isLoading, isError, error, refetch } = useStageList()
  const [reorder, { isLoading: reordering }] = useCpReorderStagesMutation()
  const [editing, setEditing] = useState<{ stage?: CpStage } | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  // the new order, shown until the refreshed list arrives (or dropped if the save fails)
  const [pending, setPending] = useState<{ ids: string[]; base: CpStageList } | null>(null)

  if (isLoading) return <LoadingState />
  if (isError || !list) return <LoadError error={error} onRetry={refetch} />

  const ordered =
    pending && pending.base === list
      ? pending.ids.map((id) => list.stages.find((s) => s._id === id)).filter((s): s is CpStage => !!s)
      : list.stages
  const subNames = subStageNames(list.stages)
  const dropSub = list.settings.dropSubStage

  const saveOrder = async (ids: string[]) => {
    setPending({ ids, base: list })
    try {
      await reorder(ids).unwrap()
      toast.success('Stage order saved')
    } catch (err) {
      setPending(null)
      toast.error(parseApiError(err).message)
    }
  }

  const move = (index: number, by: -1 | 1) => {
    const ids = ordered.map((s) => s._id)
    const [id] = ids.splice(index, 1)
    ids.splice(index + by, 0, id)
    saveOrder(ids)
  }

  const canDrag = canEdit && !reordering
  const endDrag = () => {
    setDragId(null)
    setOverId(null)
  }
  const onDragOver = (e: DragEvent, id: string) => {
    if (!dragId) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (overId !== id) setOverId(id)
  }
  const onDrop = (e: DragEvent, targetId: string) => {
    e.preventDefault()
    const from = dragId
    endDrag()
    if (!from || from === targetId) return
    const ids = ordered.map((s) => s._id)
    const to = ids.indexOf(targetId)
    ids.splice(ids.indexOf(from), 1)
    ids.splice(to, 0, from)
    saveOrder(ids)
  }
  const fromIndex = dragId ? ordered.findIndex((s) => s._id === dragId) : -1

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {canEdit
            ? 'Drag a row (or use the arrows) to change the order; every stage list in Channel Partners follows it.'
            : 'The stages and sub-stages the partnership team records on a lead, in order.'}
        </p>
        {canEdit && (
          <Button size="sm" data-testid="cp-stage-add" onClick={() => setEditing({})}>
            <Plus className="h-3.5 w-3.5" /> Add stage
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div
          className={cn(
            'hidden border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:items-center',
            ROW_GRID
          )}
        >
          <span />
          <span>#</span>
          <span>Stage</span>
          <span>Type</span>
          <span>Rules</span>
          <span>Sub-stages</span>
          <span>Leads</span>
          <span />
        </div>
        {ordered.length === 0 && <EmptyState title="No stages yet" description="Add the first Channel Partners stage." />}
        <ul>
          {ordered.map((s, i) => {
            const activeSubs = s.subStages.filter((x) => x.isActive).length
            const entry = s.entrySubStage ? subNames.get(s.entrySubStage) : undefined
            const dropHere = !!dropSub && s.subStages.some((x) => x._id === dropSub)
            const isTarget = overId === s._id && dragId !== s._id
            return (
              <li
                key={s._id}
                data-testid="cp-stage-row"
                data-stage-id={s._id}
                draggable={canDrag}
                onDragStart={(e) => {
                  setDragId(s._id)
                  e.dataTransfer.effectAllowed = 'move'
                  e.dataTransfer.setData('text/plain', s._id)
                }}
                onDragOver={(e) => onDragOver(e, s._id)}
                onDrop={(e) => onDrop(e, s._id)}
                onDragEnd={endDrag}
                className={cn(
                  'flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-slate-100 px-4 py-2.5 last:border-b-0 md:min-h-12',
                  ROW_GRID,
                  !s.isActive && 'bg-slate-50/80',
                  dragId === s._id && 'opacity-40',
                  isTarget && 'bg-brand-50/70',
                  // a line where the dragged stage lands: above the row when moving up, below it when moving down
                  isTarget &&
                    (fromIndex > i
                      ? 'shadow-[inset_0_2px_0_0_var(--color-brand-400)]'
                      : 'shadow-[inset_0_-2px_0_0_var(--color-brand-400)]'),
                  canDrag && 'cursor-grab active:cursor-grabbing'
                )}
              >
                <span className="text-slate-300" title={canDrag ? 'Drag to reorder' : undefined} aria-hidden>
                  {canEdit && <GripVertical className="h-4 w-4" />}
                </span>
                <span className="text-[11px] tabular-nums text-slate-400">{i + 1}</span>
                <span className={cn('flex min-w-0 items-center gap-1.5', !s.isActive && 'opacity-60')}>
                  <CpStageBadge stage={s} className="max-w-full truncate" />
                  {!s.isActive && <Badge>Inactive</Badge>}
                </span>
                <span>
                  <Badge tone={TYPE_TONE[s.type]}>{typeLabel(s.type)}</Badge>
                </span>
                <span className="flex min-w-0 flex-wrap gap-1">
                  {s.countsAsAttempt && <Badge tone="amber">Counts as attempt</Badge>}
                  {entry && (
                    <Badge tone="cyan" title={`Opens only after ${entry.name} (${entry.stage})`} className="max-w-full truncate">
                      Opens after {entry.name}
                    </Badge>
                  )}
                  {dropHere && <Badge tone="violet">Attempts end here</Badge>}
                  {!s.countsAsAttempt && !entry && !dropHere && <span className="text-xs text-slate-300 max-md:hidden">—</span>}
                </span>
                <span className="text-xs text-slate-600">
                  {s.subStages.length === 0 ? (
                    <span className="text-slate-400">None</span>
                  ) : (
                    <>
                      {activeSubs} sub-stage{activeSubs === 1 ? '' : 's'}
                      {activeSubs < s.subStages.length && (
                        <span className="block text-[11px] text-slate-400">+{s.subStages.length - activeSubs} inactive</span>
                      )}
                    </>
                  )}
                </span>
                <span className="text-xs tabular-nums text-slate-600" title="Leads in this stage now">
                  {s.leadCount ?? 0}
                  <span className="text-slate-400 md:hidden"> leads</span>
                </span>
                <span className="ml-auto flex items-center justify-end gap-0.5">
                  {canEdit && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Move ${s.name} up`}
                        title="Move up"
                        disabled={i === 0 || reordering}
                        onClick={() => move(i, -1)}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Move ${s.name} down`}
                        title="Move down"
                        disabled={i === ordered.length - 1 || reordering}
                        onClick={() => move(i, 1)}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                  <Button variant="ghost" size="sm" data-testid={canEdit ? 'cp-stage-edit' : 'cp-stage-view'} onClick={() => setEditing({ stage: s })}>
                    {canEdit ? <Pencil className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {canEdit ? 'Edit' : 'View'}
                  </Button>
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      {editing && (
        <CpStageFormDrawer
          key={editing.stage?._id ?? 'new'}
          stage={editing.stage}
          stages={list.stages}
          settings={list.settings}
          documentTypes={list.documentTypes}
          readOnly={!canEdit}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

// ------------------------------------------------------------------ Call attempts

function AttemptsForm({ list, canEdit }: { list: CpStageList; canEdit: boolean }) {
  const { settings, stages } = list
  const [updateSettings, { isLoading }] = useCpUpdateSettingsMutation()
  const [maxAttempts, setMaxAttempts] = useState(String(settings.maxAttempts))
  const [dropSubStage, setDropSubStage] = useState(settings.dropSubStage ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const closedStages = stages.filter((s) => s.type === 'closed' && s.subStages.length > 0)
  const attemptStages = stages.filter((s) => s.countsAsAttempt && s.isActive)
  const dropStage = stages.find((s) => s.subStages.some((x) => x._id === dropSubStage))
  const drop = dropStage?.subStages.find((x) => x._id === dropSubStage)
  const dropKnown = !dropSubStage || closedStages.some((s) => s.subStages.some((x) => x._id === dropSubStage))
  const dirty = maxAttempts !== String(settings.maxAttempts) || dropSubStage !== (settings.dropSubStage ?? '')

  const onSave = async (e: FormEvent) => {
    e.preventDefault()
    const n = Number(maxAttempts)
    if (!maxAttempts.trim() || !Number.isInteger(n) || n < 1 || n > 50) {
      setErrors({ maxAttempts: 'Enter a whole number from 1 to 50' })
      return
    }
    setErrors({})
    try {
      await updateSettings({ maxAttempts: n, dropSubStage: dropSubStage || null }).unwrap()
      toast.success('Call attempts saved')
    } catch (err) {
      const { message, errors: fe } = parseApiError(err)
      setErrors(fe)
      toast.error(message)
    }
  }

  return (
    <Card title="Call attempts" className="max-w-3xl">
      <form onSubmit={onSave} className="space-y-4">
        <p className="text-xs leading-5 text-slate-600">
          Calls logged in a stage marked &lsquo;Counts as a call attempt&rsquo; (Not Connected) add up; a connected call starts the count again.
          When a lead reaches the limit it moves to the sub-stage picked below, and its follow-ups close.
        </p>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
          <span>Stages that count as an attempt:</span>
          {attemptStages.length ? (
            attemptStages.map((s) => <CpStageBadge key={s._id} stage={s} />)
          ) : (
            <span className="inline-flex items-center gap-1 text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" /> None yet — tick &lsquo;Counts as a call attempt&rsquo; on a stage (e.g. Not Connected) in Stages.
            </span>
          )}
        </div>
        <fieldset disabled={!canEdit} className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
          <FormField label="Attempts before moving" required error={errors.maxAttempts} hint="1 to 50 calls in a row">
            <Input
              type="number"
              min={1}
              max={50}
              step={1}
              inputMode="numeric"
              value={maxAttempts}
              aria-invalid={!!errors.maxAttempts}
              data-testid="cp-attempts-max"
              onChange={(e) => setMaxAttempts(e.target.value)}
            />
          </FormField>
          <FormField
            label="When attempts run out, move the lead to"
            error={errors.dropSubStage}
            hint={
              closedStages.length
                ? 'A sub-stage of a Closed stage. Leave it empty to only count the attempts.'
                : 'Add a sub-stage to a Closed stage first (e.g. Dropped › Not reachable).'
            }
          >
            <Select
              value={dropSubStage}
              aria-invalid={!!errors.dropSubStage}
              data-testid="cp-attempts-drop"
              onChange={(e) => setDropSubStage(e.target.value)}
            >
              <option value="">Do not move the lead</option>
              {closedStages.map((s) => (
                <optgroup key={s._id} label={s.isActive ? s.name : `${s.name} (inactive)`}>
                  {s.subStages.map((x) => (
                    <option key={x._id} value={x._id}>
                      {x.name}
                      {x.isActive ? '' : ' (inactive)'}
                    </option>
                  ))}
                </optgroup>
              ))}
              {!dropKnown && <option value={dropSubStage}>{drop ? `${drop.name} (${dropStage?.name})` : 'Current sub-stage'}</option>}
            </Select>
          </FormField>
        </fieldset>
        {drop && dropStage && (!drop.isActive || !dropStage.isActive) && (
          <p className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            {dropStage.isActive ? `"${drop.name}" is inactive` : `"${dropStage.name}" is inactive`}: leads are not moved until it is active again.
          </p>
        )}
        {canEdit && (
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            {dirty && (
              <Button
                variant="outline"
                onClick={() => {
                  setMaxAttempts(String(settings.maxAttempts))
                  setDropSubStage(settings.dropSubStage ?? '')
                  setErrors({})
                }}
              >
                Undo
              </Button>
            )}
            <Button type="submit" loading={isLoading} data-testid="cp-attempts-save">
              Save
            </Button>
          </div>
        )}
      </form>
    </Card>
  )
}

function AttemptsTab({ canEdit }: { canEdit: boolean }) {
  const { list, isLoading, isError, error, refetch } = useStageList()
  if (isLoading) return <LoadingState />
  if (isError || !list) return <LoadError error={error} onRetry={refetch} />
  // re-mounted when the saved settings change, so the form starts from them
  return <AttemptsForm key={`${list.settings.maxAttempts}:${list.settings.dropSubStage}`} list={list} canEdit={canEdit} />
}

// ------------------------------------------------------------------ Sources

function SourcesTab({ canEdit }: { canEdit: boolean }) {
  const { data, isLoading, isFetching, isError, error, refetch } = useCpSourcesQuery()
  const [saveSource, { isLoading: saving }] = useCpSaveSourceMutation()
  const [newName, setNewName] = useState('')
  const [addError, setAddError] = useState<string>()
  const [renaming, setRenaming] = useState<{ id: string; name: string; error?: string } | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const sources = data?.data

  const onAdd = async (e: FormEvent) => {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return setAddError('Enter a source name')
    try {
      await saveSource({ body: { name } }).unwrap()
      toast.success(`Source added: ${name}`)
      setNewName('')
      setAddError(undefined)
    } catch (err) {
      const { message, errors } = parseApiError(err)
      setAddError(errors.name ?? message)
      toast.error(message)
    }
  }

  const onRename = async () => {
    if (!renaming) return
    const name = renaming.name.trim()
    if (!name) return setRenaming({ ...renaming, error: 'Enter a source name' })
    try {
      await saveSource({ id: renaming.id, body: { name } }).unwrap()
      toast.success('Source renamed')
      setRenaming(null)
    } catch (err) {
      const { message, errors } = parseApiError(err)
      setRenaming({ ...renaming, error: errors.name ?? message })
      toast.error(message)
    }
  }

  const onToggle = async (source: CpSource) => {
    setToggling(source._id)
    try {
      await saveSource({ id: source._id, body: { isActive: !source.isActive } }).unwrap()
      toast.success(source.isActive ? `${source.name} deactivated` : `${source.name} activated`)
    } catch (err) {
      toast.error(parseApiError(err).message)
    } finally {
      setToggling(null)
    }
  }

  const columns: Column<CpSource>[] = [
    {
      key: 'name',
      header: 'Source',
      render: (s) =>
        renaming?.id === s._id ? (
          <div className="py-1">
            <div className="flex items-center gap-1.5">
              <Input
                autoFocus
                className="!h-8 max-w-64"
                value={renaming.name}
                maxLength={100}
                aria-label="Source name"
                aria-invalid={!!renaming.error}
                data-testid="cp-source-rename-input"
                onChange={(e) => setRenaming({ ...renaming, name: e.target.value, error: undefined })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onRename()
                  if (e.key === 'Escape') setRenaming(null)
                }}
              />
              <Button size="sm" loading={saving} data-testid="cp-source-rename-save" onClick={onRename}>
                Save
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setRenaming(null)}>
                Cancel
              </Button>
            </div>
            {renaming.error && <p className="mt-1 text-[11px] font-medium text-red-600">{renaming.error}</p>}
          </div>
        ) : (
          <span className={cn('text-sm font-medium', s.isActive ? 'text-slate-800' : 'text-slate-400')}>{s.name}</span>
        ),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (s) =>
        canEdit ? (
          <span className="flex items-center gap-2">
            <Switch
              checked={s.isActive}
              loading={toggling === s._id}
              label={s.isActive ? `Deactivate ${s.name}` : `Activate ${s.name}`}
              onChange={() => onToggle(s)}
            />
            <span className={cn('text-xs', s.isActive ? 'text-emerald-700' : 'text-slate-400')}>{s.isActive ? 'Active' : 'Inactive'}</span>
          </span>
        ) : (
          <Badge tone={s.isActive ? 'green' : 'slate'}>{s.isActive ? 'Active' : 'Inactive'}</Badge>
        ),
    },
    ...(canEdit
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right' as const,
            render: (s: CpSource) =>
              renaming?.id === s._id ? null : (
                <Button variant="ghost" size="sm" data-testid="cp-source-rename" onClick={() => setRenaming({ id: s._id, name: s.name })}>
                  <Pencil className="h-3.5 w-3.5" /> Rename
                </Button>
              ),
          },
        ]
      : []),
  ]

  return (
    <div className="max-w-3xl">
      <p className="mb-3 text-xs text-slate-500">
        Where a partner lead came from. An inactive source cannot be picked on new leads; leads that have it keep it, and a rename shows on
        them too.
      </p>
      {canEdit && (
        <form onSubmit={onAdd} className="mb-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <div className="flex-1">
              <Input
                value={newName}
                maxLength={100}
                placeholder="New source, e.g. LinkedIn"
                aria-label="New source name"
                aria-invalid={!!addError}
                data-testid="cp-source-name"
                onChange={(e) => {
                  setNewName(e.target.value)
                  setAddError(undefined)
                }}
              />
              {addError && <p className="mt-1 text-[11px] font-medium text-red-600">{addError}</p>}
            </div>
            <Button type="submit" loading={saving && !renaming && !toggling} data-testid="cp-source-add">
              <Plus className="h-3.5 w-3.5" /> Add source
            </Button>
          </div>
        </form>
      )}
      <DataTable
        columns={columns}
        rows={sources}
        rowKey={(s) => s._id}
        loading={isLoading || (isFetching && !sources)}
        error={isError}
        errorMessage={isError ? parseApiError(error).message : undefined}
        errorDetail={error}
        onRetry={refetch}
        emptyTitle="No sources yet"
        emptyDescription={canEdit ? 'Add where partner leads come from, e.g. Referral or LinkedIn.' : undefined}
        rowClassName={(s) => (s.isActive ? undefined : 'bg-slate-50/70')}
      />
    </div>
  )
}

// ------------------------------------------------------------------ Change log

const ACTIONS: Record<string, { label: string; tone: BadgeTone }> = {
  create: { label: 'Added', tone: 'green' },
  update: { label: 'Changed', tone: 'blue' },
  delete: { label: 'Deleted', tone: 'red' },
  reorder: { label: 'Reordered', tone: 'amber' },
}

const FIELD_LABELS: [string, string][] = [
  ['name', 'Name'],
  ['type', 'Type'],
  ['color', 'Colour'],
  ['isActive', 'Active'],
  ['countsAsAttempt', 'Counts as attempt'],
  ['entrySubStage', 'Opens after'],
  ['maxAttempts', 'Attempts before moving'],
  ['dropSubStage', 'When attempts run out'],
  ['order', 'Order'],
]

const SUB_FLAGS: [string, string][] = [
  ['requiresRemark', 'Remark required'],
  ['needsApproval', 'Needs manager approval'],
  ['movesToStudent', 'Moves to student Leads'],
  ['requiredDocument', 'Document required'],
]

type Doc = Record<string, unknown>
const asDoc = (v: unknown): Doc | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : null)
const asSubs = (v: unknown): Doc[] => (Array.isArray(v) ? v.filter((x): x is Doc => !!asDoc(x)) : [])

/** ids and keys in a snapshot shown by name: sub-stage ids and document type keys */
interface Names {
  subStage: (id: string) => string
  document: (key: string) => string
}

function showValue(value: unknown, names: Names, field?: string): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (field === 'type' && typeof value === 'string') return typeLabel(value as CpStageType)
  if ((field === 'entrySubStage' || field === 'dropSubStage') && typeof value === 'string') return names.subStage(value)
  if (field === 'requiredDocument' && typeof value === 'string') return names.document(value)
  if (Array.isArray(value)) return value.map((v) => showValue(v, names)).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/** A readable list of what changed between two Lead Stages snapshots (stage, settings or source). */
function describeChanges(before: unknown, after: unknown, names: Names): string[] {
  const b = asDoc(before)
  const a = asDoc(after)
  if (!b || !a) return []
  const out: string[] = []
  for (const [key, label] of FIELD_LABELS) {
    if (!(key in a) && !(key in b)) continue
    if (JSON.stringify(b[key] ?? null) === JSON.stringify(a[key] ?? null)) continue
    out.push(`${label}: ${showValue(b[key], names, key)} → ${showValue(a[key], names, key)}`)
  }
  if ('subStages' in a || 'subStages' in b) {
    const was = asSubs(b.subStages)
    const now = asSubs(a.subStages)
    const byId = new Map(was.map((s) => [String(s._id), s]))
    for (const s of now) {
      const old = byId.get(String(s._id))
      if (!old) {
        out.push(`Sub-stage added: ${s.name}`)
        continue
      }
      if (old.name !== s.name) out.push(`Sub-stage renamed: ${old.name} → ${s.name}`)
      if (old.isActive !== s.isActive) out.push(`Sub-stage ${s.isActive ? 'activated' : 'deactivated'}: ${s.name}`)
      for (const [flag, label] of SUB_FLAGS) {
        if ((old[flag] ?? null) === (s[flag] ?? null)) continue
        out.push(`${s.name} · ${label}: ${showValue(old[flag], names, flag)} → ${showValue(s[flag], names, flag)}`)
      }
    }
    const kept = new Set(now.map((s) => String(s._id)))
    for (const s of was) if (!kept.has(String(s._id))) out.push(`Sub-stage removed: ${s.name}`)
    const order = (list: Doc[]) => list.map((s) => String(s._id)).filter((id) => byId.has(id) && kept.has(id))
    if (order(was).join() !== order(now).join()) out.push('Sub-stage order changed')
  }
  return out
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <pre className="max-h-72 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] leading-4 text-slate-700">
        {value === null || value === undefined ? '—' : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  )
}

function LogTab() {
  const { data, isLoading, isError, error, refetch } = useCpStageLogQuery()
  const { list } = useStageList()
  const [expanded, setExpanded] = useState<string | null>(null)

  if (isLoading) return <LoadingState />
  if (isError || !data) return <LoadError error={error} onRetry={refetch} />

  const subNames = subStageNames(list?.stages)
  const names: Names = {
    subStage: (id) => {
      const hit = subNames.get(id)
      return hit ? `${hit.name} (${hit.stage})` : id
    },
    document: (key) => list?.documentTypes[key] ?? key,
  }
  const entries: CpStageLogEntry[] = data.data

  return (
    <>
      <p className="mb-3 text-xs text-slate-500">Every change to the Channel Partners stages, call attempts and sources, newest first (last 100).</p>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {entries.length === 0 ? (
          <EmptyState title="No changes yet" description="Changes to stages, call attempts and sources show here with who made them." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  <th className="w-8 border-b border-slate-200 bg-slate-50 px-3 py-2.5" />
                  <th className="whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-2.5">When</th>
                  <th className="whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-2.5">Who</th>
                  <th className="whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-2.5">Action</th>
                  <th className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">Summary</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const open = expanded === entry._id
                  const action = ACTIONS[entry.action] ?? { label: entry.action, tone: 'slate' as BadgeTone }
                  const changes = open ? describeChanges(entry.before, entry.after, names) : []
                  return (
                    <Fragment key={entry._id}>
                      <tr
                        data-testid="cp-log-row"
                        className="cursor-pointer transition-colors hover:bg-slate-50/70"
                        onClick={() => setExpanded(open ? null : entry._id)}
                      >
                        <td className="border-b border-slate-100 px-3 py-2 align-top">
                          <button
                            type="button"
                            aria-expanded={open}
                            aria-label={open ? 'Hide details' : 'Show details'}
                            className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                            onClick={(e) => {
                              e.stopPropagation()
                              setExpanded(open ? null : entry._id)
                            }}
                          >
                            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </button>
                        </td>
                        <td className="whitespace-nowrap border-b border-slate-100 px-4 py-2 align-top text-xs">
                          <p className="text-slate-700">{formatDateTime(entry.at)}</p>
                          <p className="text-[11px] text-slate-400">{timeAgo(entry.at)}</p>
                        </td>
                        <td className="whitespace-nowrap border-b border-slate-100 px-4 py-2 align-top text-xs text-slate-700">{entry.actor || '—'}</td>
                        <td className="whitespace-nowrap border-b border-slate-100 px-4 py-2 align-top">
                          <Badge tone={action.tone}>{action.label}</Badge>
                        </td>
                        <td className="border-b border-slate-100 px-4 py-2 align-top text-xs text-slate-700">{entry.summary || '—'}</td>
                      </tr>
                      {open && (
                        <tr>
                          <td colSpan={5} className="border-b border-slate-100 bg-slate-50/50 px-4 py-3">
                            {changes.length > 0 && (
                              <ul className="mb-3 space-y-1 text-xs text-slate-700">
                                {changes.map((c, i) => (
                                  <li key={i} className="flex gap-1.5">
                                    <span className="text-slate-400">•</span>
                                    {c}
                                  </li>
                                ))}
                              </ul>
                            )}
                            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                              <JsonBlock title="Before" value={entry.before} />
                              <JsonBlock title="After" value={entry.after} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}

// ------------------------------------------------------------------ page

/**
 * Channel Partners › Lead Stages (SOP "Editing stages"): admins change the stages, sub-stages, call-attempt rule and
 * sources without a developer. Only Channel Partners reads these; the student stages stay in Masters. View without
 * Edit shows everything read-only.
 */
export default function CpStagesPage() {
  const me = useCurrentUser()
  const canEdit = can(me, 'consultants.stages', 'edit')
  const [params, setParams] = useSearchParams()
  const requested = params.get('tab')
  const tab: TabKey = TABS.find((t) => t.key === requested)?.key ?? 'stages'

  return (
    <>
      <PageHeader
        title="Lead Stages"
        description="The stages, sub-stages and rules the partnership team works leads through."
        breadcrumbs={[{ label: 'Channel Partners', to: CP_LEADS_PATH }, { label: 'Lead Stages' }]}
      />
      <div role="note" className="mb-4 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          These stages are only for Channel Partners. Student stages are managed in Masters and are never changed here. A stage used on a lead
          can be deactivated but not deleted; renames show on past records too.
          {!canEdit && <b className="font-semibold"> You can view these settings; changing them needs Edit on Channel Partners › Lead Stages.</b>}
        </span>
      </div>
      <CpTabs
        testIdPrefix="cp-tab"
        tabs={TABS}
        active={tab}
        onChange={(key) => {
          const next = new URLSearchParams(params)
          if (key === 'stages') next.delete('tab')
          else next.set('tab', key)
          setParams(next, { replace: true })
        }}
      />
      <div className="mt-4">
        {tab === 'stages' && <StagesTab canEdit={canEdit} />}
        {tab === 'attempts' && <AttemptsTab canEdit={canEdit} />}
        {tab === 'sources' && <SourcesTab canEdit={canEdit} />}
        {tab === 'log' && <LogTab />}
      </div>
    </>
  )
}
