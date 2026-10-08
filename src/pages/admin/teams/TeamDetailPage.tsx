import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronRight,
  MapPin,
  Network,
  PauseCircle,
  Pencil,
  Plus,
  Power,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  useDeleteTeamMutation,
  useGetTeamQuery,
  useRemoveTeamMemberMutation,
  useTeamStatsQuery,
  useUpdateTeamMutation,
} from '../../../services/adminApi'
import { useCurrentUser } from '../../../app/hooks'
import { can } from '../../../constants/permissions'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Checkbox } from '../../../components/ui/fields'
import { ConfirmDialog, EmptyState, ErrorState, Skeleton } from '../../../components/ui/feedback'
import { DataTable, type Column } from '../../../components/ui/DataTable'
import { Tabs } from '../../../components/ui/misc'
import { formatDate, formatDateTime, initials, parseApiError, timeAgo } from '../../../lib/utils'
import type { Team, TeamMember, TeamStats } from '../../../types/models'
import { TeamFormDrawer } from './TeamFormDrawer'
import { AddMembersModal } from './AddMembersModal'
import { TeamTypeBadge } from './TeamTypeBadge'
import { allowedChildTypes } from './teamMeta'

type MemberStat = TeamStats['byMember'][number]
type SubTeam = NonNullable<Team['children']>[number]

function StatTile({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-slate-800">{value}</p>
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  )
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-xs">
      <span className="shrink-0 text-slate-400">{label}</span>
      <span className="text-right font-medium text-slate-700">{children}</span>
    </div>
  )
}

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '—')

export default function TeamDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const me = useCurrentUser()
  const [tab, setTab] = useState('members')
  const [includeSubTeams, setIncludeSubTeams] = useState(false)
  const [form, setForm] = useState<{ open: boolean; mode?: 'edit' | 'sub' }>({ open: false })
  const [addOpen, setAddOpen] = useState(false)
  const [removing, setRemoving] = useState<TeamMember | null>(null)
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)

  const { data, isLoading, isError, error, refetch } = useGetTeamQuery(id, { skip: !id })
  const stats = useTeamStatsQuery({ id, include_sub_teams: includeSubTeams }, { skip: !id })
  const [removeMember, { isLoading: removingBusy }] = useRemoveTeamMemberMutation()
  const [deleteTeam, { isLoading: deactivating }] = useDeleteTeamMutation()
  const [updateTeam, { isLoading: reactivating }] = useUpdateTeamMutation()

  const team = data?.data
  const s = stats.data?.data
  const canEdit = can(me, 'teams', 'edit')
  const statsByUser = useMemo(() => new Map(s?.byMember.map((m) => [m.user._id, m])), [s])

  if (isError) {
    return (
      <>
        <Button variant="ghost" size="sm" onClick={() => navigate('/app/admin/teams')}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back to teams
        </Button>
        <ErrorState message={parseApiError(error).message} onRetry={refetch} />
      </>
    )
  }

  const onRemove = async () => {
    if (!removing || !team) return
    try {
      const res = await removeMember({ id: team._id, userId: removing._id }).unwrap()
      toast.success(res.message)
      setRemoving(null)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  const onDeactivate = async () => {
    if (!team) return
    try {
      await deleteTeam(team._id).unwrap()
      toast.success('Team deactivated')
      setConfirmDeactivate(false)
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  const onReactivate = async () => {
    if (!team) return
    try {
      await updateTeam({ id: team._id, body: { isActive: true } }).unwrap()
      toast.success('Team reactivated')
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  const memberColumns: Column<TeamMember>[] = [
    {
      key: 'name',
      header: 'Member',
      render: (m) => (
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-semibold text-brand-700">
            {initials(m.name)}
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-medium text-slate-800">
              {m.name}
              {team?.manager?._id === m._id && <Badge tone="violet">Manager</Badge>}
              {!m.isActive && <Badge>Inactive</Badge>}
            </p>
            <p className="truncate text-[11px] text-slate-500">{m.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'designation', header: 'Designation', render: (m) => <span className="text-xs">{m.designation || '—'}</span> },
    { key: 'reportingManager', header: 'Reports to', render: (m) => <span className="text-xs">{m.reportingManager?.name ?? '—'}</span> },
    {
      key: 'receivesLeads',
      header: 'Round-robin',
      render: (m) =>
        m.receivesLeads ? (
          team?.receivesLeads === false ? (
            <Badge tone="amber">Paused by team</Badge>
          ) : (
            <Badge tone="green">Receives leads</Badge>
          )
        ) : (
          <span className="text-xs text-slate-400">No</span>
        ),
    },
    {
      key: 'leads',
      header: 'Open / total leads',
      render: (m) => {
        const st = statsByUser.get(m._id)
        return (
          <span className="text-xs tabular-nums">
            {st ? (
              <>
                <b className="text-slate-800">{st.active}</b> / {st.total}
              </>
            ) : (
              '—'
            )}
          </span>
        )
      },
    },
    { key: 'lastLoginAt', header: 'Last login', render: (m) => <span className="text-xs text-slate-500">{m.lastLoginAt ? timeAgo(m.lastLoginAt) : 'Never'}</span> },
    {
      key: 'actions',
      header: '',
      className: 'text-right',
      render: (m) =>
        canEdit && (
          <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setRemoving(m)}>
            <UserMinus className="h-3.5 w-3.5" /> Remove
          </Button>
        ),
    },
  ]

  const subTeamColumns: Column<SubTeam>[] = [
    {
      key: 'name',
      header: 'Sub-team',
      render: (c) => (
        <p className="font-medium text-slate-800">
          {c.name}
          {c.code && <span className="ml-1.5 text-[11px] font-normal text-slate-400">{c.code}</span>}
        </p>
      ),
    },
    { key: 'type', header: 'Type', render: (c) => <TeamTypeBadge type={c.type} /> },
    { key: 'manager', header: 'Manager', render: (c) => <span className="text-xs">{c.manager?.name ?? '—'}</span> },
    { key: 'location', header: 'Location', render: (c) => <span className="text-xs">{c.location || '—'}</span> },
    { key: 'memberCount', header: 'Members', render: (c) => <span className="text-xs tabular-nums">{c.memberCount}</span> },
    {
      key: 'isActive',
      header: 'Status',
      render: (c) => <Badge tone={c.isActive ? 'green' : 'slate'}>{c.isActive ? 'Active' : 'Inactive'}</Badge>,
    },
  ]

  const performanceColumns: Column<MemberStat>[] = [
    {
      key: 'user',
      header: 'Member',
      render: (m) => (
        <div>
          <p className="font-medium text-slate-800">
            {m.user.name} {!m.user.isActive && <Badge>Inactive</Badge>}
          </p>
          <p className="text-[11px] text-slate-500">
            {m.user.designation || '—'}
            {includeSubTeams && m.user.team ? ` · ${m.user.team.name}` : ''}
          </p>
        </div>
      ),
    },
    { key: 'total', header: 'Total', className: 'text-right', render: (m) => <span className="tabular-nums">{m.total}</span> },
    { key: 'active', header: 'Open', className: 'text-right', render: (m) => <span className="tabular-nums">{m.active}</span> },
    {
      key: 'converted',
      header: 'Converted',
      className: 'text-right',
      render: (m) => <span className="tabular-nums text-emerald-700">{m.converted}</span>,
    },
    { key: 'lost', header: 'Lost', className: 'text-right', render: (m) => <span className="tabular-nums text-red-600">{m.lost}</span> },
    {
      key: 'assignedThisWeek',
      header: 'Assigned (7d)',
      className: 'text-right',
      render: (m) => <span className="tabular-nums">{m.assignedThisWeek}</span>,
    },
    {
      key: 'rate',
      header: 'Conversion',
      className: 'text-right',
      render: (m) => <span className="tabular-nums">{pct(m.converted, m.converted + m.lost)}</span>,
    },
  ]

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-1 text-xs text-slate-500">
        <Button variant="ghost" size="sm" onClick={() => navigate('/app/admin/teams')}>
          <ArrowLeft className="h-3.5 w-3.5" /> Teams
        </Button>
        {team?.ancestors?.map((a) => (
          <span key={a._id} className="inline-flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
            <Link to={`/app/admin/teams/${a._id}`} className="hover:text-brand-700">
              {a.name}
            </Link>
          </span>
        ))}
        {team && (
          <span className="inline-flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
            <span className="font-medium text-slate-700">{team.name}</span>
          </span>
        )}
      </div>

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {isLoading || !team ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-80" />
          </div>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                <Network className="h-6 w-6" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-semibold text-slate-800">{team.name}</h1>
                  {team.code && <span className="text-xs text-slate-400">{team.code}</span>}
                  <TeamTypeBadge type={team.type} />
                  <Badge tone={team.isActive ? 'green' : 'slate'}>{team.isActive ? 'Active' : 'Inactive'}</Badge>
                  {team.isActive && team.receivesLeads === false && (
                    <Badge tone="amber">
                      <PauseCircle className="h-3 w-3" /> Lead distribution paused
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>
                    Manager: <b className="text-slate-700">{team.manager?.name ?? 'Not set'}</b>
                  </span>
                  {team.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {team.location}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3 w-3" /> {team.memberCount ?? 0} active member{team.memberCount === 1 ? '' : 's'}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canEdit && team.isActive && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
                    <UserPlus className="h-3.5 w-3.5" /> Add members
                  </Button>
                  {can(me, 'teams', 'create') && allowedChildTypes(team.type).length > 0 && (
                    <Button variant="outline" size="sm" onClick={() => setForm({ open: true, mode: 'sub' })}>
                      <Plus className="h-3.5 w-3.5" /> Sub-team
                    </Button>
                  )}
                </>
              )}
              {canEdit && (
                <Button variant="outline" size="sm" onClick={() => setForm({ open: true, mode: 'edit' })}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              )}
              {team.isActive
                ? can(me, 'teams', 'delete') && (
                    <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setConfirmDeactivate(true)}>
                      <Power className="h-3.5 w-3.5" /> Deactivate
                    </Button>
                  )
                : canEdit && (
                    <Button variant="secondary" size="sm" onClick={onReactivate} loading={reactivating}>
                      <Power className="h-3.5 w-3.5" /> Reactivate
                    </Button>
                  )}
            </div>
          </div>
        )}
      </div>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lead workload</p>
        {!!team?.children?.length && (
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <Checkbox checked={includeSubTeams} onChange={(e) => setIncludeSubTeams(e.target.checked)} />
            Include sub-teams
            {includeSubTeams && s && <span className="text-slate-400">({s.teamCount} teams)</span>}
          </label>
        )}
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.isLoading || !s ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[74px] rounded-xl" />)
        ) : (
          <>
            <StatTile label="Members" value={s.totals.members} hint={`${s.totals.receivingLeads} receiving leads`} />
            <StatTile label="Leads owned" value={s.totals.total} />
            <StatTile label="Open" value={s.totals.active} />
            <StatTile label="Converted" value={s.totals.converted} hint={`${s.totals.lost} lost`} />
            <StatTile
              label="Conversion"
              value={s.totals.conversionRate === null ? '—' : `${s.totals.conversionRate}%`}
              hint="converted ÷ closed"
            />
            <StatTile label="Assigned (7d)" value={s.totals.assignedThisWeek} />
          </>
        )}
      </div>

      <Tabs
        tabs={[
          { key: 'members', label: 'Members', count: team?.members?.length },
          { key: 'subteams', label: 'Sub-teams', count: team?.children?.length },
          { key: 'performance', label: 'Performance' },
          { key: 'details', label: 'Details' },
        ]}
        active={tab}
        onChange={setTab}
      />

      <div className="mt-4">
        {tab === 'members' && (
          <DataTable
            columns={memberColumns}
            rows={team?.members}
            rowKey={(m) => m._id}
            loading={isLoading}
            emptyTitle="No members yet"
            emptyDescription={canEdit ? 'Use “Add members” to bring users into this team.' : undefined}
          />
        )}

        {tab === 'subteams' && (
          <DataTable
            columns={subTeamColumns}
            rows={team?.children}
            rowKey={(c) => c._id}
            loading={isLoading}
            emptyTitle="No sub-teams"
            emptyDescription="Add counsellor groups or teams under this unit to build the hierarchy."
            onRowClick={(c) => navigate(`/app/admin/teams/${c._id}`)}
          />
        )}

        {tab === 'performance' && (
          <DataTable
            columns={performanceColumns}
            rows={s?.byMember}
            rowKey={(m) => m.user._id}
            loading={stats.isLoading || stats.isFetching}
            error={stats.isError}
            errorMessage={stats.isError ? parseApiError(stats.error).message : undefined}
            onRetry={stats.refetch}
            emptyTitle="No members to report on"
          />
        )}

        {tab === 'details' && team && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Structure</h3>
              <DetailRow label="Type">
                <TeamTypeBadge type={team.type} />
              </DetailRow>
              <DetailRow label="Reports into">
                {team.parent ? (
                  <Link to={`/app/admin/teams/${team.parent._id}`} className="text-brand-700 hover:underline">
                    {team.parent.name}
                  </Link>
                ) : (
                  'Top level'
                )}
              </DetailRow>
              <DetailRow label="Manager">
                {team.manager ? `${team.manager.name}${team.manager.email ? ` (${team.manager.email})` : ''}` : '—'}
              </DetailRow>
              <DetailRow label="Location">{team.location || '—'}</DetailRow>
              <DetailRow label="Lead distribution">{team.receivesLeads === false ? 'Paused' : 'On'}</DetailRow>
              <DetailRow label="Programs">
                {team.programs?.length ? (
                  <span className="flex flex-wrap justify-end gap-1">
                    {team.programs.map((p) => (
                      <Badge key={p._id} tone="blue">
                        {p.name}
                      </Badge>
                    ))}
                  </span>
                ) : (
                  'All programs'
                )}
              </DetailRow>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">About</h3>
              {team.description ? (
                <p className="mb-2 whitespace-pre-line text-sm text-slate-700">{team.description}</p>
              ) : (
                <EmptyState title="No description" />
              )}
              <DetailRow label="Created">{formatDateTime(team.createdAt)}</DetailRow>
              <DetailRow label="Created by">{team.createdBy?.name ?? '—'}</DetailRow>
              <DetailRow label="Last updated">{formatDate(team.updatedAt)}</DetailRow>
            </div>
          </div>
        )}
      </div>

      {team && (
        <>
          <TeamFormDrawer
            open={form.open}
            onClose={() => setForm({ open: false })}
            team={form.mode === 'edit' ? team : undefined}
            defaultParent={form.mode === 'sub' ? team._id : undefined}
            onSaved={(t) => form.mode === 'sub' && navigate(`/app/admin/teams/${t._id}`)}
          />
          <AddMembersModal open={addOpen} onClose={() => setAddOpen(false)} team={team} />
        </>
      )}
      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={onRemove}
        title="Remove member"
        message={`Remove ${removing?.name} from ${team?.name}? They keep their leads and login, but team-scoped access through this team ends.`}
        confirmLabel="Remove"
        danger
        loading={removingBusy}
      />
      <ConfirmDialog
        open={confirmDeactivate}
        onClose={() => setConfirmDeactivate(false)}
        onConfirm={onDeactivate}
        title="Deactivate team"
        message={`Deactivate ${team?.name}? This is only allowed once it has no active members or sub-teams.`}
        confirmLabel="Deactivate"
        danger
        loading={deactivating}
      />
    </>
  )
}
