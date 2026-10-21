import { useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { authorizedDownload } from '../../lib/download'
import { useListUsersQuery } from '../../services/adminApi'
import { useListAuditLogsQuery } from '../../services/adminApi'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { FilterBar, PageHeader, SearchInput, Tabs } from '../../components/ui/misc'
import { useSearchParams } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { DateRangeFilter } from '../../components/ui/DateRangeFilter'
import { Select } from '../../components/ui/fields'
import { Modal } from '../../components/ui/Modal'
import type { BadgeTone } from '../../lib/status'
import { formatDateTime, parseApiError } from '../../lib/utils'
import { useListParams } from '../../hooks/useListParams'
import type { AuditLogEntry } from '../../types/models'
import { CampaignAuditDetail, MessageAuditDetail } from './audit/CommunicationDetails'
import { NotificationsLog } from './audit/NotificationsLog'
import { ScheduledLog } from './audit/ScheduledLog'

/**
 * GL-28 Activity Log in four tabs: everything, the users' and system's actions (logins, users, leads,
 * tasks, uploads, exports …), the communications (every SMS / email / WhatsApp: sent, delivered, failed,
 * replied, opted out, bulk sends) and the notifications the CRM raised for its users.
 */
type Tab = 'all' | 'activity' | 'communications' | 'scheduled' | 'notifications'
const TABS: { key: Tab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'activity', label: 'Activity' },
  { key: 'communications', label: 'Communications' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'notifications', label: 'Notifications' },
]
const DESCRIPTIONS: Record<Tab, string> = {
  all: 'Everything the CRM recorded — who, what, when (IST), from where. Click a row for the full detail.',
  activity: 'Logins and logouts, user changes, lead assignments and dispositions, uploads, exports, master and integration changes.',
  communications: 'Every SMS, email and WhatsApp message — sent, delivered, failed, replied, opted out — and every bulk send with its recipients.',
  scheduled: 'SMS, emails and WhatsApp messages waiting for their time — bulk sends and single messages — with Cancel and Send now. Once sent they move to Communications.',
  notifications: 'The alerts the CRM raised for its users — lead assigned, follow-up due, untouched lead, bulk send finished, WhatsApp reply — who got them, read or not, and how the push went.',
}

const MODULE_OPTIONS = ['users', 'leads', 'tasks', 'communications', 'integrations', 'teams', 'masters']
const ACTIVITY_ACTIONS = [
  'login', 'logout', 'create', 'update', 'delete', 'deactivate', 'reactivate', 'resend_credentials', 'assign', 'bulk_assign',
  'disposition', 'import', 'export', 'meta_mapping_update', 'change_password',
]
const COMMUNICATION_ACTIONS = [
  'message_send', 'message_sent', 'message_delivered', 'message_failed', 'message_received', 'opt_out',
  'message_schedule', 'message_schedule_cancel', 'bulk_send', 'bulk_send_now', 'bulk_send_done', 'bulk_send_cancel',
  'template_create', 'template_update', 'automation_update', 'whatsapp_template_sync', 'whatsapp_template_submit', 'whatsapp_template_edit', 'saved_text_create', 'saved_text_update', 'saved_text_delete', 'asset_upload', 'asset_delete', 'email_test',
]
const CHANNEL_OPTIONS = [
  ['sms', 'SMS'],
  ['email', 'Email'],
  ['whatsapp', 'WhatsApp'],
]
const FILTER_KEYS = [
  'search', 'actor', 'module', 'action', 'channel', 'created_from', 'created_to', 'user', 'type', 'read', 'status', 'scheduled_from', 'scheduled_to',
]
const LOG_TABS: Tab[] = ['all', 'activity', 'communications']  // the audit-entry tabs; the others have their own lists

/** Which entries open the SMS / email / WhatsApp drill-down instead of the raw before / after view. */
function communicationKind(entry: AuditLogEntry): 'message' | 'campaign' | null {
  if (entry.module !== 'communications') return null
  if (entry.entityType === 'Message') return 'message'
  if (entry.entityType === 'Campaign') return 'campaign'
  return null
}

function actionTone(action: string): BadgeTone {
  if (['delete', 'deactivate', 'message_failed', 'bulk_send_cancel', 'message_schedule_cancel', 'opt_out'].includes(action)) return 'red'
  if (['create', 'message_delivered', 'bulk_send_done'].includes(action)) return 'green'
  if (action === 'message_schedule') return 'amber'
  if (action === 'message_received') return 'violet'
  if (action.startsWith('message_')) return 'blue'
  if (action.startsWith('bulk_send')) return 'cyan'
  return 'slate'
}

export default function AuditLogPage() {
  const { query, setParam, setFilters } = useListParams({ sort_by: 'createdAt', sort_order: 'desc' }, ['tab', ...FILTER_KEYS])
  const [, setSearchParams] = useSearchParams()
  const tab: Tab = (TABS.find((t) => t.key === query.tab)?.key ?? 'all') as Tab
  const hasFilters = FILTER_KEYS.some((k) => query[k])
  const tabParams = (key: Tab) => (key === 'all' ? new URLSearchParams() : new URLSearchParams({ tab: key }))
  const resetFilters = () => setSearchParams(tabParams(tab), { replace: true })
  const switchTab = (key: string) => setSearchParams(tabParams(key as Tab), { replace: true })

  // the Communications tab is the communications module; the Activity tab is everything else
  const auditQuery = {
    ...query,
    tab: undefined, user: undefined, type: undefined, read: undefined, status: undefined, scheduled_from: undefined, scheduled_to: undefined,
    ...(tab === 'communications' ? { module: 'communications' } : {}),
    ...(tab === 'activity' ? { exclude_module: 'communications' } : {}),
  }
  const actionOptions = tab === 'communications' ? COMMUNICATION_ACTIONS : tab === 'activity' ? ACTIVITY_ACTIONS : [...ACTIVITY_ACTIONS, ...COMMUNICATION_ACTIONS]

  const { data: people } = useListUsersQuery({ page_size: 100, sort_by: 'name', sort_order: 'asc' })
  const exportCsv = () => {
    const qs = new URLSearchParams(
      Object.entries(auditQuery).filter(([k, v]) => v && !['page', 'page_size', 'sort_by', 'sort_order'].includes(k)).map(([k, v]) => [k, String(v)])
    )
    authorizedDownload(`/audit-logs/export?${qs.toString()}`, 'activity-log.csv').catch((e) => toast.error(parseApiError(e).message))
  }
  const { data, isLoading, isFetching, isError, error, refetch } = useListAuditLogsQuery(auditQuery, { skip: !LOG_TABS.includes(tab) })
  const [selected, setSelected] = useState<AuditLogEntry | null>(null)
  const selectedKind = selected ? communicationKind(selected) : null

  const columns: Column<AuditLogEntry>[] = [
    { key: 'createdAt', header: 'When', render: (r) => <span className="text-xs text-slate-500">{formatDateTime(r.createdAt)}</span> },
    { key: 'actorName', header: 'Who', render: (r) => <span className="text-xs font-medium">{r.actor?.name ?? r.actorName}</span> },
    {
      key: 'action',
      header: 'Action',
      render: (r) => <Badge tone={actionTone(r.action)}>{r.action.replace(/_/g, ' ')}</Badge>,
    },
    ...(tab === 'communications' ? [] : [{ key: 'module', header: 'Module', render: (r: AuditLogEntry) => <span className="text-xs">{r.module}</span> }]),
    {
      key: 'entity',
      header: 'Details',
      render: (r) =>
        r.summary ? (
          <span className="block max-w-md truncate text-xs text-slate-600" title={r.summary}>
            {r.summary}
          </span>
        ) : (
          <span className="text-xs text-slate-500">
            {r.entityType ?? '—'} {r.entityId ? `· ${r.entityId.slice(-6)}` : ''}
          </span>
        ),
    },
    { key: 'ip', header: 'IP', render: (r) => <span className="text-xs text-slate-400">{r.ip ?? '—'}</span> },
  ]

  return (
    <>
      <PageHeader
        title="Activity Log"
        description={DESCRIPTIONS[tab]}
        actions={
          LOG_TABS.includes(tab) ? (
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          ) : undefined
        }
      />
      <div className="mb-4">
        <Tabs tabs={TABS} active={tab} onChange={switchTab} />
      </div>
      {tab === 'notifications' ? (
        <NotificationsLog query={query} setParam={setParam} setFilters={setFilters} hasFilters={hasFilters} resetFilters={resetFilters} />
      ) : tab === 'scheduled' ? (
        <ScheduledLog query={query} setParam={setParam} setFilters={setFilters} hasFilters={hasFilters} resetFilters={resetFilters} />
      ) : (
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
            <SearchInput
              className="w-full sm:w-64"
              value={query.search ?? ''}
              onSearch={(v) => setParam('search', v)}
              placeholder={tab === 'communications' ? 'Lead name, mobile, email, template…' : 'User, lead name, record id…'}
            />
            <Select className="!w-auto" value={(query.actor as string) ?? ''} onChange={(e) => setParam('actor', e.target.value)}>
              <option value="">All users</option>
              {people?.data.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name}
                </option>
              ))}
            </Select>
            {tab !== 'communications' && (
              <Select className="!w-auto" value={(query.module as string) ?? ''} onChange={(e) => setParam('module', e.target.value)}>
                <option value="">All modules</option>
                {MODULE_OPTIONS.filter((m) => tab === 'all' || m !== 'communications').map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </Select>
            )}
            <Select className="!w-auto" value={(query.action as string) ?? ''} onChange={(e) => setParam('action', e.target.value)}>
              <option value="">All actions</option>
              {actionOptions.map((a) => (
                <option key={a} value={a}>
                  {a.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>
            {tab !== 'activity' && (
              <Select className="!w-auto" value={(query.channel as string) ?? ''} onChange={(e) => setParam('channel', e.target.value)} title="SMS / email / WhatsApp entries">
                <option value="">All channels</option>
                {CHANNEL_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
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
            emptyTitle="No activity found"
            emptyDescription="No activity matches these filters."
            emptyAction={hasFilters ? <Button variant="outline" size="sm" onClick={resetFilters}>Clear filters</Button> : undefined}
            pagination={data?.pagination}
            onPageChange={(p) => setParam('page', p)}
            onPageSizeChange={(s) => setParam('page_size', s)}
            onRowClick={setSelected}
          />
          <Modal
            open={!!selected}
            onClose={() => setSelected(null)}
            title={selectedKind === 'message' ? 'Message details' : selectedKind === 'campaign' ? 'Bulk send details' : 'Audit entry'}
            description={selected?.summary}
            size={selectedKind ? 'xl' : 'lg'}
          >
            {selected && selectedKind === 'message' && <MessageAuditDetail entry={selected} />}
            {selected && selectedKind === 'campaign' && <CampaignAuditDetail entry={selected} />}
            {selected && !selectedKind && (
              <div className="space-y-3 text-xs">
                <p>
                  <b>{selected.actor?.name ?? selected.actorName}</b> · {selected.action} · {selected.module} ·{' '}
                  {formatDateTime(selected.createdAt)}
                </p>
                {selected.before !== undefined && (
                  <div>
                    <p className="mb-1 font-semibold text-slate-600">Before</p>
                    <pre className="max-h-60 overflow-auto rounded-lg bg-slate-50 p-3">{JSON.stringify(selected.before, null, 2)}</pre>
                  </div>
                )}
                {selected.after !== undefined && (
                  <div>
                    <p className="mb-1 font-semibold text-slate-600">After</p>
                    <pre className="max-h-60 overflow-auto rounded-lg bg-slate-50 p-3">{JSON.stringify(selected.after, null, 2)}</pre>
                  </div>
                )}
                <p className="text-[11px] text-slate-400">
                  IP {selected.ip ?? '—'}
                  {selected.userAgent ? ` · ${selected.userAgent}` : ''}
                </p>
              </div>
            )}
          </Modal>
        </>
      )}
    </>
  )
}
