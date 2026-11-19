import { useState, type MouseEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, CalendarClock, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  useCpFollowUpSummaryQuery,
  useCpFollowUpsQuery,
  useCpMetaQuery,
  useCpUpdateFollowUpMutation,
} from '../../services/consultantsApi'
import { useCurrentUser } from '../../app/hooks'
import { can } from '../../constants/permissions'
import { CellText, DataTable, type Column } from '../../components/ui/DataTable'
import { FilterBar, PageHeader, SearchInput } from '../../components/ui/misc'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { FormField, Input, Select, Textarea } from '../../components/ui/fields'
import { formatDateTime, parseApiError, timeAgo } from '../../lib/utils'
import type { CpFollowUp, CpFollowUpView } from '../../types/consultants'
import { CpStageBadge } from './CpStageBadge'
import { CP_LEADS_PATH, cpLeadPath, isoToLocalInput, localInputToIso } from './cpShared'
import { CpTabs } from './CpTabs'

const VIEWS: { key: CpFollowUpView; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
]

const EMPTY: Record<CpFollowUpView, { title: string; description: string }> = {
  today: { title: 'Nothing due today', description: 'Follow-ups set while logging a call on a partner lead show here on their day.' },
  overdue: { title: 'Nothing overdue', description: 'Every open partner follow-up is still on time.' },
  upcoming: { title: 'No upcoming follow-ups', description: 'Follow-ups after today show here.' },
  completed: { title: 'No completed follow-ups', description: 'Follow-ups marked done or cancelled show here.' },
}

type Mode = 'done' | 'cancelled' | 'reschedule'

/** Done / Reschedule / Cancel on an open partner follow-up (a closed one cannot be reopened). */
function CpFollowUpActions({ followUp }: { followUp: CpFollowUp }) {
  const [updateFollowUp, { isLoading }] = useCpUpdateFollowUpMutation()
  const [mode, setMode] = useState<Mode | null>(null)
  const [outcome, setOutcome] = useState('')
  const [due, setDue] = useState('')
  const [minDue, setMinDue] = useState('')
  const [error, setError] = useState<string>()

  const open = (next: Mode) => {
    setMode(next)
    setOutcome('')
    setError(undefined)
    if (next === 'reschedule') {
      const now = Date.now()
      const current = new Date(followUp.dueAt).getTime()
      setMinDue(isoToLocalInput(new Date(now).toISOString()))
      // keep the current time when it is still ahead, else an hour from now
      setDue(isoToLocalInput(new Date(current > now ? current : now + 60 * 60 * 1000).toISOString()))
    }
  }

  const submit = async () => {
    let body: Record<string, unknown>
    if (mode === 'reschedule') {
      if (!due) return setError('Pick a date and time')
      if (new Date(due).getTime() <= Date.now()) return setError('Pick a time in the future')
      body = { dueAt: localInputToIso(due) }
    } else {
      body = { status: mode, outcome: outcome.trim() || null }
    }
    try {
      await updateFollowUp({ id: followUp._id, leadId: followUp.lead._id, body }).unwrap()
      toast.success(mode === 'done' ? 'Follow-up completed' : mode === 'cancelled' ? 'Follow-up cancelled' : 'Follow-up rescheduled')
      setMode(null)
    } catch (err) {
      const { message, errors } = parseApiError(err)
      setError(errors.dueAt ?? errors.outcome ?? errors.status)
      toast.error(message)
    }
  }

  // rows open the lead; clicks here (and inside the modals, which bubble through React) must not
  const stop = (e: MouseEvent) => e.stopPropagation()
  const lead = followUp.lead

  return (
    <div className="flex justify-end gap-1" onClick={stop}>
      <Button variant="ghost" size="sm" className="text-emerald-700" data-testid="cp-fu-done" onClick={() => open('done')}>
        <Check className="h-3.5 w-3.5" /> Done
      </Button>
      <Button variant="ghost" size="sm" data-testid="cp-fu-reschedule" onClick={() => open('reschedule')}>
        <CalendarClock className="h-3.5 w-3.5" /> Reschedule
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-red-600"
        aria-label="Cancel follow-up"
        title="Cancel follow-up"
        data-testid="cp-fu-cancel"
        onClick={() => open('cancelled')}
      >
        <X className="h-3.5 w-3.5" />
      </Button>

      {mode && (
        <Modal
          open
          size="sm"
          onClose={() => setMode(null)}
          title={mode === 'done' ? 'Complete follow-up' : mode === 'cancelled' ? 'Cancel follow-up' : 'Reschedule follow-up'}
          description={`${followUp.typeLabel} · ${lead.name}${lead.firmName ? ` (${lead.firmName})` : ''}`}
          footer={
            <>
              <Button variant="outline" onClick={() => setMode(null)}>
                Back
              </Button>
              <Button variant={mode === 'cancelled' ? 'danger' : 'primary'} loading={isLoading} data-testid="cp-fu-confirm" onClick={submit}>
                {mode === 'done' ? 'Mark done' : mode === 'cancelled' ? 'Cancel follow-up' : 'Reschedule'}
              </Button>
            </>
          }
        >
          {mode === 'reschedule' ? (
            <FormField label="New date and time" required error={error} hint={`Now due ${formatDateTime(followUp.dueAt)}`}>
              <Input
                type="datetime-local"
                value={due}
                min={minDue}
                aria-invalid={!!error}
                data-testid="cp-fu-due"
                onChange={(e) => {
                  setDue(e.target.value)
                  setError(undefined)
                }}
              />
            </FormField>
          ) : (
            <FormField label={mode === 'done' ? 'Outcome' : 'Reason'} hint="Optional — saved on the lead's timeline" error={error}>
              <Textarea rows={3} maxLength={500} value={outcome} data-testid="cp-fu-outcome" onChange={(e) => setOutcome(e.target.value)} />
            </FormField>
          )}
        </Modal>
      )}
    </div>
  )
}

/**
 * Partner Follow-ups: the Channel Partners work queue (today, overdue, upcoming, completed) on consultant leads only.
 * The student follow-ups live in Tasks and are never listed here.
 */
export default function CpFollowUpsPage() {
  const me = useCurrentUser()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const requested = params.get('view')
  const view: CpFollowUpView = VIEWS.find((v) => v.key === requested)?.key ?? 'today'
  const everyone = params.get('who') === 'all'
  const assignee = everyone ? undefined : 'me'
  const type = params.get('type') ?? ''
  const search = params.get('search') ?? ''
  const page = Number(params.get('page')) || 1
  const pageSize = Number(params.get('page_size')) || 25
  const canEdit = can(me, 'consultants.follow_ups', 'edit')
  const completed = view === 'completed'

  const set = (key: string, value: string | number | undefined) => {
    const next = new URLSearchParams(params)
    if (value === undefined || value === '') next.delete(key)
    else next.set(key, String(value))
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }

  const { data: meta } = useCpMetaQuery()
  const { data, isLoading, isFetching, isError, error, refetch } = useCpFollowUpsQuery(
    { view, assignee, type: type || undefined, search: search || undefined, page, page_size: pageSize },
    { pollingInterval: 60_000 }
  )
  const { data: summary } = useCpFollowUpSummaryQuery({ assignee }, { pollingInterval: 60_000 })
  const counts = summary?.data

  const columns: Column<CpFollowUp>[] = [
    {
      key: 'dueAt',
      header: 'Due',
      render: (f) => {
        const overdue = f.status === 'open' && f.isOverdue
        return (
          <div className="text-xs">
            <p className={overdue ? 'flex items-center gap-1 font-medium text-red-600' : 'text-slate-700'}>
              {overdue && <AlertCircle className="h-3 w-3" aria-label="Overdue" />}
              {formatDateTime(f.dueAt)}
            </p>
            <p className={overdue ? 'text-[11px] text-red-500' : 'text-[11px] text-slate-400'}>{timeAgo(f.dueAt)}</p>
          </div>
        )
      },
    },
    { key: 'type', header: 'Type', render: (f) => <Badge tone="blue">{f.typeLabel}</Badge> },
    {
      key: 'lead',
      header: 'Lead',
      render: (f) => (
        <div className="max-w-60">
          <Link
            to={cpLeadPath(f.lead._id)}
            onClick={(e) => e.stopPropagation()}
            className="block truncate font-medium text-slate-800 hover:text-brand-700 hover:underline"
          >
            {f.lead.name}
          </Link>
          <p className="truncate text-[11px] text-slate-500" title={f.lead.firmName ?? undefined}>
            {f.lead.firmName ? `${f.lead.firmName} · ` : ''}
            <span className="text-slate-400">{f.lead.leadNo}</span>
          </p>
        </div>
      ),
    },
    {
      key: 'stage',
      header: 'Lead stage',
      render: (f) => (
        <div className="space-y-0.5">
          <CpStageBadge stage={f.lead.stage} />
          {f.lead.subStage && <p className="max-w-48 truncate text-[11px] text-slate-500">{f.lead.subStage}</p>}
        </div>
      ),
    },
    {
      key: 'mobile',
      header: 'Mobile',
      render: (f) => (
        <a href={`tel:${f.lead.mobile}`} onClick={(e) => e.stopPropagation()} className="text-xs tabular-nums text-slate-700 hover:text-brand-700 hover:underline">
          {f.lead.mobile}
        </a>
      ),
    },
    { key: 'assignee', header: 'Assignee', render: (f) => <span className="text-xs">{f.assignee?.name ?? '—'}</span> },
    ...(completed
      ? ([
          {
            key: 'status',
            header: 'Status',
            render: (f) => <Badge tone={f.status === 'done' ? 'green' : 'slate'}>{f.status === 'done' ? 'Done' : 'Cancelled'}</Badge>,
          },
          { key: 'outcome', header: 'Outcome', render: (f) => <CellText muted={!f.outcome}>{f.outcome}</CellText> },
          {
            key: 'completedAt',
            header: 'Completed',
            render: (f) => (
              <div className="text-xs">
                <p className="text-slate-700">{f.completedBy?.name ?? '—'}</p>
                <p className="text-[11px] text-slate-400">{formatDateTime(f.completedAt)}</p>
              </div>
            ),
          },
        ] satisfies Column<CpFollowUp>[])
      : ([
          { key: 'notes', header: 'Notes', render: (f) => <CellText muted={!f.notes}>{f.notes}</CellText> },
          ...(canEdit
            ? [
                {
                  key: 'actions',
                  header: '',
                  align: 'right' as const,
                  render: (f: CpFollowUp) => (f.status === 'open' ? <CpFollowUpActions followUp={f} /> : null),
                },
              ]
            : []),
        ] satisfies Column<CpFollowUp>[])),
  ]

  const filtered = !!type || !!search
  const empty = filtered
    ? { title: 'No follow-ups match', description: 'Try another search or type, or clear the filters.' }
    : EMPTY[view]

  return (
    <>
      <PageHeader
        title="Partner Follow-ups"
        description="Call-backs and next actions on Channel Partners leads. Set them while logging a call on a partner lead."
        breadcrumbs={[{ label: 'Channel Partners', to: CP_LEADS_PATH }, { label: 'Follow-ups' }]}
      />
      <FilterBar
        end={
          filtered ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const next = new URLSearchParams(params)
                for (const key of ['type', 'search', 'page']) next.delete(key)
                setParams(next, { replace: true })
              }}
            >
              Reset
            </Button>
          ) : undefined
        }
      >
        <SearchInput
          className="w-full sm:w-72"
          value={search}
          placeholder="Search name, firm, mobile or lead no…"
          onSearch={(v) => set('search', v)}
        />
        <Select
          className="!w-auto"
          aria-label="Assignee"
          data-testid="cp-fu-assignee"
          value={everyone ? 'all' : 'me'}
          onChange={(e) => set('who', e.target.value === 'all' ? 'all' : undefined)}
        >
          <option value="me">Mine</option>
          <option value="all">Everyone in my scope</option>
        </Select>
        <Select className="!w-auto" aria-label="Follow-up type" data-testid="cp-fu-type" value={type} onChange={(e) => set('type', e.target.value)}>
          <option value="">All types</option>
          {meta?.data.followUpTypes.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </FilterBar>
      <CpTabs
        testIdPrefix="cp-fu-tab"
        tabs={VIEWS.map((v) => ({ ...v, count: counts?.[v.key] }))}
        active={view}
        onChange={(key) => set('view', key)}
      />
      <div className="mt-4">
        <DataTable
          columns={columns}
          rows={data?.data}
          rowKey={(f) => f._id}
          loading={isLoading || isFetching}
          error={isError}
          errorMessage={isError ? parseApiError(error).message : undefined}
          errorDetail={error}
          onRetry={refetch}
          emptyTitle={empty.title}
          emptyDescription={empty.description}
          pagination={data?.pagination}
          onPageChange={(p) => set('page', p)}
          onPageSizeChange={(s) => set('page_size', s)}
          onRowClick={(f) => navigate(cpLeadPath(f.lead._id))}
        />
      </div>
    </>
  )
}
