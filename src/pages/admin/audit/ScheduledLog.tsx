import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Badge, StatusBadge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { DataTable, type Column } from '../../../components/ui/DataTable'
import { DateRangeFilter } from '../../../components/ui/DateRangeFilter'
import { Select } from '../../../components/ui/fields'
import { FilterBar, SearchInput } from '../../../components/ui/misc'
import { Modal } from '../../../components/ui/Modal'
import type { ListQueryParams } from '../../../hooks/useListParams'
import { formatDateTime, parseApiError } from '../../../lib/utils'
import { useListUsersQuery } from '../../../services/adminApi'
import {
  useCancelCampaignMutation,
  useCancelScheduledMessageMutation,
  useScheduledSendsQuery,
  useSendCampaignNowMutation,
  useSendScheduledMessageNowMutation,
} from '../../../services/messagingApi'
import type { ScheduledSend } from '../../../types/models'
import { ChannelBadge } from './CommunicationDetails'

/**
 * Activity Log → Scheduled: every SMS / email / WhatsApp that is waiting for its time — bulk sends and
 * single messages in one list, soonest first — with Cancel and Send now. Once a send goes out it leaves
 * this tab and shows up under Communications as sent / delivered.
 */

const CHANNEL_OPTIONS = [
  ['sms', 'SMS'],
  ['email', 'Email'],
  ['whatsapp', 'WhatsApp'],
]

/** "in 2 h 15 m", "in 3 days", "due now" — how far away a scheduled time is. */
function untilText(value: string): string {
  const diff = new Date(value).getTime() - Date.now()
  if (diff <= 0) return 'due now'
  const minutes = Math.round(diff / 60_000)
  if (minutes < 60) return `in ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `in ${hours} h ${minutes % 60} m`
  const days = Math.floor(hours / 24)
  return `in ${days} day${days === 1 ? '' : 's'}`
}

interface Props {
  query: ListQueryParams
  setParam: (key: string, value?: string | number) => void
  setFilters: (values: Record<string, string | number | undefined>) => void
  hasFilters: boolean
  resetFilters: () => void
}

export function ScheduledLog({ query, setParam, setFilters, hasFilters, resetFilters }: Props) {
  const status = (query.status as string) || 'pending'
  const { data: people } = useListUsersQuery({ page_size: 100, sort_by: 'name', sort_order: 'asc' })
  const { data, isLoading, isFetching, isError, error, refetch } = useScheduledSendsQuery(
    { ...query, tab: undefined, status },
    { pollingInterval: 30_000 }
  )
  const [selected, setSelected] = useState<ScheduledSend | null>(null)
  const [cancelMessage] = useCancelScheduledMessageMutation()
  const [sendMessageNow] = useSendScheduledMessageNowMutation()
  const [cancelCampaign] = useCancelCampaignMutation()
  const [sendCampaignNow] = useSendCampaignNowMutation()
  const [busy, setBusy] = useState<string | null>(null)

  const run = async (row: ScheduledSend, action: 'cancel' | 'now') => {
    if (busy) return
    setBusy(row._id)
    try {
      if (action === 'cancel') {
        if (row.kind === 'bulk') await cancelCampaign(row._id).unwrap()
        else await cancelMessage(row._id).unwrap()
        toast.success('Cancelled — it will not be sent')
      } else {
        const res = row.kind === 'bulk' ? await sendCampaignNow(row._id).unwrap() : await sendMessageNow(row._id).unwrap()
        toast.success(res.message)
      }
      setSelected(null)
    } catch (err) {
      toast.error(parseApiError(err).message)
    } finally {
      setBusy(null)
    }
  }

  const actions = (row: ScheduledSend) =>
    row.status === 'scheduled' ? (
      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        <Button variant="outline" size="sm" loading={busy === row._id} onClick={() => run(row, 'now')}>
          Send now
        </Button>
        <Button variant="ghost" size="sm" className="text-red-600" disabled={busy === row._id} onClick={() => run(row, 'cancel')}>
          Cancel
        </Button>
      </div>
    ) : null

  const columns: Column<ScheduledSend>[] = [
    {
      key: 'scheduledAt',
      header: 'Scheduled for',
      render: (r) => (
        <span className="text-xs">
          <span className="block font-medium text-slate-700">{formatDateTime(r.scheduledAt)}</span>
          {r.status === 'scheduled' && <span className="text-slate-400">{untilText(r.scheduledAt)}</span>}
        </span>
      ),
    },
    { key: 'channel', header: 'Channel', render: (r) => <ChannelBadge channel={r.channel} /> },
    {
      key: 'kind',
      header: 'To',
      render: (r) =>
        r.kind === 'bulk' ? (
          <span className="text-xs">
            <Badge tone="cyan">Bulk</Badge> <span className="font-medium text-slate-700">{r.recipients ?? '?'} recipients</span>
            <span className="block truncate text-slate-400" title={r.name}>
              {r.name}
            </span>
          </span>
        ) : (
          <span className="text-xs">
            <span className="font-medium text-slate-700">{r.lead?.name ?? '—'}</span>
            <span className="block text-slate-400">
              {r.lead?.leadNo}
              {r.to ? ` · ${r.to}` : ''}
            </span>
          </span>
        ),
    },
    { key: 'template', header: 'Template', render: (r) => <span className="text-xs">{r.template ?? 'Custom message'}</span> },
    { key: 'scheduledBy', header: 'Scheduled by', render: (r) => <span className="text-xs">{r.scheduledBy ?? '—'}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    { key: 'actions', header: '', align: 'right', render: actions },
  ]

  return (
    <>
      <FilterBar
        end={
          hasFilters ? (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Reset
            </Button>
          ) : undefined
        }
      >
        <SearchInput className="w-full sm:w-64" value={query.search ?? ''} onSearch={(v) => setParam('search', v)} placeholder="Lead, mobile, template, bulk send…" />
        <Select className="!w-auto" value={status} onChange={(e) => setParam('status', e.target.value === 'pending' ? '' : e.target.value)}>
          <option value="pending">Waiting to go out</option>
          <option value="cancelled">Cancelled</option>
          <option value="all">Waiting + cancelled</option>
        </Select>
        <Select className="!w-auto" value={(query.channel as string) ?? ''} onChange={(e) => setParam('channel', e.target.value)}>
          <option value="">All channels</option>
          {CHANNEL_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select className="!w-auto" value={(query.actor as string) ?? ''} onChange={(e) => setParam('actor', e.target.value)}>
          <option value="">Scheduled by anyone</option>
          {people?.data.map((u) => (
            <option key={u._id} value={u._id}>
              {u.name}
            </option>
          ))}
        </Select>
        <DateRangeFilter
          label="Scheduled Date"
          heading="Scheduled Between"
          from={(query.scheduled_from as string) ?? ''}
          to={(query.scheduled_to as string) ?? ''}
          onChange={(from, to) => setFilters({ scheduled_from: from, scheduled_to: to })}
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
        emptyTitle={status === 'cancelled' ? 'Nothing was cancelled' : 'Nothing is scheduled'}
        emptyDescription={
          status === 'cancelled'
            ? 'Cancelled sends will be listed here.'
            : 'Schedule an SMS, email or WhatsApp from a lead (Send → Schedule) or a bulk send from the lead list, and it will wait here.'
        }
        emptyAction={hasFilters ? <Button variant="outline" size="sm" onClick={resetFilters}>Clear filters</Button> : undefined}
        pagination={data?.pagination}
        onPageChange={(p) => setParam('page', p)}
        onPageSizeChange={(s) => setParam('page_size', s)}
        onRowClick={setSelected}
      />
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.kind === 'bulk' ? 'Scheduled bulk send' : 'Scheduled message'}
        description={selected ? `${formatDateTime(selected.scheduledAt)}${selected.status === 'scheduled' ? ` · ${untilText(selected.scheduledAt)}` : ''}` : undefined}
        size="lg"
        footer={selected ? actions(selected) : undefined}
      >
        {selected && <ScheduledDetail row={selected} />}
      </Modal>
    </>
  )
}

function Fact({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-0.5 text-xs text-slate-700">{children ?? '—'}</div>
    </div>
  )
}

function ScheduledDetail({ row }: { row: ScheduledSend }) {
  return (
    <div className="space-y-4 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <ChannelBadge channel={row.channel} />
        {row.kind === 'bulk' && <Badge tone="cyan">Bulk</Badge>}
        <StatusBadge status={row.status} />
        {row.error && <span className="text-red-600">{row.error}</span>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Fact label="Scheduled for">{formatDateTime(row.scheduledAt)}</Fact>
        <Fact label="Scheduled by">
          {row.scheduledBy ?? '—'} <span className="text-slate-400">· {formatDateTime(row.createdAt)}</span>
        </Fact>
        <Fact label="Template">{row.template ?? 'Custom message'}</Fact>
        {row.kind === 'bulk' ? (
          <Fact label="Audience">
            <b>{row.recipients ?? '?'} recipients</b>
            {row.excluded ? (
              <span className="text-slate-400">
                {' '}
                · excluded {row.excluded.optedOut} opted out, {row.excluded.invalid} invalid, {row.excluded.duplicate} duplicate
              </span>
            ) : null}
            <span className="block text-slate-500">{row.name}</span>
          </Fact>
        ) : (
          <Fact label="To">
            {row.lead ? (
              <>
                <Link to={`/app/leads/${row.lead._id}`} className="font-medium text-brand-700 hover:underline">
                  {row.lead.name}
                </Link>
                <span className="text-slate-400"> · {row.lead.leadNo}</span>
                <span className="block text-slate-500">
                  {row.to ?? '—'}
                  {row.lead.owner ? ` · Counsellor: ${row.lead.owner}` : ''}
                </span>
              </>
            ) : (
              '—'
            )}
          </Fact>
        )}
      </div>
      {row.variables && row.variables.length > 0 && (
        <Fact label="Template values">
          {row.variables.map((v, i) => (
            <Badge key={i} className="mb-1 mr-1">
              {i + 1}: {v}
            </Badge>
          ))}
        </Fact>
      )}
      {row.kind === 'single' && (row.body || row.subject) && (
        <Fact label="Message (as it stands now; SMS / WhatsApp lead fields are filled again when it goes out)">
          <div className="rounded-lg border border-slate-200 bg-slate-50">
            {row.subject && <p className="border-b border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">{row.subject}</p>}
            {row.channel === 'email' ? (
              <iframe title="Email body" sandbox="" srcDoc={row.body} className="h-56 w-full rounded-b-lg bg-white" />
            ) : (
              <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words px-3 py-2 font-sans text-xs text-slate-700">{row.body}</pre>
            )}
          </div>
        </Fact>
      )}
      {row.kind === 'bulk' && (
        <p className="text-slate-500">The recipients are rendered and sent in batches when the time comes; the report then appears under Communications.</p>
      )}
    </div>
  )
}
