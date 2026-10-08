import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Pencil, Plus, Send, UserCheck, UserX } from 'lucide-react'
import { toast } from 'sonner'
import {
  useDeactivateUserMutation,
  useListUsersQuery,
  useReactivateUserMutation,
  useResendCredentialsMutation,
  useTeamOptionsQuery,
} from '../../../services/adminApi'
import { useCurrentUser } from '../../../app/hooks'
import { can, DATA_SCOPES } from '../../../constants/permissions'
import { DataTable, type Column } from '../../../components/ui/DataTable'
import { FilterBar, PageHeader, SearchInput, Tabs } from '../../../components/ui/misc'
import { RowActions } from '../../../components/ui/RowActions'
import { Badge, StatusBadge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Select } from '../../../components/ui/fields'
import { ConfirmDialog } from '../../../components/ui/feedback'
import { formatDateTime, parseApiError, timeAgo } from '../../../lib/utils'
import type { User } from '../../../types/models'
import { useListParams } from '../../../hooks/useListParams'
import { UserFormDrawer } from './UserFormDrawer'
import { RoleTemplates } from './RoleTemplates'

const ROLE_TONE = { super_admin: 'violet', admin: 'blue', counsellor: 'green', other: 'slate' } as const
const refName = (v: User['team'] | User['reportingManager']) => (typeof v === 'object' && v ? v.name : null)

/**
 * Admin & User Management (SOW #1–#7, Go-live GL-01..05): users with team,
 * reporting manager, role / custom access, data scope, round-robin and status.
 * No hard delete — deactivate / reactivate; resend credentials.
 */
export default function UsersPage() {
  const me = useCurrentUser()
  const [params, setSearchParams] = useSearchParams()
  const tab = me?.isSuperAdmin && params.get('tab') === 'templates' ? 'templates' : 'users'
  const { query, setParam, onSort } = useListParams({ sort_by: 'name', sort_order: 'asc' }, ['role', 'team', 'is_active'])
  const { data, isLoading, isFetching, isError, error, refetch } = useListUsersQuery(query, { skip: tab !== 'users' })
  const { data: teams } = useTeamOptionsQuery()
  const [deactivate, { isLoading: deactivating }] = useDeactivateUserMutation()
  const [reactivate] = useReactivateUserMutation()
  const [resend] = useResendCredentialsMutation()
  const [editing, setEditing] = useState<User | undefined>()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [confirmUser, setConfirmUser] = useState<User | null>(null)
  const hasFilters = !!(query.search || query.role || query.team || query.is_active)
  const resetFilters = () => setSearchParams(new URLSearchParams(), { replace: true })

  const run = async (fn: () => Promise<{ message: string }>) => {
    try {
      toast.success((await fn()).message)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  const openEdit = (u?: User) => {
    setEditing(u)
    setDrawerOpen(true)
  }

  const onDeactivate = async () => {
    if (!confirmUser) return
    await run(() => deactivate(confirmUser._id).unwrap())
    setConfirmUser(null)
  }

  const canEditRow = (u: User) => can(me, 'users', 'edit') && (!u.isSuperAdmin || u._id === me?._id)

  const columns: Column<User>[] = [
    {
      key: 'name',
      header: 'User',
      sortable: true,
      render: (u) => (
        <div className="min-w-0">
          <p className="font-medium text-slate-800">{u.name}</p>
          <p className="text-[11px] text-slate-500">{u.email}</p>
        </div>
      ),
    },
    { key: 'designation', header: 'Designation', render: (u) => <span className="text-xs text-slate-600">{u.designation ?? '—'}</span> },
    {
      key: 'role',
      header: 'Role & access',
      render: (u) =>
        u.isSuperAdmin ? (
          <Badge tone="violet">Super Admin</Badge>
        ) : (
          <div className="flex flex-col items-start gap-0.5">
            <Badge tone={ROLE_TONE[(u.role ?? 'other') as keyof typeof ROLE_TONE]}>
              {u.role === 'other' ? (u.templateKey ? u.templateKey.replace(/-/g, ' ') : 'Custom access') : u.roleLabel ?? 'Custom access'}
            </Badge>
            <span className="text-[11px] text-slate-500">
              {u.permissions.length} modules · {DATA_SCOPES.find((s) => s.key === u.dataScope)?.label ?? u.dataScope}
              {u.fieldRules.length ? ` · ${u.fieldRules.length} masked` : ''}
            </span>
          </div>
        ),
    },
    {
      key: 'team',
      header: 'Team · Manager',
      render: (u) => (
        <div className="text-xs">
          <p className="text-slate-700">{refName(u.team) ?? '—'}</p>
          {refName(u.reportingManager) && <p className="text-[11px] text-slate-500">Reports to {refName(u.reportingManager)}</p>}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (u) => (
        <div className="flex flex-wrap gap-1">
          <StatusBadge status={u.isActive ? 'active' : 'inactive'} />
          {u.receivesLeads && u.isActive && <Badge tone="cyan">Round-robin</Badge>}
          {u.mustChangePassword && u.isActive && <StatusBadge status="pending" label="Password pending" />}
        </div>
      ),
    },
    {
      key: 'lastLoginAt',
      header: 'Last login',
      sortable: true,
      render: (u) => (
        <span className="text-xs text-slate-500" title={formatDateTime(u.lastLoginAt)}>
          {u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'Never'}
        </span>
      ),
    },
    { key: 'createdBy', header: 'Created by', render: (u) => <span className="text-xs text-slate-500">{u.createdBy?.name ?? 'System'}</span> },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      align: 'right',
      render: (u) => (
        <RowActions
          label={`Actions for ${u.name}`}
          actions={[
            { label: 'Edit', icon: Pencil, hidden: !canEditRow(u), onClick: () => openEdit(u) },
            {
              label: 'Resend credentials',
              icon: Send,
              hidden: !can(me, 'users', 'edit') || u.isSuperAdmin || !u.isActive || u._id === me?._id,
              onClick: () => run(() => resend(u._id).unwrap()),
            },
            {
              label: 'Reactivate',
              icon: UserCheck,
              hidden: !can(me, 'users', 'delete') || u.isActive || u._id === me?._id,
              onClick: () => run(() => reactivate(u._id).unwrap()),
            },
            {
              label: 'Deactivate',
              icon: UserX,
              danger: true,
              hidden: !can(me, 'users', 'delete') || u.isSuperAdmin || !u.isActive || u._id === me?._id,
              onClick: () => setConfirmUser(u),
            },
          ]}
        />
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Users & Access"
        description={
          me?.isSuperAdmin
            ? 'Create users, set their team and reporting manager, then pick a role or tick exactly what they can see and do.'
            : 'Create Admission Counsellors — login credentials are emailed automatically.'
        }
        actions={
          tab === 'users' &&
          can(me, 'users', 'create') && (
            <Button size="sm" onClick={() => openEdit(undefined)}>
              <Plus className="h-3.5 w-3.5" /> Create user
            </Button>
          )
        }
      />

      {me?.isSuperAdmin && (
        <div className="mb-4">
          <Tabs
            tabs={[
              { key: 'users', label: 'Users' },
              { key: 'templates', label: 'Role templates' },
            ]}
            active={tab}
            onChange={(key) => setSearchParams(key === 'templates' ? new URLSearchParams({ tab: 'templates' }) : new URLSearchParams(), { replace: true })}
          />
        </div>
      )}

      {tab === 'templates' ? (
        <RoleTemplates />
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
            <SearchInput className="w-full sm:w-64" value={query.search ?? ''} onSearch={(v) => setParam('search', v)} placeholder="Name, email, mobile…" />
            <Select className="!w-auto" value={(query.role as string) ?? ''} onChange={(e) => setParam('role', e.target.value)} aria-label="Role">
              <option value="">All roles</option>
              <option value="admin">Admin</option>
              <option value="counsellor">Admission Counsellor</option>
              <option value="other">Custom access</option>
            </Select>
            <Select className="!w-auto" value={(query.team as string) ?? ''} onChange={(e) => setParam('team', e.target.value)} aria-label="Team">
              <option value="">All teams</option>
              {teams?.data.map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
            </Select>
            <Select className="!w-auto" value={(query.is_active as string) ?? ''} onChange={(e) => setParam('is_active', e.target.value)} aria-label="Status">
              <option value="">All statuses</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </Select>
          </FilterBar>

          <DataTable
            columns={columns}
            rows={data?.data}
            rowKey={(u) => u._id}
            loading={isLoading || isFetching}
            error={isError}
            errorMessage={isError ? parseApiError(error).message : undefined}
            errorDetail={error}
            onRetry={refetch}
            emptyTitle="No users found"
            emptyDescription={hasFilters ? 'No users match these filters.' : 'Create the first user to get started.'}
            emptyAction={
              hasFilters ? (
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
            sortBy={query.sort_by}
            sortOrder={query.sort_order}
            onSort={onSort}
            pagination={data?.pagination}
            onPageChange={(p) => setParam('page', p)}
            onPageSizeChange={(s) => setParam('page_size', s)}
            onRowClick={(u) => canEditRow(u) && openEdit(u)}
          />
        </>
      )}

      {drawerOpen && <UserFormDrawer key={editing?._id ?? 'new'} open onClose={() => setDrawerOpen(false)} user={editing} />}
      <ConfirmDialog
        open={!!confirmUser}
        onClose={() => setConfirmUser(null)}
        onConfirm={onDeactivate}
        title="Deactivate user"
        message={`${confirmUser?.name} is signed out at once, can no longer log in and leaves round-robin. Their open leads appear under the "Owner inactive" filter for reassignment.`}
        confirmLabel="Deactivate"
        danger
        loading={deactivating}
      />
    </>
  )
}
