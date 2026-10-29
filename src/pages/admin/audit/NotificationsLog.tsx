import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useCurrentUser } from '../../../app/hooks'
import { Badge, StatusBadge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { DataTable, type Column } from '../../../components/ui/DataTable'
import { DateRangeFilter } from '../../../components/ui/DateRangeFilter'
import { ConfirmDialog } from '../../../components/ui/feedback'
import { Select } from '../../../components/ui/fields'
import { FilterBar, SearchInput } from '../../../components/ui/misc'
import { Modal } from '../../../components/ui/Modal'
import type { ListQueryParams } from '../../../hooks/useListParams'
import type { BadgeTone } from '../../../lib/status'
import { formatDateTime, parseApiError } from '../../../lib/utils'
import { useListUsersQuery } from '../../../services/adminApi'
import { useClearNotificationLogMutation, useNotificationLogQuery } from '../../../services/miscApi'
import type { NotificationLogRow } from '../../../types/models'

/**
 * Activity Log → Notifications tab: every in-app alert the CRM raised (lead assigned, follow-up due,
 * untouched lead, bulk send finished, WhatsApp reply …), who got it, whether they have read it and how
 * its browser push went. Click a row for the full alert.
 */

const TYPE_LABELS: Record<string, string> = {
  lead_assigned: 'Lead assigned',
  lead_reassigned: 'Lead reassigned',
  task_due: 'Follow-up due',
  task_overdue: 'Follow-up overdue',
  payment: 'Payment',
  application: 'Application',
  interview: 'Interview',
  exam: 'Exam',
  system: 'System',
  re_enquiry: 'Re-enquiry',
  unassigned_pool: 'Unassigned pool',
  language_barrier: 'Language barrier',
  untouched: 'Untouched lead',
  bulk_done: 'Bulk send finished',
  export_ready: 'Export ready',
  integration_error: 'Integration error',
  whatsapp_reply: 'WhatsApp reply',
}

const typeLabel = (type: string) => TYPE_LABELS[type] ?? type.replace(/_/g, ' ')

function typeTone(type: string): BadgeTone {
  if (['integration_error', 'task_overdue'].includes(type)) return 'red'
  if (['untouched', 'language_barrier', 'unassigned_pool', 'task_due'].includes(type)) return 'amber'
  if (['bulk_done', 'export_ready'].includes(type)) return 'green'
  if (type === 'whatsapp_reply') return 'violet'
  if (['lead_assigned', 'lead_reassigned', 're_enquiry'].includes(type)) return 'blue'
  return 'slate'
}

interface Props {
  query: ListQueryParams
  setParam: (key: string, value?: string | number) => void
  setFilters: (values: Record<string, string | number | undefined>) => void
  hasFilters: boolean
  resetFilters: () => void
}

export function NotificationsLog({ query, setParam, setFilters, hasFilters, resetFilters }: Props) {
  const { data: people } = useListUsersQuery({ page_size: 100, sort_by: 'name', sort_order: 'asc' })
  const { data, isLoading, isFetching, isError, error, refetch } = useNotificationLogQuery({ ...query, tab: undefined })
  const [selected, setSelected] = useState<NotificationLogRow | null>(null)
  // Super Admin's Clear All: empties this log only — nobody's bell or View All changes
  const superAdmin = !!useCurrentUser()?.isSuperAdmin
  const [clearLog, { isLoading: clearingLog }] = useClearNotificationLogMutation()
  const [clearing, setClearing] = useState(false)
  const onClearAll = async () => {
    try {
      const res = await clearLog().unwrap()
      const n = res.data.cleared
      toast.success(n ? `${n} notification${n === 1 ? '' : 's'} cleared from the log` : 'Nothing to clear')
      setClearing(false)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  const columns: Column<NotificationLogRow>[] = [
    { key: 'createdAt', header: 'When', render: (r) => <span className="text-xs text-slate-500">{formatDateTime(r.createdAt)}</span> },
    { key: 'user', header: 'To', render: (r) => <span className="text-xs font-medium">{r.user.name}</span> },
    { key: 'type', header: 'Type', render: (r) => <Badge tone={typeTone(r.type)}>{typeLabel(r.type)}</Badge> },
    {
      key: 'title',
      header: 'Alert',
      render: (r) => (
        <span className="block max-w-md truncate text-xs text-slate-600" title={r.body ? `${r.title} — ${r.body}` : r.title}>
          <span className="font-medium text-slate-700">{r.title}</span>
          {r.body ? ` — ${r.body}` : ''}
        </span>
      ),
    },
    {
      key: 'read',
      header: 'Read',
      render: (r) =>
        r.readAt ? (
          <Badge tone="green" dot title={formatDateTime(r.readAt)}>
            Read
          </Badge>
        ) : (
          <Badge tone="amber" dot>
            Unread
          </Badge>
        ),
    },
    {
      key: 'push',
      header: 'Push',
      render: (r) =>
        r.push ? (
          <StatusBadge status={r.push.status} label={`${r.push.status} · ${r.push.sent}/${r.push.attempts}`} className="capitalize" />
        ) : (
          <span className="text-xs text-slate-400">—</span>
        ),
    },
  ]

  return (
    <>
      <FilterBar
        end={
          <>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                Reset
              </Button>
            )}
            {superAdmin && !!data?.data.length && (
              <Button variant="outline" size="sm" onClick={() => setClearing(true)} title="Empty this log — nobody's bell changes">
                <Trash2 className="h-3.5 w-3.5" /> Clear All
              </Button>
            )}
          </>
        }
      >
        <SearchInput className="w-full sm:w-64" value={query.search ?? ''} onSearch={(v) => setParam('search', v)} placeholder="Alert text, lead, user…" />
        <Select className="!w-auto" value={(query.user as string) ?? ''} onChange={(e) => setParam('user', e.target.value)}>
          <option value="">All users</option>
          {people?.data.map((u) => (
            <option key={u._id} value={u._id}>
              {u.name}
            </option>
          ))}
        </Select>
        <Select className="!w-auto" value={(query.type as string) ?? ''} onChange={(e) => setParam('type', e.target.value)}>
          <option value="">All types</option>
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select className="!w-auto" value={(query.read as string) ?? ''} onChange={(e) => setParam('read', e.target.value)}>
          <option value="">Read and unread</option>
          <option value="false">Unread</option>
          <option value="true">Read</option>
        </Select>
        <DateRangeFilter
          from={(query.created_from as string) ?? ''}
          to={(query.created_to as string) ?? ''}
          onChange={(from, to) => setFilters({ created_from: from, created_to: to })}
        />
      </FilterBar>
      <DataTable
        columns={columns}
        rows={data?.data}
        rowKey={(r) => r._id}
        loading={isLoading || isFetching}
        error={isError}
        errorMessage={isError ? parseApiError(error).message : undefined}
        onRetry={refetch}
        emptyTitle="No notifications found"
        emptyDescription="No alert matches these filters."
        emptyAction={hasFilters ? <Button variant="outline" size="sm" onClick={resetFilters}>Clear filters</Button> : undefined}
        pagination={data?.pagination}
        onPageChange={(p) => setParam('page', p)}
        onPageSizeChange={(s) => setParam('page_size', s)}
        onRowClick={setSelected}
      />
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Notification" description={selected?.title} size="lg">
        {selected && <NotificationDetail row={selected} />}
      </Modal>
      <ConfirmDialog
        open={clearing}
        onClose={() => setClearing(false)}
        onConfirm={onClearAll}
        title="Clear the notification log?"
        message="Every notification listed here leaves this log. The users keep them in their own bell and View All."
        confirmLabel="Clear All"
        danger
        loading={clearingLog}
      />
    </>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-0.5 text-xs text-slate-700">{children ?? '—'}</div>
    </div>
  )
}

function NotificationDetail({ row }: { row: NotificationLogRow }) {
  const data = row.data ?? {}
  return (
    <div className="space-y-4 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={typeTone(row.type)}>{typeLabel(row.type)}</Badge>
        {row.readAt ? (
          <Badge tone="green" dot>
            Read {formatDateTime(row.readAt)}
          </Badge>
        ) : (
          <Badge tone="amber" dot>
            Unread
          </Badge>
        )}
        <span className="ml-auto text-slate-400">{formatDateTime(row.createdAt)}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Fact label="To">
          {row.user.name}
          {row.user.email ? <span className="text-slate-400"> · {row.user.email}</span> : null}
        </Fact>
        <Fact label="Raised at">{formatDateTime(row.createdAt)}</Fact>
        <Fact label="Alert">
          <p className="font-medium text-slate-800">{row.title}</p>
          {row.body && <p className="whitespace-pre-wrap text-slate-600">{row.body}</p>}
        </Fact>
        <Fact label="About">
          {data.leadId ? (
            <Link to={`/app/leads/${data.leadId}`} className="font-medium text-brand-700 hover:underline">
              Open the lead
            </Link>
          ) : null}
          {data.bulk && data.count ? <p>{data.count} leads{data.by ? ` · by ${data.by}` : ''}</p> : null}
          {data.taskId ? <p className="text-slate-500">Task {data.taskId}</p> : null}
          {data.url ? (
            <p>
              <Link to={data.url} className="text-brand-700 hover:underline">
                {data.url}
              </Link>
            </p>
          ) : null}
          {!data.leadId && !data.bulk && !data.taskId && !data.url ? '—' : null}
        </Fact>
        <Fact label="Browser push">
          {row.push ? (
            <div>
              <StatusBadge status={row.push.status} label={`${row.push.status} · ${row.push.sent} of ${row.push.attempts} device(s)`} className="capitalize" />
              <p className="mt-1 text-slate-500">
                via {row.push.provider} · last attempt {formatDateTime(row.push.lastAt)}
                {row.push.failed ? ` · ${row.push.failed} failed` : ''}
              </p>
              {row.push.error && <p className="text-red-600">{row.push.error}</p>}
            </div>
          ) : (
            <span className="text-slate-400">No push (type not pushed, or no device registered) — shown in the bell only</span>
          )}
        </Fact>
      </div>
      {row.data && (
        <details className="text-xs">
          <summary className="cursor-pointer text-slate-500 hover:text-slate-700">Raw data</summary>
          <pre className="mt-1 max-h-60 overflow-auto rounded-lg bg-slate-50 p-3">{JSON.stringify(row.data, null, 2)}</pre>
        </details>
      )}
    </div>
  )
}
