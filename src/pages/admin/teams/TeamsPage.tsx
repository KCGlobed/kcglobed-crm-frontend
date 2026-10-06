import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ban, ExternalLink, List, Network, PauseCircle, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { useDeleteTeamMutation, useListTeamsQuery, useTeamTreeQuery } from '../../../services/adminApi'
import { useCurrentUser } from '../../../app/hooks'
import { can } from '../../../constants/permissions'
import { DataTable, type Column } from '../../../components/ui/DataTable'
import { FilterBar, PageHeader, SearchInput } from '../../../components/ui/misc'
import { RowActions } from '../../../components/ui/RowActions'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { ConfirmDialog } from '../../../components/ui/feedback'
import { Checkbox, Select } from '../../../components/ui/fields'
import { cn, parseApiError } from '../../../lib/utils'
import { useListParams } from '../../../hooks/useListParams'
import type { Team } from '../../../types/models'
import { TeamFormDrawer } from './TeamFormDrawer'
import { TeamTree } from './TeamTree'
import { TeamTypeBadge } from './TeamTypeBadge'
import { TEAM_TYPES } from './teamMeta'

export default function TeamsPage() {
  const me = useCurrentUser()
  const navigate = useNavigate()
  const { query, setParam, onSort } = useListParams({ sort_by: 'name', sort_order: 'asc' }, [
    'is_active',
    'type',
    'view',
    'include_inactive',
  ])
  const view = query.view === 'tree' ? 'tree' : 'list'
  // view/include_inactive drive the page itself, not the /teams list call
  const listQuery = Object.fromEntries(Object.entries(query).filter(([k]) => k !== 'view' && k !== 'include_inactive'))

  const list = useListTeamsQuery(listQuery, { skip: view !== 'list' })
  const tree = useTeamTreeQuery({ include_inactive: query.include_inactive === 'true' }, { skip: view !== 'tree' })
  const [deleteTeam, { isLoading: deleting }] = useDeleteTeamMutation()
  const [formOpen, setFormOpen] = useState(false)
  const [confirm, setConfirm] = useState<Team | null>(null)

  const onDeactivate = async () => {
    if (!confirm) return
    try {
      await deleteTeam(confirm._id).unwrap()
      toast.success('Team deactivated')
      setConfirm(null)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  const columns: Column<Team>[] = [
    {
      key: 'name',
      header: 'Team',
      sortable: true,
      render: (t) => (
        <div className="min-w-40">
          <p className="font-medium text-slate-800">
            {t.name}
            {t.code && <span className="ml-1.5 text-[11px] font-normal text-slate-400">{t.code}</span>}
          </p>
          {t.description && <p className="line-clamp-1 text-[11px] text-slate-400">{t.description}</p>}
        </div>
      ),
    },
    { key: 'type', header: 'Type', sortable: true, render: (t) => <TeamTypeBadge type={t.type} /> },
    { key: 'manager', header: 'Manager', render: (t) => <span className="text-xs">{t.manager?.name ?? '—'}</span> },
    { key: 'parent', header: 'Reports into', render: (t) => <span className="text-xs">{t.parent?.name ?? '—'}</span> },
    { key: 'location', header: 'Location', render: (t) => <span className="text-xs">{t.location || '—'}</span> },
    {
      key: 'memberCount',
      header: 'Members',
      render: (t) => (
        <span className="text-xs tabular-nums">
          {t.memberCount ?? 0}
          {!!t.subTeamCount && <span className="text-slate-400"> · {t.subTeamCount} sub</span>}
        </span>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (t) => (
        <div className="flex flex-wrap gap-1">
          <Badge tone={t.isActive ? 'green' : 'slate'}>{t.isActive ? 'Active' : 'Inactive'}</Badge>
          {t.isActive && t.receivesLeads === false && (
            <Badge tone="amber" className="!px-1.5">
              <PauseCircle className="h-3 w-3" />
              <span className="sr-only">Lead distribution paused</span>
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-12',
      align: 'right',
      render: (t) => (
        <RowActions
          label={`Actions for ${t.name}`}
          actions={[
            { label: 'Open', icon: ExternalLink, onClick: () => navigate(`/app/admin/teams/${t._id}`) },
            { label: 'Deactivate', icon: Ban, danger: true, hidden: !can(me, 'teams', 'delete') || !t.isActive, onClick: () => setConfirm(t) },
          ]}
        />
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Teams & Hierarchy"
        description="Departments, teams and counsellor groups. Team data scope, dashboards and round-robin follow this structure."
        actions={
          can(me, 'teams', 'create') && (
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Create team
            </Button>
          )
        }
      />

      <FilterBar>
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5" role="tablist">
          {(
            [
              { key: 'list', label: 'List', icon: List },
              { key: 'tree', label: 'Hierarchy', icon: Network },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              onClick={() => setParam('view', key === 'list' ? '' : key)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium',
                view === key ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        {view === 'list' ? (
          <>
            <SearchInput
              className="w-full sm:w-64"
              value={query.search ?? ''}
              onSearch={(v) => setParam('search', v)}
              placeholder="Search name, code, location…"
            />
            <Select className="!w-auto" value={(query.type as string) ?? ''} onChange={(e) => setParam('type', e.target.value)}>
              <option value="">All types</option>
              {TEAM_TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </Select>
            <Select
              className="!w-auto"
              value={(query.is_active as string) ?? ''}
              onChange={(e) => setParam('is_active', e.target.value)}
            >
              <option value="">All statuses</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </Select>
          </>
        ) : (
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <Checkbox
              checked={query.include_inactive === 'true'}
              onChange={(e) => setParam('include_inactive', e.target.checked ? 'true' : '')}
            />
            Show inactive teams
          </label>
        )}
      </FilterBar>

      {view === 'list' ? (
        <DataTable
          columns={columns}
          rows={list.data?.data}
          rowKey={(t) => t._id}
          loading={list.isLoading || list.isFetching}
          error={list.isError}
          errorMessage={list.isError ? parseApiError(list.error).message : undefined}
          onRetry={list.refetch}
          emptyTitle="No teams found"
          emptyDescription="Try a different filter, or create the first team."
          sortBy={query.sort_by}
          sortOrder={query.sort_order}
          onSort={onSort}
          pagination={list.data?.pagination}
          onPageChange={(p) => setParam('page', p)}
          onPageSizeChange={(s) => setParam('page_size', s)}
          onRowClick={(t) => navigate(`/app/admin/teams/${t._id}`)}
        />
      ) : (
        <TeamTree
          nodes={tree.data?.data}
          loading={tree.isLoading || tree.isFetching}
          error={tree.isError ? parseApiError(tree.error).message : undefined}
          onRetry={tree.refetch}
        />
      )}

      <TeamFormDrawer
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={(t) => navigate(`/app/admin/teams/${t._id}`)}
      />
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={onDeactivate}
        title="Deactivate team"
        message={`Deactivate ${confirm?.name}? This is only allowed once it has no active members or sub-teams.`}
        confirmLabel="Deactivate"
        danger
        loading={deleting}
      />
    </>
  )
}
