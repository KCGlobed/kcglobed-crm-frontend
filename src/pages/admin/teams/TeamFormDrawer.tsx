import { useEffect, useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  useCreateTeamMutation,
  useTeamTreeQuery,
  useUpdateTeamMutation,
  useUserOptionsQuery,
} from '../../../services/adminApi'
import { useMasterBootstrapQuery } from '../../../services/mastersApi'
import { Drawer } from '../../../components/ui/Drawer'
import { Button } from '../../../components/ui/Button'
import { Checkbox, FormField, Input, Select, Textarea } from '../../../components/ui/fields'
import { cn, parseApiError } from '../../../lib/utils'
import type { Team, TeamTreeNode } from '../../../types/models'
import { TEAM_TYPES, TEAM_TYPE_LABEL } from './teamMeta'

const schema = z.object({
  name: z.string().trim().min(2, 'Team name is required').max(100),
  code: z
    .string()
    .max(20, 'Code must be 20 characters or fewer')
    .regex(/^[A-Za-z0-9_-]*$/, 'Letters, numbers, dashes and underscores only'),
  type: z.enum(['department', 'team', 'counsellor_group']),
  parent: z.string(),
  manager: z.string(),
  location: z.string().max(100),
  programs: z.array(z.string()),
  receivesLeads: z.boolean(),
  isActive: z.boolean(),
  description: z.string().max(500),
})
type FormValues = z.infer<typeof schema>

const EMPTY: FormValues = {
  name: '',
  code: '',
  type: 'team',
  parent: '',
  manager: '',
  location: '',
  programs: [],
  receivesLeads: true,
  isActive: true,
  description: '',
}

/** Flattens the org tree into indented options, leaving out `excludeId` and everything under it. */
function parentOptions(nodes: TeamTreeNode[], excludeId?: string, depth = 0): { node: TeamTreeNode; depth: number }[] {
  return nodes.flatMap((n) =>
    n._id === excludeId ? [] : [{ node: n, depth }, ...parentOptions(n.children, excludeId, depth + 1)]
  )
}

interface Props {
  open: boolean
  onClose: () => void
  team?: Team
  /** pre-selects the parent when adding a sub-team */
  defaultParent?: string
  onSaved?: (team: Team) => void
}

export function TeamFormDrawer({ open, onClose, team, defaultParent, onSaved }: Props) {
  const { data: tree } = useTeamTreeQuery({}, { skip: !open })
  const { data: users } = useUserOptionsQuery(undefined, { skip: !open })
  const { data: masters } = useMasterBootstrapQuery(undefined, { skip: !open })
  const [createTeam, { isLoading: creating }] = useCreateTeamMutation()
  const [updateTeam, { isLoading: updating }] = useUpdateTeamMutation()

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY })

  useEffect(() => {
    if (!open) return
    reset(
      team
        ? {
            name: team.name,
            code: team.code ?? '',
            type: team.type ?? 'team',
            parent: team.parent?._id ?? '',
            manager: team.manager?._id ?? '',
            location: team.location ?? '',
            programs: team.programs?.map((p) => p._id) ?? [],
            receivesLeads: team.receivesLeads ?? true,
            isActive: team.isActive,
            description: team.description ?? '',
          }
        : { ...EMPTY, parent: defaultParent ?? '', type: defaultParent ? 'counsellor_group' : 'team' }
    )
  }, [open, team, defaultParent, reset])

  const parents = useMemo(() => parentOptions(tree?.data ?? [], team?._id), [tree, team?._id])

  const onSubmit = async (v: FormValues) => {
    const body = {
      name: v.name,
      code: v.code || null,
      type: v.type,
      parent: v.parent || null,
      manager: v.manager || null,
      location: v.location || null,
      programs: v.programs,
      receivesLeads: v.receivesLeads,
      description: v.description || null,
      ...(team ? { isActive: v.isActive } : {}),
    }
    try {
      const res = team
        ? await updateTeam({ id: team._id, body }).unwrap()
        : await createTeam(body).unwrap()
      toast.success(team ? 'Team updated' : 'Team created')
      onSaved?.(res.data)
      onClose()
    } catch (err) {
      const { message, errors: fe } = parseApiError(err)
      Object.entries(fe).forEach(([f, m]) => f in schema.shape && setError(f as keyof FormValues, { message: m }))
      toast.error(message)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={team ? `Edit ${team.name}` : defaultParent ? 'Add sub-team' : 'Create team'}
      description="Team data scope, dashboards and lead distribution follow this hierarchy"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} loading={creating || updating}>
            {team ? 'Save changes' : 'Create'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FormField label="Name" error={errors.name?.message} required className="sm:col-span-2">
            <Input aria-invalid={!!errors.name} placeholder="e.g. Admissions Team Mumbai" {...register('name')} />
          </FormField>
          <FormField label="Code" error={errors.code?.message} hint="Optional, unique">
            <Input aria-invalid={!!errors.code} className="uppercase" placeholder="ADM-MUM" {...register('code')} />
          </FormField>
        </section>

        <FormField label="Type">
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {TEAM_TYPES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => field.onChange(t.key)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-left transition-colors',
                      field.value === t.key
                        ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
                        : 'border-slate-200 hover:border-slate-300'
                    )}
                  >
                    <p className="text-xs font-semibold text-slate-700">{t.label}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{t.hint}</p>
                  </button>
                ))}
              </div>
            )}
          />
        </FormField>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Reports into" error={errors.parent?.message} hint="Leave empty for a top-level unit">
            <Select aria-invalid={!!errors.parent} {...register('parent')}>
              <option value="">None (top level)</option>
              {parents.map(({ node, depth }) => (
                <option key={node._id} value={node._id}>
                  {'  '.repeat(depth * 2)}
                  {depth > 0 ? '└ ' : ''}
                  {node.name} · {TEAM_TYPE_LABEL[node.type ?? 'team']}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Manager / team leader" error={errors.manager?.message}>
            <Select aria-invalid={!!errors.manager} {...register('manager')}>
              <option value="">No manager</option>
              {users?.data.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name}
                  {u.designation ? ` — ${u.designation}` : ''}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Location" error={errors.location?.message}>
            <Input placeholder="e.g. Mumbai" {...register('location')} />
          </FormField>
        </section>

        <FormField label="Programs handled" error={errors.programs?.message} hint="Used for program-based routing and reporting">
          <Controller
            control={control}
            name="programs"
            render={({ field }) => {
              const programs = masters?.data.programs ?? []
              if (!programs.length) return <p className="text-xs text-slate-400">No active programs in Masters yet.</p>
              const toggle = (id: string) =>
                field.onChange(field.value.includes(id) ? field.value.filter((p) => p !== id) : [...field.value, id])
              return (
                <div className="flex flex-wrap gap-1.5">
                  {programs.map((p) => {
                    const on = field.value.includes(p._id)
                    return (
                      <button
                        key={p._id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggle(p._id)}
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-xs transition-colors',
                          on
                            ? 'border-brand-500 bg-brand-50 font-medium text-brand-700'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        )}
                      >
                        {p.name}
                      </button>
                    )
                  })}
                </div>
              )
            }}
          />
        </FormField>

        <section className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          <label className="flex items-start gap-2 text-xs text-slate-700">
            <Checkbox className="mt-0.5" {...register('receivesLeads')} />
            <span>
              <span className="font-medium">Include this team in lead distribution</span>
              <span className="block text-[11px] text-slate-500">
                When off, members are skipped by round-robin even if their own “receives leads” box is ticked.
              </span>
            </span>
          </label>
          {team && (
            <label className="flex items-start gap-2 text-xs text-slate-700">
              <Checkbox className="mt-0.5" {...register('isActive')} />
              <span>
                <span className="font-medium">Active</span>
                <span className="block text-[11px] text-slate-500">
                  A team can only be deactivated once it has no active members or sub-teams.
                </span>
              </span>
            </label>
          )}
        </section>

        <FormField label="Description" error={errors.description?.message}>
          <Textarea rows={3} placeholder="What this team is responsible for" {...register('description')} />
        </FormField>
      </form>
    </Drawer>
  )
}
