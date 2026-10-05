import { useState } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
  useDeactivateUserMutation,
  useListUsersQuery,
  useReactivateUserMutation,
  useResendCredentialsMutation,
} from '../../../services/adminApi'
import { useCurrentUser } from '../../../app/hooks'
import { can } from '../../../constants/permissions'
import { DataTable, type Column } from '../../../components/ui/DataTable'
import { PageHeader, SearchInput } from '../../../components/ui/misc'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Select } from '../../../components/ui/fields'
import { ConfirmDialog } from '../../../components/ui/feedback'
import { formatDateTime, parseApiError, timeAgo } from '../../../lib/utils'
import type { User } from '../../../types/models'
import { UserFormDrawer } from './UserFormDrawer'
import { useListParams } from '../../../hooks/useListParams'

const ROLE_TONE = { super_admin: 'violet', admin: 'blue', counsellor: 'green', other: 'slate' } as const

/** GL-03 Manage users: no hard delete; deactivate / reactivate; resend credentials. */
export default function UsersPage() {
  const me = useCurrentUser()
  const { query, setParam, onSort } = useListParams({ sort_by: 'name', sort_order: 'asc' }, ['role', 'is_active'])
  const { data, isLoading, isFetching, isError, error, refetch } = useListUsersQuery(query)
  const [deactivate, { isLoading: deactivating }] = useDeactivateUserMutation()
  const [reactivate] = useReactivateUserMutation()
  const [resend] = useResendCredentialsMutation()
  const [editing, setEditing] = useState<User | undefined>()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [confirmUser, setConfirmUser] = useState<User | null>(null)

  const run = async (fn: () => Promise<{ message: string }>) => {
    try {
      toast.success((await fn()).message)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  const onDeactivate = async () => {
    if (!confirmUser) return
    await run(() => deactivate(confirmUser._id).unwrap())
    setConfirmUser(null)
  }

  const columns: Column<User>[] = [
    { key: 'name', header: 'Name', sortable: true, render: (u) => <span className="font-medium text-slate-800">{u.name}</span> },
    { key: 'email', header: 'Email', sortable: true, render: (u) => <span className="text-xs text-slate-600">{u.email}</span> },
    { key: 'designation', header: 'Designation', render: (u) => <span className="text-xs text-slate-600">{u.designation ?? '—'}</span> },
    {
      key: 'role',
      header: 'Role',
      render: (u) => (
        <Badge tone={ROLE_TONE[(u.isSuperAdmin ? 'super_admin' : u.role ?? 'other') as keyof typeof ROLE_TONE]}>
          {u.isSuperAdmin ? 'Super Admin' : u.roleLabel ?? 'Custom access'}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (u) => (
        <div className="flex flex-wrap gap-1">
          <Badge tone={u.isActive ? 'green' : 'red'}>{u.isActive ? 'Active' : 'Inactive'}</Badge>
          {u.mustChangePassword && u.isActive && <Badge tone="amber">Password pending</Badge>}
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
      className: 'text-right',
      render: (u) =>
        u.isSuperAdmin && u._id !== me?._id ? null : (
          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {can(me, 'users', 'edit') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(u)
                  setDrawerOpen(true)
                }}
              >
                Edit
              </Button>
            )}
            {can(me, 'users', 'edit') && u.isActive && u._id !== me?._id && (
              <Button variant="ghost" size="sm" onClick={() => run(() => resend(u._id).unwrap())}>
                Resend credentials
              </Button>
            )}
            {can(me, 'users', 'delete') && u._id !== me?._id &&
              (u.isActive ? (
                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setConfirmUser(u)}>
                  Deactivate
                </Button>
              ) : (
                <Button variant="ghost" size="sm" className="text-emerald-700" onClick={() => run(() => reactivate(u._id).unwrap())}>
                  Reactivate
                </Button>
              ))}
          </div>
        ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Users"
        description={me?.isSuperAdmin ? 'Create Admins and Admission Counsellors — login credentials are emailed automatically' : 'Create Admission Counsellors — login credentials are emailed automatically'}
        actions={
          can(me, 'users', 'create') && (
            <Button
              size="sm"
              onClick={() => {
                setEditing(undefined)
                setDrawerOpen(true)
              }}
            >
              <Plus className="h-3.5 w-3.5" /> Create user
            </Button>
          )
        }
      />

      <div className="mb-3 flex flex-wrap gap-2">
        <SearchInput className="w-64" value={query.search ?? ''} onSearch={(v) => setParam('search', v)} placeholder="Name, email, mobile…" />
        <Select className="!w-auto" value={(query.role as string) ?? ''} onChange={(e) => setParam('role', e.target.value)}>
          <option value="">All roles</option>
          <option value="admin">Admin</option>
          <option value="counsellor">Admission Counsellor</option>
          <option value="other">Custom access</option>
        </Select>
        <Select className="!w-auto" value={(query.is_active as string) ?? ''} onChange={(e) => setParam('is_active', e.target.value)}>
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={data?.data}
        rowKey={(u) => u._id}
        loading={isLoading || isFetching}
        error={isError}
        errorMessage={isError ? parseApiError(error).message : undefined}
        onRetry={refetch}
        emptyTitle="No users found"
        sortBy={query.sort_by}
        sortOrder={query.sort_order}
        onSort={onSort}
        pagination={data?.pagination}
        onPageChange={(p) => setParam('page', p)}
        onPageSizeChange={(s) => setParam('page_size', s)}
      />

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
