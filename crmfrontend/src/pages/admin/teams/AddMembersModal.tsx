import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useAddTeamMembersMutation, useTeamOptionsQuery, useUserOptionsQuery } from '../../../services/adminApi'
import { Modal } from '../../../components/ui/Modal'
import { Button } from '../../../components/ui/Button'
import { Checkbox, Input } from '../../../components/ui/fields'
import { EmptyState, Skeleton } from '../../../components/ui/feedback'
import { cn, initials, parseApiError } from '../../../lib/utils'
import type { Team } from '../../../types/models'

const teamIdOf = (team: unknown) =>
  team && typeof team === 'object' ? (team as { _id: string })._id : ((team as string | null | undefined) ?? '')

export function AddMembersModal({ open, onClose, team }: { open: boolean; onClose: () => void; team: Team }) {
  const { data: users, isLoading } = useUserOptionsQuery(undefined, { skip: !open })
  const { data: teams } = useTeamOptionsQuery(undefined, { skip: !open })
  const [addMembers, { isLoading: saving }] = useAddTeamMembersMutation()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [setManager, setSetManager] = useState(true)

  const teamName = useMemo(() => new Map(teams?.data.map((t) => [t._id, t.name])), [teams])

  const candidates = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (users?.data ?? [])
      .filter((u) => teamIdOf(u.team) !== team._id)
      .filter((u) => !term || u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term))
  }, [users, search, team._id])

  const moving = candidates.filter((u) => selected.has(u._id) && teamIdOf(u.team)).length

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const close = () => {
    setSelected(new Set())
    setSearch('')
    onClose()
  }

  const onSubmit = async () => {
    try {
      const res = await addMembers({
        id: team._id,
        userIds: [...selected],
        setReportingManager: !!team.manager && setManager,
      }).unwrap()
      toast.success(res.message)
      close()
    } catch (err) {
      toast.error(parseApiError(err).message)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title={`Add members to ${team.name}`}
      description="Users already in another team are moved here — a user belongs to one team at a time."
      footer={
        <>
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={!selected.size} loading={saving}>
            Add {selected.size || ''} member{selected.size === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <Input
        autoFocus
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or email…"
        className="mb-3"
      />

      <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200">
        {isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
        ) : !candidates.length ? (
          <EmptyState title="No users to add" description={search ? 'No active user matches that search.' : 'Every active user is already in this team.'} />
        ) : (
          candidates.map((u) => {
            const current = teamIdOf(u.team)
            const on = selected.has(u._id)
            return (
              <label
                key={u._id}
                className={cn(
                  'flex cursor-pointer items-center gap-3 border-b border-slate-100 px-3 py-2 last:border-0',
                  on ? 'bg-brand-50/60' : 'hover:bg-slate-50'
                )}
              >
                <Checkbox checked={on} onChange={() => toggle(u._id)} />
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">
                  {initials(u.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-800">{u.name}</span>
                  <span className="block truncate text-[11px] text-slate-500">
                    {u.email}
                    {u.designation ? ` · ${u.designation}` : ''}
                  </span>
                </span>
                <span className={cn('shrink-0 text-[11px]', current ? 'text-amber-700' : 'text-slate-400')}>
                  {current ? `In ${teamName.get(current) ?? 'another team'}` : 'No team'}
                </span>
              </label>
            )
          })
        )}
      </div>

      {moving > 0 && (
        <p className="mt-2 text-[11px] text-amber-700">
          {moving} selected user{moving === 1 ? ' is' : 's are'} currently in another team and will be moved.
        </p>
      )}
      {team.manager && (
        <label className="mt-3 flex items-center gap-2 text-xs text-slate-700">
          <Checkbox checked={setManager} onChange={(e) => setSetManager(e.target.checked)} />
          Set <b>{team.manager.name}</b> as their reporting manager
        </label>
      )}
    </Modal>
  )
}
