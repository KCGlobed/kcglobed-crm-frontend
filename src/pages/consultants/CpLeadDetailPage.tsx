import { useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRightLeft,
  CalendarClock,
  CalendarPlus,
  Check,
  CircleCheck,
  Download,
  Eye,
  FilePen,
  FilePlus2,
  FileText,
  Loader2,
  Lock,
  Mail,
  MessageSquare,
  Milestone,
  Pencil,
  Phone,
  PhoneCall,
  Sparkles,
  Trash2,
  TriangleAlert,
  Upload,
  UserPlus,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  cpDocumentPath,
  useCpAddNoteMutation,
  useCpCreateFollowUpMutation,
  useCpDeleteDocumentMutation,
  useCpDeleteLeadMutation,
  useCpDocumentsQuery,
  useCpHistoryQuery,
  useCpLeadFollowUpsQuery,
  useCpLeadQuery,
  useCpMetaQuery,
  useCpNotesQuery,
  useCpTimelineQuery,
  useCpUpdateFollowUpMutation,
  useCpUploadDocumentMutation,
} from '../../services/consultantsApi'
import { useCurrentUser } from '../../app/hooks'
import { can } from '../../constants/permissions'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { FormField, Input, Select, Textarea } from '../../components/ui/fields'
import { ConfirmDialog, EmptyState, ErrorState, Skeleton } from '../../components/ui/feedback'
import { Breadcrumbs } from '../../components/ui/misc'
import { authorizedDownload, useAuthorizedObjectUrl } from '../../lib/download'
import { cn, formatDateTime, initials, parseApiError, timeAgo } from '../../lib/utils'
import type { CpDocument, CpFollowUp, CpLeadDetail, CpMeta } from '../../types/consultants'
import { CpStageBadge } from './CpStageBadge'
import { CP_LEADS_PATH, isoToLocalInput, localInputToIso } from './cpShared'
import CpLogDrawer from './CpLogDrawer'
import CpLeadFormDrawer from './CpLeadFormDrawer'
import CpAssignModal from './CpAssignModal'

// ---------------------------------------------------------------- small pieces

const isPast = (iso?: string | null) => !!iso && new Date(iso).getTime() < Date.now()
const nowLocalInput = () => isoToLocalInput(new Date().toISOString())
const withProtocol = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`)
const fileSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
const isImage = (doc: Pick<CpDocument, 'contentType'>) => doc.contentType.startsWith('image/')
const isPreviewable = (doc: Pick<CpDocument, 'contentType'>) => isImage(doc) || doc.contentType === 'application/pdf'

function DetailRow({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-xs">
      <span className="shrink-0 text-slate-400">{label}</span>
      <span className="min-w-0 break-all text-right font-medium text-slate-700">{children ?? '—'}</span>
    </div>
  )
}

function Panel({ title, children, actions, className }: { title: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white p-4 shadow-sm', className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
        {actions}
      </div>
      {children}
    </div>
  )
}

function HeaderFact({ label, children, danger, testId }: { label: string; children: ReactNode; danger?: boolean; testId?: string }) {
  return (
    <div className="min-w-0" data-testid={testId}>
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className={cn('truncate text-xs font-medium', danger ? 'text-red-600' : 'text-slate-700')}>{children}</p>
    </div>
  )
}

/** The student lead page's tab bar look, with a test id per tab. */
function DetailTabs({ tabs, active, onChange }: { tabs: { key: string; label: string; count?: number }[]; active: string; onChange: (key: string) => void }) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={active === tab.key}
          data-testid={`cp-tab-${tab.key}`}
          onClick={() => onChange(tab.key)}
          className={cn(
            '-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
            active === tab.key ? 'border-gold-400 text-brand-700' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={cn(
                'ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                active === tab.key ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-600'
              )}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

function ListSkeleton({ rows = 3, className = 'h-14' }: { rows?: number; className?: string }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={cn('w-full', className)} />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- Overview

function OverviewTab({ lead, meta }: { lead: CpLeadDetail; meta?: CpMeta }) {
  const colorOf = (name: string | null) => meta?.stages.find((s) => s.name === name)?.color ?? null
  const place = [lead.city, lead.state].filter(Boolean).join(', ')
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Partner Profile">
        <div data-testid="cp-partner-profile">
          <DetailRow label="Firm">{lead.firmName}</DetailRow>
          <DetailRow label="Contact person">{lead.name}</DetailRow>
          <DetailRow label="Business type">{lead.businessType}</DetailRow>
          <DetailRow label="Team size">{lead.teamSize ?? undefined}</DetailRow>
          <DetailRow label="Students a year">{lead.studentsPerYear ?? undefined}</DetailRow>
          <DetailRow label="Website">
            {lead.website ? (
              <a href={withProtocol(lead.website)} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">
                {lead.website}
              </a>
            ) : undefined}
          </DetailRow>
          <DetailRow label="City / State">{place || undefined}</DetailRow>
          <DetailRow label="Alternate mobile">
            {lead.altMobile ? (
              <a href={`tel:${lead.altMobile}`} className="text-brand-700 hover:underline">
                {lead.altMobile}
              </a>
            ) : undefined}
          </DetailRow>
          <DetailRow label="Source">{lead.source?.name}</DetailRow>
          <DetailRow label="Created by">{lead.createdBy?.name ?? 'System'}</DetailRow>
          <DetailRow label="Created on">{formatDateTime(lead.createdAt)}</DetailRow>
          <DetailRow label="Created via">{lead.createdVia === 'import' ? 'Bulk import' : 'Added manually'}</DetailRow>
          <DetailRow label="Assigned on">{lead.assignedAt ? formatDateTime(lead.assignedAt) : undefined}</DetailRow>
        </div>
      </Panel>

      <Panel title={`Recent calls${lead.callCount ? ` (${lead.callCount})` : ''}`}>
        {!lead.recentCalls.length && <p className="text-xs text-slate-400">No calls logged yet</p>}
        <div className="-mr-2 max-h-[28rem] overflow-y-auto pr-2" data-testid="cp-recent-calls">
          {lead.recentCalls.map((c) => (
            <div key={c._id} className="border-b border-slate-50 py-2 text-xs last:border-0" data-testid="cp-recent-call">
              <p className="flex flex-wrap items-center gap-1.5">
                <Badge tone={c.connected ? 'green' : 'amber'} dot>
                  {c.connected ? 'Connected' : 'Not connected'}
                </Badge>
                {c.stage && (
                  <CpStageBadge stage={{ name: c.stage, color: colorOf(c.stage) }}>
                    {c.stage}
                    {c.subStage && <span className="font-normal opacity-90">· {c.subStage}</span>}
                  </CpStageBadge>
                )}
              </p>
              {c.remark && <p className="mt-1 whitespace-pre-wrap text-slate-700">{c.remark}</p>}
              <p className="mt-0.5 text-slate-400">
                {c.calledBy?.name ?? 'System'} · {formatDateTime(c.calledAt)}
              </p>
            </div>
          ))}
        </div>
        {lead.callCount > lead.recentCalls.length && (
          <p className="mt-2 text-[11px] text-slate-400">
            Showing the latest {lead.recentCalls.length} of {lead.callCount} calls — every call is on the Timeline.
          </p>
        )}
      </Panel>
    </div>
  )
}

// ---------------------------------------------------------------- Timeline

const TYPE_ICONS: Record<string, { icon: typeof Sparkles; className: string }> = {
  created: { icon: FilePlus2, className: 'bg-emerald-50 text-emerald-600' },
  call: { icon: Phone, className: 'bg-pink-50 text-pink-600' },
  stage_change: { icon: ArrowRightLeft, className: 'bg-amber-50 text-amber-600' },
  note: { icon: MessageSquare, className: 'bg-sky-50 text-sky-600' },
  document: { icon: FileText, className: 'bg-teal-50 text-teal-600' },
  assignment: { icon: UserPlus, className: 'bg-brand-50 text-brand-600' },
  follow_up: { icon: CalendarClock, className: 'bg-orange-50 text-orange-600' },
  edit: { icon: FilePen, className: 'bg-slate-100 text-slate-500' },
  system: { icon: Sparkles, className: 'bg-slate-100 text-slate-500' },
}

const TIMELINE_PAGE_SIZE = 25

function TimelinePage({ leadId, page, isLast, onMore }: { leadId: string; page: number; isLast: boolean; onMore: () => void }) {
  const { data, isLoading, isError, error, refetch, isFetching } = useCpTimelineQuery({ id: leadId, page, page_size: TIMELINE_PAGE_SIZE })

  if (isLoading) return <ListSkeleton />
  if (isError) return <ErrorState message={parseApiError(error).message} onRetry={refetch} error={error} />
  if (page === 1 && !data?.data.length) {
    return <EmptyState title="No Activity Yet" description="Calls, stage changes, notes, documents and follow-ups will appear here." />
  }
  return (
    <>
      <ol className="relative space-y-4 border-l border-slate-200 pl-6">
        {data?.data.map((activity) => {
          const meta = TYPE_ICONS[activity.type] ?? TYPE_ICONS.system
          const Icon = meta.icon
          return (
            <li key={activity._id} className="relative" data-testid="cp-timeline-item" data-type={activity.type}>
              <span className={cn('absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full', meta.className)}>
                <Icon className="h-3 w-3" />
              </span>
              <p className="text-sm font-medium text-slate-700">{activity.title}</p>
              {activity.description && <p className="mt-0.5 whitespace-pre-wrap text-xs text-slate-500">{activity.description}</p>}
              <p className="mt-0.5 text-[11px] text-slate-400">
                {activity.actorName ?? 'System'} · {formatDateTime(activity.createdAt)}
              </p>
            </li>
          )
        })}
      </ol>
      {isLast && data?.pagination.next_page && (
        <div className="mt-4 text-center">
          <Button variant="outline" size="sm" loading={isFetching} onClick={onMore} data-testid="cp-timeline-more">
            Load Older Activity
          </Button>
        </div>
      )}
    </>
  )
}

function TimelineTab({ leadId }: { leadId: string }) {
  const [pages, setPages] = useState(1)
  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      {Array.from({ length: pages }, (_, i) => (
        <TimelinePage key={i} leadId={leadId} page={i + 1} isLast={i === pages - 1} onMore={() => setPages((p) => p + 1)} />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- Follow-ups

type FollowUpAction = { kind: 'done' | 'cancelled' | 'reschedule'; followUp: CpFollowUp }

/** Done / Cancel with an optional outcome, or a new date and time (and notes) for Reschedule. */
function FollowUpActionModal({ action, leadId, onClose }: { action: FollowUpAction; leadId: string; onClose: () => void }) {
  const { kind, followUp } = action
  const [update, { isLoading }] = useCpUpdateFollowUpMutation()
  const [outcome, setOutcome] = useState('')
  const [dueAt, setDueAt] = useState(isoToLocalInput(followUp.dueAt))
  const [notes, setNotes] = useState(followUp.notes ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const onSave = async () => {
    let body: Record<string, unknown>
    if (kind === 'reschedule') {
      if (!dueAt) return setErrors({ dueAt: 'Pick the new date and time' })
      if (new Date(dueAt).getTime() <= Date.now()) return setErrors({ dueAt: 'The follow-up must be in the future' })
      body = { dueAt: localInputToIso(dueAt), notes: notes.trim() || null }
    } else {
      body = { status: kind, outcome: outcome.trim() || undefined }
    }
    try {
      await update({ id: followUp._id, leadId, body }).unwrap()
      toast.success(kind === 'done' ? 'Follow-up completed' : kind === 'cancelled' ? 'Follow-up cancelled' : 'Follow-up rescheduled')
      onClose()
    } catch (err) {
      const parsed = parseApiError(err)
      setErrors(parsed.errors)
      toast.error(parsed.message)
    }
  }

  const title = kind === 'done' ? 'Complete follow-up' : kind === 'cancelled' ? 'Cancel follow-up' : 'Reschedule follow-up'
  return (
    <Modal
      open
      size="sm"
      onClose={onClose}
      title={title}
      description={`${followUp.typeLabel} · due ${formatDateTime(followUp.dueAt)}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Back
          </Button>
          <Button variant={kind === 'cancelled' ? 'danger' : 'primary'} loading={isLoading} onClick={onSave} data-testid="cp-fu-confirm">
            {kind === 'done' ? 'Mark done' : kind === 'cancelled' ? 'Cancel follow-up' : 'Reschedule'}
          </Button>
        </>
      }
    >
      {kind === 'reschedule' ? (
        <div className="space-y-3">
          <FormField label="New date & time" required error={errors.dueAt}>
            <Input
              type="datetime-local"
              min={nowLocalInput()}
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              aria-invalid={!!errors.dueAt}
              data-testid="cp-fu-reschedule-due"
            />
          </FormField>
          <FormField label="Notes" error={errors.notes}>
            <Textarea rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormField>
        </div>
      ) : (
        <FormField label={kind === 'done' ? 'Outcome' : 'Reason'} hint="Optional — saved on the lead's timeline" error={errors.outcome}>
          <Textarea rows={3} maxLength={500} value={outcome} onChange={(e) => setOutcome(e.target.value)} data-testid="cp-fu-outcome" />
        </FormField>
      )}
    </Modal>
  )
}

function AddFollowUpForm({ lead, meta }: { lead: CpLeadDetail; meta?: CpMeta }) {
  const [create, { isLoading }] = useCpCreateFollowUpMutation()
  const types = meta?.followUpTypes ?? []
  const [type, setType] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [notes, setNotes] = useState('')
  const [assignee, setAssignee] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const pickedType = type || types[0]?.value || 'call'

  const onSubmit = async () => {
    if (!dueAt) return setErrors({ dueAt: 'Pick the date and time' })
    if (new Date(dueAt).getTime() <= Date.now()) return setErrors({ dueAt: 'The follow-up must be in the future' })
    try {
      await create({
        id: lead._id,
        body: { type: pickedType, dueAt: localInputToIso(dueAt), notes: notes.trim() || undefined, assignee: assignee || undefined },
      }).unwrap()
      toast.success('Follow-up added')
      setDueAt('')
      setNotes('')
      setErrors({})
    } catch (err) {
      const parsed = parseApiError(err)
      // the backend names a wrong assignee 'owner'
      setErrors({ ...parsed.errors, ...(parsed.errors.owner ? { assignee: parsed.errors.owner } : {}) })
      toast.error(parsed.message)
    }
  }

  return (
    <Panel title="Add follow-up">
      <div className="space-y-3" data-testid="cp-fu-add">
        <FormField label="Type" error={errors.type}>
          <Select value={pickedType} onChange={(e) => setType(e.target.value)} data-testid="cp-fu-add-type">
            {types.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
            {!types.length && <option value="call">Call</option>}
          </Select>
        </FormField>
        <FormField label="Date & time" required error={errors.dueAt}>
          <Input
            type="datetime-local"
            min={nowLocalInput()}
            value={dueAt}
            onChange={(e) => {
              setDueAt(e.target.value)
              setErrors((p) => ({ ...p, dueAt: '' }))
            }}
            aria-invalid={!!errors.dueAt}
            data-testid="cp-fu-add-due"
          />
        </FormField>
        <FormField label="Assign to" error={errors.assignee} hint="Defaults to the lead's owner">
          <Select value={assignee} onChange={(e) => setAssignee(e.target.value)} data-testid="cp-fu-add-assignee">
            <option value="">{lead.owner ? `Lead owner (${lead.owner.name})` : 'Me'}</option>
            {meta?.owners
              .filter((o) => o._id !== lead.owner?._id)
              .map((o) => (
                <option key={o._id} value={o._id}>
                  {o.name}
                </option>
              ))}
          </Select>
        </FormField>
        <FormField label="Notes" error={errors.notes}>
          <Textarea rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="cp-fu-add-notes" />
        </FormField>
        <Button className="w-full" onClick={onSubmit} loading={isLoading} disabled={!dueAt} data-testid="cp-fu-add-save">
          <CalendarPlus className="h-3.5 w-3.5" /> Add follow-up
        </Button>
      </div>
    </Panel>
  )
}

function FollowUpsTab({ lead, meta }: { lead: CpLeadDetail; meta?: CpMeta }) {
  const user = useCurrentUser()
  const { data, isLoading, isError, error, refetch } = useCpLeadFollowUpsQuery(lead._id)
  const [action, setAction] = useState<FollowUpAction | null>(null)
  const canCreate = can(user, 'consultants.follow_ups', 'create')
  const canAct = can(user, 'consultants.follow_ups', 'edit')
  const followUps = data?.data ?? []
  const open = followUps.filter((f) => f.status === 'open').length
  const showAdd = canCreate && lead.status === 'open'

  const list = isLoading ? (
    <ListSkeleton rows={2} className="h-16" />
  ) : isError ? (
    <ErrorState message={parseApiError(error).message} onRetry={refetch} error={error} />
  ) : !followUps.length ? (
    <EmptyState
      title="No Follow-ups Yet"
      description={lead.status === 'open' ? 'Log a call or add a follow-up to schedule the next action.' : `${lead.stage.name} leads need no follow-up.`}
    />
  ) : (
    <>
      <p className="mb-2 text-xs text-slate-500">
        <b className="text-slate-700">{followUps.length}</b> follow-up{followUps.length === 1 ? '' : 's'} on this lead
        {open > 0 && (
          <>
            {' '}
            · <b className="text-slate-700">{open}</b> open
          </>
        )}
      </p>
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm" data-testid="cp-followups">
        {followUps.map((f) => (
          <li key={f._id} className={cn('flex flex-wrap items-start gap-3 px-4 py-3', f.status !== 'open' && 'opacity-70')} data-testid="cp-followup">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-800">
                {f.typeLabel}
                <Badge tone={f.status === 'done' ? 'green' : f.status === 'cancelled' ? 'slate' : f.isOverdue ? 'red' : 'blue'}>
                  {f.status === 'done' ? 'Done' : f.status === 'cancelled' ? 'Cancelled' : f.isOverdue ? 'Overdue' : 'Open'}
                </Badge>
              </p>
              <p className={cn('mt-0.5 text-xs', f.status === 'open' && f.isOverdue ? 'text-red-600' : 'text-slate-500')}>
                {f.status === 'open'
                  ? `Due ${formatDateTime(f.dueAt)} (${timeAgo(f.dueAt)}) · ${f.assignee.name}`
                  : `${f.status === 'done' ? 'Done' : 'Cancelled'} ${formatDateTime(f.completedAt)}${f.completedBy ? ` by ${f.completedBy.name}` : ''} · was due ${formatDateTime(f.dueAt)}`}
              </p>
              {f.notes && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">{f.notes}</p>}
              {f.outcome && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-600">Outcome: {f.outcome}</p>}
            </div>
            {canAct && f.status === 'open' && (
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="sm" className="text-emerald-700" onClick={() => setAction({ kind: 'done', followUp: f })} data-testid="cp-fu-done">
                  <Check className="h-3.5 w-3.5" /> Done
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setAction({ kind: 'reschedule', followUp: f })} data-testid="cp-fu-reschedule">
                  <CalendarClock className="h-3.5 w-3.5" /> Reschedule
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600"
                  aria-label="Cancel follow-up"
                  title="Cancel follow-up"
                  onClick={() => setAction({ kind: 'cancelled', followUp: f })}
                  data-testid="cp-fu-cancel"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  )

  return (
    <div className={cn('grid gap-4', showAdd && 'lg:grid-cols-3')}>
      {showAdd && (
        <div className="lg:col-span-1">
          <AddFollowUpForm lead={lead} meta={meta} />
        </div>
      )}
      <div className={cn(showAdd && 'lg:col-span-2')}>{list}</div>
      {action && <FollowUpActionModal key={`${action.kind}-${action.followUp._id}`} action={action} leadId={lead._id} onClose={() => setAction(null)} />}
    </div>
  )
}

// ---------------------------------------------------------------- Notes

const NOTE_MAX = 5000

function NotesTab({ leadId, canEdit }: { leadId: string; canEdit: boolean }) {
  const [body, setBody] = useState('')
  const { data, isLoading, isError, error, refetch } = useCpNotesQuery(leadId)
  const [addNote, { isLoading: saving }] = useCpAddNoteMutation()

  const onSubmit = async () => {
    if (!body.trim()) return
    try {
      await addNote({ id: leadId, body: body.trim() }).unwrap()
      setBody('')
      toast.success('Note added')
    } catch (err) {
      // the text stays in the box so the user can retry
      toast.error(parseApiError(err).message)
    }
  }

  return (
    <div className={cn('grid gap-4', canEdit && 'lg:grid-cols-3')}>
      {canEdit && (
        <div className="lg:col-span-1">
          <Panel title="Add note">
            <div className="space-y-2">
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="What happened with this partner?"
                rows={5}
                maxLength={NOTE_MAX}
                data-testid="cp-note-input"
              />
              <p className="text-right text-[11px] text-slate-400">
                {body.length} / {NOTE_MAX.toLocaleString()}
              </p>
              <Button onClick={onSubmit} loading={saving} disabled={!body.trim()} className="w-full" data-testid="cp-note-save">
                Save Note
              </Button>
            </div>
          </Panel>
        </div>
      )}
      <div className={cn(canEdit && 'lg:col-span-2')}>
        {isLoading && <ListSkeleton className="h-20" />}
        {isError && <ErrorState message={parseApiError(error).message} onRetry={refetch} error={error} />}
        {!isLoading && !isError && !data?.data.length && <EmptyState title="No Notes Yet" description="Notes keep the next person in the loop." />}
        <div className="space-y-3" data-testid="cp-notes">
          {data?.data.map((n) => (
            <div key={n._id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="cp-note">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700">
                  {initials(n.createdBy?.name)}
                </span>
                <span className="text-xs font-medium text-slate-700">{n.createdBy?.name ?? 'System'}</span>
                <span className="ml-auto text-[11px] text-slate-400">{formatDateTime(n.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-slate-600">{n.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Documents

function DocumentPreviewModal({ leadId, doc, onClose }: { leadId: string; doc: CpDocument; onClose: () => void }) {
  const file = useAuthorizedObjectUrl(isPreviewable(doc) ? `${cpDocumentPath(leadId, doc._id)}?inline=1` : null)
  const download = () => authorizedDownload(cpDocumentPath(leadId, doc._id), doc.fileName).catch((e) => toast.error(parseApiError(e).message))
  return (
    <Modal
      open
      onClose={onClose}
      title={`${doc.typeLabel} · ${doc.fileName}`}
      description={`Uploaded ${formatDateTime(doc.uploadedAt)}${doc.uploadedBy ? ` by ${doc.uploadedBy}` : ''}${
        doc.deletedAt ? ` · deleted ${formatDateTime(doc.deletedAt)}${doc.deletedBy ? ` by ${doc.deletedBy}` : ''}` : ''
      }`}
      size="xl"
      footer={
        <Button variant="outline" onClick={download}>
          <Download className="h-3.5 w-3.5" /> Download
        </Button>
      }
    >
      <div className="flex min-h-[60vh] items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        {!isPreviewable(doc) ? (
          <div className="flex flex-col items-center gap-2 text-center text-sm text-slate-500">
            <FileText className="h-8 w-8 text-slate-400" />
            This file type can't be shown here. Download it to open it.
          </div>
        ) : file.loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        ) : file.error ? (
          <p className="text-sm text-red-600">{file.error}</p>
        ) : isImage(doc) ? (
          <img src={file.url} alt={doc.fileName} className="max-h-[70vh] w-auto object-contain" />
        ) : (
          <iframe src={file.url} title={doc.fileName} className="h-[70vh] w-full" />
        )}
      </div>
    </Modal>
  )
}

function DocumentsTab({ leadId, canEdit }: { leadId: string; canEdit: boolean }) {
  const { data, isLoading, isError, error, refetch } = useCpDocumentsQuery(leadId)
  const [upload, { isLoading: uploading }] = useCpUploadDocumentMutation()
  const [remove, { isLoading: removing }] = useCpDeleteDocumentMutation()
  const [type, setType] = useState('')
  const [file, setFile] = useState<File | null>(null)
  // a new key empties the file input after an upload
  const [inputKey, setInputKey] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<CpDocument | null>(null)
  const [toDelete, setToDelete] = useState<CpDocument | null>(null)

  if (isLoading) return <ListSkeleton rows={2} className="h-24" />
  if (isError || !data) return <ErrorState message={parseApiError(error).message} onRetry={refetch} error={error} />
  const { documents, types, accept, maxMb } = data.data
  const active = documents.filter((d) => !d.deletedAt)
  const acceptText = accept.map((a) => a.replace('.', '').toUpperCase()).join(', ')

  const pickFile = (picked: File | null) => {
    setFile(picked)
    if (!picked) return setErrors((p) => ({ ...p, file: '' }))
    const ext = picked.name.includes('.') ? `.${picked.name.split('.').pop()!.toLowerCase()}` : ''
    if (accept.length && !accept.includes(ext)) setErrors((p) => ({ ...p, file: `Upload a ${acceptText} file` }))
    else if (picked.size > maxMb * 1024 * 1024) setErrors((p) => ({ ...p, file: `The file can be at most ${maxMb} MB` }))
    else setErrors((p) => ({ ...p, file: '' }))
  }

  const onUpload = async () => {
    const found: Record<string, string> = {}
    if (!type) found.type = 'Pick the document type'
    if (!file) found.file = 'Choose a file'
    if (errors.file) found.file = errors.file
    if (Object.values(found).some(Boolean)) return setErrors(found)
    const body = new FormData()
    body.append('type', type)
    body.append('file', file!)
    try {
      await upload({ id: leadId, body }).unwrap()
      toast.success('Document uploaded')
      setFile(null)
      setType('')
      setInputKey((k) => k + 1)
      setErrors({})
    } catch (err) {
      const parsed = parseApiError(err)
      setErrors(parsed.errors)
      toast.error(parsed.message)
    }
  }

  const onDelete = async () => {
    if (!toDelete) return
    try {
      await remove({ id: leadId, documentId: toDelete._id }).unwrap()
      toast.success('Document deleted')
      setToDelete(null)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  const download = (doc: CpDocument) =>
    authorizedDownload(cpDocumentPath(leadId, doc._id), doc.fileName).catch((e) => toast.error(parseApiError(e).message))

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-1">
        {canEdit && (
          <Panel title="Upload document">
            <div className="space-y-3">
              <FormField label="Document type" required error={errors.type}>
                <Select
                  value={type}
                  onChange={(e) => {
                    setType(e.target.value)
                    setErrors((p) => ({ ...p, type: '' }))
                  }}
                  aria-invalid={!!errors.type}
                  data-testid="cp-doc-type"
                >
                  <option value="">Choose…</option>
                  {types.map((t) => (
                    <option key={t.type} value={t.type}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="File" required error={errors.file} hint={`${acceptText} · up to ${maxMb} MB`}>
                <label
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs transition-colors hover:bg-slate-50',
                    'focus-within:border-brand-500 focus-within:ring-3 focus-within:ring-brand-100',
                    errors.file ? 'border-red-400' : 'border-slate-300'
                  )}
                >
                  <input
                    key={inputKey}
                    type="file"
                    accept={accept.join(',')}
                    onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                    aria-invalid={!!errors.file}
                    className="sr-only"
                    data-testid="cp-doc-file"
                  />
                  <Upload className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className={cn('min-w-0 truncate', file ? 'font-medium text-slate-700' : 'text-slate-500')}>
                    {file ? `${file.name} · ${fileSize(file.size)}` : 'Choose a file…'}
                  </span>
                </label>
              </FormField>
              <Button className="w-full" onClick={onUpload} loading={uploading} disabled={!type || !file || !!errors.file} data-testid="cp-doc-upload">
                <Upload className="h-3.5 w-3.5" /> Upload
              </Button>
            </div>
          </Panel>
        )}
        <Panel title="Document checklist">
          <ul className="space-y-1" data-testid="cp-doc-types">
            {types.map((t) => {
              const count = active.filter((d) => d.type === t.type).length
              return (
                <li key={t.type} className="flex items-center justify-between gap-2 text-xs">
                  <span className={cn('flex items-center gap-1.5', count ? 'text-slate-700' : 'text-slate-400')}>
                    {count ? <CircleCheck className="h-3.5 w-3.5 text-emerald-600" /> : <span className="h-3.5 w-3.5 rounded-full border border-slate-300" />}
                    {t.label}
                  </span>
                  {count > 1 && <span className="text-[11px] text-slate-400">{count} files</span>}
                </li>
              )
            })}
          </ul>
        </Panel>
      </div>

      <div className="lg:col-span-2">
        {!documents.length ? (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <EmptyState title="No Documents Yet" description="MoU, KYC and other partner documents uploaded here show on the lead." />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm" data-testid="cp-documents">
            {documents.map((d) => (
              <li
                key={d._id}
                className={cn('flex flex-wrap items-start gap-3 px-4 py-3', d.deletedAt && 'bg-slate-50 opacity-60')}
                data-testid="cp-document"
                data-deleted={d.deletedAt ? 'true' : undefined}
              >
                <FileText className={cn('mt-0.5 h-4 w-4 shrink-0', d.deletedAt ? 'text-slate-300' : 'text-teal-600')} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-800">
                    {d.typeLabel}
                    {d.deletedAt && <Badge>Deleted</Badge>}
                  </p>
                  <p className={cn('truncate text-xs text-slate-600', d.deletedAt && 'line-through')} title={d.fileName}>
                    {d.fileName} · {fileSize(d.size)}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Uploaded by {d.uploadedBy ?? 'System'} on {formatDateTime(d.uploadedAt)}
                  </p>
                  {d.deletedAt && (
                    <p className="text-[11px] text-slate-500">
                      Deleted by {d.deletedBy ?? 'System'} on {formatDateTime(d.deletedAt)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {isPreviewable(d) && (
                    <Button variant="ghost" size="sm" onClick={() => setPreview(d)} data-testid="cp-doc-preview">
                      <Eye className="h-3.5 w-3.5" /> Preview
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => download(d)} title="Download" aria-label="Download" data-testid="cp-doc-download">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  {canEdit && !d.deletedAt && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600"
                      onClick={() => setToDelete(d)}
                      title="Delete"
                      aria-label="Delete document"
                      data-testid="cp-doc-delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {preview && <DocumentPreviewModal leadId={leadId} doc={preview} onClose={() => setPreview(null)} />}
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={onDelete}
        title="Delete document"
        message={`Delete ${toDelete?.typeLabel ?? 'this document'} (${toDelete?.fileName ?? ''})? It comes off the lead but stays listed as deleted for the audit trail.`}
        confirmLabel="Delete"
        danger
        loading={removing}
      />
    </div>
  )
}

// ---------------------------------------------------------------- History

function HistoryTab({ leadId }: { leadId: string }) {
  const { data, isLoading, isError, error, refetch } = useCpHistoryQuery(leadId)
  if (isLoading) return <Skeleton className="h-48 w-full" />
  if (isError) return <ErrorState message={parseApiError(error).message} onRetry={refetch} error={error} />
  if (!data?.data.length) return <EmptyState title="No Field Changes Yet" />
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm" data-testid="cp-history">
        <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-2">Field</th>
            <th className="px-4 py-2">Old → New</th>
            <th className="px-4 py-2">Changed By</th>
            <th className="px-4 py-2">When</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.data.map((h) => (
            <tr key={h._id} className="align-top">
              <td className="px-4 py-2 text-xs font-medium text-slate-700">{h.label || h.field}</td>
              <td className="max-w-md px-4 py-2 text-xs">
                <span className="break-words text-slate-500 line-through decoration-slate-300">{h.oldValue ?? '—'}</span>
                <span className="mx-1.5 text-slate-400">→</span>
                <span className="break-words text-slate-800">{h.newValue ?? '—'}</span>
              </td>
              <td className="px-4 py-2 text-xs text-slate-600">{h.changedBy ?? 'System'}</td>
              <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-500">{formatDateTime(h.changedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------- page

type ModalKind = 'call' | 'update' | 'edit' | 'assign' | 'delete'

/** A Channel Partners lead: header with the stage and actions, then Overview / Timeline / Follow-ups / Notes / Documents / History. */
export default function CpLeadDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const user = useCurrentUser()
  const [searchParams, setSearchParams] = useSearchParams()
  const [modal, setModal] = useState<ModalKind | null>(null)

  const { data, isLoading, isError, error, refetch } = useCpLeadQuery(id, { skip: !id })
  const { data: metaRes } = useCpMetaQuery()
  const [deleteLead, { isLoading: deleting }] = useCpDeleteLeadMutation()
  const canViewFollowUps = can(user, 'consultants.follow_ups', 'view')
  const { data: followUpsRes } = useCpLeadFollowUpsQuery(id, { skip: !id || !canViewFollowUps })
  const lead = data?.data
  const meta = metaRes?.data
  const canEdit = can(user, 'consultants.leads', 'edit')
  const canDelete = can(user, 'consultants.leads', 'delete')
  const canReassign = can(user, 'consultants.leads', 'reassign')
  const openFollowUps = followUpsRes?.data.filter((f) => f.status === 'open').length

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'timeline', label: 'Timeline' },
    ...(canViewFollowUps ? [{ key: 'followups', label: 'Follow-ups', count: openFollowUps }] : []),
    { key: 'notes', label: 'Notes' },
    { key: 'documents', label: 'Documents' },
    { key: 'history', label: 'History' },
  ]
  const requested = searchParams.get('tab') ?? 'overview'
  const tab = tabs.some((t) => t.key === requested) ? requested : 'overview'
  const setTab = (key: string) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (key === 'overview') next.delete('tab')
        else next.set('tab', key)
        return next
      },
      { replace: true }
    )
  const close = () => setModal(null)

  if (isError) {
    return (
      <>
        <Button variant="ghost" size="sm" onClick={() => navigate(CP_LEADS_PATH)}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Partner Leads
        </Button>
        <ErrorState message={parseApiError(error).message} onRetry={refetch} error={error} />
      </>
    )
  }

  const onDelete = async () => {
    if (!lead) return
    try {
      await deleteLead(lead._id).unwrap()
      toast.success('Lead deleted')
      navigate(CP_LEADS_PATH)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  const overdue = !!lead && lead.status === 'open' && isPast(lead.nextFollowUpAt)
  const maxAttempts = meta?.settings.maxAttempts

  return (
    <>
      <Breadcrumbs items={[{ label: 'Partner Leads', to: CP_LEADS_PATH }, { label: lead?.leadNo ?? '…' }]} />

      <div className="mb-4 mt-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm" data-testid="cp-lead-header">
        {isLoading || !lead ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-80" />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-base font-bold text-brand-700">
                  {initials(lead.firmName || lead.name)}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-lg font-semibold text-slate-800" data-testid="cp-lead-name">
                      {lead.name}
                    </h1>
                    <span className="text-xs text-slate-400" data-testid="cp-lead-no">
                      {lead.leadNo}
                    </span>
                    <CpStageBadge
                      stage={lead.stage}
                      title={lead.stageChangedAt ? `In this stage since ${formatDateTime(lead.stageChangedAt)}` : undefined}
                    >
                      {lead.stage.name}
                      {lead.subStage && <span className="font-normal opacity-90">· {lead.subStage.name}</span>}
                    </CpStageBadge>
                    {lead.locked && (
                      <Badge tone="green">
                        <Lock className="h-3 w-3" /> Locked
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500" data-testid="cp-lead-firm">
                    {lead.firmName ?? 'No firm name'}
                    {lead.businessType ? ` · ${lead.businessType}` : ''}
                    {lead.city ? ` · ${lead.city}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2" data-testid="cp-lead-actions">
                {canEdit && !lead.locked && (
                  <>
                    <Button size="sm" onClick={() => setModal('call')} data-testid="cp-log-call">
                      <PhoneCall className="h-3.5 w-3.5" /> Log Call
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setModal('update')} data-testid="cp-update-stage">
                      <Milestone className="h-3.5 w-3.5" /> Update stage
                    </Button>
                  </>
                )}
                {canEdit && (
                  <Button variant="outline" size="sm" onClick={() => setModal('edit')} data-testid="cp-edit-lead">
                    <Pencil className="h-3.5 w-3.5" /> Edit details
                  </Button>
                )}
                {canReassign && (
                  <Button variant="outline" size="sm" onClick={() => setModal('assign')} data-testid="cp-assign-lead">
                    <UserPlus className="h-3.5 w-3.5" /> {lead.owner ? 'Reassign' : 'Assign'}
                  </Button>
                )}
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600"
                    onClick={() => setModal('delete')}
                    title="Delete lead"
                    aria-label="Delete lead"
                    data-testid="cp-delete-lead"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {(lead.locked || lead.studentDuplicate) && (
              <div className="mt-3 space-y-2">
                {lead.locked && (
                  <div className="flex gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-900 ring-1 ring-inset ring-emerald-100" data-testid="cp-locked-banner">
                    <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <p>
                      <b>Onboarded — locked.</b> This partner is onboarded; calls and stage changes can no longer be logged on the lead.
                    </p>
                  </div>
                )}
                {lead.studentDuplicate && (
                  <div className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 ring-1 ring-inset ring-amber-200" data-testid="cp-student-duplicate">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <p>
                      This mobile/email is also student lead <b>{lead.studentDuplicate.leadNo}</b> — flagged, not merged.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 sm:grid-cols-3 lg:grid-cols-6">
              <HeaderFact label="Owner" testId="cp-fact-owner">
                {lead.owner?.name ?? 'Unassigned'}
              </HeaderFact>
              <HeaderFact label="Mobile" testId="cp-fact-mobile">
                <a href={`tel:${lead.mobile}`} className="text-brand-700 hover:underline">
                  <Phone className="mr-1 inline h-3 w-3" />
                  {lead.mobile}
                </a>
              </HeaderFact>
              <HeaderFact label="Email" testId="cp-fact-email">
                {lead.email ? (
                  <a href={`mailto:${lead.email}`} className="text-brand-700 hover:underline" title={lead.email}>
                    <Mail className="mr-1 inline h-3 w-3" />
                    {lead.email}
                  </a>
                ) : (
                  '—'
                )}
              </HeaderFact>
              <HeaderFact label="Next Follow-up" danger={overdue} testId="cp-fact-followup">
                {lead.nextFollowUpAt ? `${overdue ? 'Overdue · ' : ''}${formatDateTime(lead.nextFollowUpAt)}` : 'None'}
              </HeaderFact>
              <HeaderFact label="Attempts" testId="cp-fact-attempts">
                <span title="Calls in a row that did not connect">
                  {lead.attempts}
                  {maxAttempts ? ` of ${maxAttempts}` : ''}
                  {lead.callCount ? ` · ${lead.callCount} call${lead.callCount === 1 ? '' : 's'}` : ''}
                </span>
              </HeaderFact>
              <HeaderFact label="Last Activity">{timeAgo(lead.lastActivityAt)}</HeaderFact>
            </div>
          </>
        )}
      </div>

      <DetailTabs tabs={tabs} active={tab} onChange={setTab} />

      <div className="mt-4">
        {isLoading || !lead ? (
          <Skeleton className="h-48 w-full" />
        ) : tab === 'timeline' ? (
          <TimelineTab leadId={lead._id} />
        ) : tab === 'followups' ? (
          <FollowUpsTab lead={lead} meta={meta} />
        ) : tab === 'notes' ? (
          <NotesTab leadId={lead._id} canEdit={canEdit} />
        ) : tab === 'documents' ? (
          <DocumentsTab leadId={lead._id} canEdit={canEdit} />
        ) : tab === 'history' ? (
          <HistoryTab leadId={lead._id} />
        ) : (
          <OverviewTab lead={lead} meta={meta} />
        )}
      </div>

      {lead && (modal === 'call' || modal === 'update') && <CpLogDrawer open onClose={close} lead={lead} withCall={modal === 'call'} />}
      {lead && modal === 'edit' && <CpLeadFormDrawer open onClose={close} lead={lead} />}
      {lead && modal === 'assign' && <CpAssignModal lead={lead} onClose={close} />}

      <ConfirmDialog
        open={modal === 'delete'}
        onClose={close}
        onConfirm={onDelete}
        title="Delete Partner Lead"
        message={`Delete ${lead?.name ?? 'this lead'}${lead?.firmName ? ` (${lead.firmName})` : ''} · ${lead?.leadNo ?? ''}? Its open follow-ups are cancelled; the record is kept in the audit trail.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
      />
    </>
  )
}
