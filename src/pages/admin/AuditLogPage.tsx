import { useState } from 'react'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../components/ui/Button'
import { authorizedDownload } from '../../lib/download'
import { useListUsersQuery } from '../../services/adminApi'
import { useListAuditLogsQuery } from '../../services/adminApi'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { FilterBar, PageHeader, SearchInput } from '../../components/ui/misc'
import { useSearchParams } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Input, Select } from '../../components/ui/fields'
import { Modal } from '../../components/ui/Modal'
import { formatDateTime, parseApiError } from '../../lib/utils'
import { useListParams } from '../../hooks/useListParams'
import type { AuditLogEntry } from '../../types/models'

const MODULE_OPTIONS = ['users', 'leads', 'tasks', 'communications', 'integrations', 'teams', 'masters']
// GL-28: logins/logouts, users created/deactivated, assignments, uploads, bulk sends, exports, template & automation changes
const ACTION_OPTIONS = ['login', 'logout', 'create', 'update', 'deactivate', 'reactivate', 'resend_credentials', 'assign', 'bulk_assign', 'disposition', 'import', 'export', 'bulk_send', 'message_send', 'template_create', 'template_update', 'automation_update', 'meta_mapping_update', 'change_password']

export default function AuditLogPage() {
  const { query, setParam } = useListParams({ sort_by: 'createdAt', sort_order: 'desc' }, [
    'module',
    'action',
    'created_from',
    'created_to',
    'actor',
  ])
  const [, setSearchParams] = useSearchParams()
  const hasFilters = ['search', 'actor', 'module', 'action', 'created_from', 'created_to'].some((k) => query[k])
  const resetFilters = () => setSearchParams(new URLSearchParams(), { replace: true })
  const { data: people } = useListUsersQuery({ page_size: 100, sort_by: 'name', sort_order: 'asc' })
  const exportCsv = () => {
    const qs = new URLSearchParams(Object.entries(query).filter(([k, v]) => v && !['page', 'page_size', 'sort_by', 'sort_order'].includes(k)).map(([k, v]) => [k, String(v)]))
    authorizedDownload(`/audit-logs/export?${qs.toString()}`, 'activity-log.csv').catch((e) => toast.error(parseApiError(e).message))
  }
  const { data, isLoading, isFetching, isError, error, refetch } = useListAuditLogsQuery(query)
  const [selected, setSelected] = useState<AuditLogEntry | null>(null)

  const columns: Column<AuditLogEntry>[] = [
    { key: 'createdAt', header: 'When', render: (r) => <span className="text-xs text-slate-500">{formatDateTime(r.createdAt)}</span> },
    { key: 'actorName', header: 'Who', render: (r) => <span className="text-xs font-medium">{r.actor?.name ?? r.actorName}</span> },
    {
      key: 'action',
      header: 'Action',
      render: (r) => (
        <Badge tone={r.action === 'delete' || r.action === 'deactivate' ? 'red' : r.action === 'create' ? 'green' : 'slate'}>
          {r.action.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    { key: 'module', header: 'Module', render: (r) => <span className="text-xs">{r.module}</span> },
    {
      key: 'entity',
      header: 'Record',
      render: (r) => (
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
        description="Logins and logouts, user changes, assignments, uploads, bulk sends, exports and template/automation changes — who, what, when (IST), from where"
        actions={
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
        }
      />
      <FilterBar
        end={
          hasFilters ? (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Reset
            </Button>
          ) : undefined
        }
      >
        <SearchInput className="w-full sm:w-56" value={query.search ?? ''} onSearch={(v) => setParam('search', v)} placeholder="Actor, record id…" />
        <Select className="!w-auto" value={(query.actor as string) ?? ''} onChange={(e) => setParam('actor', e.target.value)}>
          <option value="">All users</option>
          {people?.data.map((u) => (
            <option key={u._id} value={u._id}>
              {u.name}
            </option>
          ))}
        </Select>
        <Select className="!w-auto" value={(query.module as string) ?? ''} onChange={(e) => setParam('module', e.target.value)}>
          <option value="">All modules</option>
          {MODULE_OPTIONS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </Select>
        <Select className="!w-auto" value={(query.action as string) ?? ''} onChange={(e) => setParam('action', e.target.value)}>
          <option value="">All actions</option>
          {ACTION_OPTIONS.map((a) => (
            <option key={a} value={a}>
              {a.replace(/_/g, ' ')}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          From
          <Input type="date" className="!w-auto" value={(query.created_from as string) ?? ''} onChange={(e) => setParam('created_from', e.target.value)} />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-500">
          To
          <Input type="date" className="!w-auto" value={(query.created_to as string) ?? ''} onChange={(e) => setParam('created_to', e.target.value)} />
        </label>
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
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Audit entry" size="lg">
        {selected && (
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
          </div>
        )}
      </Modal>
    </>
  )
}
